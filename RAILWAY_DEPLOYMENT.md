# USB Sentinel - Railway Deployment Guide

## 1. Prerequisites
- Railway account: https://railway.app/
- GitHub repo connected
- Neon/PostgreSQL database (or Railway Postgres plugin)

## 2. Environment Variables
Set these in Railway project settings:
- `DATABASE_URL` (Neon or Railway Postgres connection string)
- `JWT_SECRET` (generate with `openssl rand -base64 32`)
- `SESSION_SECRET` (generate with `openssl rand -base64 32`)
- `NODE_ENV=production`
- `PORT=8080` (Railway default)

## 3. Build & Start Commands
- **Build:** `npm run build`
- **Start:** `npm run start`

## 4. Procfile
A `Procfile` is included:
```
web: npm run start
```

## 5. Steps
1. Push your code to GitHub
2. Create a new Railway project, link your repo
3. Set environment variables
4. Deploy!

## 6. Notes
- The app listens on `process.env.PORT` (default 8080 for Railway)
- Static files are served from `dist/public`
- API and frontend are served from the same process

## 7. Troubleshooting
- Check Railway logs for errors
- Ensure all env vars are set
- Make sure your database is accessible from Railway

---
For more, see: https://docs.railway.app/deploy/quickstart
