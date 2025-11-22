'use client';
import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useSocket } from '../hooks/useSocket';
import type {
  ServerToClientEvents,
  ClientToServerEvents
} from '../types/socket';
import type { Socket } from 'socket.io-client';
import type { ConnectionMetrics } from '../hooks/useSocket';

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextValue {
  socket: SocketType | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  metrics: ConnectionMetrics;
  connect: () => void;
  disconnect: () => void;

  emit: <K extends keyof ClientToServerEvents>(
    event: K,
    data: Parameters<ClientToServerEvents[K]>[0]
  ) => boolean;

  on: <K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K]
  ) => void;

  off: <K extends keyof ServerToClientEvents>(
    event: K,
    handler?: ServerToClientEvents[K]
  ) => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({
  children
}) => {
  const socketData = useSocket();

  useEffect(() => {
    console.log('SocketProvider mounting, initiating connection...');
    socketData.connect();

    // Cleanup on unmount
    return () => {
      console.log('SocketProvider unmounting, disconnecting...');
      socketData.disconnect();
    };
  }, [socketData.connect, socketData.disconnect]);

  return (
    <SocketContext.Provider value={socketData}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocketContext = (): SocketContextValue => {
  const ctx = useContext(SocketContext);
  if (!ctx)
    throw new Error('useSocketContext must be used within a SocketProvider');
  return ctx;
};