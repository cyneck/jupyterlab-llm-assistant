import { jsx as _jsx } from "react/jsx-runtime";
/**
 * LLM Assistant sidebar panel widget.
 */
import { Panel } from '@lumino/widgets';
import { ReactWidget } from '@jupyterlab/apputils';
import { Signal } from '@lumino/signaling';
import { ChatPanel } from '../components/ChatPanel';
import { SettingsModel } from '../models/settings';
/**
 * LLM Assistant sidebar panel
 */
export class LLMAssistantPanel extends Panel {
    /**
     * Create a new LLM Assistant panel
     */
    constructor() {
        super();
        /**
         * Signal emitted when settings change
         */
        this.settingsChanged = new Signal(this);
        this.addClass('llm-assistant-panel');
        this._settingsModel = new SettingsModel();
        // Create the main content widget
        const content = this._createContent();
        this.addWidget(content);
    }
    /**
     * Create the main content widget
     */
    _createContent() {
        const content = ReactWidget.create(_jsx(ChatPanelWrapper, { settingsModel: this._settingsModel, onSettingsChange: (settings) => this.settingsChanged.emit(settings) }));
        content.addClass('llm-assistant-content');
        return content;
    }
    /**
     * Get current settings
     */
    getSettings() {
        return this._settingsModel.settings;
    }
    /**
     * Update settings
     */
    async updateSettings(settings) {
        await this._settingsModel.saveSettings(settings);
    }
}
import { useState, useEffect, useCallback } from 'react';
const ChatPanelWrapper = ({ settingsModel, onSettingsChange, }) => {
    const [settings, setSettings] = useState(settingsModel.settings);
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
    const handleSettingsChange = useCallback(async (newSettings) => {
        await settingsModel.saveSettings(newSettings);
        onSettingsChange({ ...settings, ...newSettings });
    }, [settingsModel, settings, onSettingsChange]);
    const handleOpenSettings = useCallback(() => {
        // Settings panel is managed internally by ChatPanel
    }, []);
    return (_jsx(ChatPanel, { settings: settings, onOpenSettings: handleOpenSettings }));
};
export default LLMAssistantPanel;
//# sourceMappingURL=LLMAssistantPanel.js.map