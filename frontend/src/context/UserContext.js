import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [balance, setBalance] = useState(null);

  const fetchBalance = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setBalance(null);
      return;
    }
    try {
      const { data } = await api.get('/api/wallet/balance');
      setBalance(data.wallet_balance);
    } catch {
      setBalance(null);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setBalance(null);
  }, []);

  useEffect(() => {
    if (localStorage.getItem('access_token')) fetchBalance();
  }, [fetchBalance]);

  const value = useMemo(
    () => ({
      balance,
      setBalance,
      fetchBalance,
      logout,
    }),
    [balance, fetchBalance, logout],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
