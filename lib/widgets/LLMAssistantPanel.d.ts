/**
 * LLM Assistant sidebar panel widget.
 */
import { Panel } from '@lumino/widgets';
import { Signal } from '@lumino/signaling';
import { LLMSettings } from '../models/types';
/**
 * LLM Assistant sidebar panel
 */
export declare class LLMAssistantPanel extends Panel {
    /**
     * Signal emitted when settings change
     */
    readonly settingsChanged: Signal<this, LLMSettings>;
    private _settingsModel;
    /**
     * Create a new LLM Assistant panel
     */
    constructor();
    /**
     * Create the main content widget
     */
    private _createContent;
    /**
     * Get current settings
     */
    getSettings(): LLMSettings;
    /**
     * Update settings
     */
    updateSettings(settings: Partial<LLMSettings>): Promise<void>;
}
export default LLMAssistantPanel;
//# sourceMappingURL=LLMAssistantPanel.d.ts.map