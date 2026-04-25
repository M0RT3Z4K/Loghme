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
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
    <path d="M5 1h5M1 3.5h13M6 6v5M9 6v5M2.5 3.5l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ── Delete Confirmation Modal ── */
function DeleteDialog({ convTitle, onConfirm, onCancel, language }) {
  const isRtl = language === 'fa';

  // بستن با Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className="delete-dialog__backdrop" onClick={onCancel} dir={isRtl ? 'rtl' : 'ltr'}>
      <div
        className="delete-dialog__card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        {/* آیکون هشدار */}
        <div className="delete-dialog__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h3 id="delete-dialog-title" className="delete-dialog__title">
          {isRtl ? 'حذف گفتگو' : 'Delete Chat'}
        </h3>

        <p className="delete-dialog__body">
          {isRtl
            ? <>گفتگوی <strong>«{convTitle}»</strong> برای همیشه حذف می‌شود و قابل بازگشت نیست.</>
            : <>Chat <strong>"{convTitle}"</strong> will be permanently deleted and cannot be recovered.</>
          }
        </p>

        <div className="delete-dialog__actions">
          <button className="delete-dialog__btn delete-dialog__btn--cancel" onClick={onCancel}>
            {isRtl ? 'انصراف' : 'Cancel'}
          </button>
          <button className="delete-dialog__btn delete-dialog__btn--confirm" onClick={onConfirm}>
            <IconTrash />
            {isRtl ? 'بله، حذف کن' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

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

  // دیالوگ حذف: { id, title } یا null
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (refreshTrigger !== prevRefreshRef.current) {
      prevRefreshRef.current = refreshTrigger;
      fetchConversations();
    }
  }, [refreshTrigger, fetchConversations]);

  const handleDeleteClick = (e, conv) => {
    e.stopPropagation();
    setDeleteTarget({ id: conv.id, title: conv.title || (isRtl ? 'بدون عنوان' : 'Untitled') });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/api/chat/conversations/${deleteTarget.id}`);
      await fetchConversations();
      if (activeConversationId === deleteTarget.id) {
        onNewChat();
        // onSelectConversation(null);
      }
    } catch (error) {
      console.error('Failed to delete conversation', error);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteCancel = () => {
    if (!deleting) setDeleteTarget(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
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
                onClick={() => onSelectConversation(conv.id)}
              >
                <span className="sidebar__conv-icon"><IconChat /></span>
                <span className="sidebar__conv-title">{conv.title}</span>
                <button
                  className="sidebar__conv-delete"
                  onClick={(e) => handleDeleteClick(e, conv)}
                  title={isRtl ? 'حذف' : 'Delete'}
                  aria-label={isRtl ? 'حذف گفتگو' : 'Delete conversation'}
                >
                  <IconTrash />
                </button>
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

      {/* Delete Dialog — خارج از aside تا z-index مشکل نداشته باشه */}
      {deleteTarget && (
        <DeleteDialog
          convTitle={deleteTarget.title}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          language={language}
        />
      )}
    </>
  );
}