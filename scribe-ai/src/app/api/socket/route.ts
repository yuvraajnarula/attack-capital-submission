import { NextApiRequest, NextApiResponse } from 'next';
import { NextApiResponseWithSocket } from '@/lib/socket-server';
import initializeSocket from '@/lib/socket-server';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  if (req.method === 'GET') {
    initializeSocket(res);
    res.status(200).json({ message: 'Socket server initialized' });
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ message: `Method ${req.method} not allowed` });
  }
}