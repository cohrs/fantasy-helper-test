# Setup Guide for New Users

This guide will help you get the Multi-Sport Fantasy Assistant running on your machine.

## Prerequisites

- Node.js 20 or higher
- pnpm 10 or higher (install with `npm install -g pnpm`)
- A Yahoo account
- A Google account (for Gemini API)

## Step 1: Clone and Install

```bash
git clone <your-repo-url>
cd asshat-fantasy-2026
pnpm install
```

## Step 2: Get API Credentials

### Yahoo Fantasy API

1. Go to https://developer.yahoo.com/apps/
2. Click "Create an App"
3. Fill in the form:
   - Application Name: "Fantasy Assistant" (or your choice)
   - Application Type: "Web Application"
   - Redirect URI(s): 
     - `https://localhost:3000/api/auth/callback/yahoo`
     - Add your production URL later if deploying
   - API Permissions: Check "Fantasy Sports"
4. Save your Client ID and Client Secret

### Google Gemini API

1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy the generated key

### Neon Postgres Database

1. Go to https://neon.tech and sign up
2. Create a new project
3. Copy the connection string from the dashboard
4. Make sure it includes `?sslmode=require` at the end

### NextAuth Secret

Generate a secure random string:
```bash
openssl rand -base64 32
```

## Step 3: Configure Environment

1. Copy the example environment file:
```bash
cp .env.example .env.local
```

2. Edit `.env.local` and fill in your credentials:
```env
NEXTAUTH_URL=https://localhost:3000
NEXTAUTH_SECRET=<paste your generated secret>

YAHOO_CLIENT_ID=<your yahoo client id>
YAHOO_CLIENT_SECRET=<your yahoo client secret>
YAHOO_LEAGUE_ID=<your default league id - can change later>

GEMINI_API_KEY=<your gemini api key>

POSTGRES_URL=<your neon connection string>
```

## Step 4: Initialize Database

Run the migration script to create the database tables:
```bash
pnpm tsx scripts/migrate-to-db.ts
```

## Step 5: Start Development Server

```bash
pnpm dev
```

The app will start on https://localhost:3000 (HTTPS is enforced automatically).

Your browser may show a security warning about the self-signed certificate - this is normal for local development. Click "Advanced" and "Proceed to localhost".

## Step 6: Sign In and Select League

1. Click "Sign in with Yahoo"
2. Authorize the app to access your fantasy leagues
3. You'll see a league selector - choose your league
4. The app will detect if it's baseball or basketball and adjust accordingly

## Troubleshooting

### "Cannot connect to database"
- Check that your POSTGRES_URL is correct
- Make sure it ends with `?sslmode=require`
- Verify your Neon database is active

### "Yahoo OAuth error"
- Verify your redirect URI in Yahoo app settings matches exactly
- Make sure you're using HTTPS (not HTTP)
- Check that your Client ID and Secret are correct

### "Gemini API error"
- Verify your API key is correct
- Check that you haven't exceeded the free tier limits

### Port 3000 already in use
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9
```

## Next Steps

- Read `docs/FINAL-STATUS.md` for current feature status
- Check `docs/DEVELOPMENT.md` for development guidelines
- See the main README.md for full documentation

## Deploying to Production

See the main README.md for Vercel deployment instructions.
