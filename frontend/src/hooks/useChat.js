import { useCallback, useRef, useState } from 'react';
import { useMessages } from '@chatui/core';
import { readChatSSE } from '../services/chatStream';

/**
 * مدیریت پیام‌ها و استریم پاسخ (الان به /api/chat/stream-demo وصل است).
 */
export function useChat(options = {}) {
  const { messages, appendMsg, updateMsg, resetList } = useMessages([]);
  const onDoneRef = useRef(options.onAssistantDone);
  const conversationIdRef = useRef(null);
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4o-mini');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  onDoneRef.current = options.onAssistantDone;

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const fileToText = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsText(file);
    });

  const addAttachments = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const built = await Promise.all(
      files.map(async (file) => {
        const mimeType = file.type || 'application/octet-stream';
        const isImage = mimeType.startsWith('image/');
        const isTextLike =
          mimeType.startsWith('text/') ||
          /json|javascript|xml|csv|markdown|yaml/.test(mimeType) ||
          /\.(txt|md|json|js|ts|jsx|tsx|py|java|c|cpp|go|rs|html|css|sql|yml|yaml|csv)$/i.test(
            file.name,
          );
        let dataUrl = null;
        let textContent = null;
        if (isImage) dataUrl = await fileToDataUrl(file);
        if (isTextLike) textContent = (await fileToText(file)).slice(0, 20000);
        if (!isImage && !isTextLike) dataUrl = await fileToDataUrl(file);
        return {
          name: file.name,
          mime_type: mimeType,
          data_url: dataUrl,
          text_content: textContent,
        };
      }),
    );
    setPendingAttachments((prev) => [...prev, ...built]);
  }, []);

  const removeAttachment = useCallback((index) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const onSend = useCallback(
    async (type, val) => {
      if (type !== 'text' || !val.trim()) return;

      appendMsg({
        type: 'text',
        content: {
          text:
            pendingAttachments.length > 0
              ? `${val.trim()}\n\n📎 ${pendingAttachments.map((a) => a.name).join(', ')}`
              : val.trim(),
        },
        position: 'right',
      });

      const assistantId = appendMsg({
        type: 'text',
        content: { text: '' },
        position: 'left',
      });

      const token = localStorage.getItem('access_token');
      let acc = '';

      try {
        await readChatSSE('/api/chat/stream-demo', {
          token,
          body: {
            text: val.trim(),
            conversation_id: conversationIdRef.current,
            model: selectedModel,
            attachments: pendingAttachments,
          },
          onDataLine: (payload) => {
            try {
              const j = JSON.parse(payload);
              if (j.conversation_id != null) {
                conversationIdRef.current = j.conversation_id;
              }
              if (j.error) {
                acc += `\n[OpenRouter error] ${j.error}`;
              }
              if (j.chunk != null) acc += j.chunk;
            } catch {
              acc += payload;
            }
            updateMsg(assistantId, {
              type: 'text',
              content: { text: acc },
              position: 'left',
            });
          },
        });
      } catch {
        updateMsg(assistantId, {
          type: 'text',
          content: { text: 'خطا در دریافت پاسخ.' },
          position: 'left',
        });
      }
      setPendingAttachments([]);

      onDoneRef.current?.();
    },
    [appendMsg, pendingAttachments, selectedModel, updateMsg],
  );

  const resetChat = useCallback(() => {
    conversationIdRef.current = null;
    resetList([]);
    setPendingAttachments([]);
  }, [resetList]);

  return {
    messages,
    onSend,
    resetList: resetChat,
    selectedModel,
    setSelectedModel,
    pendingAttachments,
    addAttachments,
    removeAttachment,
  };
}
