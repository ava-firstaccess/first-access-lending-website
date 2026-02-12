# 🚀 Quick Start Checklist for Google My Business Reviews

**Goal:** Get 50+ Google reviews on your website (instead of 5)

**Time Required:** 15-20 minutes

---

## ☑️ Step-by-Step Checklist

### 1. Enable APIs in Google Cloud Console (5 min)

**Link:** https://console.cloud.google.com/apis/library

- [ ] Enable **"Google My Business API"**
- [ ] Enable **"My Business Account Management API"**
- [ ] Enable **"My Business Business Information API"**

---

### 2. Create OAuth Credentials (5 min)

**Link:** https://console.cloud.google.com/apis/credentials

- [ ] Click **"Create Credentials"** → **"OAuth client ID"**
- [ ] Application type: **Web application**
- [ ] Name: **First Access Lending GMB Reviews**
- [ ] Add authorized redirect URI:
  ```
  https://www.firstaccesslending.com/api/auth/google/callback
  ```
- [ ] Click **"Create"**
- [ ] **Copy & save:**
  - Client ID: `_____________________________.apps.googleusercontent.com`
  - Client Secret: `GOCSPX-_____________________________`

---

### 3. Add Environment Variables in Vercel (3 min)

**Link:** https://vercel.com/[your-project]/settings/environment-variables

Add these three variables:

| Name | Value |
|------|-------|
| `GOOGLE_OAUTH_CLIENT_ID` | [Paste Client ID from step 2] |
| `GOOGLE_OAUTH_CLIENT_SECRET` | [Paste Client Secret from step 2] |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://www.firstaccesslending.com/api/auth/google/callback` |

- [ ] Variables added
- [ ] Redeploy the site (Vercel will prompt you)

---

### 4. Authenticate Your Google Account (2 min)

**Link:** https://www.firstaccesslending.com/admin/setup

- [ ] Click **"Authenticate with Google"**
- [ ] Sign in with the Google account that **owns** the First Access Lending business
- [ ] Grant permissions when prompted
- [ ] You should see: ✅ **Authentication: Authenticated**

---

### 5. Test It Works (1 min)

On the admin setup page:

- [ ] Click **"Test GMB Reviews API"** button
- [ ] New tab opens with JSON data
- [ ] Look for `"user_ratings_total"` - should be 10+ (not 5!)
- [ ] Look for `"source": "gmb"` - confirms using new API

**Success!** 🎉 You now have access to 50+ reviews.

---

## 📝 Notes

### One-Time Setup
You only need to do this once. The system will automatically refresh tokens forever.

### Who Should Authenticate?
The Google account that **owns or manages** the First Access Lending business listing on Google.

### What If Something Goes Wrong?
- Check `GOOGLE_MY_BUSINESS_SETUP.md` for detailed troubleshooting
- Re-authenticate at `/admin/setup` if needed
- Verify all environment variables are set correctly in Vercel

### Update Your Website (Optional)
If you want to switch from the old API to the new one:

**Find this in your code:**
```tsx
await fetch('/api/google-reviews')
```

**Change to:**
```tsx
await fetch('/api/gmb-reviews')
```

The response format is the same, so nothing else needs to change!

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Not authenticated" error | Go to `/admin/setup` and click "Authenticate with Google" |
| Only seeing 5 reviews | You're still using `/api/google-reviews` - switch to `/api/gmb-reviews` |
| "No GMB accounts found" | Sign in with the account that owns the business |
| "Token exchange failed" | Check Client ID/Secret are correct in Vercel |

---

## ✅ Done!

Once you complete all 5 steps, your website will automatically fetch 50+ Google reviews instead of just 5.

**Questions?** Check the full guide: `GOOGLE_MY_BUSINESS_SETUP.md`
