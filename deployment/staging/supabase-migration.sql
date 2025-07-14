-- Supabase Staging Database Migration Script
-- This script sets up the initial schema for the staging environment

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas if they don't exist
CREATE SCHEMA IF NOT EXISTS shared_kernel;
CREATE SCHEMA IF NOT EXISTS entitlement;
CREATE SCHEMA IF NOT EXISTS assets;
CREATE SCHEMA IF NOT EXISTS work;

-- Grant permissions
GRANT USAGE ON SCHEMA shared_kernel TO postgres;
GRANT USAGE ON SCHEMA entitlement TO postgres;
GRANT USAGE ON SCHEMA assets TO postgres;
GRANT USAGE ON SCHEMA work TO postgres;

-- Create staging-specific monitoring table
CREATE TABLE IF NOT EXISTS public.deployment_info (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    environment VARCHAR(50) NOT NULL DEFAULT 'staging',
    version VARCHAR(50) NOT NULL,
    deployed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deployed_by VARCHAR(100),
    git_commit VARCHAR(40),
    notes TEXT
);

-- Create health check table
CREATE TABLE IF NOT EXISTS public.health_checks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time_ms INTEGER,
    details JSONB
);

-- Create index for health checks
CREATE INDEX idx_health_checks_service_checked ON public.health_checks(service_name, checked_at DESC);

-- Insert initial deployment record
INSERT INTO public.deployment_info (version, deployed_by, notes)
VALUES ('1.0.0', 'initial-setup', 'Initial staging environment setup');