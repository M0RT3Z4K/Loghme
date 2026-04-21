import { useEffect } from 'react';
import ChatInterface from '../components/ChatInterface';
import Sidebar from '../components/Sidebar/Sidebar';
import { useUser } from '../context/UserContext';
import { useChat } from '../hooks/useChat';
import './ChatPage.css';

export default function ChatPage() {
  const { fetchBalance } = useUser();
  const {
    messages,
    onSend,
    resetList,
    selectedModel,
    setSelectedModel,
    isModelLocked,
    pendingAttachments,
    addAttachments,
    removeAttachment,
  } = useChat({ onAssistantDone: fetchBalance });

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return (
    <div className="chat-page">
      <Sidebar onNewChat={() => resetList([])} />
      <ChatInterface
        messages={messages}
        onSend={onSend}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        isModelLocked={isModelLocked}
        pendingAttachments={pendingAttachments}
        onPickFiles={async (e) => {
          await addAttachments(e.target.files);
          e.target.value = '';
        }}
        onRemoveAttachment={removeAttachment}
      />
    </div>
  );
}
