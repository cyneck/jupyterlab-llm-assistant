/**
 * InputArea — unified input block for Chat / Agent / Plan modes.
 *
 * v0.7.0 changes:
 * - Textarea grows from 120 px (min) to 400 px (max) — suitable for large inputs
 * - Toolbar row: image attach button + file/dir attach button + send button
 * - @ mention: now resolves BOTH files and directories;
 *   selecting a directory opens it inline in the picker (drill-down)
 * - Attachment chip list: selected @-referenced paths shown as dismissable chips
 * - Ctrl+Enter or Cmd+Enter to send (Enter = newline by default at 3+ lines,
 *   Enter still sends on single-line for quick use; configurable)
 * - enableVision is now always true from InputArea perspective — the image
 *   button is always shown (backend handles capability check)
 */
import React from 'react';
import { ImageData } from '../models/types';
import type { AppMode } from './ChatPanel';
/** A path chip that the user has explicitly confirmed via the @ picker */
export interface AttachedPath {
    id: string;
    path: string;
    isDir: boolean;
}
export interface InputAreaProps {
    onSend: (text: string, images: ImageData[], attachedPaths: AttachedPath[]) => void;
    disabled: boolean;
    /** Still accepted so callers don't break, but image attach is always shown */
    enableVision?: boolean;
    mode: AppMode;
    onModeChange: (mode: AppMode) => void;
    /** Working root dir for @ resolution (defaults to cwd on server) */
    rootDir?: string;
}
export declare const InputArea: React.FC<InputAreaProps>;
export default InputArea;
//# sourceMappingURL=InputArea.d.ts.map