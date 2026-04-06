# Google OAuth Setup Guide

## Prerequisites

1. A Google Cloud Platform (GCP) account
2. A Supabase project with Google OAuth enabled

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Configure the OAuth consent screen (if not done already):
   - Choose **External** (for testing) or **Internal** (for G Suite)
   - Fill in required information
   - Add scopes: `email`, `profile`
6. Create OAuth client ID:
   - Application type: **Web application**
   - Name: Your app name (e.g., "Weavy Clone")
   - Authorized JavaScript origins:
     - `http://localhost:3000` (for development)
     - `https://yourdomain.com` (for production)
   - Authorized redirect URIs:
     - `https://fcvklxgzvqqzexywrmry.supabase.co/auth/v1/callback`
     - `http://localhost:3000/auth/callback` (for local testing)
7. Copy the **Client ID** and **Client Secret**

## Step 2: Configure Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** and click to configure
5. Enable Google provider
6. Enter your Google OAuth credentials:
   - **Client ID (for OAuth)**: Paste your Google Client ID
   - **Client Secret (for OAuth)**: Paste your Google Client Secret
7. Click **Save**

## Step 3: Update Redirect URLs

Make sure your Supabase project has the correct redirect URLs:

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Add your site URL:
   - Development: `http://localhost:3000`
   - Production: `https://yourdomain.com`
3. Add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://yourdomain.com/auth/callback`

## Step 4: Test Google Login

1. Start your development server: `npm run dev`
2. Navigate to `/login` or `/signup`
3. Click **"Continue with Google"** button
4. You should be redirected to Google's sign-in page
5. After signing in, you'll be redirected back to your app

## Troubleshooting

### "redirect_uri_mismatch" Error

- Make sure the redirect URI in Google Console matches exactly:
  - `https://fcvklxgzvqqzexywrmry.supabase.co/auth/v1/callback`
- Check for trailing slashes or protocol mismatches

### "Invalid client" Error

- Verify your Client ID and Client Secret in Supabase
- Make sure Google OAuth is enabled in Supabase

### Redirect Not Working

- Check that your site URL is configured in Supabase
- Verify the callback route exists at `/auth/callback`
- Check browser console for errors

## Production Checklist

- [ ] Update Google OAuth redirect URIs with production domain
- [ ] Update Supabase site URL with production domain
- [ ] Test Google login in production
- [ ] Verify email domain restrictions (if any)
- [ ] Set up proper error handling and logging

