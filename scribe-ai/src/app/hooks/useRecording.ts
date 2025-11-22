import { useState, useEffect, useCallback } from 'react';

export interface Recording {
  id: string;
  title: string;
  status: 'RECORDING' | 'PAUSED' | 'PROCESSING' | 'COMPLETED';
  duration: number | null;
  transcript?: string | null;
  summary?: string | null;
  audioUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RecordingsResponse {
  success: boolean;
  recordings: Recording[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface RecordingResponse {
  success: boolean;
  recording: Recording;
}

interface UseRecordingsOptions {
  limit?: number;
  offset?: number;
  status?: string;
  autoFetch?: boolean;
}

export const useRecordings = (options: UseRecordingsOptions = {}) => {
  const { limit = 10, offset = 0, status, autoFetch = false } = options;

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 10,
    offset: 0,
    hasMore: false,
  });

  const fetchRecordings = useCallback(async (): Promise<Recording[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        ...(status && { status }),
      });

      const response = await fetch(`/api/recordings?${params}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error(`Failed to fetch recordings: ${response.status}`);

      const data: RecordingsResponse = await response.json();

      if (!data.success) throw new Error('Failed to fetch recordings');

      setPagination(data.pagination);
      return data.recordings;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch recordings';
      setError(errorMessage);
      console.error('Fetch recordings error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [limit, offset, status]);

  const createRecording = useCallback(async (title: string): Promise<Recording | null> => {
    setError(null);

    try {
      const response = await fetch('/api/recordings', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create recording: ${response.status}`);
      }

      const data: RecordingResponse = await response.json();

      if (data.success && data.recording) {
        // Refresh recordings list
        await fetchRecordings();
        return data.recording;
      }

      throw new Error('Failed to create recording');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create recording';
      setError(errorMessage);
      console.error('Create recording error:', err);
      return null;
    }
  }, [fetchRecordings]);

  const updateRecording = useCallback(async (
    id: string,
    updates: Partial<Omit<Recording, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<boolean> => {
    setError(null);

    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update recording: ${response.status}`);
      }

      const data: RecordingResponse = await response.json();

      if (data.success) {
        // Update local state
        setRecordings(prev =>
          prev.map(rec => rec.id === id ? data.recording : rec)
        );
        return true;
      }

      throw new Error('Failed to update recording');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update recording';
      setError(errorMessage);
      console.error('Update recording error:', err);
      return false;
    }
  }, []);

  const deleteRecording = useCallback(async (id: string): Promise<boolean> => {
    setError(null);

    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete recording: ${response.status}`);
      }

      // Remove from local state
      setRecordings(prev => prev.filter(rec => rec.id !== id));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete recording';
      setError(errorMessage);
      console.error('Delete recording error:', err);
      return false;
    }
  }, []);

  const getRecording = useCallback(async (id: string): Promise<Recording | null> => {
    setError(null);

    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch recording: ${response.status}`);
      }

      const data: RecordingResponse = await response.json();

      if (data.success) {
        return data.recording;
      }

      throw new Error('Failed to fetch recording');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch recording';
      setError(errorMessage);
      console.error('Get recording error:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchRecordings();
    }
  }, [autoFetch, fetchRecordings]);

  return {
    recordings,
    isLoading,
    error,
    pagination,
    fetchRecordings,
    createRecording,
    updateRecording,
    deleteRecording,
    getRecording,
  };
};