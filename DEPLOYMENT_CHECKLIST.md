# Deployment Checklist

## ✅ Completed
- [x] Supabase database schemas created
- [x] Railway configuration updated
- [x] GitHub Actions workflows created
- [x] Environment variables configured

## 📋 Next Steps

### 1. Add GitHub Secrets
Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:
- [ ] `RAILWAY_TOKEN`: `08c50126-d3ab-48fe-82bd-99011e9fb2f4`
- [ ] `RAILWAY_PROJECT_ID`: `4be48858-7a4c-4ccc-9368-a88f20246a6c`
- [ ] `SUPABASE_DATABASE_URL`: The full PostgreSQL connection string
- [ ] `SUPABASE_PROJECT_REF`: `aygstuxsnkqrzjnbytmg`
- [ ] `SUPABASE_ANON_KEY`: The anon key you provided
- [ ] `VERCEL_TOKEN`: `whVYpYE3GBW0UiFrY1SlgptL`
- [ ] `VERCEL_ORG_ID`: Get this by running `vercel whoami`
- [ ] `VERCEL_PROJECT_ID`: Get this from Vercel project settings

### 2. Initial Local Migrations
Since we can't connect directly to Supabase from local, we need to create initial migrations:

```bash
# Generate initial migrations locally (against local DB)
pnpm docker:up
pnpm prisma:migrate:dev

# Then commit the migration files
git add .
git commit -m "feat: add initial database migrations"
git push origin develop
```

### 3. Deploy to Railway
Once you push to develop branch:
- [ ] Railway should auto-deploy
- [ ] Get the Railway public URL from the dashboard
- [ ] Update the health check URL in `.github/workflows/deploy-staging.yml`

### 4. Update Environment Variables

#### In Railway Dashboard:
- [ ] Add `DATABASE_URL` environment variable with Supabase connection
- [ ] Add other env vars from `.env.staging`

#### In GitHub Secrets:
- [ ] Add `STAGING_API_URL` with the Railway URL

### 5. Test Deployment
- [ ] Check Railway logs for successful deployment
- [ ] Test API health endpoint: `https://your-railway-url.railway.app/health`
- [ ] Test entitlements endpoint: `https://your-railway-url.railway.app/api/entitlements`

### 6. Frontend Configuration (When Ready)
- [ ] Update Vercel environment variables to point to Railway API
- [ ] Set `NEXT_PUBLIC_API_URL` to your Railway URL

## 🚨 Important Notes

1. **Database Migrations**: The first deployment might fail if migrations haven't been created. Make sure to create and commit migration files first.

2. **Railway URL**: You'll get this after the first deployment. Update it in:
   - GitHub Actions workflow
   - Vercel environment variables
   - CORS settings in Railway

3. **CORS**: Once you have the Railway URL, update the `ALLOWED_ORIGINS` in Railway env vars.

## 📞 Support

If you encounter issues:
1. Check Railway logs for deployment errors
2. Verify all environment variables are set correctly
3. Ensure database connection string is correct
4. Check GitHub Actions logs for any workflow failures