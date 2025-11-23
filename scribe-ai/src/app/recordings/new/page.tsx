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
    const mimeTypeRef = useRef<string>('');
    const isStoppingRef = useRef<boolean>(false); // Prevent multiple stop calls
    const isMountedRef = useRef<boolean>(true); // Track component mount status

    const { createRecording } = useRecordings();
    const { isConnected, emit, on, off } = useSocketContext();

    // Track mounted state
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

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
                const displayStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });

                console.log('Display stream tracks:', {
                    video: displayStream.getVideoTracks().length,
                    audio: displayStream.getAudioTracks().length
                });

                let audioStream: MediaStream | null = null;
                try {
                    audioStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            sampleRate: 44100,
                        }
                    });
                    console.log('Microphone stream tracks:', audioStream.getAudioTracks().length);
                } catch (err) {
                    console.warn('Could not get microphone audio:', err);
                }

                const audioTracks = [
                    ...displayStream.getAudioTracks(),
                    ...(audioStream ? audioStream.getAudioTracks() : [])
                ];

                console.log('Total audio tracks:', audioTracks.length);

                if (audioTracks.length === 0) {
                    displayStream.getTracks().forEach(track => track.stop());
                    throw new Error('No audio tracks available. Please enable microphone or system audio for screen recording.');
                }

                stream = new MediaStream([
                    ...displayStream.getVideoTracks(),
                    ...audioTracks
                ]);
            } else {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100,
                    }
                });
            }

            if (stream.getAudioTracks().length === 0) {
                stream.getTracks().forEach(track => track.stop());
                throw new Error('No audio tracks available in the stream');
            }

            console.log('Stream created with', stream.getAudioTracks().length, 'audio track(s) and', stream.getVideoTracks().length, 'video track(s)');

            stream.getTracks().forEach(track => {
                console.log(`Track: ${track.kind} - ${track.label} - enabled: ${track.enabled} - readyState: ${track.readyState}`);
            });

            return stream;
        } catch (error) {
            console.error('Error initializing media:', error);
            throw error;
        }
    }, [recordingMode]);

    // Start recording timer
    const startRecordingTimer = useCallback(() => {
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }

        setRecordingTime(0);

        recordingTimerRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
        }, 1000);
    }, []);

    // Stop recording timer
    const stopRecordingTimer = useCallback(() => {
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        setRecordingTime(0);
    }, []);

    // Get supported MIME type
    const getSupportedMimeType = useCallback((stream: MediaStream): string => {
        const hasVideo = stream?.getVideoTracks()?.length > 0;
        
        const possibleTypes = hasVideo ? [
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9,opus',
            'video/webm',
        ] : [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
            'audio/mpeg',
            'audio/wav'
        ];

        for (const type of possibleTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                console.log('Using MIME type:', type);
                return type;
            }
        }

        console.warn('⚠️ No preferred MIME type supported, using default');
        return '';
    }, []);

    // Stop recording
    const stopRecording = useCallback(async () => {
        console.log('🛑 stopRecording called, isStoppingRef:', isStoppingRef.current);
        
        // Prevent multiple simultaneous stop calls
        if (isStoppingRef.current) {
            console.log('Already stopping, ignoring call');
            return;
        }

        if (!mediaRecorderRef.current || !isRecording) {
            console.log('stopRecording: No active recording');
            return;
        }

        isStoppingRef.current = true;
        
        try {
            console.log('Stopping recording, MediaRecorder state:', mediaRecorderRef.current.state);
            
            if (mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            
            setIsRecording(false);
            setIsPaused(false);
            stopRecordingTimer();

            if (streamRef.current) {
                console.log('🔌 Stopping all stream tracks');
                streamRef.current.getTracks().forEach(track => {
                    console.log('Stopping track:', track.kind, track.label);
                    track.stop();
                });
                streamRef.current = null;
            }

            setCurrentSession(prev => prev ? { ...prev, status: 'PROCESSING' } : null);
        } catch (error) {
            console.error('Error in stopRecording:', error);
        } finally {
            // Reset after a short delay to allow onstop handler to complete
            setTimeout(() => {
                isStoppingRef.current = false;
            }, 1000);
        }
    }, [isRecording, stopRecordingTimer]);

    // Start recording session
    const startRecording = async () => {
        try {
            console.log(' Starting recording...');

            if (!isConnected) {
                alert('Not connected to server. Please wait and try again.');
                return;
            }

            const title = prompt('Enter recording title:') || `Recording ${new Date().toLocaleString()}`;
            console.log('Creating recording with title:', title);

            const newRecording = await createRecording(title);
            if (!newRecording) {
                throw new Error('Failed to create recording');
            }

            console.log('Recording created:', newRecording);

            const stream = await initializeMedia();
            console.log('Media stream initialized');
            
            streamRef.current = stream;

            // Set up track ended handlers - but DON'T auto-stop for screen share
            stream.getTracks().forEach(track => {
                track.onended = () => {
                    console.warn(`Track ended: ${track.kind} - ${track.label}`);
                    // Only auto-stop for screen share video track (user clicked browser's stop button)
                    if (recordingMode === 'screen' && track.kind === 'video') {
                        console.log('Screen share stopped by user, stopping recording...');
                        stopRecording();
                    }
                };
            });

            const mimeType = getSupportedMimeType(stream);
            mimeTypeRef.current = mimeType;

            const mediaRecorder = mimeType 
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);

            console.log('MediaRecorder created with MIME type:', mimeType || 'default');

            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            isStoppingRef.current = false; // Reset stopping flag

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    console.log('Audio chunk captured:', event.data.size, 'bytes');
                    audioChunksRef.current.push(event.data);

                    event.data.arrayBuffer().then(buffer => {
                        console.log('Sending audio chunk to server');
                        const sent = emit('audio-chunk', {
                            recordingId: newRecording.id,
                            chunk: buffer,
                            isFinal: false
                        });
                        console.log('Audio chunk sent:', sent ? 'yes' : 'no');
                    }).catch(err => {
                        console.error('Error sending audio chunk:', err);
                    });
                }
            };

            mediaRecorder.onstop = () => {
                console.log('MediaRecorder.onstop triggered');
                console.log('Total chunks collected:', audioChunksRef.current.length);
                
                if (audioChunksRef.current.length > 0) {
                    const finalBlob = new Blob(audioChunksRef.current, { 
                        type: mimeTypeRef.current || 'audio/webm' 
                    });
                    console.log('Final blob size:', finalBlob.size, 'bytes');
                    
                    finalBlob.arrayBuffer().then(buffer => {
                        console.log('Sending final audio chunk');
                        emit('audio-chunk', {
                            recordingId: newRecording.id,
                            chunk: buffer,
                            isFinal: true
                        });
                        
                        // Send complete signal after final chunk
                        setTimeout(() => {
                            console.log('Emitting complete-recording');
                            emit('complete-recording', {
                                recordingId: newRecording.id
                            });
                        }, 500);
                    }).catch(err => {
                        console.error(' Error sending final chunk:', err);
                    });
                } else {
                    console.warn('No audio chunks were collected!');
                    // Still try to complete
                    emit('complete-recording', {
                        recordingId: newRecording.id
                    });
                }

                // Clear the chunks
                audioChunksRef.current = [];
            };

            mediaRecorder.onerror = (event: any) => {
                console.error(' MediaRecorder error:', event);
                console.error('Error details:', event.error);
                alert('Recording error occurred. Please try again.');
            };

            console.log('🎬 Starting MediaRecorder with 1000ms timeslice');
            
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

            console.log('Recording started successfully');

        } catch (error) {
            console.error(' Error starting recording:', error);
            
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            stopRecordingTimer();
            setIsRecording(false);
            setIsPaused(false);

            if (error instanceof Error) {
                if (error.name === 'NotAllowedError') {
                    alert('Permission denied. Please allow microphone/screen share access.');
                } else if (error.name === 'NotFoundError') {
                    alert('No microphone found. Please check your audio devices.');
                } else if (error.name === 'NotSupportedError') {
                    alert('Recording is not supported in this browser. Please try Chrome, Firefox, or Edge.');
                } else {
                    alert(`Failed to start recording: ${error.message}`);
                }
            }
        }
    };

    // Pause recording
    const pauseRecording = () => {
        if (mediaRecorderRef.current && isRecording && !isPaused) {
            console.log('Pausing recording');
            mediaRecorderRef.current.pause();
            setIsPaused(true);

            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
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
            console.log(' Resuming recording');
            mediaRecorderRef.current.resume();
            setIsPaused(false);
            
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            emit('resume-recording', {
                recordingId: currentSession?.id || ''
            });

            setCurrentSession(prev => prev ? { ...prev, status: 'RECORDING' } : null);
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
            console.log('Transcription update:', data);
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
            console.log('Recording completed:', data);
            if (currentSession && data.recordingId === currentSession.id) {
                setSummary(data.summary);
                setCurrentSession(prev => prev ? {
                    ...prev,
                    status: 'COMPLETED',
                    summary: data.summary,
                    transcript: data.transcript,
                    duration: data.duration
                } : null);

                // Only redirect if component is still mounted
                if (isMountedRef.current) {
                    setTimeout(() => {
                        console.log('Redirecting to recording detail page');
                        router.push(`/recordings/${currentSession.id}`);
                    }, 2000);
                }
            }
        };

        const handleRecordingError = (data: {
            recordingId: string;
            error: string;
        }) => {
            console.error('Recording error from server:', data);
            if (currentSession && data.recordingId === currentSession.id) {
                alert(`Recording error: ${data.error}`);
                setCurrentSession(prev => prev ? { ...prev, status: 'COMPLETED' } : null);
            }
        };

        const handleRecordingStatus = (data: {
            recordingId: string;
            status: string;
        }) => {
            console.log('Recording status:', data);
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

    // Cleanup ONLY on unmount (not on isRecording change)
    useEffect(() => {
        return () => {
            console.log('Component unmounting - cleanup');
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                console.log('Stopping MediaRecorder in cleanup');
                mediaRecorderRef.current.stop();
            }
            if (streamRef.current) {
                console.log('🔌 Stopping stream tracks in cleanup');
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
        };
    }, []); // Empty deps - only on unmount

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

                {/* Recording Controls */}
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

                    {currentSession && (
                        <div className="border-t pt-4 dark:border-gray-700">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {currentSession.title}
                                </h3>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${currentSession.status === 'RECORDING' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' :
                                        currentSession.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' :
                                            currentSession.status === 'PROCESSING' ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100' :
                                                'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
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