import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useUser } from '../../context/UserContext';
import api from '../../services/api';
import './Sidebar.css';

export default function Sidebar({ onNewChat, onSelectConversation, refreshTrigger }) {
  const navigate = useNavigate();
  const { balance, logout, requestTopup } = useUser();
  const [topupAmount, setTopupAmount] = useState(30000);
  const [topupError, setTopupError] = useState('');
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const prevRefreshRef = useRef(refreshTrigger);

  useEffect(() => {
    fetchConversations();
  }, []);

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

  const handleSelectConversation = (conversation) => {
    onSelectConversation(conversation.id);
  };

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">Loghme</div>
      <button type="button" className="app-sidebar__btn" onClick={onNewChat}>
        گفتگوی جدید
      </button>
      <div className="app-sidebar__section-title">گفتگوهای اخیر</div>
      <ul className="app-sidebar__list">
        {loading ? (
          <li className="app-sidebar__placeholder">در حال بارگذاری...</li>
        ) : conversations.length === 0 ? (
          <li className="app-sidebar__placeholder">هنوز گفتگویی ذخیره نشده</li>
        ) : (
          conversations.map((conv) => (
            <li
              key={conv.id}
              className="app-sidebar__item"
              onClick={() => handleSelectConversation(conv)}
            >
              <button type="button" className="app-sidebar__item-btn">
                {conv.title}
              </button>
            </li>
          ))
        )}
      </ul>
      <div className="app-sidebar__footer">
        {balance != null && (
          <div className="app-sidebar__balance">
            موجودی کیف پول: <strong>{Number(balance).toLocaleString('fa-IR')} تومان</strong>
          </div>
        )}
        <div className="app-sidebar__topup">
          <label htmlFor="topup-amount">شارژ کیف پول (حداقل ۳۰٬۰۰۰)</label>
          <input
            id="topup-amount"
            type="number"
            min={30000}
            step={1000}
            value={topupAmount}
            onChange={(e) => setTopupAmount(Number(e.target.value || 0))}
          />
          <button type="button" className="app-sidebar__pay" onClick={handleTopup}>
            پرداخت با زرین‌پال
          </button>
          {topupError && <div className="app-sidebar__error">{topupError}</div>}
        </div>
        <button
          type="button"
          className="app-sidebar__link"
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
        >
          خروج
        </button>
      </div>
    </aside>
  );
}
