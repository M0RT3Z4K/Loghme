import { useCallback, useRef, useState } from 'react';
import { readChatSSE } from '../services/chatStream';
import api from '../services/api';

let _msgCounter = 0;
const uid = () => `msg-${++_msgCounter}`;

export function useChat(options = {}) {
  const [messages, setMessages] = useState([]);
  const onDoneRef = useRef(options.onAssistantDone);
  const conversationIdRef = useRef(null);
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4o-mini');
  const [isModelLocked, setIsModelLocked] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  onDoneRef.current = options.onAssistantDone;

  const appendMsg = useCallback((msg) => {
    const id = uid();
    setMessages(prev => [...prev, { ...msg, _id: id }]);
    return id;
  }, []);

  const updateMsg = useCallback((id, updates) => {
    setMessages(prev =>
      prev.map(m => m._id === id ? { ...m, ...updates } : m)
    );
  }, []);

  const resetList = useCallback((initial = []) => {
    setMessages(initial);
  }, []);

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const fileToText = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = reject;
      r.readAsText(file);
    });

  const compressImage = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1024;
          if (width > height && width > maxDim) {
            height = (height * maxDim) / width;
            width = maxDim;
          } else if (height > maxDim) {
            width = (width * maxDim) / height;
            height = maxDim;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL(file.type, 0.8));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const loadConversation = useCallback(async (conversationId) => {
    try {
      const response = await api.get(`/api/chat/conversations/${conversationId}/messages`);
      const { conversation, messages: loaded } = response.data;

      conversationIdRef.current = conversation.id;
      setSelectedModel(conversation.selected_model);
      setIsModelLocked(true);

      setMessages(
        loaded.map((msg) => ({
          _id: uid(),
          type: 'text',
          content: { text: msg.content },
          position: msg.role === 'user' ? 'right' : 'left',
        }))
      );
      setPendingAttachments([]);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  }, []);

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
          /\.(txt|md|json|js|ts|jsx|tsx|py|java|c|cpp|go|rs|html|css|sql|yml|yaml|csv)$/i.test(file.name);
        let dataUrl = null;
        let textContent = null;
        // Compress images on selection (not on send)
        if (isImage) {
          dataUrl = await compressImage(file);
        } else if (isTextLike) {
          textContent = (await fileToText(file)).slice(0, 20000);
        } else {
          dataUrl = await fileToDataUrl(file);
        }
        return { name: file.name, mime_type: mimeType, data_url: dataUrl, text_content: textContent };
      })
    );
    setPendingAttachments(prev => [...prev, ...built]);
  }, []);

  const removeAttachment = useCallback((index) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const onSend = useCallback(
    async (type, val) => {
      if (type !== 'text' || !val.trim()) return;

      const userText =
        pendingAttachments.length > 0
          ? `${val.trim()}\n\n📎 ${pendingAttachments.map(a => a.name).join(', ')}`
          : val.trim();

      appendMsg({
        type: 'text',
        content: { text: userText },
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
                const isNew = conversationIdRef.current !== j.conversation_id;
                conversationIdRef.current = j.conversation_id;
                setIsModelLocked(true);
              }
              if (j.error) acc += `\n[خطا] ${j.error}`;
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
        // Refresh conversation list only after assistant response is complete
        if (acc.trim() && !acc.includes('[خطا]')) {
          setRefreshTrigger(prev => prev + 1);
        }
      } catch (err) {
        updateMsg(assistantId, {
          type: 'text',
          content: { text: `⚠️ خطا در دریافت پاسخ. ${err?.message || ''}`.trim() },
          position: 'left',
        });
      }

      setPendingAttachments([]);
      onDoneRef.current?.();
    },
    [appendMsg, pendingAttachments, selectedModel, updateMsg]
  );

  const resetChat = useCallback(() => {
    conversationIdRef.current = null;
    setIsModelLocked(false);
    setMessages([]);
    setPendingAttachments([]);
  }, []);

  return {
    messages,
    onSend,
    resetList: resetChat,
    selectedModel,
    setSelectedModel,
    isModelLocked,
    pendingAttachments,
    addAttachments,
    removeAttachment,
    loadConversation,
    refreshTrigger,
  };
}