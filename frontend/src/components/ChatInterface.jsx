import Chat, { Bubble } from '@chatui/core';
import MessageRenderer from './MessageRenderer';

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
}) {
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
    <div
      className="chat-interface-wrap"
      style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid #3c4043',
          background: '#1e1f20',
          color: '#e3e3e3',
        }}
      >
        <label htmlFor="model-select">Model:</label>
        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={isModelLocked}
          style={{ background: '#131314', color: '#e3e3e3', borderRadius: 6, padding: '4px 8px' }}
        >
          {MODEL_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {isModelLocked && <span style={{ fontSize: 12, color: '#9aa0a6' }}>مدل برای این گفتگو قفل شد</span>}
        <label
          htmlFor="chat-files"
          style={{ cursor: 'pointer', marginInlineStart: 8, color: '#8ab4f8' }}
        >
          + فایل/عکس
        </label>
        <input id="chat-files" type="file" multiple onChange={onPickFiles} style={{ display: 'none' }} />
      </div>
      {pendingAttachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 12px', background: '#131314' }}>
          {pendingAttachments.map((att, i) => (
            <button
              key={`${att.name}-${i}`}
              type="button"
              onClick={() => onRemoveAttachment(i)}
              style={{
                border: '1px solid #3c4043',
                background: '#1e1f20',
                color: '#e3e3e3',
                borderRadius: 999,
                padding: '4px 10px',
                cursor: 'pointer',
              }}
              title="حذف فایل"
            >
              {att.name} ×
            </button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Chat
          navbar={{ title: 'دستیار لقمـه' }}
          messages={messages}
          renderMessageContent={renderMessageContent}
          onSend={onSend}
          placeholder="پیام خود را بنویسید…"
        />
      </div>
    </div>
  );
}
