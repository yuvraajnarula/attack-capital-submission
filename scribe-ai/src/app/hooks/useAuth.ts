import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  token: string;
  ipAddress?: string;
  userAgent?: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isActionLoading: boolean;
  login: (user: User, session: Session) => void;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setActionLoading: (loading: boolean) => void;
  updateUser: (user: Partial<User>) => void;
}

interface AuthResponse {
  success: boolean;
  data?: {
    user: User;
    session: Session;
  };
  error?: string;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: true,
      isActionLoading: false,
      login: (user: User, session: Session) =>
        set({ user, session, isAuthenticated: true }),
      logout: async () => {
        try {
          // Call Better Auth logout endpoint
          await fetch('/api/auth/sign-out', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({ user: null, session: null, isAuthenticated: false });
        }
      },
      setLoading: (isLoading: boolean) => set({ isLoading }),
      setActionLoading: (isActionLoading: boolean) => set({ isActionLoading }),
      updateUser: (updatedFields: Partial<User>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedFields } : null,
        })),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export const useAuthCheck = () => {
  const { login, logout, setLoading } = useAuth();

  const checkAuth = async () => {
    setLoading(true);
    try {
      // Use Better Auth's session endpoint
      const response = await fetch('/api/auth/get-session', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();

        // Better Auth returns { user, session } structure
        if (data?.user && data?.session) {
          login(data.user, data.session);
        } else {
          await logout();
        }
      } else {
        await logout();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      await logout();
    } finally {
      setLoading(false);
    }
  };

  return checkAuth;
};

// Helper hook to refresh session
export const useRefreshSession = () => {
  const { login, logout } = useAuth();

  const refreshSession = async () => {
    try {
      const response = await fetch('/api/auth/get-session', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.user && data?.session) {
          login(data.user, data.session);
          return true;
        }
      }
      await logout();
      return false;
    } catch (error) {
      console.error('Session refresh failed:', error);
      await logout();
      return false;
    }
  };

  return refreshSession;
};

// Helper hook for auth actions
export const useAuthActions = () => {
  const { login, logout, setActionLoading } = useAuth();

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const signIn = async (email: string, password: string): Promise<AuthResponse> => {
    setActionLoading(true);
    try {
      // Validate email
      if (!validateEmail(email)) {
        return {
          success: false,
          error: 'Please enter a valid email address'
        };
      }

      // Validate password
      // const passwordError = validatePassword(password);
      // if (passwordError) {
      //   return {
      //     success: false,
      //     error: passwordError
      //   };
      // }

      const response = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      console.log(data)
      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Sign in failed'
        };
      }

      if (data?.user || data?.session) {
        login(data.user, data.session);
        return { success: true, data };
      }

      return {
        success: false,
        error: 'Invalid response from server'
      };
    } catch (error) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sign in failed'
      };
    } finally {
      setActionLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name?: string): Promise<AuthResponse> => {
    setActionLoading(true);
    try {
      // Validate email
      if (!validateEmail(email)) {
        return {
          success: false,
          error: 'Please enter a valid email address'
        };
      }

      // Validate password
      const passwordError = validatePassword(password);
      if (passwordError) {
        return {
          success: false,
          error: passwordError
        };
      }

      const response = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email, 
          password, 
          name, 
          type: "credential",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Sign up failed'
        };
      }

      if (data?.user && data?.session) {
        login(data.user, data.session);
        return { success: true, data };
      }

      return {
        success: false,
        error: 'Invalid response from server'
      };
    } catch (error) {
      console.error('Sign up error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sign up failed'
      };
    } finally {
      setActionLoading(false);
    }
  };

  const signOut = async () => {
    setActionLoading(true);
    try {
      await logout();
    } finally {
      setActionLoading(false);
    }
  };

  return { 
    signIn, 
    signUp, 
    signOut, 
    validateEmail, 
    validatePassword 
  };
};