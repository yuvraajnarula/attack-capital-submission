// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useAuthInit, useAuthActions } from '../hooks/useAuth';
import { useRecordings,Recording } from '../hooks/useRecording';

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const { isLoading } = useAuthInit(); 
  const { signOut } = useAuthActions();
  const router = useRouter();
  
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);
  const [error, setError] = useState<string>('');
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    processing: 0
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Load recordings from backend
  useEffect(() => {
    const loadRecordings = async () => {
      if (isAuthenticated && !isLoading) {
        setIsLoadingRecordings(true);
        setError('');
        
        try {
          const response = await fetch('/api/recordings?limit=10&offset=0', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error('Failed to fetch recordings');
          }

          const data: RecordingsResponse = await response.json();
          
          if (data.success) {
            setRecordings(data.recordings);
            
            // Calculate stats
            const total = data.pagination.total;
            const completed = data.recordings.filter(r => r.status === 'COMPLETED').length;
            const processing = data.recordings.filter(r => r.status === 'PROCESSING').length;
            
            setStats({ total, completed, processing });
          }
        } catch (error) {
          console.error('Failed to load recordings:', error);
          setError('Failed to load recordings. Please try again.');
        } finally {
          setIsLoadingRecordings(false);
        }
      }
    };

    loadRecordings();
  }, [isAuthenticated, isLoading]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: Recording['status']) => {
    switch (status) {
      case 'RECORDING':
        return 'bg-red-500';
      case 'PAUSED':
        return 'bg-yellow-500';
      case 'PROCESSING':
        return 'bg-blue-500';
      case 'COMPLETED':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: Recording['status']) => {
    switch (status) {
      case 'RECORDING':
        return 'Recording';
      case 'PAUSED':
        return 'Paused';
      case 'PROCESSING':
        return 'Processing';
      case 'COMPLETED':
        return 'Completed';
      default:
        return 'Unknown';
    }
  };

  const handleCreateRecording = async (source: 'mic' | 'tab') => {
    try {
      const title = `${source === 'mic' ? 'Mic' : 'Tab'} Recording - ${new Date().toLocaleString()}`;
      
      const response = await fetch('/api/recordings', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new Error('Failed to create recording');
      }

      const data = await response.json();
      
      if (data.success) {
        // Redirect to recording page or show success
        alert(`Recording created successfully!\n\nRecording ID: ${data.recording.id}\n\nThis will navigate to the recording interface.`);
        
        // Refresh recordings list
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to create recording:', error);
      alert('Failed to create recording. Please try again.');
    }
  };

  const handleViewRecording = (id: string) => {
    router.push(`/recordings/${id}`);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
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
                  className="text-blue-600 dark:text-blue-400 font-medium border-b-2 border-blue-600 dark:border-blue-400 px-3 py-2"
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
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium px-3 py-2"
                >
                  Settings
                </Link>
              </nav>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Welcome, {user?.name}
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
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome back, {user?.name}!
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Ready to capture your next meeting? Start a new recording or review past sessions.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => handleCreateRecording('mic')}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow text-left w-full"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Start Mic Recording
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Capture audio directly from your microphone
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleCreateRecording('tab')}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow text-left w-full"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Record Tab Audio
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Capture audio from browser tabs or applications
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </div>
            </div>
          </button>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Session Stats
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {stats.total} total recordings
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {stats.completed} completed
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Recordings Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Recent Recordings
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {recordings.length} of {stats.total} sessions
              </span>
            </div>
          </div>
          
          <div className="p-6">
            {isLoadingRecordings ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : recordings.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                  No recordings yet
                </h3>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                  Get started by creating your first recording session.
                </p>
                <div className="mt-6 space-x-4">
                  <button
                    onClick={() => handleCreateRecording('mic')}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Start Mic Recording
                  </button>
                  <button
                    onClick={() => handleCreateRecording('tab')}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Record Tab Audio
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {recordings.map((recording) => (
                  <div
                    key={recording.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(recording.status)}`}></div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {recording.title}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(recording.createdAt)} • {formatDuration(recording.duration)}
                        </p>
                        {recording.summary && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            {recording.summary}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        recording.status === 'COMPLETED' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      }`}>
                        {getStatusText(recording.status)}
                      </span>
                      
                      <button 
                        onClick={() => handleViewRecording(recording.id)}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Real-time Transcription</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              See your audio transcribed live as you speak with AI-powered accuracy
            </p>
          </div>

          <div className="text-center p-6">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">AI Summarization</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Get automatic meeting summaries with key points and action items
            </p>
          </div>

          <div className="text-center p-6">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Session History</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Access all your past recordings with search and filter capabilities
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}