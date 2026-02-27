/**
 * Settings model for managing LLM settings.
 */
import { Signal } from '@lumino/signaling';
import { LLMSettings, ConnectionTestResult, ModelsResponse } from './types';
/**
 * Default settings
 */
export declare const DEFAULT_SETTINGS: LLMSettings;
/**
 * Settings model class
 */
export declare class SettingsModel {
    private _settings;
    private _apiService;
    /**
     * Signal emitted when settings change
     */
    readonly settingsChanged: Signal<this, LLMSettings>;
    constructor(initialSettings?: Partial<LLMSettings>);
    /**
     * Get current settings
     */
    get settings(): LLMSettings;
    /**
     * Update settings
     */
    updateSettings(updates: Partial<LLMSettings>): void;
    /**
     * Load settings from server
     */
    loadSettings(): Promise<LLMSettings>;
    /**
     * Save settings to server
     */
    saveSettings(settings: Partial<LLMSettings>): Promise<void>;
    /**
     * Test connection
     */
    testConnection(): Promise<ConnectionTestResult>;
    /**
     * Get available models
     */
    getModels(): Promise<ModelsResponse>;
}
//# sourceMappingURL=settings.d.ts.map