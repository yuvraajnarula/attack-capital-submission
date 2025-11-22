import { NextRequest, NextResponse } from 'next/server';
import  prisma  from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function DELETE(req: NextRequest) {
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

    // Delete user (cascade will handle related data)
    await prisma.user.delete({
      where: { id: session.user.id }
    });

    // Sign out the user
    await auth.api.signOut({
      headers: await headers()
    });

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
