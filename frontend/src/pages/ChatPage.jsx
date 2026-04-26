import { useEffect, useState, useCallback } from 'react';
import Sidebar from '../components/Sidebar/Sidebar';
import TopBar from '../components/TopBar/TopBar';
import ChatArea from '../components/ChatArea/ChatArea';
import SettingsModal from '../components/SettingsModal/SettingsModal';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useChat } from '../hooks/useChat';
import './ChatPage.css';

export default function ChatPage() {
  const { fetchBalance } = useUser();
  const { language, setLanguage } = useLanguage();
  const isRtl = language === 'fa';

  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth > 900
  );
  const [activeConvId, setActiveConvId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const {
    messages, onSend, resetList,
    selectedModel, setSelectedModel, isModelLocked,
    pendingAttachments, addAttachments, removeAttachment,
    loadConversation, refreshTrigger,
  } = useChat({ onAssistantDone: fetchBalance });

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  useEffect(() => {
    const handler = () => setSidebarOpen(window.innerWidth > 900);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const handleNewChat = useCallback(() => {
    resetList();
    setActiveConvId(null);
    if (window.innerWidth <= 900) setSidebarOpen(false);
  }, [resetList]);

  const handleSelectConversation = useCallback((convId) => {
    setActiveConvId(convId);
    loadConversation(convId);
    if (window.innerWidth <= 900) setSidebarOpen(false);
  }, [loadConversation]);

  const handlePickFiles = async (e) => {
    await addAttachments(e.target.files);
    e.target.value = '';
  };

  return (
    <div className="chat-page" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className={`chat-page__sidebar ${sidebarOpen ? '' : 'hidden'}`}>
        <Sidebar
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          refreshTrigger={refreshTrigger}
          activeConversationId={activeConvId}
          language={language}
          onOpenSettings={() => setShowSettings(true)}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <div
        className={`chat-page__overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="chat-page__main">
        <TopBar
          onToggleSidebar={() => setSidebarOpen(s => !s)}
          language={language}
          onLanguageChange={setLanguage}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          isModelLocked={isModelLocked}
          onOpenSettings={() => setShowSettings(true)}
        />
        <ChatArea
          messages={messages}
          onSend={onSend}
          language={language}
          pendingAttachments={pendingAttachments}
          onPickFiles={handlePickFiles}
          onRemoveAttachment={removeAttachment}
        />
      </div>

      {showSettings && (
        <SettingsModal
          language={language}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}