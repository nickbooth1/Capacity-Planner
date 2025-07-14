# GitHub Secrets Setup

Add these secrets to your GitHub repository for the CI/CD pipeline to work correctly.

Go to: Settings → Secrets and variables → Actions → New repository secret

## Required Secrets

### Database
- **Name**: `SUPABASE_DATABASE_URL`
- **Value**: `postgresql://postgres:Svt9rBOwkDyopoOp@db.aygstuxsnkqrzjnbytmg.supabase.co:5432/postgres`

- **Name**: `SUPABASE_PROJECT_REF`
- **Value**: `aygstuxsnkqrzjnbytmg`

- **Name**: `SUPABASE_ANON_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5Z3N0dXhzbmtxcnpqbmJ5dG1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0OTU4NDYsImV4cCI6MjA2ODA3MTg0Nn0.D5-KEHF_5_rPA3hPuR-n8VAJoIyKKPFWY7PA60Lipis`

### Railway
- **Name**: `RAILWAY_TOKEN`
- **Value**: `08c50126-d3ab-48fe-82bd-99011e9fb2f4`

- **Name**: `RAILWAY_PROJECT_ID`
- **Value**: `4be48858-7a4c-4ccc-9368-a88f20246a6c`

### Vercel
- **Name**: `VERCEL_TOKEN`
- **Value**: `whVYpYE3GBW0UiFrY1SlgptL`

- **Name**: `VERCEL_ORG_ID`
- **Value**: (You'll need to get this from Vercel - run `vercel whoami` in terminal)

- **Name**: `VERCEL_PROJECT_ID`
- **Value**: (You'll need to get this from your Vercel project settings)

## Optional Secrets (for future use)

- **Name**: `REDIS_URL`
- **Value**: (Add when you set up Redis for caching)

- **Name**: `JWT_SECRET`
- **Value**: (Generate a secure random string)

## Environment-specific Variables

These can be set in Railway/Vercel dashboards directly:
- `NODE_ENV`: staging/production
- `PORT`: Set by Railway automatically
- `NEXT_PUBLIC_API_URL`: Set in Vercel to point to your Railway API