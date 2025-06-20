import { RemoteConfigFetch } from '@amplitude/analytics-remote-config';
import { BrowserConfig as IBrowserConfig, AutocaptureOptions, type ElementInteractionsOptions } from '@amplitude/analytics-core';
export interface AutocaptureOptionsRemoteConfig extends AutocaptureOptions {
    elementInteractions?: boolean | ElementInteractionsOptionsRemoteConfig;
}
export interface ElementInteractionsOptionsRemoteConfig extends ElementInteractionsOptions {
    /**
     * Related to pageUrlAllowlist but holds regex strings which will be initialized and appended to pageUrlAllowlist
     */
    pageUrlAllowlistRegex?: string[];
}
export type BrowserRemoteConfig = {
    browserSDK: {
        autocapture?: AutocaptureOptionsRemoteConfig | boolean;
    };
};
export declare class BrowserJoinedConfigGenerator {
    config: IBrowserConfig;
    remoteConfigFetch: RemoteConfigFetch<BrowserRemoteConfig> | undefined;
    constructor(localConfig: IBrowserConfig);
    initialize(): Promise<void>;
    generateJoinedConfig(): Promise<IBrowserConfig>;
}
export declare const createBrowserJoinedConfigGenerator: (localConfig: IBrowserConfig) => Promise<BrowserJoinedConfigGenerator>;
//# sourceMappingURL=joined-config.d.ts.map