import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';

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
      isLoading: false, // Changed from true to false
      isActionLoading: false,
      login: (user: User, session: Session) =>
        set({ user, session, isAuthenticated: true }),
      logout: async () => {
        try {
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
      const response = await fetch('/api/auth/get-session', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const text = await response.text();
        
        // Check if response is empty
        if (!text || text.trim() === '') {
          console.log('Empty response from auth check, logging out');
          await logout();
          return;
        }

        try {
          const data = JSON.parse(text);
          
          if (data?.user && data?.session) {
            login(data.user, data.session);
          } else {
            await logout();
          }
        } catch (parseError) {
          console.error('Failed to parse auth response:', parseError);
          await logout();
        }
      } else {
        console.log('Auth check failed with status:', response.status);
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

// Hook to automatically check auth on mount
export const useAuthInit = () => {
  const checkAuth = useAuthCheck();
  const { isLoading } = useAuth();

  useEffect(() => {
    checkAuth();
  }, []); // Only run once on mount

  return { isLoading };
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
        const text = await response.text();
        
        if (!text || text.trim() === '') {
          await logout();
          return false;
        }

        try {
          const data = JSON.parse(text);
          if (data?.user && data?.session) {
            login(data.user, data.session);
            return true;
          }
        } catch (parseError) {
          console.error('Failed to parse session response:', parseError);
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
      if (!validateEmail(email)) {
        return {
          success: false,
          error: 'Please enter a valid email address'
        };
      }

      const response = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const text = await response.text();
      
      if (!text || text.trim() === '') {
        return {
          success: false,
          error: 'Empty response from server'
        };
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse sign in response:', parseError);
        return {
          success: false,
          error: 'Invalid response from server'
        };
      }
      
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
      if (!validateEmail(email)) {
        return {
          success: false,
          error: 'Please enter a valid email address'
        };
      }

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