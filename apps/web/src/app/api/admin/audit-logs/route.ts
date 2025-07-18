import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { getAuditLogs } from '../../../../lib/audit';

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const session = await getSession(request.headers.get('cookie') || '');
    if (!session.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;

    const filters: Parameters<typeof getAuditLogs>[0] = {
      entityType: searchParams.get('entityType') || undefined,
      action: searchParams.get('action') || undefined,
      performedBy: searchParams.get('performedBy') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    // Parse dates if provided
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (startDate) {
      filters.startDate = new Date(startDate);
    }

    if (endDate) {
      filters.endDate = new Date(endDate);
    }

    const result = await getAuditLogs(filters);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get audit logs error:', error);
    return NextResponse.json({ error: 'Failed to get audit logs' }, { status: 500 });
  }
}
