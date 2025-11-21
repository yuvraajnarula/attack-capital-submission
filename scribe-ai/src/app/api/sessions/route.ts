import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession } from '@/lib/auth';

async function getAuthenticatedUser(request: NextRequest) {
  const sessionToken = request.cookies.get('better-auth.session-token')?.value;
  
  if (!sessionToken) {
    throw new Error('Authentication required');
  }

  const session = await verifySession(sessionToken);
  return {
    userId: session.userId,
    user: session.user,
    session: session
  };
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await getAuthenticatedUser(request);

    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        status: true,
        transcript: true,
        summary: true,
        duration: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    return NextResponse.json(sessions);
  } catch (error: any) {
    console.error(' Failed to fetch sessions:', error);
    
    if (error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// POST /api/sessions - Create new session
export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuthenticatedUser(request);
    const { title } = await request.json();
    
    const session = await prisma.session.create({
      data: {
        title: title || `Session ${new Date().toLocaleString()}`,
        userId: userId,
        status: 'ACTIVE'
      }
    });

    console.log('Created session:', session.id);
    return NextResponse.json(session);

  } catch (error: any) {
    console.error('Failed to create session:', error);
    
    if (error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

// PUT /api/sessions - Update session
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await getAuthenticatedUser(request);
    const { sessionId, transcript, summary, status, duration } = await request.json();
    
    // Verify user owns the session
    const existingSession = await prisma.session.findFirst({
      where: { 
        id: sessionId,
        userId: userId 
      }
    });

    if (!existingSession) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      );
    }

    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        ...(transcript !== undefined && { transcript }),
        ...(summary !== undefined && { summary }),
        ...(status && { status }),
        ...(duration && { duration }),
        updatedAt: new Date()
      }
    });

    console.log('✅ Updated session:', sessionId);
    return NextResponse.json(updatedSession);

  } catch (error: any) {
    console.error(' Failed to update session:', error);
    
    if (error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions - Delete session
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns the session
    const existingSession = await prisma.session.findFirst({
      where: { 
        id: sessionId,
        userId: userId 
      }
    });

    if (!existingSession) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      );
    }

    await prisma.session.delete({
      where: { id: sessionId }
    });

    console.log('Deleted session:', sessionId);
    return NextResponse.json({ message: 'Session deleted successfully' });

  } catch (error : any) {
    console.error(' Failed to delete session:', error);
    
    if (error?.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}