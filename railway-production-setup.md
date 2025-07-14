# Railway Production Setup Guide

## Step-by-Step Instructions

### 1. Access Your Railway Project

1. Go to https://railway.app
2. Select your project: **capacity-planner-prod**
3. Make sure you're in the **production** environment

### 2. Create the API Gateway Service

1. Click **"New Service"**
2. Select **"GitHub Repo"**
3. Choose your repository: `nickbooth1/capacity-planner`
4. Configure:
   - **Service Name**: `api-gateway`
   - **Branch**: `main`
   - **Root Directory**: `/` (leave empty)

### 3. Add Environment Variables

1. Click on the `api-gateway` service
2. Go to the **Variables** tab
3. Click **"Raw Editor"**
4. Copy ALL content from `railway-env-production.txt` and paste it
5. Click **"Save"**

### 4. Configure Build & Deploy Settings

1. Stay in the service settings
2. Go to **Settings** tab
3. Under **Build Command**, it should auto-detect from railway.toml
4. Under **Deploy**, verify:
   - Start Command: `node dist/apps/api-gateway/main.js`
   - Health Check Path: `/health`

### 5. Add Redis Service (Optional but Recommended)

1. Click **"New Service"** again
2. Select **"Database"**
3. Choose **"Redis"**
4. It will automatically provision and provide the REDIS_URL

### 6. Deploy

1. The deployment should start automatically after adding variables
2. Monitor the build logs
3. Wait for the health check to pass

### 7. Configure Custom Domain

1. Once deployed, go to service **Settings**
2. Under **Networking**, click **"Generate Domain"** first to test
3. Once working, add custom domain:
   - Domain: `api.capacity-planner.com`
   - Add the provided CNAME record to your DNS

### 8. Update Vercel Frontend

Go to your Vercel project and update these environment variables:

```
NEXT_PUBLIC_API_URL=https://[your-railway-url].up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://xwyzzwaxaciuspjwdmbn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3eXp6d2F4YWNpdXNwandkbWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MTc0ODcsImV4cCI6MjA2ODA5MzQ4N30.OGrXs3MxLEKN4HJr1kQKNyfhQCZEDdzA0KdaqUS9FXY
```

### 9. Test Your Deployment

```bash
# Test health endpoint
curl https://[your-railway-url].up.railway.app/health

# Should return:
# {"status":"ok","timestamp":"...","environment":"production"}

# Test API endpoint
curl https://[your-railway-url].up.railway.app/api/entitlements/MAN

# Should return entitlements for Manchester Airport
```

## Troubleshooting

### Build Fails
- Check build logs for missing dependencies
- Ensure `pnpm-lock.yaml` is committed
- Verify Node version compatibility

### Health Check Fails
- Check if port 3000 is correct
- Verify DATABASE_URL is correct
- Check logs for connection errors

### Database Connection Issues
- Verify DATABASE_URL includes `?sslmode=require`
- Check if Supabase project is active
- Ensure no firewall blocking

### 502 Bad Gateway
- Service hasn't started yet
- Check start command is correct
- Review application logs

## Important Notes

1. **First Deployment**: Takes 5-10 minutes
2. **Subsequent Deployments**: 2-3 minutes
3. **Auto-Deploy**: Pushes to `main` branch trigger deployment
4. **Rollback**: Use Railway dashboard to revert to previous deployment
5. **Logs**: Available in real-time in Railway dashboard

## Security Checklist

- [ ] Environment variables set correctly
- [ ] No secrets in logs
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] Health check working

## Next Steps

1. Set up monitoring (Sentry/Datadog)
2. Configure alerts
3. Test all API endpoints
4. Document API for team