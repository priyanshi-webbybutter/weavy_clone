# Heroku CORS Configuration Guide

## Problem
CORS errors occur when deploying to Heroku because the frontend and backend URLs are different from localhost.

## Solution

### 1. Backend Environment Variables (Heroku)

Set these in your Heroku backend app's Config Vars:

```bash
# Required: Your frontend URL
FRONTEND_URL=https://your-frontend-app.herokuapp.com

# OR use this alternative name
NEXT_PUBLIC_FRONTEND_URL=https://your-frontend-app.herokuapp.com

# Your backend URL (if needed)
BACKEND_URL=https://your-backend-app.herokuapp.com
```

**How to set in Heroku Dashboard:**
1. Go to your backend app on Heroku
2. Click **Settings** → **Config Vars**
3. Click **Reveal Config Vars**
4. Add `FRONTEND_URL` with your frontend Heroku URL

### 2. Frontend Environment Variables (Heroku)

Set these in your Heroku frontend app's Config Vars:

```bash
# Required: Your backend API URL
NEXT_PUBLIC_API_URL=https://your-backend-app.herokuapp.com/api

# Optional: Your frontend URL
NEXT_PUBLIC_FRONTEND_URL=https://your-frontend-app.herokuapp.com
```

**How to set in Heroku Dashboard:**
1. Go to your frontend app on Heroku
2. Click **Settings** → **Config Vars**
3. Click **Reveal Config Vars**
4. Add `NEXT_PUBLIC_API_URL` with your backend Heroku URL + `/api`

### 3. Supabase Configuration

#### Redirect URLs
1. Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add:
   ```
   https://your-frontend-app.herokuapp.com/auth/callback
   ```
3. Keep localhost for local development:
   ```
   http://localhost:3000/auth/callback
   ```

#### Site URL
Set **Site URL** to:
```
https://your-frontend-app.herokuapp.com
```

### 4. Google Cloud Console

1. Go to **Google Cloud Console** → **APIs & Services** → **Credentials**
2. Find your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, ensure you have:
   ```
   https://fcvklxgzvqqzexywrmry.supabase.co/auth/v1/callback
   ```
   (This is Supabase's callback URL - Google redirects here first)

### 5. Verify Configuration

#### Test CORS
```bash
curl -H "Origin: https://your-frontend-app.herokuapp.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://your-backend-app.herokuapp.com/api/auth/google
```

Should return headers with `Access-Control-Allow-Origin`.

#### Check Heroku Logs
```bash
# Backend logs
heroku logs --tail --app your-backend-app

# Frontend logs
heroku logs --tail --app your-frontend-app
```

Look for:
- CORS warnings: `⚠️ CORS blocked origin: ...`
- OAuth redirect URLs being logged
- Any error messages

### 6. Common Issues

#### Issue: CORS still blocked
**Solution:** 
- Verify `FRONTEND_URL` is set correctly in backend Heroku config
- Check that the frontend URL matches exactly (no trailing slash)
- Restart backend dyno: `heroku restart --app your-backend-app`

#### Issue: Redirect URI mismatch
**Solution:**
- Verify redirect URL in Supabase matches exactly: `https://your-frontend-app.herokuapp.com/auth/callback`
- Check Google Cloud Console has Supabase callback URL
- Ensure `FRONTEND_URL` env var is set correctly

#### Issue: OAuth redirects to wrong URL
**Solution:**
- Check `NEXT_PUBLIC_API_URL` is set correctly in frontend
- Verify `window.location.origin` matches your Heroku frontend URL
- Check browser console for the actual redirect URL being sent

### 7. Testing Locally with Production URLs

To test with production URLs locally:

```bash
# Backend .env
FRONTEND_URL=https://your-frontend-app.herokuapp.com

# Frontend .env.local
NEXT_PUBLIC_API_URL=https://your-backend-app.herokuapp.com/api
```

### 8. Quick Checklist

- [ ] `FRONTEND_URL` set in backend Heroku config
- [ ] `NEXT_PUBLIC_API_URL` set in frontend Heroku config
- [ ] Supabase redirect URL includes production frontend URL
- [ ] Supabase Site URL set to production frontend URL
- [ ] Google Cloud Console has Supabase callback URL
- [ ] Both Heroku apps restarted after config changes
- [ ] Browser console shows no CORS errors
- [ ] OAuth flow completes successfully

## Notes

- The CORS configuration now allows all origins in production for flexibility
- For stricter security, modify `backend/server.js` to reject unknown origins
- Always test OAuth flow after deploying to ensure redirect URLs match

