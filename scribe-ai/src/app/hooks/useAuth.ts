import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect, useRef } from 'react';
// ---------------------- Types ----------------------
export interface User {
  id: string;
  email: string;
  name?: string | null;
  emailVerified?: boolean;
  image?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt?: Date | null;
  token?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface CoreAuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
}

interface UIAuthState {
  isLoading: boolean; // global auth check loading
  isActionLoading: boolean; // sign in / sign up / sign out
  authReady: boolean; // has initial restore/check completed
}

interface AuthActions {
  login: (user: User, session: Session) => void;
  logout: () => Promise<void>;
  setLoading: (v: boolean) => void;
  setActionLoading: (v: boolean) => void;
  updateUser: (patch: Partial<User>) => void;
}

type AuthState = CoreAuthState & UIAuthState & AuthActions;

const safeJsonParse = (text: string | null) => {
  if (!text || (typeof text === 'string' && text.trim() === '')) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

const reviveDates = <T extends Record<string, any>>(obj: T): T => {
  if (!obj || typeof obj !== 'object') return obj;
  const out: Record<string, any> = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      out[k] = v;
    } else if (typeof v === 'string') {
      // naive ISO date detection
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/;
      if (isoDateRegex.test(v)) out[k] = new Date(v);
      else out[k] = v;
    } else if (typeof v === 'object') {
      out[k] = reviveDates(v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
};

const clearCookie = (name: string) => {
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`;
};

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      // core
      user: null,
      session: null,
      isAuthenticated: false,
      // ui
      isLoading: false,
      isActionLoading: false,
      authReady: false,

      // actions
      login: (user: User, session: Session) => {
        const u = reviveDates(user);
        const s = reviveDates(session);
        set({ user: u, session: s, isAuthenticated: true });
      },

      logout: async () => {
        set({ isActionLoading: true });
        try {
          await fetch('/api/auth/sign-out', {
            method: 'POST',
            credentials: 'include',
          });
        } catch (err) {
          console.error('Sign-out request failed:', err);
        } finally {
          try {
            clearCookie('better-auth.session_token');
          } catch (e) {
            console.error('Failed to clear auth cookies:', e);}

          set({ user: null, session: null, isAuthenticated: false });
          set({ isActionLoading: false });
        }
      },

      setLoading: (v: boolean) => set({ isLoading: v }),
      setActionLoading: (v: boolean) => set({ isActionLoading: v }),

      updateUser: (patch: Partial<User>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : null,
        }));
      },

      // authReady will be set by useAuthInit after initial check/rehydration
    }),
    {
      name: 'auth-storage',
      // store only essential pieces that are safe to persist
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
      version: 1,
      // migrate stub if you ever need it later
      migrate: (persistedState, version) => persistedState as any,
    }
  )
);

export const useAuthInit = () => {
  const setLoading = useAuth((s) => s.setLoading);
  const setAuthReady = useAuth((s) => s.setActionLoading); // reuse actionLoading setter briefly
  const login = useAuth((s) => s.login);
  const logout = useAuth((s) => s.logout);
  const authReadyRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/get-session', {
          method: 'GET',
          credentials: 'include',
        });

        if (!mounted) return;

        if (!res.ok) {
          await logout();
          return;
        }

        const text = await res.text();
        const data = safeJsonParse(text);

        if (data?.user && data?.session) {
          login(reviveDates(data.user), reviveDates(data.session));
        } else {
          await logout();
        }
      } catch (err) {
        console.error('Auth init failed:', err);
        await logout();
      } finally {
        if (!mounted) return;
        setLoading(false);
        (useAuth as any).setState({ authReady: true });
        authReadyRef.current = true;
      }
    };

    check();

    return () => {
      mounted = false;
    };
  }, []);

  const isLoading = useAuth((s) => s.isLoading);
  const authReady = useAuth((s) => s.authReady);

  return { isLoading, authReady };
};
export const useRefreshSession = () => {
  const login = useAuth((s) => s.login);
  const logout = useAuth((s) => s.logout);
  const lastRef = useRef(0);

  const refreshSession = async (): Promise<boolean> => {
    const now = Date.now();
    // throttle to once per 20s client-side calls
    if (now - lastRef.current < 20_000) return false;
    lastRef.current = now;

    try {
      const res = await fetch('/api/auth/get-session', {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) {
        await logout();
        return false;
      }

      const text = await res.text();
      const data = safeJsonParse(text);
      if (data?.user && data?.session) {
        login(reviveDates(data.user), reviveDates(data.session));
        return true;
      }

      await logout();
      return false;
    } catch (err) {
      console.error('Refresh session failed:', err);
      await logout();
      return false;
    }
  };

  return refreshSession;
};

export const useAuthActions = () => {
  const login = useAuth((s) => s.login);
  const logout = useAuth((s) => s.logout);
  const setActionLoading = useAuth((s) => s.setActionLoading);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    if (password.length < 6) return 'Password must be at least 6 characters long';
    if (!/(?=.*[a-z])/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/(?=.*[A-Z])/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/(?=.*\d)/.test(password)) return 'Password must contain at least one number';
    return null;
  };

  const handleJsonResponse = async (res: Response) => {
    const text = await res.text();
    const data = safeJsonParse(text);
    return { ok: res.ok, status: res.status, data } as { ok: boolean; status: number; data: any | null };
  };

  const signIn = async (email: string, password: string) => {
    setActionLoading(true);
    try {
      if (!validateEmail(email)) {
        return { success: false, error: 'Please enter a valid email address' };
      }

      const res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const { ok, status, data } = await handleJsonResponse(res);

      if (!ok) {
        return { success: false, error: data?.error?.message || data?.message || `Sign in failed (status ${status})` };
      }

      if (data?.user && data?.session) {
        login(reviveDates(data.user), reviveDates(data.session));
        return { success: true, data };
      }

      return { success: false, error: 'Invalid response from server' };
    } catch (err) {
      console.error('Sign in error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Sign in failed' };
    } finally {
      setActionLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    setActionLoading(true);
    try {
      if (!validateEmail(email)) return { success: false, error: 'Please enter a valid email address' };
      const pwErr = validatePassword(password);
      if (pwErr) return { success: false, error: pwErr };

      const res = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name, type: 'credential' }),
      });

      const { ok, status, data } = await handleJsonResponse(res);

      if (!ok) {
        return { success: false, error: data?.error?.message || data?.message || `Sign up failed (status ${status})` };
      }

      if (data?.user && data?.session) {
        login(reviveDates(data.user), reviveDates(data.session));
        return { success: true, data };
      }

      return { success: false, error: 'Invalid response from server' };
    } catch (err) {
      console.error('Sign up error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Sign up failed' };
    } finally {
      setActionLoading(false);
    }
  };

  const signOut = async () => {
    setActionLoading(true);
    try {
      await logout();
      return { success: true };
    } catch (err) {
      console.error('Sign out error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Sign out failed' };
    } finally {
      setActionLoading(false);
    }
  };

  return { signIn, signUp, signOut, validateEmail, validatePassword };
};

export const useAuthSelectors = () => {
  const user = useAuth((s) => s.user);
  const session = useAuth((s) => s.session);
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const isLoading = useAuth((s) => s.isLoading);
  const isActionLoading = useAuth((s) => s.isActionLoading);
  const authReady = useAuth((s) => s.authReady);
  return { user, session, isAuthenticated, isLoading, isActionLoading, authReady };
};
