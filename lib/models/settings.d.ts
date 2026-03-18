/**
 * Settings model for managing LLM settings.
 *
 * Uses workspace config (.llm-assistant/config.json) for persistence.
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
    private _rootDir;
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
     * Set root directory for workspace config
     */
    setRootDir(rootDir: string): void;
    /**
     * Update settings
     */
    updateSettings(updates: Partial<LLMSettings>): void;
    /**
     * Load settings from workspace config (.llm-assistant/config.json)
     */
    loadSettings(): Promise<LLMSettings>;
    /**
     * Save settings to workspace config (.llm-assistant/config.json)
     * Also saves apiKey to server config_store
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