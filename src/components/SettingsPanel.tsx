/**
 * Settings panel component.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { LLMSettings, ConnectionTestResult } from '../models/types';

export interface SettingsPanelProps {
  settings: LLMSettings;
  onSettingsChange: (settings: Partial<LLMSettings>) => void;
  onClose: () => void;
  onTestConnection: () => Promise<ConnectionTestResult>;
  isTestingConnection: boolean;
}

/**
 * API Provider options with default endpoints
 */
const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
  { value: 'anthropic', label: 'Anthropic (Claude)', endpoint: 'https://api.anthropic.com/v1', defaultModel: 'claude-3-sonnet-20240229' },
  { value: 'ollama', label: 'Ollama (Local)', endpoint: 'http://localhost:11434/v1', defaultModel: 'llama3' },
  { value: 'deepseek', label: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  { value: 'qianwen', label: '阿里云通义千问', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-turbo' },
  { value: 'zhipu', label: '智谱AI', endpoint: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4' },
  { value: 'moonshot', label: 'Moonshot (月之暗面)', endpoint: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
  { value: 'siliconflow', label: 'SiliconFlow', endpoint: 'https://api.siliconflow.cn/v1', defaultModel: 'Qwen/Qwen2-7B-Instruct' },
  { value: 'custom', label: 'Custom (自定义)', endpoint: '', defaultModel: '' },
];

/**
 * Settings panel component
 */
export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsChange,
  onClose,
  onTestConnection,
  isTestingConnection,
}) => {
  // Find current provider based on endpoint
  const getCurrentProvider = () => {
    const provider = PROVIDER_OPTIONS.find(p => {
      if (p.value === 'custom') return false;
      return settings.apiEndpoint.includes(p.endpoint.replace('https://', '').replace('http://', '').split('/')[0]);
    });
    return provider || PROVIDER_OPTIONS.find(p => p.value === 'custom')!;
  };

  const [localSettings, setLocalSettings] = useState<LLMSettings>({
    ...settings,
    apiKey: settings.apiKey || '',
  });
  const [currentProvider, setCurrentProvider] = useState(getCurrentProvider());
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Update local settings when props change
  useEffect(() => {
    setLocalSettings({
      ...settings,
      apiKey: settings.apiKey || '',
    });
    setCurrentProvider(getCurrentProvider());
  }, [settings]);

  // Check for changes
  useEffect(() => {
    const changed = JSON.stringify(localSettings) !== JSON.stringify(settings);
    setHasChanges(changed);
  }, [localSettings, settings]);

  // Handle input change
  const handleChange = useCallback((key: keyof LLMSettings, value: string | number | boolean) => {
    setLocalSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Handle provider change
  const handleProviderChange = useCallback((providerValue: string) => {
    const provider = PROVIDER_OPTIONS.find(p => p.value === providerValue)!;
    setCurrentProvider(provider);

    if (provider.value === 'custom') {
      // Custom: keep current endpoint and model
      setLocalSettings((prev) => ({
        ...prev,
        apiEndpoint: prev.apiEndpoint,
        model: prev.model,
      }));
    } else {
      // Predefined provider: auto-fill endpoint and default model
      setLocalSettings((prev) => ({
        ...prev,
        apiEndpoint: provider.endpoint,
        model: provider.defaultModel,
      }));
    }
  }, []);

  // Handle model change
  const handleModelChange = useCallback((value: string) => {
    handleChange('model', value);
  }, [handleChange]);

  // Handle endpoint change
  const handleEndpointChange = useCallback((value: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      apiEndpoint: value,
    }));
    // If custom endpoint, mark as custom provider
    const isKnownProvider = PROVIDER_OPTIONS.some(p => p.value !== 'custom' && value.includes(p.endpoint.replace('https://', '').replace('http://', '').split('/')[0]));
    if (!isKnownProvider) {
      setCurrentProvider(PROVIDER_OPTIONS.find(p => p.value === 'custom')!);
    }
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    onSettingsChange(localSettings);
    setHasChanges(false);
  }, [localSettings, onSettingsChange]);

  // Handle test connection
  const handleTestConnection = useCallback(async () => {
    setTestResult(null);
    try {
      // First save the current settings to ensure test uses latest values
      await onSettingsChange(localSettings);
      setHasChanges(false);

      // Then test the connection
      const result = await onTestConnection();
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Connection test failed',
      });
    }
  }, [localSettings, onSettingsChange, onTestConnection]);

  // Check if API key is available
  const isApiKeyAvailable = localSettings.apiKey.trim().length > 0;

  return (
    <div className="llm-settings-panel">
      {/* Header */}
      <div className="llm-settings-header">
        <h3>Settings</h3>
        <button className="llm-close-btn" onClick={onClose} title="Close settings">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="llm-settings-content">
        {/* API Provider Section */}
        <div className="llm-settings-section">
          <h4 className="llm-section-title">API Provider</h4>

          {/* Provider Selection */}
          <div className="llm-settings-field">
            <label htmlFor="provider">Select Provider</label>
            <select
              id="provider"
              value={currentProvider.value}
              onChange={(e) => handleProviderChange(e.target.value)}
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* API Endpoint */}
          <div className="llm-settings-field">
            <label htmlFor="apiEndpoint">API Endpoint</label>
            <input
              id="apiEndpoint"
              type="text"
              value={localSettings.apiEndpoint}
              onChange={(e) => handleEndpointChange(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
            <p className="llm-settings-hint">
              The base URL for the API endpoint
            </p>
          </div>

          {/* API Key */}
          <div className="llm-settings-field">
            <label htmlFor="apiKey">API Key</label>
            <div className="llm-input-with-button">
              <input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                value={localSettings.apiKey}
                onChange={(e) => handleChange('apiKey', e.target.value)}
                placeholder={currentProvider.value === 'ollama' ? 'any-value (Ollama local no auth)' : 'sk-...'}
                className="llm-api-key-input"
              />
              <button
                className="llm-toggle-visibility-btn"
                onClick={() => setShowApiKey(!showApiKey)}
                title={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                  </svg>
                )}
              </button>
            </div>
            <p className="llm-settings-hint">
              {currentProvider.value === 'ollama'
                ? 'Ollama 本地部署无需认证，填写任意值即可'
                : 'Enter your API key'}
            </p>
          </div>
        </div>

        {/* Model Section */}
        <div className="llm-settings-section">
          <h4 className="llm-section-title">Model Configuration</h4>
          <div className="llm-settings-field">
            <label htmlFor="model">Model Name</label>
            <input
              id="model"
              type="text"
              value={localSettings.model}
              onChange={(e) => handleModelChange(e.target.value)}
              placeholder={currentProvider.defaultModel || 'e.g., gpt-4o, llama3, qwen-turbo'}
            />
            <p className="llm-settings-hint">
              Enter the model name supported by your API provider
            </p>
          </div>
        </div>

        {/* Generation Parameters */}
        <div className="llm-settings-section">
          <h4 className="llm-section-title">Generation Parameters</h4>

          {/* Temperature */}
          <div className="llm-settings-field">
            <label htmlFor="temperature">
              Temperature: <span className="llm-value">{localSettings.temperature}</span>
            </label>
            <input
              id="temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={localSettings.temperature}
              onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
            />
            <p className="llm-settings-hint">
              Higher values (0-2) produce more creative outputs
            </p>
          </div>

          {/* Max Tokens */}
          <div className="llm-settings-field">
            <label htmlFor="maxTokens">Max Tokens</label>
            <input
              id="maxTokens"
              type="number"
              min="1"
              max="128000"
              value={localSettings.maxTokens}
              onChange={(e) => handleChange('maxTokens', parseInt(e.target.value, 10))}
            />
            <p className="llm-settings-hint">
              Maximum number of tokens in the response
            </p>
          </div>
        </div>

        {/* System Prompt */}
        <div className="llm-settings-section">
          <h4 className="llm-section-title">System Prompt</h4>
          <div className="llm-settings-field">
            <textarea
              id="systemPrompt"
              value={localSettings.systemPrompt}
              onChange={(e) => handleChange('systemPrompt', e.target.value)}
              rows={4}
              placeholder="You are a helpful AI coding assistant..."
            />
            <p className="llm-settings-hint">
              Instructions that define the assistant's behavior
            </p>
          </div>
        </div>

        {/* Toggles */}
        <div className="llm-settings-section">
          <h4 className="llm-section-title">Features</h4>
          <div className="llm-settings-field llm-settings-toggle">
            <label>
              <input
                type="checkbox"
                checked={localSettings.enableStreaming}
                onChange={(e) => handleChange('enableStreaming', e.target.checked)}
              />
              <span>Enable streaming responses</span>
            </label>
            <p className="llm-settings-hint">
              Stream responses in real-time
            </p>
          </div>

          <div className="llm-settings-field llm-settings-toggle">
            <label>
              <input
                type="checkbox"
                checked={localSettings.enableVision}
                onChange={(e) => handleChange('enableVision', e.target.checked)}
              />
              <span>Enable image input (Vision)</span>
            </label>
            <p className="llm-settings-hint">
              Allow sending images to vision-capable models
            </p>
          </div>
        </div>

        {/* Test Connection */}
        <div className="llm-settings-section">
          <button
            className="llm-test-btn"
            onClick={handleTestConnection}
            disabled={isTestingConnection || !isApiKeyAvailable}
          >
            {isTestingConnection ? (
              <>
                <span className="llm-spinner"></span>
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </button>

          {testResult && (
            <div className={`llm-test-result ${testResult.success ? 'llm-test-success' : 'llm-test-error'}`}>
              {testResult.success ? (
                <p>✓ Connection successful! Model: {testResult.model}</p>
              ) : (
                <p>✗ Error: {testResult.error}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="llm-settings-footer">
        <button className="llm-cancel-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="llm-save-btn"
          onClick={handleSave}
          disabled={!hasChanges}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;