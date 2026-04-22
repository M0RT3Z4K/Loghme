import { useRef, useEffect, useCallback, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './ChatArea.css';

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
    <path d="M13.5 7.5l-6 6a4 4 0 0 1-5.657-5.657l6.364-6.364a2.5 2.5 0 0 1 3.535 3.535L5.379 11.38a1 1 0 0 1-1.414-1.414l5.657-5.657" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

function MessageBubble({ msg, language }) {
  const isUser = msg.position === 'right';
  const isRtl = language === 'fa';
  const isEmpty = !msg.content?.text;

  return (
    <div className={`chat-msg ${isUser ? 'user' : 'ai'}`}>
      <div className="chat-msg__avatar">
        {isUser ? '👤' : 'ل'}
      </div>
      <div className="chat-msg__bubble">
        {isEmpty && !isUser ? (
          <div className="typing-indicator">
            <span/><span/><span/>
          </div>
        ) : isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content?.text}</span>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {msg.content?.text || ''}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

export default function ChatArea({
  messages,
  onSend,
  language,
  pendingAttachments,
  onPickFiles,
  onRemoveAttachment,
}) {
  const isRtl = language === 'fa';
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [text, setText] = useState('');

  const t = {
    fa: {
      placeholder: 'پیام خود را بنویسید…',
      hint: 'Enter برای ارسال، Shift+Enter برای خط جدید',
      emptyTitle: 'چطور می‌تونم کمک کنم؟',
      emptyDesc: 'هر سوال یا موضوعی داری، اینجام.',
    },
    en: {
      placeholder: 'Send a message…',
      hint: 'Enter to send, Shift+Enter for newline',
      emptyTitle: 'How can I help?',
      emptyDesc: 'Ask me anything.',
    },
  }[language];

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleTextChange = (e) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  };

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend('text', trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, onSend]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasMessages = messages && messages.length > 0;

  return (
    <div className="chat-area" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Messages */}
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

      {/* Composer */}
      <div className="composer-wrap">
        <div className="composer-wrap-inner">
          {/* Attachment chips */}
          {pendingAttachments.length > 0 && (
            <div className="composer__attachments">
              {pendingAttachments.map((att, i) => (
                <div key={`${att.name}-${i}`} className="composer__att-chip">
                  <span>📄 {att.name}</span>
                  <button
                    className="composer__att-remove"
                    onClick={() => onRemoveAttachment(i)}
                    aria-label="remove"
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Input row */}
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
              {/* Attach */}
              <button
                className="composer__attach-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="attach file"
                title={isRtl ? 'ضمیمه فایل' : 'Attach file'}
              >
                <IconPaperclip />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={onPickFiles}
              />
              {/* Send */}
              <button
                className="composer__send-btn"
                onClick={handleSubmit}
                disabled={!text.trim()}
                aria-label="send"
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