import { Server as NetServer } from 'http';
import { initializeSocket } from './socket-server';

// This will be used to initialize the socket server
export function setupSocketServer(httpServer: NetServer) {
  return initializeSocket(httpServer);
}