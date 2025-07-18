-- Enable Row Level Security for assets schema tables
ALTER TABLE assets.stands ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.stand_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.stand_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.stand_maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.stand_adjacencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.stand_capability_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.audit_events ENABLE ROW LEVEL SECURITY;

-- Create function to get current user's organization
CREATE OR REPLACE FUNCTION assets.current_user_organization()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.organization_id', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check user permissions
CREATE OR REPLACE FUNCTION assets.check_user_permission(required_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_permissions TEXT[];
BEGIN
  -- Get user permissions from session
  user_permissions := string_to_array(current_setting('app.user_permissions', true), ',');
  
  -- Check if user has required permission
  RETURN required_permission = ANY(user_permissions) OR 'admin' = ANY(user_permissions);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Stands table policies
-- SELECT: Users can only see stands from their organization
CREATE POLICY stands_select_policy ON assets.stands
  FOR SELECT
  USING (organization_id = assets.current_user_organization() AND is_deleted = false);

-- INSERT: Users with 'stands.create' permission can create stands
CREATE POLICY stands_insert_policy ON assets.stands
  FOR INSERT
  WITH CHECK (
    organization_id = assets.current_user_organization() AND
    assets.check_user_permission('stands.create')
  );

-- UPDATE: Users with 'stands.update' permission can update stands
CREATE POLICY stands_update_policy ON assets.stands
  FOR UPDATE
  USING (
    organization_id = assets.current_user_organization() AND
    assets.check_user_permission('stands.update') AND
    is_deleted = false
  )
  WITH CHECK (
    organization_id = assets.current_user_organization() AND
    assets.check_user_permission('stands.update')
  );

-- DELETE: Users with 'stands.delete' permission can soft delete stands
CREATE POLICY stands_delete_policy ON assets.stands
  FOR UPDATE
  USING (
    organization_id = assets.current_user_organization() AND
    assets.check_user_permission('stands.delete') AND
    is_deleted = false
  )
  WITH CHECK (
    organization_id = assets.current_user_organization() AND
    assets.check_user_permission('stands.delete') AND
    is_deleted = true
  );

-- Stand status history policies
CREATE POLICY stand_status_history_select_policy ON assets.stand_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assets.stands s
      WHERE s.id = stand_status_history.stand_id
      AND s.organization_id = assets.current_user_organization()
    )
  );

CREATE POLICY stand_status_history_insert_policy ON assets.stand_status_history
  FOR INSERT
  WITH CHECK (
    assets.check_user_permission('stands.update') AND
    EXISTS (
      SELECT 1 FROM assets.stands s
      WHERE s.id = stand_status_history.stand_id
      AND s.organization_id = assets.current_user_organization()
    )
  );

-- Stand import jobs policies
CREATE POLICY stand_import_jobs_select_policy ON assets.stand_import_jobs
  FOR SELECT
  USING (organization_id = assets.current_user_organization());

CREATE POLICY stand_import_jobs_insert_policy ON assets.stand_import_jobs
  FOR INSERT
  WITH CHECK (
    organization_id = assets.current_user_organization() AND
    assets.check_user_permission('stands.import')
  );

CREATE POLICY stand_import_jobs_update_policy ON assets.stand_import_jobs
  FOR UPDATE
  USING (organization_id = assets.current_user_organization())
  WITH CHECK (organization_id = assets.current_user_organization());

-- Stand maintenance records policies
CREATE POLICY stand_maintenance_select_policy ON assets.stand_maintenance_records
  FOR SELECT
  USING (organization_id = assets.current_user_organization());

CREATE POLICY stand_maintenance_insert_policy ON assets.stand_maintenance_records
  FOR INSERT
  WITH CHECK (
    organization_id = assets.current_user_organization() AND
    assets.check_user_permission('stands.maintenance')
  );

CREATE POLICY stand_maintenance_update_policy ON assets.stand_maintenance_records
  FOR UPDATE
  USING (
    organization_id = assets.current_user_organization() AND
    assets.check_user_permission('stands.maintenance')
  )
  WITH CHECK (
    organization_id = assets.current_user_organization() AND
    assets.check_user_permission('stands.maintenance')
  );

-- Stand adjacencies policies
CREATE POLICY stand_adjacencies_select_policy ON assets.stand_adjacencies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assets.stands s
      WHERE s.id = stand_adjacencies.stand_id
      AND s.organization_id = assets.current_user_organization()
    )
  );

CREATE POLICY stand_adjacencies_insert_policy ON assets.stand_adjacencies
  FOR INSERT
  WITH CHECK (
    assets.check_user_permission('stands.update') AND
    EXISTS (
      SELECT 1 FROM assets.stands s
      WHERE s.id = stand_adjacencies.stand_id
      AND s.organization_id = assets.current_user_organization()
    )
  );

-- Stand capability snapshots policies
CREATE POLICY stand_snapshots_select_policy ON assets.stand_capability_snapshots
  FOR SELECT
  USING (organization_id = assets.current_user_organization());

CREATE POLICY stand_snapshots_insert_policy ON assets.stand_capability_snapshots
  FOR INSERT
  WITH CHECK (
    organization_id = assets.current_user_organization() AND
    assets.check_user_permission('stands.update')
  );

-- Audit events policies
CREATE POLICY audit_events_select_policy ON assets.audit_events
  FOR SELECT
  USING (
    organization_id = assets.current_user_organization() AND
    (assets.check_user_permission('audit.read') OR user_id = current_setting('app.user_id', true))
  );

CREATE POLICY audit_events_insert_policy ON assets.audit_events
  FOR INSERT
  WITH CHECK (organization_id = assets.current_user_organization());

-- Create indexes for RLS performance
CREATE INDEX IF NOT EXISTS idx_stands_org_deleted ON assets.stands(organization_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_maintenance_org ON assets.stand_maintenance_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_org ON assets.stand_import_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_org_user ON assets.audit_events(organization_id, user_id);

-- Grant usage on schema
GRANT USAGE ON SCHEMA assets TO authenticated_user;

-- Grant appropriate permissions
GRANT SELECT ON ALL TABLES IN SCHEMA assets TO authenticated_user;
GRANT INSERT, UPDATE ON assets.stands TO authenticated_user;
GRANT INSERT ON assets.stand_status_history TO authenticated_user;
GRANT INSERT, UPDATE ON assets.stand_import_jobs TO authenticated_user;
GRANT INSERT, UPDATE ON assets.stand_maintenance_records TO authenticated_user;
GRANT INSERT ON assets.stand_adjacencies TO authenticated_user;
GRANT INSERT ON assets.stand_capability_snapshots TO authenticated_user;
GRANT INSERT ON assets.audit_events TO authenticated_user;

-- Create RLS bypass role for system operations
CREATE ROLE assets_system_user;
GRANT ALL ON SCHEMA assets TO assets_system_user;
GRANT ALL ON ALL TABLES IN SCHEMA assets TO assets_system_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA assets GRANT ALL ON TABLES TO assets_system_user;