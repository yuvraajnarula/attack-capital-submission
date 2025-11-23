'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useAuthInit } from '../../hooks/useAuth';
import { useRecordings, Recording } from '../../hooks/useRecording';

export default function RecordingDetailPage() {
  const { user, isAuthenticated } = useAuth();
  const { isLoading: authLoading } = useAuthInit();
  const { getRecording, error: recordingsError } = useRecordings();
  const router = useRouter();
  const params = useParams();
  const recordingId = params?.id as string;

  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log('RecordingDetailPage mounted, recordingId:', recordingId);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log('Not authenticated, redirecting to login');
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Fetch recording details using the hook
  useEffect(() => {
    if (!recordingId || !isAuthenticated) {
      console.log('No recordingId or not authenticated, skipping fetch');
      return;
    }

    const fetchRecording = async () => {
      try {
        console.log('Fetching recording:', recordingId);
        setLoading(true);
        setError(null);

        const recordingData = await getRecording(recordingId);
        console.log('Recording data received:', recordingData);

        if (recordingData) {
          setRecording(recordingData);
        } else {
          throw new Error('Recording not found');
        }
      } catch (err) {
        console.error('Error fetching recording:', err);
        setError(err instanceof Error ? err.message : 'Failed to load recording');
      } finally {
        setLoading(false);
      }
    };

    fetchRecording();
  }, [recordingId, isAuthenticated, getRecording]);

  // Also capture errors from the hook
  useEffect(() => {
    if (recordingsError) {
      setError(recordingsError);
    }
  }, [recordingsError]);
  
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading recording...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/dashboard" className="text-2xl font-bold text-gray-900 dark:text-white">
                ScribeAI
              </Link>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">Error Loading Recording</h2>
            <p className="text-red-600 dark:text-red-300">{error}</p>
            <div className="mt-4">
              <Link
                href="/recordings"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                ← Back to Recordings
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/dashboard" className="text-2xl font-bold text-gray-900 dark:text-white">
                ScribeAI
              </Link>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Recording Not Found</h2>
            <p className="text-yellow-600 dark:text-yellow-300">The recording you're looking for doesn't exist.</p>
            <div className="mt-4">
              <Link
                href="/recordings"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                ← Back to Recordings
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-2xl font-bold text-gray-900 dark:text-white">
                ScribeAI
              </Link>
              <nav className="ml-8 flex space-x-4">
                <Link
                  href="/dashboard"
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium px-3 py-2"
                >
                  Dashboard
                </Link>
                <Link
                  href="/recordings"
                  className="text-blue-600 dark:text-blue-400 font-medium border-b-2 border-blue-600 dark:border-blue-400 px-3 py-2"
                >
                  Recordings
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
                {user?.name}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Link
            href="/recordings"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center"
          >
            <span className="mr-2">←</span>
            Back to Recordings
          </Link>
        </div>

        {/* Recording Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {recording.title}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>📅 {formatDate(recording.createdAt)}</span>
                <span>⏱️ {formatDuration(recording.duration)}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${recording.status === 'COMPLETED'
                    ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                    : recording.status === 'PROCESSING'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                  }`}>
                  {recording.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Section */}
        {recording.summary && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="mr-2">🤖</span>
              AI Summary
            </h2>
            <div className="prose dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {recording.summary}
              </div>
            </div>
          </div>
        )}

        {/* Transcript Section */}
        {recording.transcript && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="mr-2">📝</span>
              Full Transcript
            </h2>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 font-mono text-sm">

                {recording.transcript}
              </div>
            </div>
          </div>
        )}

        {/* No Content Message */}
        {!recording.summary && !recording.transcript && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <p>No transcript or summary available yet.</p>
              {recording.status === 'PROCESSING' && (
                <p className="mt-2">The recording is still being processed. Please check back in a moment.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}