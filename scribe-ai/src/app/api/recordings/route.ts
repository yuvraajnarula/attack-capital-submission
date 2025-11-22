import { NextRequest, NextResponse } from 'next/server';
import  prisma  from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');

    // Build where clause
    const where = {
      userId: session.user.id,
      status: 'ACTIVE'
    };

    if (status && ['RECORDING', 'PAUSED', 'PROCESSING', 'COMPLETED'].includes(status)) {
      where.status = status;
    }

    // Fetch recordings
    const [recordings, total] = await Promise.all([
      prisma.recording.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          status: true,
          duration: true,
          transcript: true,
          summary: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.recording.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      recordings,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error('Fetch recordings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recordings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { title } = await req.json();

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Create new recording
    const recording = await prisma.recording.create({
      data: {
        title,
        userId: session.user.id,
        status: 'RECORDING'
      },
      select: {
        id: true,
        title: true,
        status: true,
        duration: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      recording
    }, { status: 201 });
  } catch (error) {
    console.error('Create recording error:', error);
    return NextResponse.json(
      { error: 'Failed to create recording' },
      { status: 500 }
    );
  }
}