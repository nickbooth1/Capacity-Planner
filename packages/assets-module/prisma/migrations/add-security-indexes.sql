-- Additional indexes for security and performance optimization
-- These indexes support RLS policies and audit queries

-- Indexes for efficient RLS policy evaluation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stands_org_code_not_deleted 
ON assets.stands(organization_id, code) 
WHERE is_deleted = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stands_org_terminal_status 
ON assets.stands(organization_id, terminal, status) 
WHERE is_deleted = false;

-- Indexes for audit event queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_user_time 
ON assets.audit_events(user_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_resource_time 
ON assets.audit_events(resource, resource_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_severity_time 
ON assets.audit_events(severity, timestamp DESC) 
WHERE success = false;

-- Indexes for security-sensitive field queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stands_security_fields 
ON assets.stands USING gin((operational_constraints->'securityRequirements')) 
WHERE operational_constraints IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stands_infrastructure_security 
ON assets.stands USING gin((infrastructure->'securitySystemDetails')) 
WHERE infrastructure IS NOT NULL;

-- Indexes for maintenance record access control
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_org_type_status 
ON assets.stand_maintenance_records(organization_id, maintenance_type, status);

-- Indexes for adjacency security checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_adjacency_stand_type 
ON assets.stand_adjacencies(stand_id, adjacency_type);

-- Performance statistics view for security monitoring
CREATE OR REPLACE VIEW assets.security_statistics AS
SELECT 
  ae.organization_id,
  DATE_TRUNC('hour', ae.timestamp) as hour,
  ae.event_type,
  ae.severity,
  COUNT(*) as event_count,
  SUM(CASE WHEN ae.success THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN NOT ae.success THEN 1 ELSE 0 END) as failure_count,
  AVG(CAST(ae.details->>'duration' AS FLOAT)) as avg_duration_ms
FROM assets.audit_events ae
WHERE ae.timestamp >= NOW() - INTERVAL '7 days'
GROUP BY 1, 2, 3, 4;

-- Grant permissions on the view
GRANT SELECT ON assets.security_statistics TO authenticated;

-- Function to clean up old audit events (data retention)
CREATE OR REPLACE FUNCTION assets.cleanup_old_audit_events(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM assets.audit_events
  WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL
  AND severity != 'critical'; -- Keep critical events longer
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup
  INSERT INTO assets.audit_events (
    organization_id,
    user_id,
    event_type,
    severity,
    resource,
    resource_id,
    action,
    details,
    success
  ) VALUES (
    'system',
    'system',
    'maintenance',
    'low',
    'audit_events',
    'cleanup',
    'cleanup_old_events',
    jsonb_build_object('deleted_count', deleted_count, 'retention_days', retention_days),
    true
  );
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule regular cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-audit-events', '0 2 * * *', 'SELECT assets.cleanup_old_audit_events();');

-- Analyze tables for query optimization
ANALYZE assets.stands;
ANALYZE assets.audit_events;
ANALYZE assets.stand_maintenance_records;
ANALYZE assets.stand_adjacencies;