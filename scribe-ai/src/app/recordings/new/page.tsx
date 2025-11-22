'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useAuthInit } from '../../hooks/useAuth';
import { useRecordings } from '../../hooks/useRecording';
import { useSocketContext } from '../../context/socket';

interface RecordingSession {
    id: string;
    title: string;
    status: 'RECORDING' | 'PAUSED' | 'PROCESSING' | 'COMPLETED';
    transcript: string;
    summary: string;
    duration: number;
    createdAt: string;
}

export default function NewRecordingPage() {
    const { user, isAuthenticated } = useAuth();
    const { isLoading } = useAuthInit();
    const router = useRouter();

    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentSession, setCurrentSession] = useState<RecordingSession | null>(null);
    const [recordingMode, setRecordingMode] = useState<'microphone' | 'screen'>('microphone');
    const [transcript, setTranscript] = useState('');
    const [summary, setSummary] = useState('');
    const [recordingTime, setRecordingTime] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

    const { createRecording } = useRecordings();
    const { isConnected, emit, on, off } = useSocketContext();

    // Redirect if not authenticated
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, isLoading, router]);

    // Initialize media devices
    const initializeMedia = useCallback(async () => {
        try {
            let stream: MediaStream;

            if (recordingMode === 'screen') {
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100,
                    }
                });

                stream.getVideoTracks()[0].onended = () => {
                    if (isRecording && !isPaused) {
                        stopRecording();
                    }
                };
            } else {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100,
                    }
                });
            }

            streamRef.current = stream;
            return stream;
        } catch (error) {
            console.error('Error initializing media:', error);
            throw error;
        }
    }, [recordingMode, isRecording, isPaused]);

    // Start recording timer
    const startRecordingTimer = () => {
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
        }

        recordingTimerRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
        }, 1000);
    };

    // Stop recording timer
    const stopRecordingTimer = () => {
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        setRecordingTime(0);
    };

    // Start recording session
    const startRecording = async () => {
        try {
            if (!isConnected) {
                alert('Not connected to server. Please wait and try again.');
                return;
            }

            const title = prompt('Enter recording title:') || `Recording ${new Date().toLocaleString()}`;

            const newRecording = await createRecording(title);
            if (!newRecording) {
                throw new Error('Failed to create recording');
            }

            const stream = await initializeMedia();

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    console.log(' Audio chunk captured:', event.data.size, 'bytes');
                    audioChunksRef.current.push(event.data);

                    event.data.arrayBuffer().then(buffer => {
                        console.log(' Sending audio chunk to server');
                        const sent = emit('audio-chunk', {
                            recordingId: newRecording.id,
                            chunk: buffer,
                            isFinal: false
                        });
                        console.log('Audio chunk sent:', sent);
                    });
                }
            };

            mediaRecorder.onstop = () => {
                if (audioChunksRef.current.length > 0) {
                    const finalBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    finalBlob.arrayBuffer().then(buffer => {
                        emit('audio-chunk', {
                            recordingId: newRecording.id,
                            chunk: buffer,
                            isFinal: true
                        });
                    });
                }

                emit('complete-recording', {
                    recordingId: newRecording.id
                });
            };

            mediaRecorder.start(1000);
            setIsRecording(true);
            setIsPaused(false);
            startRecordingTimer();

            setCurrentSession({
                id: newRecording.id,
                title: newRecording.title,
                status: 'RECORDING',
                transcript: '',
                summary: '',
                duration: 0,
                createdAt: newRecording.createdAt
            });

            setTranscript('');
            setSummary('');

        } catch (error) {
            console.error('Error starting recording:', error);
            if (error instanceof Error) {
                if (error.name === 'NotAllowedError') {
                    alert('Permission denied. Please allow microphone/screen share access.');
                } else if (error.name === 'NotFoundError') {
                    alert('No microphone found. Please check your audio devices.');
                } else {
                    alert('Failed to start recording. Please try again.');
                }
            }
        }
    };

    // Pause recording
    const pauseRecording = () => {
        if (mediaRecorderRef.current && isRecording && !isPaused) {
            mediaRecorderRef.current.pause();
            setIsPaused(true);

            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }

            emit('pause-recording', {
                recordingId: currentSession?.id || ''
            });

            setCurrentSession(prev => prev ? { ...prev, status: 'PAUSED' } : null);
        }
    };

    // Resume recording
    const resumeRecording = () => {
        if (mediaRecorderRef.current && isRecording && isPaused) {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
            startRecordingTimer();

            emit('resume-recording', {
                recordingId: currentSession?.id || ''
            });

            setCurrentSession(prev => prev ? { ...prev, status: 'RECORDING' } : null);
        }
    };

    // Stop recording
    const stopRecording = async () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);
            stopRecordingTimer();

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }

            setCurrentSession(prev => prev ? { ...prev, status: 'PROCESSING' } : null);
        }
    };

    // Socket event handlers
    useEffect(() => {
        const handleTranscriptionUpdate = (data: {
            recordingId: string;
            text: string;
            timestamp: string;
            isFinal: boolean;
        }) => {
            if (currentSession && data.recordingId === currentSession.id) {
                setTranscript(prev => {
                    const newTranscript = prev + (prev ? ' ' : '') + data.text;
                    return newTranscript;
                });

                setCurrentSession(prev => prev ? {
                    ...prev,
                    transcript: prev.transcript + (prev.transcript ? ' ' : '') + data.text
                } : null);
            }
        };

        const handleRecordingCompleted = (data: {
            recordingId: string;
            summary: string;
            transcript: string;
            duration: number;
        }) => {
            if (currentSession && data.recordingId === currentSession.id) {
                setSummary(data.summary);
                setCurrentSession(prev => prev ? {
                    ...prev,
                    status: 'COMPLETED',
                    summary: data.summary,
                    transcript: data.transcript,
                    duration: data.duration
                } : null);

                setTimeout(() => {
                    router.push(`/recordings/${currentSession.id}`);
                }, 2000);
            }
        };

        const handleRecordingError = (data: {
            recordingId: string;
            error: string;
        }) => {
            if (currentSession && data.recordingId === currentSession.id) {
                alert(`Recording error: ${data.error}`);
                setCurrentSession(prev => prev ? { ...prev, status: 'COMPLETED' } : null);
            }
        };

        const handleRecordingStatus = (data: {
            recordingId: string;
            status: string;
        }) => {
            if (currentSession && data.recordingId === currentSession.id) {
                setCurrentSession(prev => prev ? {
                    ...prev,
                    status: data.status as RecordingSession['status']
                } : null);
            }
        };

        on('transcription-update', handleTranscriptionUpdate);
        on('recording-completed', handleRecordingCompleted);
        on('recording-error', handleRecordingError);
        on('recording-status', handleRecordingStatus);

        return () => {
            off('transcription-update', handleTranscriptionUpdate);
            off('recording-completed', handleRecordingCompleted);
            off('recording-error', handleRecordingError);
            off('recording-status', handleRecordingStatus);
        };
    }, [currentSession, router, on, off]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && isRecording) {
                mediaRecorderRef.current.stop();
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            stopRecordingTimer();
        };
    }, [isRecording]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
            {/* Header - same as before */}
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
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                {user?.name}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        New Recording Session
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Start a new real-time audio transcription and summarization session
                    </p>
                </div>

                {/* Connection Status */}
                <div className="mb-6 text-center">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${isConnected
                        ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                        : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                        }`}>
                        <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                            }`}></div>
                        {isConnected ? 'Connected to Server' : 'Disconnected from Server'}
                    </div>
                </div>

                {/* Recording Controls - same as before */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                        <div className="flex gap-4">
                            <button
                                onClick={() => setRecordingMode('microphone')}
                                disabled={isRecording}
                                className={`px-4 py-2 rounded-lg transition-colors ${recordingMode === 'microphone'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                    } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                🎤 Microphone
                            </button>
                            <button
                                onClick={() => setRecordingMode('screen')}
                                disabled={isRecording}
                                className={`px-4 py-2 rounded-lg transition-colors ${recordingMode === 'screen'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                    } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                🖥️ Screen Share
                            </button>
                        </div>

                        {isRecording && (
                            <div className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
                                {formatDuration(recordingTime)}
                            </div>
                        )}

                        <div className="flex gap-2">
                            {!isRecording ? (
                                <button
                                    onClick={startRecording}
                                    disabled={!isConnected}
                                    className={`px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2 ${isConnected
                                        ? 'bg-red-500 hover:bg-red-600 text-white'
                                        : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                        }`}
                                >
                                    <div className="w-3 h-3 bg-white rounded-full"></div>
                                    Start Recording
                                </button>
                            ) : (
                                <>
                                    {isPaused ? (
                                        <button
                                            onClick={resumeRecording}
                                            className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors"
                                        >
                                            ▶️ Resume
                                        </button>
                                    ) : (
                                        <button
                                            onClick={pauseRecording}
                                            className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors"
                                        >
                                            ⏸️ Pause
                                        </button>
                                    )}
                                    <button
                                        onClick={stopRecording}
                                        className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                                    >
                                        ⏹️ Stop
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Rest of the component remains the same */}
                    {currentSession && (
                        <div className="border-t pt-4 dark:border-gray-700">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {currentSession.title}
                                </h3>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${currentSession.status === 'RECORDING' ? 'bg-green-100 text-green-800' :
                                        currentSession.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' :
                                            currentSession.status === 'PROCESSING' ? 'bg-blue-100 text-blue-800' :
                                                'bg-gray-100 text-gray-800'
                                    }`}>
                                    {currentSession.status}
                                </span>
                            </div>

                            {transcript && (
                                <div className="mb-4">
                                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Live Transcript</h4>
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-48 overflow-y-auto">
                                        <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{transcript}</div>
                                    </div>
                                </div>
                            )}

                            {summary && (
                                <div>
                                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">AI Summary</h4>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                                        <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{summary}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}