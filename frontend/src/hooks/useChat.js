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
    setMessages(prev => prev.map(m => m._id === id ? { ...m, ...updates } : m));
  }, []);

  const resetList = useCallback(() => setMessages([]), []);

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
          content: { text: (msg.content || '').trim() }, // Normalize and trim text
          position: msg.role === 'user' ? 'right' : 'left',
          token_cost: msg.role === 'assistant' ? (msg.token_cost ?? null) : null,
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
        if (isImage) dataUrl = await fileToDataUrl(file);
        if (isTextLike) textContent = (await fileToText(file)).slice(0, 20000);
        if (!isImage && !isTextLike) dataUrl = await fileToDataUrl(file);
        return { name: file.name, mime_type: mimeType, data_url: dataUrl, text_content: textContent };
      })
    );
    setPendingAttachments(prev => [...prev, ...built]);
  }, []);

  const removeAttachment = useCallback((index) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const onSend = useCallback(async (type, val) => {
    if (type !== 'text' || !val.trim()) return;

    const userText = pendingAttachments.length > 0
      ? `${val.trim()}\n\n📎 ${pendingAttachments.map(a => a.name).join(', ')}`
      : val.trim();

    appendMsg({ type: 'text', content: { text: userText }, position: 'right', token_cost: null });
    const assistantId = appendMsg({
      type: 'text', content: { text: '' }, position: 'left', token_cost: null,
    });

    const token = localStorage.getItem('access_token');
    const accRef   = { value: '' };   // متن جمع‌شده
    const costRef  = { value: null }; // هزینه از SSE (اگه بک‌اند بفرسته)

    // موجودی قبل از ارسال
    let balanceBefore = null;
    try {
      const { data } = await api.get('/api/wallet/balance');
      balanceBefore = data.wallet_balance;
    } catch { /* اگه نشد مشکلی نیست */ }

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
              if (isNew) setRefreshTrigger(prev => prev + 1);
            }
            // روش ۱: بک‌اند مستقیم token_cost فرستاده
            if (j.token_cost != null) costRef.value = j.token_cost;
            if (j.error) accRef.value += `\n⚠️ ${j.error}`;
            if (j.chunk != null) accRef.value += j.chunk;
          } catch {
            accRef.value += payload;
          }
          updateMsg(assistantId, {
            type: 'text',
            content: { text: accRef.value },
            position: 'left',
            token_cost: null,
          });
        },
      });
    } catch (err) {
      updateMsg(assistantId, {
        type: 'text',
        content: { text: `⚠️ خطا در دریافت پاسخ. ${err?.message || ''}`.trim() },
        position: 'left',
        token_cost: null,
      });
      setPendingAttachments([]);
      return;
    }

    // روش ۲: اگه بک‌اند token_cost نفرستاد، از تفاضل موجودی حساب کن
    if (costRef.value == null && balanceBefore != null) {
      try {
        const { data } = await api.get('/api/wallet/balance');
        const balanceAfter = data.wallet_balance;
        const diff = balanceBefore - balanceAfter;
        if (diff > 0) costRef.value = diff;
      } catch { /* اگه نشد نشون نده */ }
    }

    // cost رو set کن — حتماً بعد از stream
    updateMsg(assistantId, {
      type: 'text',
      content: { text: accRef.value },
      position: 'left',
      token_cost: costRef.value,
    });

    setPendingAttachments([]);
    onDoneRef.current?.();
  }, [appendMsg, pendingAttachments, selectedModel, updateMsg]);

  const resetChat = useCallback(() => {
    conversationIdRef.current = null;
    setIsModelLocked(false);
    setMessages([]);
    setPendingAttachments([]);
  }, []);

  return {
    messages, onSend, resetList: resetChat,
    selectedModel, setSelectedModel, isModelLocked,
    pendingAttachments, addAttachments, removeAttachment,
    loadConversation, refreshTrigger,
  };
}