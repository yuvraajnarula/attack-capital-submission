'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useAuthInit } from '../hooks/useAuth';
import { Recording, useRecordings } from '../hooks/useRecording';

export default function RecordingsPage() {
    const { user, isAuthenticated } = useAuth();
    const { isLoading } = useAuthInit();
    const router = useRouter();
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [isLoadingRecordings, setIsLoadingRecordings] = useState(true);
    const [error, setError] = useState<string>('');

    const { fetchRecordings } = useRecordings();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, isLoading, router]);

    useEffect(() => {
        const loadRecordings = async () => {
            if (!isAuthenticated) return;

            setIsLoadingRecordings(true);
            setError('');

            try {
                const userRecordings: Recording[] = await fetchRecordings();
                setRecordings(userRecordings); 
            } catch (error) {
                console.error('Failed to fetch recordings:', error);
                setError('Failed to load recordings');
            } finally {
                setIsLoadingRecordings(false);
            }
        };

        loadRecordings();
    }, [isAuthenticated, fetchRecordings]);

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
                                    Sessions
                                </Link>
                            </nav>
                        </div>

                        <div className="flex items-center space-x-4">
                            <Link
                                href="/recordings/new"
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                + New Recording
                            </Link>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                {user?.name}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Recording Sessions
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        View all your recorded sessions and their transcripts
                    </p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
                    </div>
                )}

                {isLoadingRecordings ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : recordings.length > 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            <div className="col-span-5">Title</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-2">Duration</div>
                            <div className="col-span-3">Created</div>
                        </div>

                        {/* Recordings List */}
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {recordings.map((recording) => (
                                <div
                                    key={recording.id}
                                    className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                                    onClick={() => router.push(`/recordings/${recording.id}`)}
                                >
                                    <div className="col-span-5">
                                        <div className="flex items-center space-x-3">
                                            <div className={`w-2 h-2 rounded-full ${getStatusColor(recording.status)}`}></div>
                                            <div>
                                                <h3 className="font-medium text-gray-900 dark:text-white">
                                                    {recording.title}
                                                </h3>
                                                {recording.transcript && (
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">
                                                        {recording.transcript.slice(0, 100)}...
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${recording.status === 'COMPLETED'
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

                                    <div className="col-span-2">
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                            {formatDuration(recording.duration)}
                                        </span>
                                    </div>

                                    <div className="col-span-3">
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                            {formatDate(recording.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            No recordings yet
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">
                            Get started by creating your first recording session.
                        </p>
                        <Link
                            href="/recordings/new"
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                            + New Recording
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
}