// app/settings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useAuthInit, useAuthActions } from '../hooks/useAuth';
import { useUserSettings } from '../hooks/useUserSettings';

export default function Settings() {
  const { user, isAuthenticated, updateUser } = useAuth();
  const { isLoading } = useAuthInit();
  const { signOut } = useAuthActions();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'profile' | 'account'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
  });

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Preferences form
  const [preferencesForm, setPreferencesForm] = useState({
    transcriptionLanguage: 'en-US',
    autoSummarize: true,
    emailNotifications: true,
    theme: 'system',
  });

  // Check authentication
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Load user data
  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        email: user.email || '',
      });
    }
  }, [user]);

  // Load preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (isAuthenticated && !isLoading) {
        try {
          const response = await fetch('/api/user/preferences', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.preferences) {
              setPreferencesForm(data.preferences);
            }
          }
        } catch (error) {
          console.error('Failed to load preferences:', error);
        }
      }
    };

    loadPreferences();
  }, [isAuthenticated, isLoading]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const showMessage = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      setSuccessMessage(message);
      setErrorMessage('');
      setTimeout(() => setSuccessMessage(''), 5000);
    } else {
      setErrorMessage(message);
      setSuccessMessage('');
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(profileForm),
      });

      const text = await response.text();
      let data;
      
      if (text && text.trim()) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error('Invalid response from server');
        }
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update profile');
      }

      // Update user in auth store
      if (data.user) {
        updateUser(data.user);
      }

      showMessage('success', 'Profile updated successfully!');
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('error', 'New passwords do not match');
      setIsSaving(false);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      showMessage('error', 'Password must be at least 6 characters');
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const text = await response.text();
      let data;
      
      if (text && text.trim()) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error('Invalid response from server');
        }
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update password');
      }

      showMessage('success', 'Password updated successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreferencesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(preferencesForm),
      });

      const text = await response.text();
      let data;
      
      if (text && text.trim()) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error('Invalid response from server');
        }
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update preferences');
      }

      showMessage('success', 'Preferences updated successfully!');
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to update preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('⚠️ Are you sure you want to delete your account?\n\nThis action cannot be undone.')) {
      return;
    }

    if (!confirm('⚠️ FINAL WARNING: This will permanently delete all your recordings and data.\n\nAre you absolutely sure?')) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/user/account', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || 'Failed to delete account');
      }

      // Sign out and redirect
      await signOut();
      router.push('/');
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to delete account');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                ScribeAI
              </h1>
              <nav className="ml-8 flex space-x-4">
                <Link
                  href="/dashboard"
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium px-3 py-2"
                >
                  Dashboard
                </Link>
                <Link
                  href="/recordings"
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium px-3 py-2"
                >
                  Sessions
                </Link>
                <Link
                  href="/settings"
                  className="text-blue-600 dark:text-blue-400 font-medium border-b-2 border-blue-600 dark:border-blue-400 px-3 py-2"
                >
                  Settings
                </Link>
              </nav>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {user?.name}
              </span>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 px-3 py-1 rounded border border-gray-300 dark:border-gray-600"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Settings
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-800 dark:text-green-200 text-sm">{successMessage}</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <p className="text-red-800 dark:text-red-200 text-sm">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <nav className="space-y-2">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors flex items-center ${
                    activeTab === 'profile'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </button>
                <button
                  onClick={() => setActiveTab('account')}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors flex items-center ${
                    activeTab === 'account'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Account Security
                </button>
            
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                    Profile Information
                  </h3>
                  <form onSubmit={handleProfileSubmit} className="space-y-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Full Name
                      </label>
                      <input
                        id="name"
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email Address
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Changing your email will require re-verification
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                      >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Account Security Tab */}
              {activeTab === 'account' && (
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                    Account Security
                  </h3>
                  
                  {/* Change Password */}
                  <form onSubmit={handlePasswordSubmit} className="space-y-6 mb-8">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                      Change Password
                    </h4>
                    
                    <div>
                      <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Current Password
                      </label>
                      <input
                        id="currentPassword"
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        New Password
                      </label>
                      <input
                        id="newPassword"
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Must be at least 6 characters long
                      </p>
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Confirm New Password
                      </label>
                      <input
                        id="confirmPassword"
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                      >
                        {isSaving ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  </form>

                  {/* Delete Account */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                    <h4 className="text-lg font-medium text-red-600 dark:text-red-400 mb-4">
                      Danger Zone
                    </h4>
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                      <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">
                        ⚠️ Warning: This action is irreversible
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        Once you delete your account, there is no going back. All your recordings, transcripts, and data will be permanently deleted.
                      </p>
                    </div>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={isSaving}
                      className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                    >
                      {isSaving ? 'Deleting...' : 'Delete Account'}
                    </button>
                  </div>
                </div>
              )}

              {/* Preferences Tab */}
              {activeTab === 'preferences' && (
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                    Preferences
                  </h3>
                  <form onSubmit={handlePreferencesSubmit} className="space-y-6">
                    <div>
                      <label htmlFor="transcriptionLanguage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Transcription Language
                      </label>
                      <select
                        id="transcriptionLanguage"
                        value={preferencesForm.transcriptionLanguage}
                        onChange={(e) => setPreferencesForm({ ...preferencesForm, transcriptionLanguage: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="en-US">English (US)</option>
                        <option value="en-GB">English (UK)</option>
                        <option value="es-ES">Spanish</option>
                        <option value="fr-FR">French</option>
                        <option value="de-DE">German</option>
                        <option value="ja-JP">Japanese</option>
                        <option value="zh-CN">Chinese (Simplified)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="theme" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Theme
                      </label>
                      <select
                        id="theme"
                        value={preferencesForm.theme}
                        onChange={(e) => setPreferencesForm({ ...preferencesForm, theme: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="system">System</option>
                      </select>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="autoSummarize"
                            type="checkbox"
                            checked={preferencesForm.autoSummarize}
                            onChange={(e) => setPreferencesForm({ ...preferencesForm, autoSummarize: e.target.checked })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </div>
                        <div className="ml-3">
                          <label htmlFor="autoSummarize" className="font-medium text-gray-700 dark:text-gray-300">
                            Auto-generate summaries
                          </label>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Automatically generate AI summaries after each recording
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="emailNotifications"
                            type="checkbox"
                            checked={preferencesForm.emailNotifications}
                            onChange={(e) => setPreferencesForm({ ...preferencesForm, emailNotifications: e.target.checked })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </div>
                        <div className="ml-3">
                          <label htmlFor="emailNotifications" className="font-medium text-gray-700 dark:text-gray-300">
                            Email notifications
                          </label>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Receive email alerts when transcriptions are completed
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                      >
                        {isSaving ? 'Saving...' : 'Save Preferences'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}