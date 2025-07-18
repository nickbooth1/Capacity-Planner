import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createSession } from '../../../../lib/auth';
import { createAuditLog } from '../../../../lib/audit';
import { PrismaClient } from '../../../../lib/prisma';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // For MVP, we'll use a simple admin check
    // In production, you'd want proper password hashing
    const isAdminUser = user.role === 'admin-support' || user.role === 'admin';

    // For development, accept a default password
    // TODO: Implement proper password hashing and validation
    const isValidPassword = password === process.env.ADMIN_PASSWORD || password === 'admin123';

    if (!isAdminUser || !isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Create session
    const sessionData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        isAdmin: true,
      },
    };

    const sessionCookie = await createSession(sessionData);

    // Create audit log
    await createAuditLog({
      entityType: 'user',
      entityId: user.id,
      action: 'login',
      performedBy: user.email,
      ipAddress:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      organizationId: user.organizationId,
    });

    return NextResponse.json(
      { success: true, user: sessionData.user },
      {
        status: 200,
        headers: {
          'Set-Cookie': sessionCookie,
        },
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
