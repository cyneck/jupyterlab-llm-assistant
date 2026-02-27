/**
 * Settings model for managing LLM settings.
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
   * Update settings
   */
  updateSettings(updates: Partial<LLMSettings>): void {
    this._settings = { ...this._settings, ...updates };
    this.settingsChanged.emit(this._settings);
  }

  /**
   * Load settings from server
   */
  async loadSettings(): Promise<LLMSettings> {
    try {
      const settings = await this._apiService.getConfig();
      this._settings = { ...DEFAULT_SETTINGS, ...settings };
      this.settingsChanged.emit(this._settings);
      return this._settings;
    } catch (err) {
      console.error('Failed to load settings:', err);
      return this._settings;
    }
  }

  /**
   * Save settings to server
   */
  async saveSettings(settings: Partial<LLMSettings>): Promise<void> {
    try {
      await this._apiService.setConfig(settings);
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