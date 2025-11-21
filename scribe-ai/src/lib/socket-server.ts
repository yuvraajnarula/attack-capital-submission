import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { NextApiResponse } from 'next';
import { transcribeAudio, generateSummary } from './gemini';
import  prisma  from './prisma';

export type NextApiResponseWithSocket = NextApiResponse & {
  socket: {
    server: NetServer & {
      io?: SocketIOServer;
    };
  };
};

const initializeSocket = (res: NextApiResponseWithSocket) => {
  if (!res.socket.server.io) {
    const io = new SocketIOServer(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Handle audio chunk transmission
      socket.on('audio-chunk', async (data: {
        recordingId: string;
        chunk: ArrayBuffer;
        isFinal: boolean;
      }) => {
        try {
          console.log('🎵 Received audio chunk for recording:', data.recordingId);
          
          // Convert ArrayBuffer to Blob
          const audioBlob = new Blob([data.chunk], { type: 'audio/webm' });
          
          // Transcribe with Gemini
          const transcription = await transcribeAudio(audioBlob);
          
          // Emit transcription update
          socket.emit('transcription-update', {
            recordingId: data.recordingId,
            text: transcription,
            timestamp: new Date().toISOString(),
            isFinal: data.isFinal
          });

          // Update recording transcript in database
          if (data.isFinal) {
            const recording = await prisma.recording.findUnique({
              where: { id: data.recordingId }
            });
            
            if (recording) {
              const updatedTranscript = recording.transcript 
                ? recording.transcript + '\n' + transcription
                : transcription;
              
              await prisma.recording.update({
                where: { id: data.recordingId },
                data: { 
                  transcript: updatedTranscript,
                  status: 'PROCESSING'
                }
              });
            }
          }

        } catch (error) {
          console.error('Transcription error:', error);
          socket.emit('transcription-error', {
            recordingId: data.recordingId,
            error: 'Failed to transcribe audio'
          });
        }
      });

      socket.on('complete-recording', async (data: { recordingId: string }) => {
        try {
          console.log('Completing recording:', data.recordingId);
          const recording = await prisma.recording.findUnique({
            where: { id: data.recordingId }
          });

          if (!recording?.transcript) {
            throw new Error('No transcript found for recording');
          }

          socket.emit('recording-status', { 
            recordingId: data.recordingId, 
            status: 'PROCESSING' 
          });

          const summary = await generateSummary(recording.transcript);

          // Calculate duration
          const duration = Math.floor(
            (new Date().getTime() - new Date(recording.createdAt).getTime()) / 1000
          );

          await prisma.recording.update({
            where: { id: data.recordingId },
            data: { 
              summary,
              status: 'COMPLETED',
              duration
            }
          });

          socket.emit('recording-completed', {
            recordingId: data.recordingId,
            summary,
            transcript: recording.transcript,
            duration
          });

        } catch (error) {
          console.error('Recording completion error:', error);
          socket.emit('recording-error', {
            recordingId: data.recordingId,
            error: 'Failed to generate summary'
          });
        }
      });

      // Handle recording pause
      socket.on('pause-recording', async (data: { recordingId: string }) => {
        try {
          await prisma.recording.update({
            where: { id: data.recordingId },
            data: { status: 'PAUSED' }
          });

          socket.emit('recording-status', {
            recordingId: data.recordingId,
            status: 'PAUSED'
          });
        } catch (error) {
          console.error('Pause recording error:', error);
          socket.emit('recording-error', {
            recordingId: data.recordingId,
            error: 'Failed to pause recording'
          });
        }
      });

      // Handle recording resume
      socket.on('resume-recording', async (data: { recordingId: string }) => {
        try {
          await prisma.recording.update({
            where: { id: data.recordingId },
            data: { status: 'RECORDING' }
          });

          socket.emit('recording-status', {
            recordingId: data.recordingId,
            status: 'RECORDING'
          });
        } catch (error) {
          console.error('Resume recording error:', error);
          socket.emit('recording-error', {
            recordingId: data.recordingId,
            error: 'Failed to resume recording'
          });
        }
      });

      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
      });
    });

    res.socket.server.io = io;
  }
};

export default initializeSocket;