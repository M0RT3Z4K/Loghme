import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatInterface from '../components/ChatInterface';
import Header from '../components/Header/Header';
import ConversationDrawer from '../components/ConversationDrawer/ConversationDrawer';
import { useUser } from '../context/UserContext';
import { useChat } from '../hooks/useChat';
import './ChatPage.css';

export default function ChatPage() {
  const navigate = useNavigate();
  const { balance, fetchBalance, logout } = useUser();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'fa');

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
    loadConversation,
    refreshTrigger,
  } = useChat({ onAssistantDone: fetchBalance });

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const handleNewChat = () => {
    resetList([]);
    setIsDrawerOpen(false);
  };

  const handleSelectConversation = (conversationId) => {
    loadConversation(conversationId);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={`chat-page ${language === 'fa' ? 'rtl' : 'ltr'}`}>
      <Header
        balance={balance}
        onToggleSidebar={() => setIsDrawerOpen(!isDrawerOpen)}
        language={language}
        onLanguageChange={setLanguage}
        onLogout={handleLogout}
      />
      <ConversationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectConversation={handleSelectConversation}
        refreshTrigger={refreshTrigger}
        language={language}
      />
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
        onNewChat={handleNewChat}
        language={language}
      />
    </div>
  );
}
