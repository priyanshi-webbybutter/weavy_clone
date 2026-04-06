# Authentication Setup Guide

## Email Confirmation

By default, Supabase requires users to confirm their email before they can log in. This is a security feature.

### Option 1: Disable Email Confirmation (Development Only)

For development/testing purposes, you can disable email confirmation:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **Settings**
4. Under **Email Auth**, find **"Enable email confirmations"**
5. **Disable** this option
6. Save changes

⚠️ **Warning**: Only disable this in development. Always enable it in production!

### Option 2: Use Email Confirmation (Recommended for Production)

The app now includes:
- **Resend confirmation email** button on the login page when "Email not confirmed" error appears
- Clear messaging on signup that users need to confirm their email

**How it works:**
1. User signs up → receives confirmation email
2. User clicks link in email → account is confirmed
3. User can now log in

**If user didn't receive email:**
- Click "Resend confirmation email" button on login page
- Check spam folder
- Verify email address is correct

## Testing Without Email Confirmation

If you disable email confirmation:
- Users can sign up and immediately log in
- No confirmation email is sent
- Faster for development/testing

## Production Checklist

- [ ] Enable email confirmations in Supabase
- [ ] Configure email templates in Supabase
- [ ] Set up custom SMTP (optional, for custom email domain)
- [ ] Test email delivery
- [ ] Test resend confirmation flow

