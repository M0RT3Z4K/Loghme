import { useRef, useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';
import './TopBar.css';

export const MODEL_OPTIONS = [
  { value: 'openai/gpt-4o-mini',                          label: 'GPT-4o mini',         badge: 'fast' },
  { value: 'openai/gpt-4o',                               label: 'GPT-4o',              badge: 'smart' },
  { value: 'openai/gpt-5-chat',                           label: 'GPT-5',               badge: 'powerful' },
  { value: 'google/gemini-2.5-flash',                     label: 'Gemini 2.5 Flash',    badge: 'fast' },
  { value: 'google/gemini-2.5-flash-lite',                label: 'Gemini 2.5 Flash Lite', badge: 'cheap' },
  { value: 'google/gemini-2.5-pro',                       label: 'Gemini 2.5 Pro',      badge: 'smart' },
  { value: 'google/gemini-3-flash-preview',               label: 'Gemini 3 Flash',      badge: 'new' },
  { value: 'google/gemini-3.1-flash-lite-preview',        label: 'Gemini 3 Flash Lite', badge: 'cheap' },
  { value: 'deepseek/deepseek-v3.2',                      label: 'DeepSeek V3.2',       badge: 'smart' },
  { value: 'deepseek/deepseek-r1',                        label: 'DeepSeek R1',         badge: 'reason' },
  { value: 'google/gemini-3.1-flash-image-preview',       label: 'Nano Banana 🍌',      badge: 'image' },
];

const IconMenu = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
    <path d="M2 4.5h13M2 8.5h13M2 12.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconMoon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <path d="M13.5 9A6 6 0 0 1 7 2.5c0-.28.02-.55.05-.82A6.5 6.5 0 1 0 14.32 10.95 6.05 6.05 0 0 1 13.5 9Z" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);
const IconSun = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconChevron = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function PricingTag({ pricing, modelId, language }) {
  if (!pricing || !pricing[modelId]) return null;
  const p = pricing[modelId];
  const isRtl = language === 'fa';

  // Use input price as representative, round to nearest 10
  const inputPer1k = p.input_toman_per_1k;
  if (!inputPer1k && inputPer1k !== 0) return null;

  let label;
  if (inputPer1k === 0) {
    label = isRtl ? 'رایگان' : 'Free';
  } else if (inputPer1k < 1) {
    label = isRtl ? `~${p.input_usd_per_1m.toFixed(3)}$/M` : `~$${p.input_usd_per_1m.toFixed(3)}/M`;
  } else {
    label = isRtl
      ? `~${inputPer1k.toLocaleString('fa-IR')} ت/۱ک`
      : `~${inputPer1k.toLocaleString('en-US')}T/1k`;
  }

  return <span className="topbar__model-price">{label}</span>;
}

export default function TopBar({
  onToggleSidebar, language, onLanguageChange,
  selectedModel, onModelChange, isModelLocked,
  onOpenSettings,
}) {
  const { balance, requestTopup, fetchBalance } = useUser();
  const { theme, toggleTheme } = useTheme();
  const isRtl = language === 'fa';

  const [showWallet, setShowWallet] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const [topupAmount, setTopupAmount] = useState(30000);
  const [topupError, setTopupError] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [modelPricing, setModelPricing] = useState(null);

  const walletRef = useRef(null);
  const modelRef = useRef(null);

  // Fetch model pricing once
  useEffect(() => {
    const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
    const token = localStorage.getItem('access_token');
    if (!token) return;
    fetch(`${API_URL}/api/models/pricing`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setModelPricing(data.models || null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (walletRef.current && !walletRef.current.contains(e.target)) setShowWallet(false);
      if (modelRef.current && !modelRef.current.contains(e.target)) setShowModel(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTopup = async () => {
    setTopupError('');
    setTopupLoading(true);
    try {
      const result = await requestTopup(topupAmount);
      if (result?.payment_url) window.open(result.payment_url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setTopupError(e?.response?.data?.detail || (isRtl ? 'خطا در ساخت پرداخت' : 'Payment error'));
    } finally {
      setTopupLoading(false);
    }
  };

  const formatBalance = (bal) => {
    if (bal == null) return '···';
    return Math.floor(Number(bal)).toLocaleString(isRtl ? 'fa-IR' : 'en-US');
  };

  const formatBalanceFull = (bal) => {
    if (bal == null) return '···';
    return Number(bal).toLocaleString(isRtl ? 'fa-IR' : 'en-US');
  };

  const truncateModelName = (name, maxLength = 12) => {
    if (!name || name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
  };

  const t = {
    fa: { wallet: 'کیف پول', toman: 'تومان', charge: 'افزایش موجودی', chargeMin: 'حداقل ۳۰٬۰۰۰ تومان', pay: 'پرداخت با زرین‌پال', model: 'مدل هوش مصنوعی', settings: 'تنظیمات' },
    en: { wallet: 'Wallet', toman: 'Toman', charge: 'Top Up', chargeMin: 'Minimum 30,000', pay: 'Pay with ZarinPal', model: 'AI Model', settings: 'Settings' },
  }[language];

  const currentModelOption = MODEL_OPTIONS.find(m => m.value === selectedModel);
  const currentModelLabel = isMobile
    ? truncateModelName(currentModelOption?.label || selectedModel)
    : (currentModelOption?.label || selectedModel);

  const badgeColors = {
    fast: '#00d4aa',
    smart: '#7c6af7',
    cheap: '#34d399',
    new: '#f59e0b',
    image: '#ec4899',
    reason: '#60a5fa',
    powerful: '#f97316',
  };

  return (
    <div className="topbar" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="topbar__left">
        <button className="topbar__icon-btn" onClick={onToggleSidebar}>
          <IconMenu />
        </button>
        <div className="topbar__model-wrap" ref={modelRef} dir="ltr">
          <button
            className="topbar__model-btn"
            onClick={() => !isModelLocked && setShowModel(s => !s)}
            disabled={isModelLocked}
            title={currentModelOption?.label || selectedModel}
          >
            <span>{currentModelLabel}</span>
            {isModelLocked ? <span className="lock">🔒</span> : <IconChevron />}
          </button>
          {showModel && (
            <div className="topbar__model-dropdown">
              <div className="topbar__model-header">
                {isRtl ? 'انتخاب مدل' : 'Select Model'}
              </div>
              {MODEL_OPTIONS.map(m => {
                const p = modelPricing && modelPricing[m.value];
                return (
                  <button
                    key={m.value}
                    className={`topbar__model-option ${m.value === selectedModel ? 'active' : ''}`}
                    onClick={() => { onModelChange(m.value); setShowModel(false); }}
                  >
                    <div className="topbar__model-option-left">
                      <span
                        className="topbar__model-badge"
                        style={{ background: badgeColors[m.badge] || '#666', opacity: 0.85 }}
                      >
                        {m.badge}
                      </span>
                      <span className="topbar__model-name">{m.label}</span>
                    </div>
                    <div className="topbar__model-option-right">
                      {p ? (
                        <span className="topbar__model-price-inline">
                          {p.input_toman_per_1k === 0
                            ? (isRtl ? 'رایگان' : 'Free')
                            : isRtl
                              ? `${p.input_toman_per_1k.toLocaleString('fa-IR')}ت/۱ک`
                              : `${p.input_toman_per_1k.toLocaleString()}T/1k`
                          }
                        </span>
                      ) : null}
                      {m.value === selectedModel && <span className="check">✓</span>}
                    </div>
                  </button>
                );
              })}
              <div className="topbar__model-footer">
                {isRtl ? '* قیمت تقریبی به ازای هر ۱۰۰۰ توکن ورودی' : '* Approx. cost per 1k input tokens'}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="topbar__right">
        <button className="topbar__theme-btn" onClick={toggleTheme}>
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        <button className="topbar__lang-btn" onClick={() => onLanguageChange(language === 'fa' ? 'en' : 'fa')}>
          {language === 'fa' ? 'EN' : 'FA'}
        </button>
        {onOpenSettings && (
          <button className="topbar__icon-btn" onClick={onOpenSettings} title={t.settings}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        )}

        <div className="topbar__wallet-wrap" ref={walletRef}>
          <div className="topbar__wallet" onClick={() => { setShowWallet(s => !s); fetchBalance(); }} role="button" tabIndex={0}>
            <span className="topbar__wallet-amount">{formatBalance(balance)}</span>
            <span className="topbar__wallet-currency">{t.toman}</span>
          </div>

          {showWallet && (
            <div className="topbar__wallet-dropdown">
              <h4>{t.wallet}</h4>
              <div className="topbar__wallet-balance-display">{formatBalanceFull(balance)}</div>
              <div className="topbar__wallet-balance-label">{t.toman}</div>
              <div className="topbar__wallet-topup-section">
                <div className="topbar__wallet-topup-label">{t.charge} — {t.chargeMin}</div>
                <input
                  type="number"
                  className="topbar__wallet-input"
                  min={30000}
                  step={5000}
                  value={topupAmount}
                  onChange={e => setTopupAmount(Number(e.target.value || 0))}
                />
                <button className="topbar__wallet-pay-btn" onClick={handleTopup} disabled={topupLoading}>
                  {topupLoading ? '···' : t.pay}
                </button>
                {topupError && <div className="topbar__wallet-error">{topupError}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}