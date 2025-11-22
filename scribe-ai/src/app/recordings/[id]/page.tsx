'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useAuthInit } from '../../hooks/useAuth';

interface Recording {
  id: string;
  title: string;
  status: 'RECORDING' | 'PAUSED' | 'PROCESSING' | 'COMPLETED';
  transcript: string | null;
  summary: string | null;
  duration: number | null;
  audioUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RecordingDetailResponse {
  success: boolean;
  recording: Recording;
}

export default function RecordingDetailPage({ params }: { params: { id: string } }) {
  const { user, isAuthenticated } = useAuth();
  const { isLoading } = useAuthInit();
  const router = useRouter();
  
  const [recording, setRecording] = useState<Recording | null>(null);
  const [isLoadingRecording, setIsLoadingRecording] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const fetchRecording = async () => {
      if (!isAuthenticated || !params.id) return;

      setIsLoadingRecording(true);
      setError('');

      try {
        const response = await fetch(`/api/recordings/${params.id}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Recording not found');
          }
          throw new Error('Failed to fetch recording');
        }

        const data: RecordingDetailResponse = await response.json();
        
        if (data.success) {
          setRecording(data.recording);
        } else {
          throw new Error('Failed to load recording');
        }
      } catch (error) {
        console.error('Failed to fetch recording:', error);
        setError(error instanceof Error ? error.message : 'Failed to load recording');
      } finally {
        setIsLoadingRecording(false);
      }
    };

    fetchRecording();
  }, [params.id, isAuthenticated]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Link
            href="/recordings"
            className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to All Recordings
          </Link>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {isLoadingRecording ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : recording ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            {/* Recording Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {recording.title}
                  </h1>
                  <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>Created: {formatDate(recording.createdAt)}</span>
                    {recording.duration && (
                      <span>Duration: {formatDuration(recording.duration)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(recording.status)}`}></div>
                  <span className={`px-3 py-1 text-sm rounded-full ${
                    recording.status === 'COMPLETED' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : recording.status === 'PROCESSING'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : recording.status === 'RECORDING'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}>
                    {getStatusText(recording.status)}
                  </span>
                </div>
              </div>
            </div>

            {/* Transcript Section */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Transcript
              </h2>
              {recording.transcript ? (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    {recording.transcript}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>No transcript available</p>
                  {recording.status === 'PROCESSING' && (
                    <p className="text-sm mt-2">Transcript is being processed...</p>
                  )}
                </div>
              )}
            </div>

            {/* Summary Section */}
            {recording.summary && (
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  AI Summary
                </h2>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    {recording.summary}
                  </pre>
                </div>
              </div>
            )}

            {/* Recording Metadata */}
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Recording Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Recording ID:</span>
                  <p className="text-gray-900 dark:text-white font-mono">{recording.id}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Status:</span>
                  <p className="text-gray-900 dark:text-white">{getStatusText(recording.status)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Created:</span>
                  <p className="text-gray-900 dark:text-white">{formatDate(recording.createdAt)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Last Updated:</span>
                  <p className="text-gray-900 dark:text-white">{formatDate(recording.updatedAt)}</p>
                </div>
                {recording.duration && (
                  <div>
                    <span className="font-medium text-gray-500 dark:text-gray-400">Duration:</span>
                    <p className="text-gray-900 dark:text-white">{formatDuration(recording.duration)}</p>
                  </div>
                )}
                {recording.audioUrl && (
                  <div>
                    <span className="font-medium text-gray-500 dark:text-gray-400">Audio File:</span>
                    <a 
                      href={recording.audioUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Download Audio
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : !error && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Recording not found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {`The recording you're looking for doesn't exist or you don't have permission to access it.`}
            </p>
            <Link
              href="/recordings"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Back to Recordings
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}