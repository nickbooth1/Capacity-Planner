-- CapaCity Planner Database Schema Setup for Supabase
-- Run this in the Supabase SQL Editor

-- Create schemas (if they don't exist)
CREATE SCHEMA IF NOT EXISTS entitlement;
CREATE SCHEMA IF NOT EXISTS assets;
CREATE SCHEMA IF NOT EXISTS work;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA entitlement TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA assets TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA work TO postgres, anon, authenticated, service_role;

-- Grant table permissions (will apply to future tables)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA entitlement GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA assets GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA work GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add PostGIS for future geospatial features
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Show success message
DO $$
BEGIN
    RAISE NOTICE 'Database schemas created successfully';
    RAISE NOTICE 'Schemas: public, entitlement, assets, work';
END $$;