/**
 * Settings panel component.
 */
import React from 'react';
import { LLMSettings, ConnectionTestResult } from '../models/types';
export interface SettingsPanelProps {
    settings: LLMSettings;
    onSettingsChange: (settings: Partial<LLMSettings>) => void;
    onClose: () => void;
    onTestConnection: () => Promise<ConnectionTestResult>;
    isTestingConnection: boolean;
}
/**
 * Settings panel component
 */
export declare const SettingsPanel: React.FC<SettingsPanelProps>;
export default SettingsPanel;
//# sourceMappingURL=SettingsPanel.d.ts.map