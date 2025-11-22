import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';

export interface User {
  id: string;
  name: string;
  email: string;
  // Add any additional fields your backend returns
}

export interface ProfileData {
  name: string;
  email: string;
}

export interface PasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface PreferencesData {
  transcriptionLanguage: string;
  autoSummarize: boolean;
  emailNotifications: boolean;
  theme: string;
}

export interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  user?: User;
  preferences?: PreferencesData;
}

export const useUserSettings = () => {
  const { updateUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  // Generic API handler with strict typing
  const handleApiCall = async <TBody, TResponse>(
    url: string,
    method: string,
    body?: TBody
  ): Promise<TResponse | null> => {
    try {
      setIsLoading(true);

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...(body && { body: JSON.stringify(body) }),
      });

      const raw = await response.text();
      let data: TResponse | null = null;

      if (raw.trim()) {
        try {
          data = JSON.parse(raw) as TResponse;
        } catch {
          throw new Error('Invalid response from server');
        }
      }

      if (!response.ok) {
        const errMsg =
          (data as ApiResponse | null)?.error || `Request failed with status ${response.status}`;
        throw new Error(errMsg);
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = useCallback(
    async (profileData: ProfileData): Promise<boolean> => {
      clearMessages();

      try {
        const data = await handleApiCall<ProfileData, ApiResponse>(
          '/api/user/profile',
          'PUT',
          profileData
        );

        if (data?.user) {
          updateUser(data.user);
        }

        setSuccessMessage('Profile updated successfully!');
        setTimeout(() => setSuccessMessage(null), 5000);
        return true;
      } catch (err) {
        console.error('Update profile error:', err);
        return false;
      }
    },
    [updateUser, clearMessages]
  );

  const updatePassword = useCallback(
    async (passwordData: PasswordData): Promise<boolean> => {
      clearMessages();

      try {
        await handleApiCall<PasswordData, ApiResponse>(
          '/api/user/password',
          'PUT',
          passwordData
        );

        setSuccessMessage('Password updated successfully!');
        setTimeout(() => setSuccessMessage(null), 5000);
        return true;
      } catch (err) {
        console.error('Update password error:', err);
        return false;
      }
    },
    [clearMessages]
  );

  const updatePreferences = useCallback(
    async (preferencesData: PreferencesData): Promise<boolean> => {
      clearMessages();

      try {
        await handleApiCall<PreferencesData, ApiResponse>(
          '/api/user/preferences',
          'PUT',
          preferencesData
        );

        setSuccessMessage('Preferences updated successfully!');
        setTimeout(() => setSuccessMessage(null), 5000);
        return true;
      } catch (err) {
        console.error('Update preferences error:', err);
        return false;
      }
    },
    [clearMessages]
  );

  const deleteAccount = useCallback(
    async (): Promise<boolean> => {
      clearMessages();

      try {
        await handleApiCall<undefined, ApiResponse>(
          '/api/user/account',
          'DELETE'
        );
        return true;
      } catch (err) {
        console.error('Delete account error:', err);
        return false;
      }
    },
    [clearMessages]
  );

  return {
    isLoading,
    error,
    successMessage,
    clearMessages,
    updateProfile,
    updatePassword,
    updatePreferences,
    deleteAccount,
  };
};
