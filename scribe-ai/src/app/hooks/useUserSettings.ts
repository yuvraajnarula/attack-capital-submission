import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';

interface ProfileData {
  name: string;
  email: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
}

interface PreferencesData {
  transcriptionLanguage: string;
  autoSummarize: boolean;
  emailNotifications: boolean;
  theme: string;
}

interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  user?: any;
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

  const handleApiCall = async (
    url: string,
    method: string,
    body?: any
  ): Promise<ApiResponse | null> => {
    try {
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        ...(body && { body: JSON.stringify(body) }),
      });

      const text = await response.text();
      let data: ApiResponse | null = null;

      if (text && text.trim()) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          throw new Error('Invalid response from server');
        }
      }

      if (!response.ok) {
        throw new Error(data?.error || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Request failed';
      setError(errorMessage);
      throw err;
    }
  };

  const updateProfile = useCallback(async (profileData: ProfileData): Promise<boolean> => {
    setIsLoading(true);
    clearMessages();

    try {
      const data = await handleApiCall('/api/user/profile', 'PUT', profileData);

      if (data?.user) {
        updateUser(data.user);
      }

      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(null), 5000);
      return true;
    } catch (err) {
      console.error('Update profile error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [updateUser, clearMessages]);

  const updatePassword = useCallback(async (passwordData: PasswordData): Promise<boolean> => {
    setIsLoading(true);
    clearMessages();

    try {
      await handleApiCall('/api/user/password', 'PUT', passwordData);
      setSuccessMessage('Password updated successfully!');
      setTimeout(() => setSuccessMessage(null), 5000);
      return true;
    } catch (err) {
      console.error('Update password error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [clearMessages]);

  const updatePreferences = useCallback(async (preferencesData: PreferencesData): Promise<boolean> => {
    setIsLoading(true);
    clearMessages();

    try {
      await handleApiCall('/api/user/preferences', 'PUT', preferencesData);
      setSuccessMessage('Preferences updated successfully!');
      setTimeout(() => setSuccessMessage(null), 5000);
      return true;
    } catch (err) {
      console.error('Update preferences error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [clearMessages]);

  const fetchPreferences = useCallback(async (): Promise<PreferencesData | null> => {
    clearMessages();

    try {
      const data = await handleApiCall('/api/user/preferences', 'GET');
      return data?.preferences || null;
    } catch (err) {
      console.error('Fetch preferences error:', err);
      return null;
    }
  }, [clearMessages]);

  const deleteAccount = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    clearMessages();

    try {
      await handleApiCall('/api/user/account', 'DELETE');
      return true;
    } catch (err) {
      console.error('Delete account error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [clearMessages]);

  return {
    isLoading,
    error,
    successMessage,
    clearMessages,
    updateProfile,
    updatePassword,
    updatePreferences,
    fetchPreferences,
    deleteAccount,
  };
};