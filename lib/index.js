/**
 * JupyterLab LLM Assistant Extension
 *
 * Main entry point for the extension.
 */
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ILayoutRestorer } from '@jupyterlab/application';
import { ICommandPalette } from '@jupyterlab/apputils';
import { chatIcon } from './components/icons';
import { LLMAssistantPanel } from './widgets/LLMAssistantPanel';
/**
 * The extension ID
 */
const PLUGIN_ID = 'jupyterlab-llm-assistant:plugin';
/**
 * The command IDs
 */
var CommandIDs;
(function (CommandIDs) {
    CommandIDs.openAssistant = 'llm-assistant:open';
    CommandIDs.clearChat = 'llm-assistant:clear';
})(CommandIDs || (CommandIDs = {}));
/**
 * The JupyterLab plugin
 */
const plugin = {
    id: PLUGIN_ID,
    autoStart: true,
    requires: [ISettingRegistry],
    optional: [ICommandPalette, ILayoutRestorer],
    activate: activatePlugin,
};
/**
 * Activate the plugin
 */
async function activatePlugin(app, settingRegistry, palette, restorer) {
    console.log('JupyterLab LLM Assistant extension is activated!');
    // Create the sidebar panel
    const panel = new LLMAssistantPanel();
    panel.id = 'llm-assistant-panel';
    panel.title.icon = chatIcon;
    panel.title.caption = 'LLM Assistant';
    // Load settings
    let settings = {
        apiEndpoint: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: 'You are a helpful AI coding assistant. Help users with programming questions, explain code, debug issues, and provide code examples. Be concise and accurate.',
        enableStreaming: true,
        enableVision: true,
    };
    try {
        const settingValues = await settingRegistry.load(PLUGIN_ID);
        settings = {
            ...settings,
            ...settingValues.composite,
        };
        // Listen for settings changes
        settingRegistry.pluginChanged.connect(async () => {
            const newSettings = await settingRegistry.load(PLUGIN_ID);
            settings = {
                ...settings,
                ...newSettings.composite,
            };
        });
    }
    catch (error) {
        console.warn('Failed to load settings, using defaults:', error);
    }
    // Add to right sidebar
    app.shell.add(panel, 'right', { rank: 100 });
    // Restore panel state
    if (restorer) {
        restorer.add(panel, 'llm-assistant-panel');
    }
    // Add commands
    app.commands.addCommand(CommandIDs.openAssistant, {
        label: 'Open LLM Assistant',
        icon: chatIcon,
        execute: () => {
            app.shell.activateById(panel.id);
        },
    });
    app.commands.addCommand(CommandIDs.clearChat, {
        label: 'Clear LLM Assistant Chat',
        execute: () => {
            // This will be handled by the panel
            panel.node.dispatchEvent(new CustomEvent('llm-clear-chat'));
        },
    });
    // Add to command palette
    if (palette) {
        palette.addItem({
            command: CommandIDs.openAssistant,
            category: 'LLM Assistant',
        });
    }
    console.log('JupyterLab LLM Assistant extension activated successfully!');
}
/**
 * Export the plugin
 */
export default plugin;
/**
 * Export components and models for external use
 */
export { LLMAssistantPanel } from './widgets/LLMAssistantPanel';
export { ChatModel } from './models/chat';
export { SettingsModel } from './models/settings';
export { LLMApiService } from './services/api';
//# sourceMappingURL=index.js.map