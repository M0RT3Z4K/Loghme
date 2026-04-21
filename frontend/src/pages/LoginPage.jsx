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
    } catch {
      /* خطا در useAuth */
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    clearError();
    try {
      await login(phone, password);
      await fetchBalance();
      navigate('/chat', { replace: true });
    } catch {
      /* خطا در useAuth */
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">لقمـه</h1>
        <div className="login-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login');
              clearError();
              setOtpSent(false);
              setMockHint(null);
            }}
          >
            ورود
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => {
              setMode('register');
              clearError();
              setOtpSent(false);
              setMockHint(null);
            }}
          >
            ثبت‌نام
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="login-form">
            <label>
              موبایل
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09123456789"
                autoComplete="tel"
                required
              />
            </label>
            <label>
              رمز عبور
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? '…' : 'ورود'}
            </button>
          </form>
        ) : (
          <form
            className="login-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (otpSent) handleRegister();
            }}
          >
            <label>
              موبایل
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09123456789"
                autoComplete="tel"
                required
              />
            </label>
            {!otpSent ? (
              <button type="button" className="secondary" onClick={handleSendOtp} disabled={loading || !phone}>
                {loading ? '…' : 'ارسال کد تأیید'}
              </button>
            ) : (
              <>
                {mockHint != null && (
                  <div className="login-hint">کد آزمایشی (فقط dev): {mockHint}</div>
                )}
                <label>
                  کد تأیید
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </label>
                <label>
                  نام (اختیاری)
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </label>
                <label>
                  رمز عبور
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <button type="submit" disabled={loading}>
                  {loading ? '…' : 'ثبت‌نام'}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
