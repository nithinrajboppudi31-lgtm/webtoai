import Rea.t, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Fetch the latest user profile and credit count directly from the backend
  const refreshUser = async (authToken) => {
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
  };

  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem('user');
      const savedToken = localStorage.getItem('token');

      if (savedToken) {
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (err) {
            console.error('Failed to parse saved user', err);
          }
        }
        // Sync with backend to get fresh credits immediately
        await refreshUser(savedToken);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    // Fetch fresh database record right after login
    refreshUser(newToken);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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