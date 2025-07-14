-- Database initialization script for CapaCity Planner
-- Creates all required schemas for multi-tenant architecture

-- Create database if not exists (run as superuser)
-- CREATE DATABASE capacity_planner;

-- Connect to capacity_planner database
\c capacity_planner;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS entitlement;
CREATE SCHEMA IF NOT EXISTS assets;
CREATE SCHEMA IF NOT EXISTS work;

-- Grant permissions (adjust user as needed)
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA entitlement TO postgres;
GRANT ALL ON SCHEMA assets TO postgres;
GRANT ALL ON SCHEMA work TO postgres;

-- Set search path
SET search_path TO public, entitlement, assets, work;

-- Add UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add any other required extensions
CREATE EXTENSION IF NOT EXISTS "postgis"; -- For future GeoJSON support

-- Create base audit trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Output confirmation
DO $$
BEGIN
    RAISE NOTICE 'Database schemas created successfully';
    RAISE NOTICE 'Schemas: public, entitlement, assets, work';
END $$;