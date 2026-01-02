# Google OAuth Configuration Fix

## The Issue

The error "Google OAuth failed" is typically caused by incorrect redirect URL configuration in Supabase.

## Important URLs

- **Supabase Internal Callback** (automatic): `https://fcvklxgzvqqzexywrmry.supabase.co/auth/v1/callback`
- **Frontend Callback** (must be configured): `http://localhost:3000/auth/callback`

## Step-by-Step Fix

### 1. Configure Redirect URLs in Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. Under **Redirect URLs**, add:
   ```
   http://localhost:3000/auth/callback
   ```
   (For production, also add your production URL)

5. Under **Site URL**, set:
   ```
   http://localhost:3000
   ```
   (For production, use your production domain)

6. Click **Save**

### 2. Verify Google OAuth Provider

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Find **Google** and click to configure
3. Make sure it's **Enabled**
4. Verify **Client ID (for OAuth)** and **Client Secret (for OAuth)** are filled in
5. Click **Save**

### 3. Verify Google Cloud Console Settings

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, make sure you have:
   ```
   https://fcvklxgzvqqzexywrmry.supabase.co/auth/v1/callback
   ```
   (This is Supabase's callback - Google redirects here first)

5. Click **Save**

### 4. Test the Flow

1. Start your backend server (should be on port 3001 or 3002)
2. Start your frontend (should be on port 3000)
3. Try logging in with Google
4. Check backend terminal for detailed logs

## How OAuth Flow Works

1. User clicks "Sign in with Google"
2. Frontend calls `/api/auth/google` with `redirectTo: http://localhost:3000/auth/callback`
3. Backend calls Supabase's `signInWithOAuth` with that redirect URL
4. Supabase redirects user to Google OAuth page
5. User authorizes on Google
6. Google redirects to Supabase: `https://fcvklxgzvqqzexywrmry.supabase.co/auth/v1/callback?code=...`
7. Supabase processes the code and redirects to your frontend: `http://localhost:3000/auth/callback?code=...`
8. Frontend callback page exchanges code for session via `/api/auth/google/callback`

## Common Errors

### "redirect_uri_mismatch"
- **Fix**: Add `http://localhost:3000/auth/callback` to Supabase Redirect URLs

### "invalid_client"
- **Fix**: Check Google OAuth credentials in Supabase Dashboard

### "No OAuth URL returned"
- **Fix**: Ensure Google provider is enabled in Supabase

### "500 Internal Server Error"
- **Fix**: Check backend terminal logs for the exact error
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in `backend/.env`

## Debugging

Check your backend terminal when clicking "Sign in with Google". You should see:
```
🔐 Google OAuth route hit!
📍 Redirect URL (frontend callback): http://localhost:3000/auth/callback
🔄 Calling signInWithOAuth with: { ... }
📦 OAuth result: { ... }
```

If you see errors, they will be logged with details.

