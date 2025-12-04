# USB Sentinel - Vercel Deployment Guide

## Overview

USB Sentinel is a full-stack application for managing USB device access across Windows machines. This guide covers deployment on Vercel.

## Prerequisites

- Node.js 20+
- PostgreSQL database (Neon recommended)
- GitHub repository (for Vercel integration)
- Vercel account

## Environment Variables

Configure these variables in your Vercel project settings:

```env
# Database
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Authentication
JWT_SECRET=your-secure-random-string
SESSION_SECRET=your-secure-random-string

# Node Environment
NODE_ENV=production
```

## Deployment Steps

### 1. Push to GitHub

```bash
git add .
git commit -m "chore: Prepare for Vercel deployment"
git push origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Select `USB App Full Stack/UsbControlBackend` as root directory
5. Add environment variables (see above)
6. Click "Deploy"

### 3. Configure Environment Variables

In Vercel Project Settings → Environment Variables, add:
- `DATABASE_URL` - Your Neon PostgreSQL connection string
- `JWT_SECRET` - Generate with: `openssl rand -base64 32`
- `SESSION_SECRET` - Generate with: `openssl rand -base64 32`
- `NODE_ENV` - Set to `production`

### 4. Database Setup

After first deployment, run database migrations:

```bash
# From your local machine
npm run db:push
```

Or use Vercel Deployment Hooks to automate this.

## Deployment Configuration

Key files for Vercel:

- **`vercel.json`** - Vercel project configuration
- **`.vercelignore`** - Files to exclude from deployment
- **`package.json`** - Build and start scripts
- **`vite.config.ts`** - Build configuration (chunk size limit: 1500)

## Build & Start Commands

- **Build**: `npm run build`
- **Start**: `npm run start`

## Monitoring

Monitor your deployment in Vercel Dashboard:
- Deployment logs
- Function analytics
- Performance metrics
- Error tracking

## Troubleshooting

### Build Fails

Check these common issues:
1. Missing environment variables
2. Database connection string invalid
3. Node version mismatch (requires 20+)

### Runtime Errors

Check Vercel Function logs for:
1. Database connection issues
2. Missing dependencies
3. Environment variable configuration

### Performance Issues

- Monitor function execution time (max 60s on Vercel)
- Check database connection pooling
- Review bundle size (target: <1500KB chunks)

## Local Development

For local development, use `.env` file:

```bash
DATABASE_URL=...
JWT_SECRET=...
SESSION_SECRET=...
NODE_ENV=development
```

Run with:
```bash
npm run dev
```

## Production Considerations

1. **Database**: Use Neon serverless PostgreSQL
2. **Secrets**: Store all secrets in Vercel environment variables
3. **Backups**: Enable Neon automated backups
4. **Monitoring**: Set up error tracking (e.g., Sentry)
5. **SSL/TLS**: Vercel provides automatic HTTPS

## Scaling

- Vercel automatically scales based on traffic
- Database connections are pooled via Neon
- Function timeout: 60 seconds
- Concurrent function executions: handled by Vercel

## Support

For issues:
1. Check Vercel deployment logs
2. Review application error logs
3. Verify environment variables
4. Test database connectivity

---

**Deployed by**: Vercel
**Framework**: Node.js + React
**Database**: PostgreSQL (Neon)
