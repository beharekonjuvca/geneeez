import { createContext, useContext, useEffect, useState } from "react";
import {
  apiLogin,
  apiLogout,
  apiSignup,
  apiRefresh,
  apiMe,
} from "../lib/api/auth";
import { setAccess } from "../lib/api/client";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await apiRefresh();
        const me = await apiMe();
        if (mounted) setUser(me);
      } catch {
        if (mounted) {
          setUser(null);
          setAccess(null);
        }
      } finally {
        if (mounted) setInitializing(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const signup = async (email, password) => {
    const { user } = await apiSignup(email, password);
    setUser(user);
    return user;
  };

  const login = async (email, password) => {
    const { user } = await apiLogin(email, password);
    setUser(user);
    return user;
  };

  const logout = async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setAccess(null);
    }
  };

  return (
    <AuthCtx.Provider value={{ user, initializing, signup, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
