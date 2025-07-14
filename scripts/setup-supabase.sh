#!/bin/bash

# Setup Supabase Database for Staging
# This script initializes the database schemas in Supabase

echo "🚀 Setting up Supabase database schemas..."

# Load environment variables
if [ -f .env.staging ]; then
  export $(cat .env.staging | grep -v '^#' | xargs)
else
  echo "❌ .env.staging file not found!"
  exit 1
fi

# Extract connection details
DB_HOST=$(echo $DATABASE_URL | sed -E 's/.*@([^:]+):.*/\1/')
DB_NAME=$(echo $DATABASE_URL | sed -E 's/.*\/([^?]+).*/\1/')

echo "📊 Database: $DB_HOST/$DB_NAME"

# Run the initialization script
echo "🔧 Creating schemas..."
PGPASSWORD=Svt9rBOwkDyopoOp psql -h $DB_HOST -U postgres -d $DB_NAME -f scripts/init-database.sql

if [ $? -eq 0 ]; then
  echo "✅ Database schemas created successfully!"
else
  echo "❌ Failed to create database schemas"
  exit 1
fi

echo "🎉 Supabase setup complete!"