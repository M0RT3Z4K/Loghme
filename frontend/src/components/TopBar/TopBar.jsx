import { useRef, useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';
import './TopBar.css';

export const MODEL_OPTIONS = [
  {
    value: 'openai/gpt-4o-mini',
    label: { fa: 'GPT-4o mini', en: 'GPT-4o mini' },
    badge: 'fast',
    desc: { fa: 'سریع و اقتصادی برای کارهای روزمره', en: 'Fast & economical for daily tasks' },
  },
  {
    value: 'openai/gpt-4o',
    label: { fa: 'GPT-4o', en: 'GPT-4o' },
    badge: 'smart',
    desc: { fa: 'هوشمند و چندوجهی — متن، تصویر، کد', en: 'Multimodal — text, image, code' },
  },
  {
    value: 'openai/gpt-5-chat',
    label: { fa: 'GPT-5', en: 'GPT-5' },
    badge: 'powerful',
    desc: { fa: 'قوی‌ترین مدل OpenAI', en: 'Most powerful OpenAI model' },
  },
  {
    value: 'google/gemini-2.5-flash',
    label: { fa: 'Gemini 2.5 Flash', en: 'Gemini 2.5 Flash' },
    badge: 'fast',
    desc: { fa: 'سریع و کم‌هزینه از گوگل', en: 'Fast & cheap from Google' },
  },
  {
    value: 'google/gemini-2.5-flash-lite',
    label: { fa: 'Gemini 2.5 Flash Lite', en: 'Gemini 2.5 Flash Lite' },
    badge: 'cheap',
    desc: { fa: 'ارزان‌ترین گزینه Gemini', en: 'Cheapest Gemini option' },
  },
  {
    value: 'google/gemini-2.5-pro',
    label: { fa: 'Gemini 2.5 Pro', en: 'Gemini 2.5 Pro' },
    badge: 'smart',
    desc: { fa: 'نسخه حرفه‌ای Gemini با توانایی بالا', en: 'Pro Gemini with high capability' },
  },
  {
    value: 'google/gemini-3-flash-preview',
    label: { fa: 'Gemini 3 Flash', en: 'Gemini 3 Flash' },
    badge: 'new',
    desc: { fa: 'نسل سوم Gemini — پیش‌نمایش', en: 'Gemini gen 3 — preview' },
  },
  {
    value: 'google/gemini-3.1-flash-lite-preview',
    label: { fa: 'Gemini 3 Flash Lite', en: 'Gemini 3 Flash Lite' },
    badge: 'cheap',
    desc: { fa: 'سبک‌ترین مدل نسل جدید', en: 'Lightest next-gen model' },
  },
  {
    value: 'deepseek/deepseek-v3.2',
    label: { fa: 'DeepSeek V3.2', en: 'DeepSeek V3.2' },
    badge: 'smart',
    desc: { fa: 'مدل چینی با عملکرد عالی در برنامه‌نویسی', en: 'Chinese model, great at coding' },
  },
  {
    value: 'deepseek/deepseek-r1',
    label: { fa: 'DeepSeek R1', en: 'DeepSeek R1' },
    badge: 'reason',
    desc: { fa: 'تفکر زنجیره‌ای — مناسب استدلال', en: 'Chain-of-thought reasoning model' },
  },
  {
    value: 'google/gemini-3.1-flash-image-preview',
    label: { fa: 'Nano Banana 🍌', en: 'Nano Banana 🍌' },
    badge: 'image',
    desc: { fa: 'تولید تصویر با هوش مصنوعی', en: 'AI image generation' },
  },
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

const BADGE_META = {
  fast:     { color: '#00d4aa', fa: 'سریع',     en: 'Fast' },
  smart:    { color: '#7c6af7', fa: 'هوشمند',   en: 'Smart' },
  cheap:    { color: '#34d399', fa: 'اقتصادی',  en: 'Cheap' },
  new:      { color: '#f59e0b', fa: 'جدید',     en: 'New' },
  image:    { color: '#ec4899', fa: 'تصویر',    en: 'Image' },
  reason:   { color: '#60a5fa', fa: 'استدلال',  en: 'Reason' },
  powerful: { color: '#f97316', fa: 'قدرتمند',  en: 'Powerful' },
};

function formatPrice(p, isRtl) {
  if (!p) return null;
  const v = p.input_toman_per_1k;
  if (v === 0) return isRtl ? 'رایگان' : 'Free';
  if (!v) return null;
  if (isRtl) return `${v.toLocaleString('fa-IR')} ت/۱ک`;
  return `${v.toLocaleString('en-US')} T/1k`;
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

  useEffect(() => {
    const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
    const token = localStorage.getItem('access_token');
    if (!token) return;
    fetch(`${API_URL}/api/models/pricing`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setModelPricing(data.models || null))
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

  const t = {
    fa: {
      wallet: 'کیف پول', toman: 'تومان', charge: 'افزایش موجودی',
      chargeMin: 'حداقل ۳۰٬۰۰۰ تومان', pay: 'پرداخت با زرین‌پال',
      selectModel: 'انتخاب مدل', pricingNote: '* قیمت تقریبی به ازای هر ۱۰۰۰ توکن ورودی',
      locked: 'مدل قفل شده', settings: 'تنظیمات',
    },
    en: {
      wallet: 'Wallet', toman: 'Toman', charge: 'Top Up',
      chargeMin: 'Minimum 30,000', pay: 'Pay with ZarinPal',
      selectModel: 'Select Model', pricingNote: '* Approx. cost per 1k input tokens',
      locked: 'Model locked', settings: 'Settings',
    },
  }[language];

  const currentModelOption = MODEL_OPTIONS.find((m) => m.value === selectedModel);
  const currentModelLabel = currentModelOption?.label[language] || selectedModel;
  const truncated =
    isMobile && currentModelLabel.length > 10
      ? currentModelLabel.slice(0, 10) + '…'
      : currentModelLabel;

  return (
    <div className="topbar" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="topbar__left">
        <button className="topbar__icon-btn" onClick={onToggleSidebar}>
          <IconMenu />
        </button>

        {/* ── Model selector ── */}
        <div className="topbar__model-wrap" ref={modelRef} dir="ltr">
          <button
            className="topbar__model-btn"
            onClick={() => !isModelLocked && setShowModel((s) => !s)}
            disabled={isModelLocked}
            title={isModelLocked ? t.locked : currentModelLabel}
          >
            <span>{truncated}</span>
            {isModelLocked ? <span className="lock">🔒</span> : <IconChevron />}
          </button>

          {showModel && (
            <div className="topbar__model-dropdown" dir={isRtl ? 'rtl' : 'ltr'}>
              <div className="topbar__model-header">{t.selectModel}</div>

              {MODEL_OPTIONS.map((m) => {
                const p = modelPricing?.[m.value];
                const badge = BADGE_META[m.badge] || {};
                const isActive = m.value === selectedModel;
                const priceStr = formatPrice(p, isRtl);

                return (
                  <button
                    key={m.value}
                    className={`topbar__model-option ${isActive ? 'active' : ''}`}
                    onClick={() => { onModelChange(m.value); setShowModel(false); }}
                  >
                    <div className="topbar__model-option-main">
                      <div className="topbar__model-option-row1">
                        <span className="topbar__model-name">{m.label[language]}</span>
                        <span
                          className="topbar__model-badge"
                          style={{ background: badge.color }}
                        >
                          {isRtl ? badge.fa : badge.en}
                        </span>
                        {isActive && <span className="check">✓</span>}
                      </div>
                      <div className="topbar__model-option-row2">
                        <span className="topbar__model-desc">{m.desc[language]}</span>
                        {priceStr && (
                          <span className="topbar__model-price-inline">{priceStr}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              <div className="topbar__model-footer">{t.pricingNote}</div>
            </div>
          )}
        </div>
      </div>

      <div className="topbar__right">
        <button className="topbar__theme-btn" onClick={toggleTheme}>
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        <button
          className="topbar__lang-btn"
          onClick={() => onLanguageChange(language === 'fa' ? 'en' : 'fa')}
        >
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
          <div
            className="topbar__wallet"
            onClick={() => { setShowWallet((s) => !s); fetchBalance(); }}
            role="button"
            tabIndex={0}
          >
            <span className="topbar__wallet-amount">{formatBalance(balance)}</span>
            <span className="topbar__wallet-currency">{t.toman}</span>
          </div>

          {showWallet && (
            <div className="topbar__wallet-dropdown">
              <h4>{t.wallet}</h4>
              <div className="topbar__wallet-balance-display">{formatBalanceFull(balance)}</div>
              <div className="topbar__wallet-balance-label">{t.toman}</div>
              <div className="topbar__wallet-topup-section">
                <div className="topbar__wallet-topup-label">
                  {t.charge} — {t.chargeMin}
                </div>
                <input
                  type="number"
                  className="topbar__wallet-input"
                  min={30000}
                  step={5000}
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(Number(e.target.value || 0))}
                />
                <button
                  className="topbar__wallet-pay-btn"
                  onClick={handleTopup}
                  disabled={topupLoading}
                >
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