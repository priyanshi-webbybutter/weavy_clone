# Session Management & Extended Login Time

## Overview

The session timeout has been increased from **1 hour to 7 days**, and automatic session refresh has been implemented to keep users logged in longer.

## Changes Made

### 1. Backend Session Expiry (`backend/routes/auth.js`)

- **Changed**: Session expiry from `3600 seconds` (1 hour) to `604800 seconds` (7 days)
- **Location**: `GET /api/auth/session` endpoint
- **Impact**: Users remain logged in for 7 days instead of 1 hour

```javascript
const SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days
```

### 2. Frontend Automatic Session Refresh (`contexts/AuthContext.tsx`)

- **Added**: Automatic session refresh every 30 minutes
- **Added**: Session refresh when window regains focus
- **Added**: Refresh token storage and management
- **Impact**: Sessions are automatically renewed before expiry, keeping users logged in indefinitely as long as they're active

#### Key Features:

1. **Periodic Refresh**: Checks and refreshes session every 30 minutes
2. **Focus Refresh**: Refreshes session when user returns to the tab/window
3. **Refresh Token Storage**: Stores refresh tokens for future use
4. **Clean Logout**: Removes both access and refresh tokens on logout

### 3. Refresh Token Storage

Updated in multiple locations to store refresh tokens:
- `contexts/AuthContext.tsx` - `signIn`, `signUp`, `checkSession`, `signOut`
- `app/auth/callback/page.tsx` - OAuth callback handler

## How It Works

### Session Lifecycle

1. **Login**: User logs in → Session created with 7-day expiry
2. **Active Use**: Every 30 minutes, session is automatically refreshed
3. **Tab Focus**: When user returns to tab, session refreshes immediately
4. **Extended Stay**: As long as user is active, session keeps renewing
5. **Inactivity**: After 7 days of no activity, session expires

### Automatic Refresh Flow

```
User Logs In
    ↓
Session Created (7 days expiry)
    ↓
Every 30 minutes → Refresh Session
    ↓
Window Focus → Refresh Session
    ↓
Session Renewed (another 7 days)
    ↓
Repeat while active...
```

## Configuration

### Adjust Session Duration

To change the session duration, modify `SESSION_EXPIRY_SECONDS` in `backend/routes/auth.js`:

```javascript
// Current: 7 days
const SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

// Example: 30 days
const SESSION_EXPIRY_SECONDS = 30 * 24 * 60 * 60;

// Example: 1 day
const SESSION_EXPIRY_SECONDS = 24 * 60 * 60;
```

### Adjust Refresh Interval

To change how often sessions refresh, modify the interval in `contexts/AuthContext.tsx`:

```typescript
// Current: 30 minutes
const refreshInterval = setInterval(() => {
  // ...
}, 30 * 60 * 1000);

// Example: 15 minutes
const refreshInterval = setInterval(() => {
  // ...
}, 15 * 60 * 1000);
```

## Supabase JWT Configuration (Optional)

For optimal performance, you can also configure Supabase's JWT expiry:

1. Go to **Supabase Dashboard** → **Project Settings** → **API**
2. Find **JWT Settings**
3. Set **JWT expiry** to match your backend (604800 seconds = 7 days)
4. Save changes

**Note**: This is optional. The backend override will work regardless of Supabase's JWT settings.

## Benefits

1. ✅ **Better UX**: Users stay logged in longer
2. ✅ **Automatic Renewal**: No manual re-login needed
3. ✅ **Seamless Experience**: Session refreshes in background
4. ✅ **Security**: Still expires after inactivity period
5. ✅ **Focus Detection**: Refreshes when user returns to app

## Testing

1. **Login** and verify session is created
2. **Wait 30 minutes** and check console for refresh logs
3. **Switch tabs** and return - session should refresh
4. **Check localStorage** - should contain `auth_token` and `refresh_token`
5. **Logout** - both tokens should be removed

## Troubleshooting

### Session Still Expiring Too Quickly

- Check backend logs to verify `SESSION_EXPIRY_SECONDS` is correct
- Verify frontend refresh interval is running (check console logs)
- Check Supabase JWT settings if configured

### Refresh Not Working

- Check browser console for errors
- Verify `API_BASE_URL` is correct in `AuthContext.tsx`
- Check network tab for `/auth/session` requests every 30 minutes

### Tokens Not Stored

- Check browser localStorage
- Verify `localStorage.setItem` is being called
- Check for browser privacy settings blocking localStorage

