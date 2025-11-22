import { createServer, type Server as HttpServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer, Socket } from 'socket.io';

// Environment configuration
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '5000', 10);

// Logging utility
const log = {
  info: (message: string, ...args: unknown[]) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
  },
  debug: (message: string, ...args: unknown[]) => {
    if (dev) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }
};

// Socket.IO types
interface AudioChunkData {
  recordingId: string;
  chunk: ArrayBuffer;
  isFinal: boolean;
  timestamp?: string;
}

interface RecordingData {
  recordingId: string;
}

interface ClientToServerEvents {
  'audio-chunk': (data: AudioChunkData) => void;
  'complete-recording': (data: RecordingData) => void;
  'pause-recording': (data: RecordingData) => void;
  'resume-recording': (data: RecordingData) => void;
}

interface ServerToClientEvents {
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
    status: string;
  }) => void;

  'audio-chunk-received': (data: {
    recordingId: string;
    success: boolean;
  }) => void;
}

// Active recording sessions
const activeRecordings = new Map<
  string,
  {
    socketId: string;
    startTime: number;
    chunks: number;
    isPaused: boolean;
  }
>();

// Graceful shutdown handler
let isShuttingDown = false;

const gracefulShutdown = (server: HttpServer, io: SocketIOServer) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.info('Received shutdown signal, closing gracefully...');

  // Stop accepting new connections
  server.close(() => {
    log.info('HTTP server closed');
  });

  // Close all socket connections
  io.close(() => {
    log.info('Socket.IO server closed');
    process.exit(0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    log.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer: HttpServer = createServer(async (req, res) => {
    try {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');

      if (!dev) {
        res.setHeader(
          'Strict-Transport-Security',
          'max-age=63072000; includeSubDomains; preload'
        );
      }

      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      log.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      path: '/api/socket/io',
      addTrailingSlash: false,
      cors: {
        origin: dev
          ? ['http://localhost:3000', 'http://127.0.0.1:3000']
          : process.env.NEXT_PUBLIC_SITE_URL || '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1e8,
      perMessageDeflate: { threshold: 1024 },
      httpCompression: { threshold: 1024 },
      transports: ['websocket', 'polling'],
      allowUpgrades: true
    }
  );

  io.use(async (socket, next) => {
    try {
      const _token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization;

      // TODO: validate token later
      next();
    } catch (error) {
      log.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on(
    'connection',
    (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
      log.info(`Client connected: ${socket.id}`);

      const connectionTime = Date.now();
      const clientIp = socket.handshake.address;
      const userAgent = socket.handshake.headers['user-agent'];

      log.debug(`Connection details - IP: ${clientIp}, UA: ${userAgent}`);

      socket.on('audio-chunk', async (data: AudioChunkData) => {
        try {
          log.debug(
            `Received audio chunk for recording: ${data.recordingId}`
          );

          if (!data.recordingId || !data.chunk) {
            throw new Error('Invalid audio chunk data');
          }

          if (!activeRecordings.has(data.recordingId)) {
            activeRecordings.set(data.recordingId, {
              socketId: socket.id,
              startTime: Date.now(),
              chunks: 0,
              isPaused: false
            });
            log.info(`Started tracking recording: ${data.recordingId}`);
          }

          const recording = activeRecordings.get(data.recordingId)!;
          recording.chunks++;

          // Demo transcription stub every 5 chunks
          if (recording.chunks % 5 === 0) {
            socket.emit('transcription-update', {
              recordingId: data.recordingId,
              text: `Transcribed segment ${recording.chunks / 5}...`,
              timestamp: new Date().toISOString(),
              isFinal: false
            });
          }

          socket.emit('audio-chunk-received', {
            recordingId: data.recordingId,
            success: true
          });

          if (data.isFinal) {
            log.info(
              `Final chunk received for recording: ${data.recordingId}`
            );
            socket.emit('recording-status', {
              recordingId: data.recordingId,
              status: 'PROCESSING'
            });
          }
        } catch (error) {
          log.error(
            `Error processing audio chunk for ${data.recordingId}:`,
            error
          );
          socket.emit('recording-error', {
            recordingId: data.recordingId,
            error:
              error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      socket.on('complete-recording', async (data: RecordingData) => {
        try {
          log.info(`Completing recording: ${data.recordingId}`);

          let recording = activeRecordings.get(data.recordingId);

          // If recording doesn't exist, create a placeholder
          if (!recording) {
            log.warn(`Recording ${data.recordingId} not found in active recordings, creating placeholder`);
            recording = {
              socketId: socket.id,
              startTime: Date.now(),
              chunks: 0,
              isPaused: false
            };
            activeRecordings.set(data.recordingId, recording);
          }

          socket.emit('recording-status', {
            recordingId: data.recordingId,
            status: 'PROCESSING'
          });

          await new Promise((resolve) => setTimeout(resolve, 3000));

          const duration = Math.floor(
            (Date.now() - recording.startTime) / 1000
          );

          socket.emit('recording-completed', {
            recordingId: data.recordingId,
            summary:
              'AI-generated summary: This recording discussed key topics including...',
            transcript: 'Complete transcript of the recording appears here.',
            duration
          });

          activeRecordings.delete(data.recordingId);
          log.info(
            `Recording completed and cleaned up: ${data.recordingId}`
          );
        } catch (error) {
          log.error(
            `Error completing recording ${data.recordingId}:`,
            error
          );
          socket.emit('recording-error', {
            recordingId: data.recordingId,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to complete recording'
          });
        }
      });
      socket.on('pause-recording', (data: RecordingData) => {
        try {
          log.info(`Pausing recording: ${data.recordingId}`);

          const recording = activeRecordings.get(data.recordingId);
          if (recording) recording.isPaused = true;

          socket.emit('recording-status', {
            recordingId: data.recordingId,
            status: 'PAUSED'
          });
        } catch (error) {
          log.error(
            `Error pausing recording ${data.recordingId}:`,
            error
          );
        }
      });

      socket.on('resume-recording', (data: RecordingData) => {
        try {
          log.info(`Resuming recording: ${data.recordingId}`);

          const recording = activeRecordings.get(data.recordingId);
          if (recording) recording.isPaused = false;

          socket.emit('recording-status', {
            recordingId: data.recordingId,
            status: 'RECORDING'
          });
        } catch (error) {
          log.error(
            `Error resuming recording ${data.recordingId}:`,
            error
          );
        }
      });

      socket.on('disconnect', (reason) => {
        const sessionDuration = Date.now() - connectionTime;
        log.info(
          `Client disconnected: ${socket.id}, reason: ${reason}, duration: ${sessionDuration}ms`
        );

        for (const [recordingId, recording] of activeRecordings.entries()) {
          if (recording.socketId === socket.id) {
            log.warn(
              `Cleaning up abandoned recording: ${recordingId}`
            );
            activeRecordings.delete(recordingId);
          }
        }
      });

      socket.on('error', (error) => {
        log.error(`Socket error for ${socket.id}:`, error);
      });
    }
  );

  // Periodic logging
  setInterval(() => {
    const stats = {
      connections: io.engine.clientsCount,
      activeRecordings: activeRecordings.size,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
    log.debug('Server stats:', stats);
  }, 60000);

  httpServer
    .once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        log.error(`Port ${port} is already in use`);
      } else {
        log.error('Server error:', err);
      }
      process.exit(1);
    })
    .listen(port, hostname, () => {
      log.info(`Server ready on http://${hostname}:${port}`);
      log.info(` Socket.IO running on /api/socket/io`);
      log.info(`Environment: ${dev ? 'Development' : 'Production'}`);
    });

  process.on('SIGTERM', () => gracefulShutdown(httpServer, io));
  process.on('SIGINT', () => gracefulShutdown(httpServer, io));

  process.on('uncaughtException', (error) => {
    log.error('Uncaught exception:', error);
    gracefulShutdown(httpServer, io);
  });

  process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled rejection at:', promise, 'reason:', reason);
  });
});
