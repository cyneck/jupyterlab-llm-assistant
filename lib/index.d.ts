/**
 * JupyterLab LLM Assistant Extension
 *
 * Main entry point for the extension.
 */
import { JupyterFrontEndPlugin } from '@jupyterlab/application';
/**
 * The JupyterLab plugin
 */
declare const plugin: JupyterFrontEndPlugin<void>;
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
export type { LLMSettings, ChatMessage, ImageData } from './models/types';
//# sourceMappingURL=index.d.ts.map