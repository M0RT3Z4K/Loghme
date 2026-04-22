import { useState } from 'react';
import Chat, { Bubble } from '@chatui/core';
import MessageRenderer from './MessageRenderer';
import './ChatInterface.css';

const MODEL_OPTIONS = [
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
  { value: 'openai/gpt-4o', label: 'GPT-4o' },
  { value: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
  { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
];

export default function ChatInterface({
  messages,
  onSend,
  selectedModel,
  onModelChange,
  isModelLocked,
  pendingAttachments,
  onPickFiles,
  onRemoveAttachment,
  onNewChat,
  language = 'fa',
}) {
  const [showModelSelector, setShowModelSelector] = useState(false);

  const text = {
    fa: {
      selectModel: 'انتخاب مدل',
      locked: 'مدل قفل شده',
      attachFiles: 'افزودن فایل',
      removeFile: 'حذف',
      newChat: 'گفتگوی جدید',
      placeholder: 'پیام خود را بنویسید…',
      assistant: 'دستیار لقمه',
    },
    en: {
      selectModel: 'Select Model',
      locked: 'Model Locked',
      attachFiles: 'Add Files',
      removeFile: 'Remove',
      newChat: 'New Chat',
      placeholder: 'Type your message…',
      assistant: 'Loghme Assistant',
    },
  };

  const t = text[language];
  const isRtl = language === 'fa';

  function renderMessageContent(msg) {
    const text = msg.content?.text ?? '';
    if (msg.position === 'right') {
      return <Bubble content={text} />;
    }
    return (
      <Bubble>
        <MessageRenderer content={text} />
      </Bubble>
    );
  }

  return (
    <div className={`chat-interface-wrap ${isRtl ? 'rtl' : 'ltr'}`}>
      {/* Toolbar */}
      <div className="chat-interface__toolbar">
        <div className="chat-interface__toolbar-left">
          <button
            className="chat-interface__new-chat-btn"
            onClick={onNewChat}
            title={t.newChat}
          >
            ✎ {t.newChat}
          </button>
        </div>

        <div className="chat-interface__toolbar-right">
          <div className="chat-interface__model-selector">
            <button
              className="chat-interface__model-btn"
              onClick={() => setShowModelSelector(!showModelSelector)}
              disabled={isModelLocked}
              title={isModelLocked ? t.locked : t.selectModel}
            >
              {MODEL_OPTIONS.find((m) => m.value === selectedModel)?.label || 'Model'}
              {isModelLocked && <span className="chat-interface__lock-icon">🔒</span>}
            </button>

            {showModelSelector && !isModelLocked && (
              <div className="chat-interface__model-dropdown">
                {MODEL_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    className={`chat-interface__model-option ${
                      selectedModel === m.value ? 'active' : ''
                    }`}
                    onClick={() => {
                      onModelChange(m.value);
                      setShowModelSelector(false);
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="chat-interface__file-label" title={t.attachFiles}>
            📎
            <input
              id="chat-files"
              type="file"
              multiple
              onChange={onPickFiles}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Pending Attachments */}
      {pendingAttachments.length > 0 && (
        <div className="chat-interface__attachments">
          {pendingAttachments.map((att, i) => (
            <div key={`${att.name}-${i}`} className="chat-interface__attachment-item">
              <span className="chat-interface__attachment-name">{att.name}</span>
              <button
                type="button"
                className="chat-interface__attachment-remove"
                onClick={() => onRemoveAttachment(i)}
                title={t.removeFile}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Chat Container */}
      <div className="chat-interface__content">
        <Chat
          navbar={false}
          messages={messages}
          renderMessageContent={renderMessageContent}
          onSend={onSend}
          placeholder={t.placeholder}
          actions={[]}
        />
      </div>
    </div>
  );
}
