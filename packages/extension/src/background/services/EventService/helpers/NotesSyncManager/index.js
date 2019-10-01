import {
    warnLog,
    errorLog,
} from '~utils/log';
import Web3Service from '../../../Web3Service';
import fetchNotes from '../../utils/fetchNotes';
import saveNotes from '../../utils/saveNotes';
import saveNotesAccess from '../../utils/saveNotesAccess';
import {
    syncedAssets,
} from '../../utils/asset';
import AssetsSyncManagerFactory from '../AssetsSyncManager/factory';

/* See more details about limitation
 * https://infura.io/docs/ethereum/json-rpc/eth_getLogs
*/
const infuraLimitError = {
    code: -32005,
    message: 'query returned more than 10000 results',
};

const assetsSyncManager = networkId => AssetsSyncManagerFactory.create(networkId);

class SyncManager {
    constructor() {
        this.config = {
            syncInterval: 5000, // ms
            blocksPerRequest: 540000, // ~ per 3 months (~6000 per day)
            precisionDelta: 10, //
        };
        this.addresses = new Map();
        this.paused = false;
        this.progressSubscriber = null;
    }

    setConfig(config) {
        Object.keys(this.config)
            .forEach((key) => {
                if (config[key] !== undefined) {
                    this.config[key] = config[key];
                }
            });
    }

    isInQueue(address) {
        const syncAddress = this.addresses.get(address);
        return !!(syncAddress
            && (syncAddress.syncing || syncAddress.syncReq)
        );
    }

    handleFetchError = (error) => {
        errorLog('Failed to sync CreateNote / UpdateMetadata / DestroyNote with web3.', error);
        if (process.env.NODE_ENV === 'development') {
            this.paused = true;
        }
    };

    pause = (address, prevState = {}) => {
        const syncAddress = this.addresses.get(address);
        if (!syncAddress) {
            warnLog(`NotesSyncManager syncing with "${address}" eth address is not in process.`);
            return;
        }

        this.addresses.set(address, {
            ...syncAddress,
            pausedState: prevState,
        });
    };

    syncProgress = async (address) => {
        const syncAddress = this.addresses.get(address);
        if (!syncAddress) {
            warnLog(`NotesSyncManager syncing with "${address}" eth address is not in process.`);
            return null;
        }
        const {
            lastSyncedBlock,
            networkId,
        } = syncAddress;

        const blocks = await Web3Service(networkId).eth.getBlockNumber();

        return {
            blocks,
            lastSyncedBlock,
        };
    };

    setProgressCallback = (callback) => {
        this.progressSubscriber = callback;
    };

    resume = (address) => {
        const syncAddress = this.addresses.get(address);
        if (!syncAddress) {
            warnLog(`NotesSyncManager syncing with "${address}" eth address is not in process.`);
            return;
        }

        const {
            pausedState,
        } = syncAddress;
        if (!pausedState) {
            warnLog(`NotesSyncManager with ${address} eth address is already running.`);
            return;
        }

        this.addresses.set(address, {
            ...syncAddress,
            pausedState: null,
        });

        this.syncNotes({
            ...pausedState,
            address,
        });
    };

    async syncNotes(options) {
        const {
            address,
            lastSyncedBlock,
            networkId,
        } = options;

        const syncAddress = this.addresses.get(address);
        if (syncAddress.pausedState) {
            return;
        }
        if (this.paused) {
            this.pause(address, options);
            return;
        }

        this.addresses.set(address, {
            ...syncAddress,
            syncing: true,
            syncReq: null,
        });

        const {
            syncReq: prevSyncReq,
        } = syncAddress;

        if (prevSyncReq) {
            clearTimeout(prevSyncReq);
        }

        const {
            syncInterval,
            precisionDelta,
            blocksPerRequest,
        } = this.config;

        const assetsManager = assetsSyncManager(networkId);
        const currentBlock = assetsManager.lastSyncedBlock();
        const fromAssets = (await syncedAssets(networkId))
            .map(({ registryOwner }) => registryOwner);

        let newLastSyncedBlock = lastSyncedBlock;

        if (currentBlock > lastSyncedBlock) {
            const fromBlock = lastSyncedBlock + 1;
            const toBlock = Math.min(fromBlock + blocksPerRequest, currentBlock);
            let shouldLoadNextPortion = currentBlock - fromBlock > precisionDelta;

            const {
                error,
                groupedNotes,
            } = await fetchNotes({
                owner: address,
                fromBlock,
                toBlock,
                fromAssets,
                networkId,
            });

            if (groupedNotes) {
                const promises = [
                    saveNotes(groupedNotes, networkId),
                    saveNotesAccess(groupedNotes, networkId),
                ];
                await Promise.all(promises);

                newLastSyncedBlock = toBlock;

                if (this.progressSubscriber) {
                    this.progressSubscriber({
                        blocks: currentBlock,
                        lastSyncedBlock: newLastSyncedBlock,
                    });
                }
            } else if (error && error.code === infuraLimitError.code) {
                this.config = {
                    ...this.config,
                    blocksPerRequest: blocksPerRequest / 2,
                };
                shouldLoadNextPortion = true;
            } else {
                this.handleFetchError(error);
            }

            if (shouldLoadNextPortion) {
                this.addresses.set(address, {
                    ...syncAddress,
                    lastSyncedBlock: newLastSyncedBlock,
                });

                await this.syncNotes({
                    ...options,
                    lastSyncedBlock: newLastSyncedBlock,
                });
                return;
            }
        }

        const syncReq = setTimeout(() => {
            this.syncNotes({
                ...options,
                lastSyncedBlock: newLastSyncedBlock,
            });
        }, syncInterval);

        this.addresses.set(address, {
            ...syncAddress,
            syncing: false,
            syncReq,
            lastSyncedBlock: newLastSyncedBlock,
        });
    }

    async sync({
        address,
        lastSyncedBlock,
        networkId,
    }) {
        let syncAddress = this.addresses.get(address);
        if (!syncAddress) {
            syncAddress = {
                syncing: false,
                syncReq: null,
                lastSyncedBlock,
                networkId,
            };
            this.addresses.set(address, syncAddress);
        }
        return this.syncNotes({
            address,
            lastSyncedBlock,
            networkId,
        });
    }
}

export default SyncManager;