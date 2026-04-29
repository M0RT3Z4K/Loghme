import { useRef, useEffect, useCallback, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './ChatArea.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M14 8L2 2l3 6-3 6 12-6Z" fill="currentColor"/>
  </svg>
);
const IconSendRtl = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 8l12-6-3 6 3 6L2 8Z" fill="currentColor"/>
  </svg>
);
const IconPaperclip = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M13.5 7.5l-6 6a4 4 0 0 1-5.657-5.657l6.364-6.364a2.5 2.5 0 0 1 3.535 3.535L5.379 11.38a1 1 0 0 1-1.414-1.414l5.657-5.657"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconInfo = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M6 5.5v3M6 3.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

function formatCost(toman, lang) {
  if (toman == null || toman <= 0) return null;
  const rounded = Math.round(toman);
  if (lang === 'fa') return `${rounded.toLocaleString('fa-IR')} تومان`;
  return `${rounded.toLocaleString('en-US')} T`;
}

function CostBadge({ cost, language }) {
  const [show, setShow] = useState(false);
  const label = formatCost(cost, language);
  if (!label) return null;
  return (
    <div className="chat-msg__cost-wrap">
      <button
        className="chat-msg__cost-btn"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        aria-label={`هزینه: ${label}`}
      >
        <IconInfo />
      </button>
      {show && (
        <div className="chat-msg__cost-tooltip">
          {language === 'fa' ? 'هزینه: ' : 'Cost: '}
          <strong>{label}</strong>
        </div>
      )}
    </div>
  );
}

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
      <rect x="2" y="2" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}
function IconShare() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 6l-4-4-4 4M12 2v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 2v14M8 12l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 20h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

/** Resolve image URL — prefix API_URL for relative paths */
function resolveImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
}

function ImageMessage({ msg, language }) {
  const { imageUrl, prompt } = msg.content || {};

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = resolveImageUrl(imageUrl);
    a.download = `loghme-image-${Date.now()}.png`;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="chat-msg ai">
      <div className="chat-msg__avatar">ل</div>
      <div className="chat-msg__bubble-wrap">
        <div className="chat-msg__bubble chat-msg__bubble--image">
          <img
            src={resolveImageUrl(imageUrl)}
            alt={prompt || 'generated'}
            className="chat-msg__generated-image"
            loading="lazy"
          />
          {prompt && (
            <div className="chat-msg__image-prompt">🎨 {prompt}</div>
          )}
        </div>
        <div className="chat-msg__actions">
          <CostBadge cost={msg.token_cost} language={language} />
          <button className="chat-msg__action-btn" onClick={handleDownload} title="Download">
            <IconDownload />
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageLoadingMessage({ language }) {
  const label = language === 'fa' ? 'در حال ساخت تصویر…' : 'Generating image…';
  return (
    <div className="chat-msg ai">
      <div className="chat-msg__avatar">ل</div>
      <div className="chat-msg__bubble-wrap">
        <div className="chat-msg__bubble chat-msg__bubble--image-loading">
          <div className="image-generating">
            <div className="image-generating__spinner" />
            <span>🎨 {label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, language }) {
  const isUser = msg.position === 'right';
  const isEmpty = !msg.content?.text;
  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);

  if (msg.type === 'image') return <ImageMessage msg={msg} language={language} />;
  if (msg.type === 'image-loading') return <ImageLoadingMessage language={language} />;

  const handleCopy = async () => {
    if (!msg.content?.text) return;
    await navigator.clipboard.writeText(msg.content.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const text = encodeURIComponent(msg.content?.text || '');
  const shareOptions = [
    { name: 'Telegram', url: `https://t.me/share/url?text=${text}` },
    { name: 'WhatsApp', url: `https://wa.me/?text=${text}` },
    { name: 'Twitter', url: `https://twitter.com/intent/tweet?text=${text}` },
  ];

  return (
    <div className={`chat-msg ${isUser ? 'user' : 'ai'}`}>
      <div className="chat-msg__avatar">{isUser ? '👤' : 'ل'}</div>
      <div className="chat-msg__bubble-wrap">
        <div className="chat-msg__bubble">
          {isEmpty && !isUser ? (
            <div className="typing-indicator"><span/><span/><span/></div>
          ) : isUser ? (
            <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content?.text}</span>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {msg.content?.text || ''}
            </ReactMarkdown>
          )}
        </div>
        {!isUser && (
          <div className="chat-msg__actions">
            {msg.token_cost != null && (
              <>
                <CostBadge cost={msg.token_cost} language={language} />
                <button className="chat-msg__action-btn" onClick={handleCopy}>
                  {copied ? <IconCheck /> : <IconCopy />}
                </button>
                <div className="chat-msg__share-wrap">
                  <button className="chat-msg__action-btn" onClick={() => setShowShare((v) => !v)}>
                    <IconShare />
                  </button>
                  {showShare && (
                    <div className="chat-msg__share-popover">
                      {shareOptions.map((opt) => (
                        <button
                          key={opt.name}
                          onClick={() => { window.open(opt.url, '_blank'); setShowShare(false); }}
                          className="chat-msg__share-item"
                        >
                          {opt.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatArea({
  messages, onSend, language,
  pendingAttachments, onPickFiles, onRemoveAttachment,
}) {
  const isRtl = language === 'fa';
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [text, setText] = useState('');

  const t = {
    fa: {
      placeholder: 'پیام خود را بنویسید…',
      hint: 'Enter برای ارسال  •  Shift+Enter برای خط جدید',
      emptyTitle: 'چطور می‌تونم کمک کنم؟',
      emptyDesc: 'هر سوالی داری یا تصویری که میخوای بسازی، اینجام.',
    },
    en: {
      placeholder: 'Send a message…',
      hint: 'Enter to send  •  Shift+Enter for newline',
      emptyTitle: 'How can I help?',
      emptyDesc: 'Ask me anything or describe an image to create.',
    },
  }[language];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTextChange = (e) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend('text', trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [text, onSend]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getPdfIcon = (att) => {
    if (att.mime_type === 'application/pdf') return '📄';
    if (att.mime_type?.startsWith('image/')) return '🖼️';
    return '📎';
  };

  const hasMessages = messages && messages.length > 0;

  return (
    <div className="chat-area" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="chat-area__messages">
        {!hasMessages ? (
          <div className="chat-area__empty">
            <div className="chat-area__empty-icon">ل</div>
            <h2>{t.emptyTitle}</h2>
            <p>{t.emptyDesc}</p>
          </div>
        ) : (
          <div className="chat-area__messages-inner">
            {messages.map((msg, i) => (
              <MessageBubble key={msg._id || i} msg={msg} language={language} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="composer-wrap">
        <div className="composer-wrap-inner">
          {pendingAttachments.length > 0 && (
            <div className="composer__attachments">
              {pendingAttachments.map((att, i) => (
                <div
                  key={`${att.name}-${i}`}
                  className={`composer__att-chip ${att.mime_type === 'application/pdf' ? 'composer__att-chip--pdf' : ''}`}
                >
                  <span>{getPdfIcon(att)} {att.name}</span>
                  <button className="composer__att-remove" onClick={() => onRemoveAttachment(i)}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="composer">
            <textarea
              ref={textareaRef}
              className="composer__textarea"
              placeholder={t.placeholder}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              rows={1}
              dir={isRtl ? 'rtl' : 'ltr'}
            />
            <div className="composer__actions">
              <button
                className="composer__attach-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="attach"
              >
                <IconPaperclip />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,text/*,.json,.js,.ts,.jsx,.tsx,.py,.md,.csv,.yaml,.yml"
                style={{ display: 'none' }}
                onChange={onPickFiles}
              />
              <button
                className="composer__send-btn"
                onClick={handleSubmit}
                disabled={!text.trim()}
              >
                {isRtl ? <IconSendRtl /> : <IconSend />}
              </button>
            </div>
          </div>
          <div className="composer__hint">{t.hint}</div>
        </div>
      </div>
    </div>
  );
}