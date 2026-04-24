import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import api from '../../services/api';
import './Sidebar.css';

const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M7.5 2v11M2 7.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const IconChat = () => (
  <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
    <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h8A1.5 1.5 0 0 1 13 3.5v6A1.5 1.5 0 0 1 11.5 11H8l-3 2.5V11H3.5A1.5 1.5 0 0 1 2 9.5v-6Z" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);
const IconUser = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M2 13c0-2.761 2.462-5 5.5-5s5.5 2.239 5.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconLogout = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M6 2H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3M10 10l3-3-3-3M13 7H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function Sidebar({
  onNewChat,
  onSelectConversation,
  refreshTrigger,
  activeConversationId,
  language,
  onOpenSettings,
  onClose,
}) {
  const navigate = useNavigate();
  const { logout } = useUser();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const prevRefreshRef = useRef(refreshTrigger);
  const isRtl = language === 'fa';

  const t = {
    fa: {
      newChat: 'گفتگوی جدید',
      recent: 'گفتگوهای اخیر',
      noConv: 'گفتگویی وجود ندارد',
      account: 'حساب کاربری',
      logout: 'خروج از حساب',
    },
    en: {
      newChat: 'New Chat',
      recent: 'Recent Chats',
      noConv: 'No conversations yet',
      account: 'Account',
      logout: 'Sign Out',
    },
  }[language];

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/chat/conversations');
      setConversations(res.data || []);
    } catch (e) {
      console.error('Failed to fetch conversations', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Reload when a new conversation is created
  useEffect(() => {
    if (refreshTrigger !== prevRefreshRef.current) {
      prevRefreshRef.current = refreshTrigger;
      fetchConversations();
    }
  }, [refreshTrigger, fetchConversations]);

  const [confirmDelete, setConfirmDelete] = useState(null); // State for managing confirmation
  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="sidebar" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Logo */}
      <div className="sidebar__logo">
        <div className="sidebar__logo-mark">ل</div>
        <span className="sidebar__logo-text">لقمه</span>
        <button className="sidebar__close-btn" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* New Chat */}
      <button className="sidebar__new-chat" onClick={onNewChat}>
        <IconPlus />
        {t.newChat}
      </button>

      {/* Conversations */}
      <div className="sidebar__section-label">{t.recent}</div>
      <div className="sidebar__conversations">
        {loading ? (
          <div className="sidebar__conv-loading">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="sidebar__conv-skeleton" style={{ opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="sidebar__conv-placeholder">{t.noConv}</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`sidebar__conv-item ${activeConversationId === conv.id ? 'active' : ''}`}
            >
              <span className="sidebar__conv-icon" onClick={() => onSelectConversation(conv.id)}><IconChat /></span>
              <span className="sidebar__conv-title" onClick={() => onSelectConversation(conv.id)}>{conv.title}</span>
              <button
                className="sidebar__conv-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(conv.id); // Show confirmation card
                }}
              >
                ✕
              </button>

              {confirmDelete === conv.id && (
                <div className="sidebar__confirm-delete">
                  <p>آیا مطمئن هستید که می‌خواهید این گفتگو را حذف کنید؟</p>
                  <button
                    className="confirm-btn"
                    onClick={async () => {
                      try {
                        await api.delete(`/api/chat/conversations/${conv.id}`);
                        fetchConversations();
                        setConfirmDelete(null); // Close confirmation card
                      } catch (error) {
                        console.error('Failed to delete conversation', error);
                      }
                    }}
                  >
                    بله
                  </button>
                  <button
                    className="cancel-btn"
                    onClick={() => setConfirmDelete(null)}
                  >
                    خیر
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="sidebar__footer">
        <button className="sidebar__footer-btn" onClick={onOpenSettings}>
          <IconUser />
          {t.account}
        </button>
        <button className="sidebar__footer-btn danger" onClick={handleLogout}>
          <IconLogout />
          {t.logout}
        </button>
      </div>
    </aside>
  );
}