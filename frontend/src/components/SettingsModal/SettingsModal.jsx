import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import './SettingsModal.css';

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconBrain() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C9.5 2 7 3.5 7 6c0 1-.4 1.8-1 2.4C4.7 9.5 4 10.6 4 12c0 2.5 2 4.5 4.5 4.5h7C18 16.5 20 14.5 20 12c0-1.4-.7-2.5-1-3.6-.6-.6-1-1.4-1-2.4 0-2.5-2.5-4-6-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M12 12v6M9 18h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function SettingsModal({ language, onClose }) {
  const isRtl = language === 'fa';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [userInfo, setUserInfo] = useState({ phone: '', full_name: '' });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const t = {
    fa: {
      title: 'تنظیمات حساب',
      phone: 'شماره موبایل',
      name: 'نام',
      memory: 'حافظه بلند‌مدت',
      memoryDesc: 'هوش مصنوعی اطلاعات مهم شما را در مکالمات مختلف به خاطر می‌سپارد.',
      memoryOn: 'فعال',
      memoryOff: 'غیرفعال',
      clearMemory: 'پاک کردن حافظه',
      clearConfirm: 'آیا مطمئن هستید؟ تمام حافظه بلند‌مدت پاک می‌شود.',
      save: 'ذخیره',
      saved: 'ذخیره شد ✓',
      close: 'بستن',
      clearDone: 'حافظه پاک شد ✓',
    },
    en: {
      title: 'Account Settings',
      phone: 'Phone',
      name: 'Name',
      memory: 'Long-term Memory',
      memoryDesc: 'AI remembers important info about you across conversations.',
      memoryOn: 'Enabled',
      memoryOff: 'Disabled',
      clearMemory: 'Clear Memory',
      clearConfirm: 'Are you sure? All long-term memory will be erased.',
      save: 'Save',
      saved: 'Saved ✓',
      close: 'Close',
      clearDone: 'Memory cleared ✓',
    },
  }[language];

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/user/settings');
      setMemoryEnabled(data.long_term_memory_enabled ?? false);
      setUserInfo({ phone: data.phone || '', full_name: data.full_name || '' });
    } catch (e) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.patch('/api/user/settings', { long_term_memory_enabled: memoryEnabled });
      setSuccessMsg(t.saved);
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClearMemory = async () => {
    if (!window.confirm(t.clearConfirm)) return;
    setClearing(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.delete('/api/user/settings/memory');
      setSuccessMsg(t.clearDone);
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch {
      setError('Clear failed');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="settings-backdrop" onClick={onClose} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-modal__header">
          <h2>{t.title}</h2>
          <button className="settings-modal__close" onClick={onClose}>
            <IconX />
          </button>
        </div>

        {loading ? (
          <div className="settings-modal__loading">
            <div className="settings-spinner" />
          </div>
        ) : (
          <div className="settings-modal__body">
            {/* User info */}
            <div className="settings-section">
              <div className="settings-field">
                <label>{t.phone}</label>
                <div className="settings-field-value" dir="ltr">{userInfo.phone}</div>
              </div>
              {userInfo.full_name && (
                <div className="settings-field">
                  <label>{t.name}</label>
                  <div className="settings-field-value">{userInfo.full_name}</div>
                </div>
              )}
            </div>

            <div className="settings-divider" />

            {/* Long-term memory */}
            <div className="settings-section">
              <div className="settings-section__title">
                <IconBrain />
                {t.memory}
              </div>
              <p className="settings-section__desc">{t.memoryDesc}</p>

              <div className="settings-memory-row">
                <div className="settings-toggle-wrap">
                  <button
                    className={`settings-toggle ${memoryEnabled ? 'on' : 'off'}`}
                    onClick={() => setMemoryEnabled(v => !v)}
                    role="switch"
                    aria-checked={memoryEnabled}
                  >
                    <span className="settings-toggle__thumb" />
                  </button>
                  <span className="settings-toggle__label">
                    {memoryEnabled ? t.memoryOn : t.memoryOff}
                  </span>
                </div>

                <button
                  className="settings-clear-btn"
                  onClick={handleClearMemory}
                  disabled={clearing}
                >
                  <IconTrash />
                  {clearing ? '···' : t.clearMemory}
                </button>
              </div>
            </div>

            {/* Messages */}
            {error && <div className="settings-error">{error}</div>}
            {successMsg && <div className="settings-success">{successMsg}</div>}
          </div>
        )}

        {/* Footer */}
        <div className="settings-modal__footer">
          <button className="settings-cancel-btn" onClick={onClose}>{t.close}</button>
          <button className="settings-save-btn" onClick={handleSave} disabled={saving || loading}>
            {saving ? '···' : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}