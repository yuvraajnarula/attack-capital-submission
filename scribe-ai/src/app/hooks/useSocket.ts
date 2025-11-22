"use client";

import { useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
    ServerToClientEvents,
    ClientToServerEvents
} from '../types/socket';

export interface ConnectionMetrics {
    connectedAt: number | null;
    disconnectedAt: number | null;
    reconnectAttempts: number;
    totalReconnects: number;
    lastError: string | null;
}

export const useSocket = () => {
    const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false); // Changed from true to false
    const [error, setError] = useState<string | null>(null);

    const [metrics, setMetrics] = useState<ConnectionMetrics>({
        connectedAt: null,
        disconnectedAt: null,
        reconnectAttempts: 0,
        totalReconnects: 0,
        lastError: null
    });

    const connect = useCallback(() => {
        if (socketRef.current?.connected) {
            console.log('Socket already connected');
            return;
        }

        if (socketRef.current) {
            console.log('Socket exists but not connected, cleaning up...');
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        setIsConnecting(true);
        setError(null);

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

        console.log('Connecting to Socket.IO at:', socketUrl);

        const socket = io(socketUrl, {
            path: '/api/socket/io',
            addTrailingSlash: false,
            transports: ['websocket', 'polling'], // Try websocket first
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 10,
            timeout: 20000,
            autoConnect: true // Explicitly enable auto-connect
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('✅ Socket connected! ID:', socket.id);
            setIsConnecting(false);
            setIsConnected(true);
            setError(null);

            setMetrics((m) => ({
                ...m,
                connectedAt: Date.now(),
                lastError: null,
                reconnectAttempts: 0 // Reset on successful connection
            }));
        });

        socket.on('connect_error', (err) => {
            console.error('❌ Socket connection error:', err.message, err);
            setIsConnected(false);
            setIsConnecting(false);
            setError(err.message);

            setMetrics((m) => ({
                ...m,
                lastError: err.message,
                reconnectAttempts: m.reconnectAttempts + 1
            }));
        });

        socket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
            setMetrics((m) => ({
                ...m,
                totalReconnects: m.totalReconnects + 1
            }));
        });

        socket.on('disconnect', (reason) => {
            console.log('🔌 Socket disconnected:', reason);
            setIsConnected(false);

            setMetrics((m) => ({
                ...m,
                disconnectedAt: Date.now()
            }));
        });

        socket.on('error', (err) => {
            console.error('⚠️ Socket error:', err);
            setError(err.toString());
        });

        // Additional debugging
        socket.io.on('reconnect_attempt', () => {
            console.log('🔄 Attempting to reconnect...');
        });

        socket.io.on('reconnect_failed', () => {
            console.error('❌ Reconnection failed');
        });
    }, []);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            console.log('Disconnecting socket...');
            socketRef.current.disconnect();
            socketRef.current = null;
            setIsConnected(false);
            setIsConnecting(false);
        }
    }, []);

    const emit = useCallback(
        <K extends keyof ClientToServerEvents>(
            event: K,
            ...args: Parameters<ClientToServerEvents[K]>
        ): boolean => {
            if (socketRef.current?.connected) {
                socketRef.current.emit(event, ...args);
                return true;
            }
            console.warn('⚠️ Socket not connected, cannot emit:', event);
            return false;
        },
        []
    );

    const on = useCallback(
        <K extends keyof ServerToClientEvents>(
            event: K,
            handler: ServerToClientEvents[K]
        ) => {
            socketRef.current?.on(event, handler);
        },
        []
    );

    const off = useCallback(
        <K extends keyof ServerToClientEvents>(
            event: K,
            handler?: ServerToClientEvents[K]
        ) => {
            if (!socketRef.current) return;
            if (handler) {
                socketRef.current.off(event, handler);
            } else {
                socketRef.current.off(event);
            }
        },
        []
    );

    const getSocket = useCallback(() => socketRef.current, []);

    return {
        getSocket,
        isConnected,
        isConnecting,
        error,
        metrics,
        connect,
        disconnect,
        emit,
        on,
        off
    };
};