import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('wasel_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem('wasel_user');
      localStorage.removeItem('wasel_token');
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('wasel_token'));
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ id: Date.now(), message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  useEffect(() => {
    async function verifyUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (res.success && res.user) {
          setUser(res.user);
          localStorage.setItem('wasel_user', JSON.stringify(res.user));
        }
      } catch (err) {
        console.error('Session expired or invalid:', err);
        logout();
      } finally {
        setLoading(false);
      }
    }

    verifyUser();
  }, [token]);

  const login = async (loginIdentifier, password) => {
    try {
      const res = await api.post('/auth/login', { login: loginIdentifier, password });
      if (res.success && res.token) {
        localStorage.setItem('wasel_token', res.token);
        localStorage.setItem('wasel_user', JSON.stringify(res.user));
        setToken(res.token);
        setUser(res.user);
        showToast(res.message || 'تم تسجيل الدخول بنجاح!', 'success');
        return res.user;
      }
    } catch (err) {
      showToast(err.message || 'فشل تسجيل الدخول.', 'error');
      throw err;
    }
  };

  const register = async (studentData) => {
    try {
      const res = await api.post('/auth/register', studentData);
      if (res.success && res.pending_approval) {
        showToast(res.message, 'info');
        return null;
      }
      if (res.success && res.token) {
        localStorage.setItem('wasel_token', res.token);
        localStorage.setItem('wasel_user', JSON.stringify(res.user));
        setToken(res.token);
        setUser(res.user);
        showToast(res.message || 'تم إنشاء الحساب بنجاح!', 'success');
        return res.user;
      }
    } catch (err) {
      showToast(err.message || 'فشل إنشاء الحساب.', 'error');
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('wasel_token');
    localStorage.removeItem('wasel_user');
    setToken(null);
    setUser(null);
    showToast('تم تسجيل الخروج بنجاح.', 'info');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        token,
        loading,
        login,
        register,
        logout,
        showToast,
        toast,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
