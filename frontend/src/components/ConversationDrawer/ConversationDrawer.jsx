import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import api from '../../services/api';
import './ConversationDrawer.css';

export default function ConversationDrawer({ isOpen, onClose, onSelectConversation, refreshTrigger, language }) {
  const navigate = useNavigate();
  const { requestTopup } = useUser();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState(30000);
  const [topupError, setTopupError] = useState('');
  const prevRefreshRef = useRef(refreshTrigger);

  useEffect(() => {
    if (isOpen) {
      fetchConversations();
    }
  }, [isOpen]);

  useEffect(() => {
    if (refreshTrigger !== prevRefreshRef.current) {
      prevRefreshRef.current = refreshTrigger;
      fetchConversations();
    }
  }, [refreshTrigger]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/chat/conversations');
      setConversations(response.data || []);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = (conversationId) => {
    onSelectConversation(conversationId);
    onClose();
  };

  const handleTopup = async () => {
    setTopupError('');
    try {
      const result = await requestTopup(topupAmount);
      if (result?.payment_url) {
        window.open(result.payment_url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      setTopupError(e?.response?.data?.detail || 'خطا در ساخت پرداخت');
    }
  };

  const text = {
    fa: {
      recentChats: 'گفت‌و‌گوهای اخیر',
      noChatHistory: 'هنوز گفت‌و‌گویی ذخیره نشده',
      loading: 'در حال بارگذاری...',
      newChat: 'گفتگوی جدید',
      topup: 'شارژ کیف‌پول',
      topupLabel: 'شارژ کیف پول (حداقل ۳۰٬۰۰۰)',
      pay: 'پرداخت',
      close: 'بستن',
    },
    en: {
      recentChats: 'Recent Chats',
      noChatHistory: 'No conversation history',
      loading: 'Loading...',
      newChat: 'New Chat',
      topup: 'Top Up Wallet',
      topupLabel: 'Top up wallet (minimum 30,000)',
      pay: 'Pay',
      close: 'Close',
    },
  };

  const t = text[language];

  return (
    <>
      {isOpen && <div className="conversation-drawer__overlay" onClick={onClose} />}
      <aside className={`conversation-drawer ${isOpen ? 'open' : ''} ${language === 'fa' ? 'rtl' : 'ltr'}`}>
        <div className="conversation-drawer__header">
          <h2 className="conversation-drawer__title">{t.recentChats}</h2>
          <button className="conversation-drawer__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="conversation-drawer__content">
          <ul className="conversation-drawer__list">
            {loading ? (
              <li className="conversation-drawer__item-placeholder">{t.loading}</li>
            ) : conversations.length === 0 ? (
              <li className="conversation-drawer__item-placeholder">{t.noChatHistory}</li>
            ) : (
              conversations.map((conv) => (
                <li
                  key={conv.id}
                  className="conversation-drawer__item"
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <button type="button" className="conversation-drawer__item-btn">
                    {conv.title}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="conversation-drawer__footer">
          <div className="conversation-drawer__topup-section">
            <label htmlFor="drawer-topup-amount" className="conversation-drawer__topup-label">
              {t.topupLabel}
            </label>
            <input
              id="drawer-topup-amount"
              type="number"
              className="conversation-drawer__topup-input"
              min={30000}
              step={1000}
              value={topupAmount}
              onChange={(e) => setTopupAmount(Number(e.target.value || 0))}
            />
            <button type="button" className="conversation-drawer__pay-btn" onClick={handleTopup}>
              {t.pay}
            </button>
            {topupError && <div className="conversation-drawer__error">{topupError}</div>}
          </div>
        </div>
      </aside>
    </>
  );
}
