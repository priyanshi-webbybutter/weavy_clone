# Admin Dashboard Setup Guide

## Overview

The admin dashboard allows administrators to view all users and their details, including credits, transactions, and projects.

## Admin User Setup

To create an admin user in Supabase, you need to set the admin role in the user's metadata. There are two ways to do this:

### Method 1: Via Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** > **Users**
3. Find the user you want to make an admin
4. Click on the user to edit
5. In the **User Metadata** or **App Metadata** section, add:
   ```json
   {
     "role": "admin"
   }
   ```
   OR
   ```json
   {
     "is_admin": true
   }
   ```

### Method 2: Via SQL (Supabase SQL Editor)

```sql
-- Update user metadata to make them admin
UPDATE auth.users
SET app_metadata = jsonb_set(
  COALESCE(app_metadata, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'admin@example.com';

-- OR using user_metadata
UPDATE auth.users
SET user_metadata = jsonb_set(
  COALESCE(user_metadata, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'admin@example.com';
```

## Accessing the Admin Dashboard

1. Navigate to `/admin/login` in your application
2. Login with admin credentials (email and password)
3. Upon successful login, you'll be redirected to `/admin/dashboard`

## Admin Dashboard Features

### Statistics Overview
- **Total Users**: Count of all registered users
- **Total Credits**: Sum of all user credit balances
- **Total Revenue**: Total dollar cost from all transactions
- **Total Transactions**: Count of all credit transactions
- **Total Projects**: Count of all user projects
- **Credits Used**: Total credits deducted across all users

### User Management
- View all users in a sortable table
- Search users by email or user ID
- Sort by:
  - Creation Date
  - Email
  - Credit Balance
  - Transaction Count
- Expand user rows to see detailed information:
  - Account Information (created date, last sign in, email verification)
  - Credits Information (balance, created/updated dates)
  - Transaction Statistics (count, total credits used, dollar cost, last transaction)
  - Project Information (count, last project date)

## API Endpoints

### POST `/api/admin/login`
Admin login endpoint. Validates credentials and checks admin status.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "user": { ... },
  "session": { ... },
  "isAdmin": true
}
```

### GET `/api/admin/users`
Fetches all users with detailed information. Requires admin authentication.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": "...",
      "email": "...",
      "emailConfirmed": true,
      "createdAt": "...",
      "lastSignIn": "...",
      "isAdmin": false,
      "credits": {
        "balance": 1000.00,
        "createdAt": "...",
        "updatedAt": "..."
      },
      "transactions": {
        "count": 5,
        "totalCreditsDeducted": "2.5000",
        "totalDollarCost": "0.050000",
        "lastTransaction": "..."
      },
      "projects": {
        "count": 3,
        "lastProject": {
          "id": "...",
          "createdAt": "..."
        }
      }
    }
  ],
  "total": 10
}
```

### GET `/api/admin/stats`
Fetches overall platform statistics. Requires admin authentication.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalUsers": 10,
    "totalCredits": 10000.00,
    "totalTransactions": 50,
    "totalCreditsDeducted": "25.0000",
    "totalDollarCost": "0.500000",
    "totalProjects": 30
  }
}
```

## Security Notes

- Admin routes are protected by middleware that checks:
  1. Valid authentication token
  2. Admin role in user metadata
- Only users with `app_metadata.role === 'admin'` or `user_metadata.role === 'admin'` can access admin endpoints
- The admin dashboard uses the Supabase service role key to bypass RLS and fetch all user data
- Make sure `SUPABASE_SERVICE_ROLE_KEY` is set in your backend `.env` file

## Troubleshooting

### "Access denied: Admin credentials required"
- The user account doesn't have admin role set in metadata
- Check user metadata in Supabase Dashboard
- Update metadata using Method 1 or Method 2 above

### "Service role key not configured"
- Add `SUPABASE_SERVICE_ROLE_KEY` to your backend `.env` file
- Get the service role key from Supabase Dashboard > Settings > API

### Users not showing up
- Ensure the service role key is correctly configured
- Check that RLS policies allow service role access (service role bypasses RLS by default)

