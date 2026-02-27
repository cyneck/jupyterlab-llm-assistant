/**
 * Input area component for chat messages.
 */
import React from 'react';
import { ImageData } from '../models/types';
export interface InputAreaProps {
    onSend: (text: string, images: ImageData[]) => void;
    disabled: boolean;
    enableVision: boolean;
}
/**
 * Input area component with text input and image upload
 */
export declare const InputArea: React.FC<InputAreaProps>;
export default InputArea;
//# sourceMappingURL=InputArea.d.ts.map