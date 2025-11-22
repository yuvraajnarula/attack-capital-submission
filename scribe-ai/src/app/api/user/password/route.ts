import { NextRequest, NextResponse } from 'next/server';
import  prisma  from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { hash, verify } from '@node-rs/argon2';

export async function PUT(req: NextRequest) {
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

    const { currentPassword, newPassword } = await req.json();

    // Validate input
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current and new password are required' },
        { status: 400 }
      );
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Get user's account with password
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        providerId: 'credential'
      }
    });

    if (!account || !account.password) {
      return NextResponse.json(
        { error: 'No password account found' },
        { status: 404 }
      );
    }

    // Verify current password
    const isValidPassword = await verify(account.password, currentPassword, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1
    });

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Hash new password
    const hashedPassword = await hash(newPassword, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1
    });

    // Update password
    await prisma.account.update({
      where: { id: account.id },
      data: { password: hashedPassword }
    });

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Password update error:', error);
    return NextResponse.json(
      { error: 'Failed to update password' },
      { status: 500 }
    );
  }
}