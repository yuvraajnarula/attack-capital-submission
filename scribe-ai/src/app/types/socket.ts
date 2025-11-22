export interface AudioChunkData {
  recordingId: string;
  chunk: ArrayBuffer;
  isFinal: boolean;
  timestamp?: string;
}

export interface RecordingData {
  recordingId: string;
}

export interface ServerToClientEvents {
  'transcription-update': (data: {
    recordingId: string;
    text: string;
    timestamp: string;
    isFinal: boolean;
  }) => void;

  'recording-completed': (data: {
    recordingId: string;
    summary: string;
    transcript: string;
    duration: number;
  }) => void;

  'recording-error': (data: {
    recordingId: string;
    error: string;
  }) => void;

  'recording-status': (data: {
    recordingId: string;
    status: string; // "PAUSED" | "RECORDING" | "PROCESSING"
  }) => void;

  'audio-chunk-received': (data: {
    recordingId: string;
    success: boolean;
  }) => void;
}

export interface ClientToServerEvents {
  'audio-chunk': (data: AudioChunkData) => void;
  'complete-recording': (data: RecordingData) => void;
  'pause-recording': (data: RecordingData) => void;
  'resume-recording': (data: RecordingData) => void;
}
