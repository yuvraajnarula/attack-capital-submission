import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { auth } from '../../../../lib/auth';
import { headers } from 'next/headers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ params is a Promise
) {
  try {
    const { id } = await params; // ✅ Await the params first
    
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const recording = await prisma.recording.findUnique({
      where: {
        id: id // ✅ Now using the resolved id
      }
    });

    if (!recording || recording.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      recording
    });
  } catch (error) {
    console.error('Fetch recording error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recording' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // ✅ Await params
    
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const data = await req.json();

    // Verify ownership
    const existingRecording = await prisma.recording.findFirst({
      where: {
        id: id, // ✅ Use resolved id
        userId: session.user.id
      }
    });

    if (!existingRecording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Update recording
    const recording = await prisma.recording.update({
      where: { id: id }, // ✅ Use resolved id
      data: {
        ...(data.title && { title: data.title }),
        ...(data.status && { status: data.status }),
        ...(data.duration !== undefined && { duration: data.duration }),
        ...(data.transcript !== undefined && { transcript: data.transcript }),
        ...(data.summary !== undefined && { summary: data.summary }),
        ...(data.audioUrl !== undefined && { audioUrl: data.audioUrl })
      }
    });

    return NextResponse.json({
      success: true,
      recording
    });
  } catch (error) {
    console.error('Update recording error:', error);
    return NextResponse.json(
      { error: 'Failed to update recording' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // ✅ Await params
    
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify ownership
    const existingRecording = await prisma.recording.findFirst({
      where: {
        id: id, // ✅ Use resolved id
        userId: session.user.id
      }
    });

    if (!existingRecording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      );
    }

    // Delete recording
    await prisma.recording.delete({
      where: { id: id } // ✅ Use resolved id
    });

    return NextResponse.json({
      success: true,
      message: 'Recording deleted successfully'
    });
  } catch (error) {
    console.error('Delete recording error:', error);
    return NextResponse.json(
      { error: 'Failed to delete recording' },
      { status: 500 }
    );
  }
}