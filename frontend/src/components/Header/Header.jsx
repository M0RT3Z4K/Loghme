import { useState } from 'react';
import './Header.css';

export default function Header({ balance, onToggleSidebar, language, onLanguageChange, onLogout }) {
  const [showBalance, setShowBalance] = useState(true);

  const formatBalance = (bal) => {
    if (bal == null) return '...';
    return Number(bal).toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US');
  };

  const text = {
    fa: {
      wallet: 'کیف پول',
      language: 'زبان',
      logout: 'خروج',
      toman: 'تومان',
    },
    en: {
      wallet: 'Wallet',
      language: 'Language',
      logout: 'Logout',
      toman: 'Toman',
    },
  };

  const t = text[language];

  return (
    <header className={`chat-header ${language === 'fa' ? 'rtl' : 'ltr'}`}>
      <div className="chat-header__left">
        <button
          className="chat-header__menu-btn"
          onClick={onToggleSidebar}
          title={language === 'fa' ? 'گفت‌و‌گوها' : 'Conversations'}
        >
          ☰
        </button>
        <div className="chat-header__title">
          Loghme {language === 'fa' ? 'لقمه' : 'Chat'}
        </div>
      </div>

      <div className="chat-header__right">
        <div className="chat-header__wallet">
          <span className="chat-header__wallet-label">{t.wallet}:</span>
          <span className="chat-header__wallet-amount">
            {formatBalance(balance)}
          </span>
          <span className="chat-header__wallet-currency">{t.toman}</span>
        </div>

        <select
          className="chat-header__language-select"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
        >
          <option value="fa">فارسی</option>
          <option value="en">English</option>
        </select>

        <button
          className="chat-header__logout-btn"
          onClick={onLogout}
          title={t.logout}
        >
          ⎋
        </button>
      </div>
    </header>
  );
}
