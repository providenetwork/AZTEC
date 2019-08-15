import config from '~config/metadata';
import {
    ADDRESS_LENGTH,
    VIEWING_KEY_LENGTH,
} from '~config/constants';
import _addAccess from './_addAccess';
import _getAccess from './_getAccess';
import toString from './toString';

const arrayValues = [
    'addresses',
    'viewingKeys',
];

export default function constructor(metadataStr) {
    const metadata = {};
    let start = metadataStr.startsWith('0x')
        ? 2
        : 0;
    config.forEach(({
        name,
        length,
    }) => {
        const len = typeof length === 'number'
            ? length
            : parseInt(metadata[length], 16);
        metadata[name] = [
            arrayValues.indexOf(name) >= 0 ? '' : '0x',
            metadataStr.substr(start, len),
        ].join('');
        start += len;
    });

    const {
        addresses: addressStr,
        viewingKeys: viewingKeysStr,
    } = metadata;
    const addresses = [];
    const viewingKeys = [];
    const numberOfAccounts = addressStr.length / ADDRESS_LENGTH;
    for (let i = 0; i < numberOfAccounts; i += 1) {
        addresses.push(`0x${addressStr.substr(
            ADDRESS_LENGTH * i,
            ADDRESS_LENGTH,
        )}`);
        viewingKeys.push(`0x${viewingKeysStr.substr(
            VIEWING_KEY_LENGTH * i,
            VIEWING_KEY_LENGTH,
        )}`);
    }
    metadata.addresses = addresses;
    metadata.viewingKeys = viewingKeys;

    return {
        ...metadata,
        addAccess: (access) => {
            const {
                addresses: newAddresses,
                viewingKeys: newViewingKeys,
            } = _addAccess(metadata, access);

            newAddresses.forEach((a, i) => {
                if (addresses.indexOf(a) >= 0) return;

                addresses.push(a);
                viewingKeys.push(newViewingKeys[i]);
            });
        },
        getAccess: address => _getAccess(metadata, address),
        toString: () => toString(metadata),
    };
}