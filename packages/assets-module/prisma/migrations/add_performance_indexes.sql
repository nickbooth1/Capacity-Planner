-- Performance optimization indexes for Stand table

-- Index for organization and soft delete queries
CREATE INDEX IF NOT EXISTS idx_stand_org_deleted 
ON assets."Stand" (organization_id, is_deleted);

-- Index for code lookups
CREATE INDEX IF NOT EXISTS idx_stand_org_code 
ON assets."Stand" (organization_id, code) 
WHERE is_deleted = false;

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_stand_org_status 
ON assets."Stand" (organization_id, status) 
WHERE is_deleted = false;

-- Index for terminal grouping
CREATE INDEX IF NOT EXISTS idx_stand_org_terminal 
ON assets."Stand" (organization_id, terminal) 
WHERE is_deleted = false;

-- GIN indexes for JSONB fields (for efficient queries on JSON data)
CREATE INDEX IF NOT EXISTS idx_stand_dimensions 
ON assets."Stand" USING GIN (dimensions);

CREATE INDEX IF NOT EXISTS idx_stand_aircraft_compat 
ON assets."Stand" USING GIN (aircraft_compatibility);

CREATE INDEX IF NOT EXISTS idx_stand_ground_support 
ON assets."Stand" USING GIN (ground_support);

CREATE INDEX IF NOT EXISTS idx_stand_operational_constraints 
ON assets."Stand" USING GIN (operational_constraints);

CREATE INDEX IF NOT EXISTS idx_stand_environmental_features 
ON assets."Stand" USING GIN (environmental_features);

CREATE INDEX IF NOT EXISTS idx_stand_infrastructure 
ON assets."Stand" USING GIN (infrastructure);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_stand_org_terminal_code 
ON assets."Stand" (organization_id, terminal, code) 
WHERE is_deleted = false;

-- Index for version (optimistic locking)
CREATE INDEX IF NOT EXISTS idx_stand_version 
ON assets."Stand" (id, version);

-- Index for audit fields
CREATE INDEX IF NOT EXISTS idx_stand_updated_at 
ON assets."Stand" (updated_at DESC) 
WHERE is_deleted = false;

-- Index for spatial queries (if using PostGIS)
-- CREATE INDEX IF NOT EXISTS idx_stand_location 
-- ON assets."Stand" USING GIST (ST_MakePoint(longitude, latitude))
-- WHERE longitude IS NOT NULL AND latitude IS NOT NULL;

-- Analyze the table to update statistics for query planner
ANALYZE assets."Stand";