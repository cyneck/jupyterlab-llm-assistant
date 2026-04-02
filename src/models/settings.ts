/**
 * Settings model for managing LLM settings.
 *
 * Uses user-level config (~/.llm-assistant/config.json) for persistence.
 * Project-level overrides (.llm-assistant/config.json) are handled separately.
 */

import { Signal } from '@lumino/signaling';
import { LLMSettings, ConnectionTestResult, ModelsResponse } from './types';
import { LLMApiService } from '../services/api';

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: LLMSettings = {
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
  private _settings: LLMSettings;
  private _apiService: LLMApiService;

  /**
   * Signal emitted when settings change
   */
  readonly settingsChanged = new Signal<this, LLMSettings>(this);

  constructor(initialSettings?: Partial<LLMSettings>) {
    this._settings = { ...DEFAULT_SETTINGS, ...initialSettings };
    this._apiService = new LLMApiService();
  }

  /**
   * Get current settings
   */
  get settings(): LLMSettings {
    return { ...this._settings };
  }

  /**
   * Update settings locally (without persisting)
   */
  updateSettings(updates: Partial<LLMSettings>): void {
    this._settings = { ...this._settings, ...updates };
    this.settingsChanged.emit(this._settings);
  }

  /**
   * Load settings from user-level config (~/.llm-assistant/config.json)
   */
  async loadSettings(): Promise<LLMSettings> {
    try {
      const serverConfig = await this._apiService.getConfig();
      console.log('[SettingsModel] Loaded from server:', JSON.stringify(serverConfig, null, 2));
      // Only use systemPrompt if it's non-empty, otherwise keep DEFAULT_SETTINGS
      const effectiveSystemPrompt = serverConfig.systemPrompt || DEFAULT_SETTINGS.systemPrompt;
      this._settings = {
        ...DEFAULT_SETTINGS,
        ...serverConfig,
        systemPrompt: effectiveSystemPrompt,
        // Don't load apiKey from server (security - it returns empty string)
        apiKey: '',
      };
      console.log('[SettingsModel] Merged settings:', JSON.stringify(this._settings, null, 2));
      return this._settings;
    } catch (err) {
      console.error('Failed to load settings:', err);
      return this._settings;
    }
  }

  /**
   * Save settings to user-level config (~/.llm-assistant/config.json)
   */
  async saveSettings(settings: Partial<LLMSettings>): Promise<void> {
    try {
      // Don't save empty apiKey to avoid overwriting existing key on server
      const settingsToSave: Partial<LLMSettings> = {};
      for (const [key, value] of Object.entries(settings)) {
        if (key === 'apiKey' && (!value || value === '')) {
          // Skip empty apiKey to preserve existing key on server
          continue;
        }
        (settingsToSave as any)[key] = value;
      }

      await this._apiService.setConfig(settingsToSave);
      this._settings = { ...this._settings, ...settings };
      this.settingsChanged.emit(this._settings);
    } catch (err) {
      console.error('Failed to save settings:', err);
      throw err;
    }
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<ConnectionTestResult> {
    return this._apiService.testConnection();
  }

  /**
   * Get available models
   */
  async getModels(): Promise<ModelsResponse> {
    return this._apiService.getModels();
  }
}