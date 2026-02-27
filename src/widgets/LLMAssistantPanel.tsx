/**
 * LLM Assistant sidebar panel widget.
 */

import { Panel, Widget } from '@lumino/widgets';
import { ReactWidget } from '@jupyterlab/apputils';
import { Signal } from '@lumino/signaling';
import { LLMSettings } from '../models/types';
import { ChatPanel } from '../components/ChatPanel';
import { SettingsModel } from '../models/settings';

/**
 * LLM Assistant sidebar panel
 */
export class LLMAssistantPanel extends Panel {
  /**
   * Signal emitted when settings change
   */
  readonly settingsChanged = new Signal<this, LLMSettings>(this);

  private _settingsModel: SettingsModel;

  /**
   * Create a new LLM Assistant panel
   */
  constructor() {
    super();
    this.addClass('llm-assistant-panel');

    this._settingsModel = new SettingsModel();

    // Create the main content widget
    const content = this._createContent();
    this.addWidget(content);
  }

  /**
   * Create the main content widget
   */
  private _createContent(): Widget {
    const content = ReactWidget.create(
      <ChatPanelWrapper
        settingsModel={this._settingsModel}
        onSettingsChange={(settings) => this.settingsChanged.emit(settings)}
      />
    );
    content.addClass('llm-assistant-content');
    return content;
  }

  /**
   * Get current settings
   */
  getSettings(): LLMSettings {
    return this._settingsModel.settings;
  }

  /**
   * Update settings
   */
  async updateSettings(settings: Partial<LLMSettings>): Promise<void> {
    await this._settingsModel.saveSettings(settings);
  }
}

/**
 * ChatPanel wrapper component
 */
interface ChatPanelWrapperProps {
  settingsModel: SettingsModel;
  onSettingsChange: (settings: LLMSettings) => void;
}

import React, { useState, useEffect, useCallback } from 'react';

const ChatPanelWrapper: React.FC<ChatPanelWrapperProps> = ({
  settingsModel,
  onSettingsChange,
}) => {
  const [settings, setSettings] = useState<LLMSettings>(settingsModel.settings);

  useEffect(() => {
    // Load settings on mount
    settingsModel.loadSettings().then((loaded) => {
      setSettings(loaded);
    });

    // Subscribe to settings changes
    settingsModel.settingsChanged.connect((_, newSettings) => {
      setSettings(newSettings);
    });

    return () => {
      // Cleanup
    };
  }, [settingsModel]);

  const handleSettingsChange = useCallback(
    async (newSettings: Partial<LLMSettings>) => {
      await settingsModel.saveSettings(newSettings);
      onSettingsChange({ ...settings, ...newSettings });
    },
    [settingsModel, settings, onSettingsChange]
  );

  const handleOpenSettings = useCallback(() => {
    // Settings panel is managed internally by ChatPanel
  }, []);

  return (
    <ChatPanel
      settings={settings}
      onOpenSettings={handleOpenSettings}
    />
  );
};

export default LLMAssistantPanel;