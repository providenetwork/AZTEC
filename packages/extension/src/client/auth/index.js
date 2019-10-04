import registerExtension from './registerExtension';
import registerDomain from './registerDomain';
import ApiError from '~client/utils/ApiError';

export const ensureExtensionInstalled = async () => {
    const account = await registerExtension() || {};

    if (!account || account.error) {
        throw new ApiError('account.not.registered');
    }

    return account;
};

export const ensureDomainRegistered = async () => {
    const response = await registerDomain();

    if (!response) {
        throw new ApiError('domain.not.registered');
    }

    return response;
};
