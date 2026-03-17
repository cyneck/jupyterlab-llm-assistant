/**
 * Settings model for managing LLM settings.
 *
 * Uses workspace config (.llm-assistant/config.json) for persistence.
 */
import { Signal } from '@lumino/signaling';
import { LLMApiService } from '../services/api';
/**
 * Default settings
 */
export const DEFAULT_SETTINGS = {
    apiEndpoint: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: 'You are a helpful AI coding assistant. Help users with programming questions, explain code, debug issues, and provide code examples. Be concise and accurate.',
    enableStreaming: true,
    enableVision: true,
};
/**
 * Settings model class
 */
export class SettingsModel {
    constructor(initialSettings) {
        this._rootDir = '';
        /**
         * Signal emitted when settings change
         */
        this.settingsChanged = new Signal(this);
        this._settings = { ...DEFAULT_SETTINGS, ...initialSettings };
        this._apiService = new LLMApiService();
    }
    /**
     * Get current settings
     */
    get settings() {
        return { ...this._settings };
    }
    /**
     * Set root directory for workspace config
     */
    setRootDir(rootDir) {
        this._rootDir = rootDir;
    }
    /**
     * Update settings
     */
    updateSettings(updates) {
        this._settings = { ...this._settings, ...updates };
        this.settingsChanged.emit(this._settings);
    }
    /**
     * Load settings from workspace config (.llm-assistant/config.json)
     */
    async loadSettings() {
        try {
            const wsConfig = await this._apiService.getWorkspaceConfig(this._rootDir);
            const wsSettings = wsConfig.config || {};
            // Merge with defaults and server config
            const serverConfig = await this._apiService.getConfig();
            this._settings = {
                ...DEFAULT_SETTINGS,
                ...serverConfig,
                ...wsSettings,
                // Preserve hasApiKey from server config
                hasApiKey: serverConfig.hasApiKey,
                // Don't load apiKey from workspace (security)
                apiKey: wsSettings.apiKey || '',
            };
            this.settingsChanged.emit(this._settings);
            return this._settings;
        }
        catch (err) {
            console.error('Failed to load settings:', err);
            return this._settings;
        }
    }
    /**
     * Save settings to workspace config (.llm-assistant/config.json)
     * Also saves apiKey to server config_store if present
     */
    async saveSettings(settings) {
        // Save apiKey to server config_store if provided
        if (settings.apiKey) {
            try {
                await this._apiService.setConfig({ apiKey: settings.apiKey });
            }
            catch (err) {
                console.error('Failed to save API key to server:', err);
            }
        }
        // Filter out sensitive fields and internal fields for workspace config
        const wsSettings = {};
        const allowedKeys = ['model', 'temperature', 'maxTokens', 'systemPrompt', 'enableStreaming', 'enableVision', 'apiEndpoint'];
        for (const key of allowedKeys) {
            if (key in settings) {
                wsSettings[key] = settings[key];
            }
        }
        try {
            await this._apiService.setWorkspaceConfig(wsSettings, this._rootDir);
            this._settings = { ...this._settings, ...settings };
            this.settingsChanged.emit(this._settings);
        }
        catch (err) {
            console.error('Failed to save settings:', err);
            throw err;
        }
    }
    /**
     * Test connection
     */
    async testConnection() {
        return this._apiService.testConnection();
    }
    /**
     * Get available models
     */
    async getModels() {
        return this._apiService.getModels();
    }
}
//# sourceMappingURL=settings.js.map