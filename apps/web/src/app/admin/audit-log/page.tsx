import AuditLogClient from './AuditLogClient';
import { getAuditLogs } from '../../../lib/audit';

export default async function AuditLogPage() {
  const { logs, total } = await getAuditLogs({ limit: 100 });

  return <AuditLogClient initialLogs={logs} totalCount={total} />;
}
