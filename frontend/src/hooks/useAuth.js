import { useCallback, useState } from 'react';
import api from '../services/api';

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => setError(null), []);

  const sendOtp = useCallback(async (phone) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/api/auth/send-otp', { phone });
      return data;
    } catch (e) {
      const msg = e.response?.data?.detail ?? e.message ?? 'خطا در ارسال کد';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async ({ phone, password, otp, full_name }) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/api/auth/register', {
        phone,
        password,
        otp,
        full_name: full_name || undefined,
      });
      return data;
    } catch (e) {
      const msg = e.response?.data?.detail ?? e.message ?? 'ثبت‌نام ناموفق';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (phone, password) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/api/auth/login', { phone, password });
      if (data.access_token) localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
      return data;
    } catch (e) {
      const msg = e.response?.data?.detail ?? e.message ?? 'ورود ناموفق';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    clearError,
    sendOtp,
    register,
    login,
  };
}
