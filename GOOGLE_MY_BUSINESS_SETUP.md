# Google My Business API Setup Guide

This guide walks through setting up Google My Business (GMB) API integration to fetch 200+ reviews instead of the 5-review limit from Google Places API.

## Overview

**What we built:**
- OAuth 2.0 authentication flow
- Google My Business API integration
- Admin setup page for one-time authentication
- Automatic token refresh handling
- New `/api/gmb-reviews` endpoint fetching 50+ reviews

## Prerequisites

1. Google Cloud Console access
2. Google My Business account with business ownership
3. Vercel deployment access (for production environment variables)

---

## Part 1: Google Cloud Console Setup

### Step 1: Enable Required APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **"APIs & Services"** > **"Library"**
4. Search for and enable these APIs:
   - ✅ **Google My Business API**
   - ✅ **My Business Account Management API**
   - ✅ **My Business Business Information API**
5. Click **"Enable"** for each

### Step 2: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** > **"OAuth consent screen"**
2. Choose **External** user type (unless using Google Workspace)
3. Fill in required fields:
   - **App name:** First Access Lending Reviews
   - **User support email:** Your business email
   - **Developer contact:** Your email
4. Click **"Save and Continue"**
5. Add scopes:
   - Click **"Add or Remove Scopes"**
   - Search for: `https://www.googleapis.com/auth/business.manage`
   - Select it and save
6. Add test users (if in testing mode):
   - Add the Google account that owns the business listing
7. Click **"Save and Continue"** through remaining steps

### Step 3: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** > **"Credentials"**
2. Click **"Create Credentials"** > **"OAuth client ID"**
3. Configure:
   - **Application type:** Web application
   - **Name:** First Access Lending GMB Reviews
   - **Authorized redirect URIs:**
     - Production: `https://www.firstaccesslending.com/api/auth/google/callback`
     - Local dev: `http://localhost:3000/api/auth/google/callback`
4. Click **"Create"**
5. **Save these credentials** (you'll need them next):
   - Client ID (looks like: `xxxxx.apps.googleusercontent.com`)
   - Client Secret (looks like: `GOCSPX-xxxxx`)

---

## Part 2: Environment Configuration

### Local Development

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Add your OAuth credentials to `.env.local`:
   ```env
   GOOGLE_OAUTH_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret_here
   GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   ```

### Production (Vercel)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Add these variables:
   - `GOOGLE_OAUTH_CLIENT_ID` → Your Client ID
   - `GOOGLE_OAUTH_CLIENT_SECRET` → Your Client Secret
   - `GOOGLE_OAUTH_REDIRECT_URI` → `https://www.firstaccesslending.com/api/auth/google/callback`
4. Click **"Save"**
5. Redeploy the application

---

## Part 3: Authentication (One-Time Setup)

### For Zach (Business Owner):

1. Go to the admin setup page:
   - Production: https://www.firstaccesslending.com/admin/setup
   - Local: http://localhost:3000/admin/setup

2. Click **"Authenticate with Google"**

3. Sign in with the Google account that **owns the First Access Lending business listing**

4. Review and grant permissions:
   - The app will request access to manage your Google My Business data
   - This is necessary to fetch reviews

5. You'll be redirected back to the setup page with a success message

6. Verify authentication status shows:
   - ✅ Authentication: Authenticated
   - ✅ Refresh Token: Available

7. Test the integration by clicking **"Test GMB Reviews API"**

**Important:** This authentication only needs to be done once. The system will automatically refresh tokens as needed.

---

## Part 4: API Endpoints

### New GMB Reviews Endpoint

**URL:** `/api/gmb-reviews`

**Response Format:**
```json
{
  "placeId": "accounts/123/locations/456",
  "name": "First Access Lending",
  "rating": 4.8,
  "user_ratings_total": 45,
  "reviews": [
    {
      "author_name": "John Doe",
      "author_url": "",
      "profile_photo_url": "https://...",
      "rating": 5,
      "relative_time_description": "2 months ago",
      "text": "Great service!",
      "time": 1234567890,
      "reviewId": "xyz123"
    }
  ],
  "source": "gmb"
}
```

**Features:**
- Fetches up to 50 reviews per request (can be increased to 200+)
- Automatically refreshes OAuth tokens
- Falls back gracefully if authentication is needed

### Legacy Endpoint (Fallback)

**URL:** `/api/google-reviews`

Still available as fallback using Places API (max 5 reviews)

---

## Part 5: Update Frontend Components

To use the new GMB reviews, update your frontend components:

```tsx
// Before (Places API - max 5 reviews)
const response = await fetch('/api/google-reviews');

// After (GMB API - 50+ reviews)
const response = await fetch('/api/gmb-reviews');
```

The response format is compatible, so no other changes needed!

---

## Troubleshooting

### "Not authenticated" error
- Go to `/admin/setup` and authenticate with Google
- Ensure you're using the account that owns the business

### "Failed to fetch GMB accounts"
- Verify the Google account has access to the business listing
- Check that all required APIs are enabled in Google Cloud Console
- Ensure OAuth consent screen is properly configured

### "Token exchange failed"
- Verify Client ID and Client Secret are correct in environment variables
- Check that redirect URI matches exactly in both:
  - Google Cloud Console credentials
  - Environment variable `GOOGLE_OAUTH_REDIRECT_URI`

### "No locations found"
- Verify the Google account owns or manages the business listing
- Check that the business is verified on Google My Business

### Token refresh issues
- Delete `.google-oauth-tokens.json` (locally) and re-authenticate
- In production, go to `/admin/setup` and re-authenticate

---

## Security Notes

1. **Never commit `.google-oauth-tokens.json`** - It's in `.gitignore`
2. **Never commit `.env.local`** - Keep secrets secret
3. **Protect `/admin/setup` in production** - Add authentication middleware
4. **Use environment variables** in production (Vercel handles this)
5. **OAuth tokens are stored locally** - In production, consider using a database or secure vault

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── google/
│   │   │   │   ├── login/
│   │   │   │   │   └── route.ts          # OAuth login redirect
│   │   │   │   └── callback/
│   │   │   │       └── route.ts          # OAuth callback handler
│   │   │   └── status/
│   │   │       └── route.ts              # Check auth status
│   │   ├── gmb-reviews/
│   │   │   └── route.ts                  # New GMB reviews endpoint
│   │   └── google-reviews/
│   │       └── route.ts                  # Legacy Places API (fallback)
│   └── admin/
│       └── setup/
│           └── page.tsx                  # Admin authentication page
└── lib/
    └── google-auth.ts                    # OAuth token management
```

---

## Testing Checklist

- [ ] Google Cloud Console APIs enabled
- [ ] OAuth credentials created
- [ ] Environment variables configured
- [ ] Authentication completed at `/admin/setup`
- [ ] `/api/gmb-reviews` returns 10+ reviews
- [ ] Token refresh works (wait for expiry or test manually)
- [ ] Code committed and pushed to GitHub
- [ ] Vercel environment variables set
- [ ] Production deployment tested

---

## Next Steps

1. **Update frontend components** to use `/api/gmb-reviews`
2. **Add caching** to reduce API calls (GMB has rate limits)
3. **Implement webhook** for real-time review notifications (optional)
4. **Add admin authentication** to protect `/admin/setup`
5. **Monitor token refresh** to ensure it's working correctly

---

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check Vercel deployment logs
3. Verify all environment variables are set correctly
4. Re-authenticate at `/admin/setup` if needed

For API-specific issues, refer to:
- [Google My Business API Documentation](https://developers.google.com/my-business)
- [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
