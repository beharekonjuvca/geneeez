import { createContext, useContext, useEffect, useState } from "react";
import { api, setAccess } from "../lib/api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await api.post("/auth/refresh");
        if (!mounted) return;
        setAccess(r.data.access);
        const me = await api.get("/auth/me");
        if (!mounted) return;
        setUser(me.data);
      } catch {
        if (!mounted) return;
        setUser(null);
        setAccess(null);
      } finally {
        if (mounted) setInitializing(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const signup = async (email, password) => {
    const r = await api.post("/auth/signup", { email, password });
    setAccess(r.data.access);
    setUser(r.data.user);
    return r.data.user;
  };

  const login = async (email, password) => {
    const r = await api.post("/auth/login", { email, password });
    setAccess(r.data.access);
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setAccess(null);
      setUser(null);
    }
  };

  return (
    <AuthCtx.Provider value={{ user, initializing, signup, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
