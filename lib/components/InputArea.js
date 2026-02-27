import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Input area component for chat messages.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
/**
 * Generate unique ID
 */
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Input area component with text input and image upload
 */
export const InputArea = ({ onSend, disabled, enableVision, }) => {
    const [text, setText] = useState('');
    const [images, setImages] = useState([]);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [text]);
    // Handle text change
    const handleTextChange = useCallback((e) => {
        setText(e.target.value);
    }, []);
    // Handle image file selection
    const handleImageSelect = useCallback(async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0)
            return;
        const newImages = [];
        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/'))
                continue;
            // Read file as data URL
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
            newImages.push({
                id: generateId(),
                dataUrl,
                file,
                preview: dataUrl,
            });
        }
        setImages((prev) => [...prev, ...newImages]);
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);
    // Handle paste event for images
    const handlePaste = useCallback(async (e) => {
        if (!enableVision)
            return;
        const items = e.clipboardData.items;
        const newImages = [];
        for (const item of Array.from(items)) {
            if (!item.type.startsWith('image/'))
                continue;
            const file = item.getAsFile();
            if (!file)
                continue;
            // Read file as data URL
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
            newImages.push({
                id: generateId(),
                dataUrl,
                file,
                preview: dataUrl,
            });
        }
        if (newImages.length > 0) {
            setImages((prev) => [...prev, ...newImages]);
        }
    }, [enableVision]);
    // Remove image
    const handleRemoveImage = useCallback((id) => {
        setImages((prev) => prev.filter((img) => img.id !== id));
    }, []);
    // Handle send
    const handleSend = useCallback(() => {
        if (disabled)
            return;
        if (!text.trim() && images.length === 0)
            return;
        onSend(text.trim(), images);
        setText('');
        setImages([]);
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [text, images, disabled, onSend]);
    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((e) => {
        // Send on Enter (without Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);
    // Handle image button click
    const handleImageButtonClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);
    const canSend = !disabled && (text.trim().length > 0 || images.length > 0);
    return (_jsxs("div", { className: "llm-input-area", children: [images.length > 0 && (_jsx("div", { className: "llm-image-previews", children: images.map((image) => (_jsxs("div", { className: "llm-image-preview", children: [_jsx("img", { src: image.preview, alt: "Preview" }), _jsx("button", { className: "llm-image-remove", onClick: () => handleRemoveImage(image.id), title: "Remove image", children: _jsx("svg", { viewBox: "0 0 24 24", width: "14", height: "14", fill: "currentColor", children: _jsx("path", { d: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" }) }) })] }, image.id))) })), _jsxs("div", { className: "llm-input-row", children: [enableVision && (_jsxs(_Fragment, { children: [_jsx("input", { ref: fileInputRef, type: "file", accept: "image/*", multiple: true, onChange: handleImageSelect, style: { display: 'none' } }), _jsx("button", { className: "llm-image-btn", onClick: handleImageButtonClick, disabled: disabled, title: "Attach image", children: _jsx("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "currentColor", children: _jsx("path", { d: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" }) }) })] })), _jsx("textarea", { ref: textareaRef, className: "llm-text-input", value: text, onChange: handleTextChange, onKeyDown: handleKeyDown, onPaste: handlePaste, placeholder: enableVision ? "Send a message... (paste images supported)" : "Send a message...", disabled: disabled, rows: 1 }), _jsx("button", { className: "llm-send-btn", onClick: handleSend, disabled: !canSend, title: "Send message (Enter)", children: _jsx("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "currentColor", children: _jsx("path", { d: "M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" }) }) })] }), _jsx("div", { className: "llm-input-hint", children: _jsx("span", { children: "Enter to send, Shift+Enter for new line" }) })] }));
};
export default InputArea;
//# sourceMappingURL=InputArea.js.map