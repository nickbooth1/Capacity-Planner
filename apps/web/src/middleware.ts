import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // For now, just allow all admin routes to pass through
  // We'll implement proper authentication later
  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};
