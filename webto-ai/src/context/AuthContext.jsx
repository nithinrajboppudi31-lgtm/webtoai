import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  // Fetch the latest user profile and credit count directly from the backend
  const refreshUser = useCallback(async (authToken) => {
    const activeToken = authToken || token || localStorage.getItem('token');
    if (!activeToken) return null;

    try {
      const res = await fetch('https://webtoai-backend.onrender.com/api/auth/me', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
          return data.user;
        }
      } else if (res.status === 401) {
        logout();
      }
    } catch (err) {
      console.error('Failed to sync user data from backend:', err);
    }
    return null;
  }, [token, logout]);

  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem('user');
      const savedToken = localStorage.getItem('token');

      if (savedToken) {
        setToken(savedToken);
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (err) {
            console.error('Failed to parse saved user', err);
            localStorage.removeItem('user');
          }
        }
        // Sync with backend to get fresh credits immediately
        await refreshUser(savedToken);
      }
      setLoading(false);
    };

    initAuth();
  }, [refreshUser]);

  const login = (newToken, newUser) => {
    setToken(newToken);
    if (newUser) {
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
    }
    if (newToken) {
      localStorage.setItem('token', newToken);
      refreshUser(newToken);
    }
  };

  const updateUser = (updatedFields) => {
    setUser((prev) => {
      const updated = { ...prev, ...updatedFields };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, setUser, token, loading, login, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}