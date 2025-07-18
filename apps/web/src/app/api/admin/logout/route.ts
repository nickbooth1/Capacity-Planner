import { NextRequest, NextResponse } from 'next/server';
import { sessionOptions } from '../../../../lib/auth';

export async function POST(request: NextRequest) {
  // Clear the session cookie
  const response = NextResponse.json({ success: true });

  response.cookies.set(sessionOptions.cookieName, '', {
    maxAge: 0,
    path: '/',
  });

  return response;
}
