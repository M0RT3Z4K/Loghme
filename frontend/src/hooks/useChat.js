import { useCallback, useRef, useState } from 'react';
import { readChatSSE } from '../services/chatStream';
import api from '../services/api';

let _msgCounter = 0;
const uid = () => `msg-${++_msgCounter}`;

// ── Keywords that strongly suggest image generation ──────────────────
const IMAGE_KEYWORDS_FA = [
  'بساز', 'بکش', 'رسم کن', 'طراحی کن', 'تصویر', 'عکس', 'نقاشی',
  'تصویرسازی', 'ایجاد تصویر', 'خلق تصویر', 'بیا یه عکس', 'یه تصویر',
  'برام عکس', 'برام تصویر', 'generate', 'create image', 'draw',
];
const IMAGE_KEYWORDS_EN = [
  'draw', 'paint', 'sketch', 'illustrate', 'render', 'generate image',
  'create image', 'make image', 'make a picture', 'picture of',
  'image of', 'photo of', 'artwork of',
];

/**
 * Heuristic: returns true when the message almost certainly wants image generation.
 * Explicit commands (/image, /تصویر) always win; this is the fallback.
 */
function looksLikeImageRequest(text) {
  const lower = text.toLowerCase();
  const allKeywords = [...IMAGE_KEYWORDS_FA, ...IMAGE_KEYWORDS_EN];
  // Require at least one keyword AND the message must be relatively short
  // (long texts are usually chat, not image prompts)
  const hasKeyword = allKeywords.some((kw) => lower.includes(kw));
  return hasKeyword && text.length < 300;
}

export function useChat(options = {}) {
  const [messages, setMessages] = useState([]);
  const onDoneRef = useRef(options.onAssistantDone);
  const conversationIdRef = useRef(null);
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4o-mini');
  const [isModelLocked, setIsModelLocked] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  onDoneRef.current = options.onAssistantDone;

  const appendMsg = useCallback((msg) => {
    const id = uid();
    setMessages((prev) => [...prev, { ...msg, _id: id }]);
    return id;
  }, []);

  const updateMsg = useCallback((id, updates) => {
    setMessages((prev) =>
      prev.map((m) => (m._id === id ? { ...m, ...updates } : m))
    );
  }, []);

  const resetList = useCallback(() => setMessages([]), []);

  // ── File helpers ──────────────────────────────────────────────────
  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result.split(',')[1]);
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

  // ── Load existing conversation ────────────────────────────────────
  const loadConversation = useCallback(async (conversationId) => {
    try {
      const response = await api.get(
        `/api/chat/conversations/${conversationId}/messages`
      );
      const { conversation, messages: loaded } = response.data;
      conversationIdRef.current = conversation.id;
      setSelectedModel(conversation.selected_model);
      setIsModelLocked(true);
      setMessages(
        loaded.map((msg) => {
          // Detect image messages stored by the backend
          if (msg.role === 'assistant') {
            try {
              const parsed = JSON.parse(msg.content);
              if (parsed?.type === 'image' && parsed?.urls?.length) {
                return {
                  _id: uid(),
                  type: 'image',
                  content: {
                    imageUrl: parsed.urls[0],
                    allUrls: parsed.urls,
                    prompt: parsed.prompt || '',
                  },
                  position: 'left',
                  token_cost: msg.token_cost ?? null,
                };
              }
            } catch {}
          }
          return {
            _id: uid(),
            type: 'text',
            content: { text: msg.content },
            position: msg.role === 'user' ? 'right' : 'left',
            token_cost: msg.role === 'assistant' ? (msg.token_cost ?? null) : null,
          };
        })
      );
      setPendingAttachments([]);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  }, []);

  // ── Attachments ───────────────────────────────────────────────────
  const addAttachments = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const built = await Promise.all(
      files.map(async (file) => {
        const mimeType = file.type || 'application/octet-stream';
        const isImage = mimeType.startsWith('image/');
        const isPdf =
          mimeType === 'application/pdf' ||
          file.name.toLowerCase().endsWith('.pdf');
        const isTextLike =
          !isPdf &&
          (mimeType.startsWith('text/') ||
            /json|javascript|xml|csv|markdown|yaml/.test(mimeType) ||
            /\.(txt|md|json|js|ts|jsx|tsx|py|java|c|cpp|go|rs|html|css|sql|yml|yaml|csv)$/i.test(
              file.name
            ));

        let dataUrl = null;
        let textContent = null;
        let pdf_base64 = null;

        if (isImage) dataUrl = await fileToDataUrl(file);
        else if (isPdf) pdf_base64 = await fileToBase64(file);
        else if (isTextLike) textContent = await fileToText(file);
        else dataUrl = await fileToDataUrl(file);

        return {
          name: file.name,
          mime_type: isPdf ? 'application/pdf' : mimeType,
          data_url: dataUrl,
          text_content: textContent,
          pdf_base64,
        };
      })
    );
    setPendingAttachments((prev) => [...prev, ...built]);
  }, []);

  const removeAttachment = useCallback((index) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Image generation ──────────────────────────────────────────────
  const generateImage = useCallback(
    async (prompt) => {
      setIsGeneratingImage(true);

      appendMsg({
        type: 'text',
        content: { text: `🎨 ${prompt}` },
        position: 'right',
        token_cost: null,
      });

      const assistantId = appendMsg({
        type: 'image-loading',
        content: { text: '' },
        position: 'left',
        token_cost: null,
      });

      try {
        const { data } = await api.post('/api/image/generate-image', {
          prompt,
          conversation_id: conversationIdRef.current ?? undefined,
        });

        const images = data?.images || [];

        if (images.length > 0 && images[0]?.url) {
          updateMsg(assistantId, {
            type: 'image',
            content: {
              imageUrl: images[0].url,
              allUrls: images.map((i) => i.url),
              prompt: data.prompt || prompt,
            },
            position: 'left',
            token_cost: data.cost_toman || null,
          });
        } else {
          updateMsg(assistantId, {
            type: 'text',
            content: { text: '⚠️ هیچ تصویری از سرویس دریافت نشد.' },
            position: 'left',
            token_cost: null,
          });
        }

        // Update conversation tracking
        if (data.conversation_id) {
          const isNew = conversationIdRef.current !== data.conversation_id;
          conversationIdRef.current = data.conversation_id;
          setIsModelLocked(true);
          if (isNew) setRefreshTrigger((v) => v + 1);
        }

        onDoneRef.current?.();
      } catch (err) {
        const msg =
          err?.response?.data?.detail || err?.message || 'خطا در ساخت تصویر';
        updateMsg(assistantId, {
          type: 'text',
          content: { text: `⚠️ ${msg}` },
          position: 'left',
          token_cost: null,
        });
      } finally {
        setIsGeneratingImage(false);
      }
    },
    [appendMsg, updateMsg]
  );

  // ── Send message ──────────────────────────────────────────────────
  const onSend = useCallback(
    async (type, val) => {
      if (type !== 'text' || !val.trim()) return;

      const trimmed = val.trim();

      // 1. Explicit command: /image … or /تصویر …
      const explicitMatch = trimmed.match(
        /^\/(?:image|img|تصویر|عکس)\s+(.+)/i
      );
      if (explicitMatch) {
        await generateImage(explicitMatch[1].trim());
        return;
      }

      // 2. Heuristic auto-detect
      if (looksLikeImageRequest(trimmed) && pendingAttachments.length === 0) {
        await generateImage(trimmed);
        return;
      }

      // 3. Normal chat
      const userText =
        pendingAttachments.length > 0
          ? `${trimmed}\n\n📎 ${pendingAttachments.map((a) => a.name).join(', ')}`
          : trimmed;

      appendMsg({
        type: 'text',
        content: { text: userText },
        position: 'right',
        token_cost: null,
      });
      const assistantId = appendMsg({
        type: 'text',
        content: { text: '' },
        position: 'left',
        token_cost: null,
      });

      const token = localStorage.getItem('access_token');
      const accRef = { value: '' };
      const costRef = { value: null };

      let balanceBefore = null;
      try {
        const { data } = await api.get('/api/wallet/balance');
        balanceBefore = data.wallet_balance;
      } catch {}

      try {
        await readChatSSE('/api/chat/stream-demo', {
          token,
          body: {
            text: trimmed,
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
                if (isNew) setRefreshTrigger((prev) => prev + 1);
              }
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
          content: {
            text: `⚠️ خطا در دریافت پاسخ.\n ${err?.message || ''}`.trim(),
          },
          position: 'left',
          token_cost: null,
        });
        setPendingAttachments([]);
        return;
      }

      if (costRef.value == null && balanceBefore != null) {
        try {
          const { data } = await api.get('/api/wallet/balance');
          const diff = balanceBefore - data.wallet_balance;
          if (diff > 0) costRef.value = diff;
        } catch {}
      }

      updateMsg(assistantId, {
        type: 'text',
        content: { text: accRef.value },
        position: 'left',
        token_cost: costRef.value,
      });

      setPendingAttachments([]);
      onDoneRef.current?.();
    },
    [appendMsg, generateImage, pendingAttachments, selectedModel, updateMsg]
  );

  // ── Reset ─────────────────────────────────────────────────────────
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
    isGeneratingImage,
    generateImage,
  };
}