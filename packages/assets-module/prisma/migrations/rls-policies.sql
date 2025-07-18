-- Row Level Security (RLS) Policies for Assets Module
-- This file contains all RLS policies to secure access to asset data
-- Organization-based access control ensures users can only access their organization's data

-- Enable RLS on all tables in the assets schema
ALTER TABLE assets.stands ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.stand_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.asset_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.stand_capability_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.stand_utilization_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.stand_maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.stand_adjacencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets.stand_capability_snapshots ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's organization ID
CREATE OR REPLACE FUNCTION assets.get_current_organization_id() RETURNS text AS $$
BEGIN
  RETURN current_setting('app.current_organization_id', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current user ID
CREATE OR REPLACE FUNCTION assets.get_current_user_id() RETURNS text AS $$
BEGIN
  RETURN current_setting('app.current_user_id', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has admin role
CREATE OR REPLACE FUNCTION assets.is_admin_user() RETURNS boolean AS $$
BEGIN
  RETURN COALESCE(current_setting('app.user_role', true), '') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has capability management permissions
CREATE OR REPLACE FUNCTION assets.has_capability_management_permission() RETURNS boolean AS $$
BEGIN
  RETURN COALESCE(current_setting('app.user_permissions', true), '') LIKE '%capability_management%'
    OR assets.is_admin_user();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has maintenance management permissions
CREATE OR REPLACE FUNCTION assets.has_maintenance_management_permission() RETURNS boolean AS $$
BEGIN
  RETURN COALESCE(current_setting('app.user_permissions', true), '') LIKE '%maintenance_management%'
    OR assets.is_admin_user();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STANDS TABLE POLICIES
-- Policy for SELECT: Users can view stands in their organization
CREATE POLICY stands_select_policy ON assets.stands FOR SELECT
  USING (organization_id = assets.get_current_organization_id());

-- Policy for INSERT: Users can create stands in their organization
CREATE POLICY stands_insert_policy ON assets.stands FOR INSERT
  WITH CHECK (
    organization_id = assets.get_current_organization_id()
    AND assets.has_capability_management_permission()
  );

-- Policy for UPDATE: Users can update stands in their organization with proper permissions
CREATE POLICY stands_update_policy ON assets.stands FOR UPDATE
  USING (organization_id = assets.get_current_organization_id())
  WITH CHECK (
    organization_id = assets.get_current_organization_id()
    AND assets.has_capability_management_permission()
  );

-- Policy for DELETE: Only admins can delete stands
CREATE POLICY stands_delete_policy ON assets.stands FOR DELETE
  USING (
    organization_id = assets.get_current_organization_id()
    AND assets.is_admin_user()
  );

-- STAND STATUS HISTORY TABLE POLICIES
-- Policy for SELECT: Users can view status history for their organization's stands
CREATE POLICY stand_status_history_select_policy ON assets.stand_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assets.stands 
      WHERE id = stand_id 
      AND organization_id = assets.get_current_organization_id()
    )
  );

-- Policy for INSERT: Users can create status history records
CREATE POLICY stand_status_history_insert_policy ON assets.stand_status_history FOR INSERT
  WITH CHECK (
    changed_by = assets.get_current_user_id()
    AND EXISTS (
      SELECT 1 FROM assets.stands 
      WHERE id = stand_id 
      AND organization_id = assets.get_current_organization_id()
    )
  );

-- ASSET TYPES TABLE POLICIES
-- Policy for SELECT: Users can view asset types in their organization
CREATE POLICY asset_types_select_policy ON assets.asset_types FOR SELECT
  USING (organization_id = assets.get_current_organization_id());

-- Policy for INSERT: Only admins can create asset types
CREATE POLICY asset_types_insert_policy ON assets.asset_types FOR INSERT
  WITH CHECK (
    organization_id = assets.get_current_organization_id()
    AND assets.is_admin_user()
  );

-- Policy for UPDATE: Only admins can update asset types
CREATE POLICY asset_types_update_policy ON assets.asset_types FOR UPDATE
  USING (organization_id = assets.get_current_organization_id())
  WITH CHECK (
    organization_id = assets.get_current_organization_id()
    AND assets.is_admin_user()
  );

-- Policy for DELETE: Only admins can delete asset types
CREATE POLICY asset_types_delete_policy ON assets.asset_types FOR DELETE
  USING (
    organization_id = assets.get_current_organization_id()
    AND assets.is_admin_user()
  );

-- ASSETS TABLE POLICIES
-- Policy for SELECT: Users can view assets in their organization
CREATE POLICY assets_select_policy ON assets.assets FOR SELECT
  USING (organization_id = assets.get_current_organization_id());

-- Policy for INSERT: Users with capability management can create assets
CREATE POLICY assets_insert_policy ON assets.assets FOR INSERT
  WITH CHECK (
    organization_id = assets.get_current_organization_id()
    AND assets.has_capability_management_permission()
  );

-- Policy for UPDATE: Users with capability management can update assets
CREATE POLICY assets_update_policy ON assets.assets FOR UPDATE
  USING (organization_id = assets.get_current_organization_id())
  WITH CHECK (
    organization_id = assets.get_current_organization_id()
    AND assets.has_capability_management_permission()
  );

-- Policy for DELETE: Only admins can delete assets
CREATE POLICY assets_delete_policy ON assets.assets FOR DELETE
  USING (
    organization_id = assets.get_current_organization_id()
    AND assets.is_admin_user()
  );

-- STAND CAPABILITY TEMPLATES TABLE POLICIES
-- Policy for SELECT: Users can view templates in their organization
CREATE POLICY templates_select_policy ON assets.stand_capability_templates FOR SELECT
  USING (organization_id = assets.get_current_organization_id());

-- Policy for INSERT: Only admins can create templates
CREATE POLICY templates_insert_policy ON assets.stand_capability_templates FOR INSERT
  WITH CHECK (
    organization_id = assets.get_current_organization_id()
    AND assets.is_admin_user()
  );

-- Policy for UPDATE: Only admins can update templates
CREATE POLICY templates_update_policy ON assets.stand_capability_templates FOR UPDATE
  USING (organization_id = assets.get_current_organization_id())
  WITH CHECK (
    organization_id = assets.get_current_organization_id()
    AND assets.is_admin_user()
  );

-- Policy for DELETE: Only admins can delete templates
CREATE POLICY templates_delete_policy ON assets.stand_capability_templates FOR DELETE
  USING (
    organization_id = assets.get_current_organization_id()
    AND assets.is_admin_user()
  );

-- STAND UTILIZATION PATTERNS TABLE POLICIES
-- Policy for SELECT: Users can view utilization patterns for their organization's stands
CREATE POLICY utilization_patterns_select_policy ON assets.stand_utilization_patterns FOR SELECT
  USING (organization_id = assets.get_current_organization_id());

-- Policy for INSERT: System can create utilization patterns
CREATE POLICY utilization_patterns_insert_policy ON assets.stand_utilization_patterns FOR INSERT
  WITH CHECK (organization_id = assets.get_current_organization_id());

-- Policy for UPDATE: System can update utilization patterns
CREATE POLICY utilization_patterns_update_policy ON assets.stand_utilization_patterns FOR UPDATE
  USING (organization_id = assets.get_current_organization_id())
  WITH CHECK (organization_id = assets.get_current_organization_id());

-- Policy for DELETE: Only admins can delete utilization patterns
CREATE POLICY utilization_patterns_delete_policy ON assets.stand_utilization_patterns FOR DELETE
  USING (
    organization_id = assets.get_current_organization_id()
    AND assets.is_admin_user()
  );

-- STAND MAINTENANCE RECORDS TABLE POLICIES
-- Policy for SELECT: Users can view maintenance records for their organization's stands
CREATE POLICY maintenance_records_select_policy ON assets.stand_maintenance_records FOR SELECT
  USING (organization_id = assets.get_current_organization_id());

-- Policy for INSERT: Users with maintenance management can create records
CREATE POLICY maintenance_records_insert_policy ON assets.stand_maintenance_records FOR INSERT
  WITH CHECK (
    organization_id = assets.get_current_organization_id()
    AND assets.has_maintenance_management_permission()
  );

-- Policy for UPDATE: Users with maintenance management can update records
CREATE POLICY maintenance_records_update_policy ON assets.stand_maintenance_records FOR UPDATE
  USING (organization_id = assets.get_current_organization_id())
  WITH CHECK (
    organization_id = assets.get_current_organization_id()
    AND assets.has_maintenance_management_permission()
  );

-- Policy for DELETE: Only admins can delete maintenance records
CREATE POLICY maintenance_records_delete_policy ON assets.stand_maintenance_records FOR DELETE
  USING (
    organization_id = assets.get_current_organization_id()
    AND assets.is_admin_user()
  );

-- STAND ADJACENCIES TABLE POLICIES
-- Policy for SELECT: Users can view adjacencies for their organization's stands
CREATE POLICY adjacencies_select_policy ON assets.stand_adjacencies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assets.stands 
      WHERE id = stand_id 
      AND organization_id = assets.get_current_organization_id()
    )
  );

-- Policy for INSERT: Users with capability management can create adjacencies
CREATE POLICY adjacencies_insert_policy ON assets.stand_adjacencies FOR INSERT
  WITH CHECK (
    assets.has_capability_management_permission()
    AND EXISTS (
      SELECT 1 FROM assets.stands 
      WHERE id = stand_id 
      AND organization_id = assets.get_current_organization_id()
    )
    AND EXISTS (
      SELECT 1 FROM assets.stands 
      WHERE id = adjacent_stand_id 
      AND organization_id = assets.get_current_organization_id()
    )
  );

-- Policy for UPDATE: Users with capability management can update adjacencies
CREATE POLICY adjacencies_update_policy ON assets.stand_adjacencies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM assets.stands 
      WHERE id = stand_id 
      AND organization_id = assets.get_current_organization_id()
    )
  )
  WITH CHECK (
    assets.has_capability_management_permission()
    AND EXISTS (
      SELECT 1 FROM assets.stands 
      WHERE id = stand_id 
      AND organization_id = assets.get_current_organization_id()
    )
    AND EXISTS (
      SELECT 1 FROM assets.stands 
      WHERE id = adjacent_stand_id 
      AND organization_id = assets.get_current_organization_id()
    )
  );

-- Policy for DELETE: Users with capability management can delete adjacencies
CREATE POLICY adjacencies_delete_policy ON assets.stand_adjacencies FOR DELETE
  USING (
    assets.has_capability_management_permission()
    AND EXISTS (
      SELECT 1 FROM assets.stands 
      WHERE id = stand_id 
      AND organization_id = assets.get_current_organization_id()
    )
  );

-- STAND CAPABILITY SNAPSHOTS TABLE POLICIES
-- Policy for SELECT: Users can view capability snapshots for their organization's stands
CREATE POLICY capability_snapshots_select_policy ON assets.stand_capability_snapshots FOR SELECT
  USING (organization_id = assets.get_current_organization_id());

-- Policy for INSERT: System can create capability snapshots
CREATE POLICY capability_snapshots_insert_policy ON assets.stand_capability_snapshots FOR INSERT
  WITH CHECK (organization_id = assets.get_current_organization_id());

-- Policy for UPDATE: No updates allowed on snapshots (immutable audit trail)
-- No UPDATE policy defined - snapshots are immutable

-- Policy for DELETE: Only admins can delete snapshots (for data retention)
CREATE POLICY capability_snapshots_delete_policy ON assets.stand_capability_snapshots FOR DELETE
  USING (
    organization_id = assets.get_current_organization_id()
    AND assets.is_admin_user()
  );

-- INDEXES FOR PERFORMANCE WITH RLS
-- Additional indexes to optimize RLS policy queries
CREATE INDEX IF NOT EXISTS idx_stands_organization_id ON assets.stands (organization_id);
CREATE INDEX IF NOT EXISTS idx_asset_types_organization_id ON assets.asset_types (organization_id);
CREATE INDEX IF NOT EXISTS idx_assets_organization_id ON assets.assets (organization_id);
CREATE INDEX IF NOT EXISTS idx_templates_organization_id ON assets.stand_capability_templates (organization_id);
CREATE INDEX IF NOT EXISTS idx_utilization_patterns_organization_id ON assets.stand_utilization_patterns (organization_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_organization_id ON assets.stand_maintenance_records (organization_id);
CREATE INDEX IF NOT EXISTS idx_capability_snapshots_organization_id ON assets.stand_capability_snapshots (organization_id);

-- GIN indexes for JSONB fields to support capability queries
CREATE INDEX IF NOT EXISTS idx_stands_dimensions_gin ON assets.stands USING gin (dimensions);
CREATE INDEX IF NOT EXISTS idx_stands_aircraft_compatibility_gin ON assets.stands USING gin (aircraft_compatibility);
CREATE INDEX IF NOT EXISTS idx_stands_ground_support_gin ON assets.stands USING gin (ground_support);
CREATE INDEX IF NOT EXISTS idx_stands_operational_constraints_gin ON assets.stands USING gin (operational_constraints);
CREATE INDEX IF NOT EXISTS idx_stands_environmental_features_gin ON assets.stands USING gin (environmental_features);
CREATE INDEX IF NOT EXISTS idx_stands_infrastructure_gin ON assets.stands USING gin (infrastructure);

-- Function to set session variables for RLS
CREATE OR REPLACE FUNCTION assets.set_session_variables(
  org_id text,
  user_id text,
  user_role text DEFAULT 'user',
  user_permissions text DEFAULT ''
) RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_organization_id', org_id, false);
  PERFORM set_config('app.current_user_id', user_id, false);
  PERFORM set_config('app.user_role', user_role, false);
  PERFORM set_config('app.user_permissions', user_permissions, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant usage on the helper functions
GRANT EXECUTE ON FUNCTION assets.get_current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION assets.get_current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION assets.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION assets.has_capability_management_permission() TO authenticated;
GRANT EXECUTE ON FUNCTION assets.has_maintenance_management_permission() TO authenticated;
GRANT EXECUTE ON FUNCTION assets.set_session_variables(text, text, text, text) TO authenticated;

-- Create a view for stands with computed capabilities for easier querying
CREATE OR REPLACE VIEW assets.stands_with_capabilities AS
SELECT 
  s.*,
  CASE 
    WHEN s.dimensions IS NOT NULL THEN 
      (s.dimensions->>'icaoCategory')::text 
    ELSE NULL 
  END as computed_icao_category,
  CASE 
    WHEN s.aircraftCompatibility IS NOT NULL THEN 
      (s.aircraftCompatibility->>'maxWingspan')::numeric 
    ELSE NULL 
  END as computed_max_wingspan,
  CASE 
    WHEN s.groundSupport IS NOT NULL THEN 
      (s.groundSupport->>'hasPowerSupply')::boolean 
    ELSE NULL 
  END as computed_has_power_supply,
  CASE 
    WHEN s.groundSupport IS NOT NULL THEN 
      (s.groundSupport->>'hasJetbridge')::boolean 
    ELSE NULL 
  END as computed_has_jetbridge
FROM assets.stands s;

-- Apply RLS to the view
ALTER VIEW assets.stands_with_capabilities SET (security_barrier = true);

-- Comments for documentation
COMMENT ON FUNCTION assets.get_current_organization_id() IS 'Gets the current organization ID from session variables';
COMMENT ON FUNCTION assets.get_current_user_id() IS 'Gets the current user ID from session variables';
COMMENT ON FUNCTION assets.is_admin_user() IS 'Checks if the current user has admin role';
COMMENT ON FUNCTION assets.has_capability_management_permission() IS 'Checks if user can manage stand capabilities';
COMMENT ON FUNCTION assets.has_maintenance_management_permission() IS 'Checks if user can manage maintenance records';
COMMENT ON FUNCTION assets.set_session_variables(text, text, text, text) IS 'Sets session variables for RLS policies';
COMMENT ON VIEW assets.stands_with_capabilities IS 'View of stands with computed capability fields for easier querying';