import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUser } from '../context/UserContext';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { fetchBalance } = useUser();
  const { loading, error, clearError, sendOtp, register, login } = useAuth();

  const [mode, setMode] = useState('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [mockHint, setMockHint] = useState(null);

  const handleSendOtp = async () => {
    clearError();
    const data = await sendOtp(phone).catch(() => null);
    if (data) {
      setOtpSent(true);
      setMockHint(data.mock_otp ?? null);
    }
  };

  const handleRegister = async () => {
    clearError();
    try {
      await register({ phone, password, otp, full_name: fullName || undefined });
      await login(phone, password);
      await fetchBalance();
      navigate('/chat', { replace: true });
    } catch { /* handled by useAuth */ }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    clearError();
    try {
      await login(phone, password);
      await fetchBalance();
      navigate('/chat', { replace: true });
    } catch { /* handled by useAuth */ }
  };

  const switchMode = (m) => {
    setMode(m);
    clearError();
    setOtpSent(false);
    setMockHint(null);
  };

  return (
    <div className="login-page" dir="rtl">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-mark">ل</div>
          <span className="login-logo-text">لقمه</span>
        </div>

        {/* Tabs */}
        <div className="login-tabs">
          <button className={`login-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => switchMode('login')}>
            ورود
          </button>
          <button className={`login-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => switchMode('register')}>
            ثبت‌نام
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="login-form">
            <div className="login-field">
              <label>شماره موبایل</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="09123456789"
                autoComplete="tel"
                dir="ltr"
                required
              />
            </div>
            <div className="login-field">
              <label>رمز عبور</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                dir="ltr"
                required
              />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? '···' : 'ورود به حساب'}
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={e => { e.preventDefault(); if (otpSent) handleRegister(); }}>
            <div className="login-field">
              <label>شماره موبایل</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="09123456789"
                autoComplete="tel"
                dir="ltr"
                required
              />
            </div>

            {!otpSent ? (
              <button type="button" className="login-btn-secondary" onClick={handleSendOtp} disabled={loading || !phone}>
                {loading ? '···' : 'ارسال کد تأیید'}
              </button>
            ) : (
              <>
                {mockHint != null && (
                  <div className="login-hint">کد آزمایشی: <strong>{mockHint}</strong></div>
                )}
                <div className="login-field">
                  <label>کد تأیید</label>
                  <input
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    dir="ltr"
                    required
                  />
                </div>
                <div className="login-field">
                  <label>نام (اختیاری)</label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div className="login-field">
                  <label>رمز عبور</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    dir="ltr"
                    required
                  />
                </div>
                <button type="submit" className="login-btn" disabled={loading}>
                  {loading ? '···' : 'ثبت‌نام'}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}