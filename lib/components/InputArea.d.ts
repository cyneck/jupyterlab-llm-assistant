/**
 * Input area component for chat / agent / plan messages.
 *
 * v0.6.0 additions:
 * - Mode selector dropdown (Chat | Agent | Plan) below the textarea
 * - @ mention support: typing "@" opens a file/directory picker
 *   resolved from the current Jupyter working directory via the backend
 */
import React from 'react';
import { ImageData } from '../models/types';
import type { AppMode } from './ChatPanel';
export interface InputAreaProps {
    onSend: (text: string, images: ImageData[]) => void;
    disabled: boolean;
    enableVision: boolean;
    /** Current mode — shown in the selector */
    mode: AppMode;
    /** Called when user picks a different mode */
    onModeChange: (mode: AppMode) => void;
    /** Working root dir for @ resolution (defaults to cwd on server) */
    rootDir?: string;
}
export declare const InputArea: React.FC<InputAreaProps>;
export default InputArea;
//# sourceMappingURL=InputArea.d.ts.map