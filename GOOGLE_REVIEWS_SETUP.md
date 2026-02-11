# Google Reviews Component Setup

**Date:** February 11, 2026  
**Status:** Custom component created, needs API key to activate

## Overview

Replaced the Jotform Google Reviews Widget with a custom component that fetches live reviews directly from Google Places API. This provides more control and eliminates dependency on third-party widgets that may not find the business.

## Why Custom Component?

- **Jotform widget limitation:** Cannot find "First Access Lending" business in their system
- **Direct API access:** Fetch actual Google Business reviews via Google Places API
- **Full control:** Customize styling, layout, and display exactly as needed
- **Professional appearance:** Maintains site's blue gradient theme and responsive design

## Component Details

### Files Created

1. **`src/components/CustomGoogleReviews.tsx`**
   - Client-side React component
   - Displays rating, review count, and review carousel
   - Handles loading states and errors gracefully
   - Fully responsive (desktop & mobile)

2. **`src/app/api/google-reviews/route.ts`**
   - Next.js API route (server-side)
   - Fetches reviews from Google Places API
   - Handles API key securely (not exposed to client)
   - Searches for "First Access Lending Virginia" and returns place details

### Features

- ⭐ **Overall Rating Display:** Shows aggregate Google rating (e.g., 4.3 stars)
- 📊 **Review Count:** Displays total number of Google reviews
- 🎠 **Review Carousel:** Individual reviews with:
  - Reviewer name and profile photo
  - Star rating
  - Review text
  - Time posted (e.g., "2 months ago")
- ⬅️➡️ **Navigation:** Arrow buttons and dot indicators
- 📱 **Responsive:** Works perfectly on desktop and mobile
- 🎨 **Styled:** Blue gradient background matching site theme

## API Key Setup

### Step 1: Get Google Cloud API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Places API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Places API"
   - Click "Enable"
4. Create credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the generated API key

### Step 2: (Optional) Restrict API Key

For security, restrict the API key to:
- **Application restrictions:** HTTP referrers
  - Add: `firstaccesslending.com/*`
  - Add: `*.vercel.app/*` (for preview deployments)
- **API restrictions:** Limit to "Places API"

### Step 3: Add API Key to Environment

**Local Development:**
```bash
# Create/edit .env.local
echo "GOOGLE_PLACES_API_KEY=your_api_key_here" >> .env.local
```

**Vercel Production:**
1. Go to project settings on Vercel
2. Navigate to "Environment Variables"
3. Add: `GOOGLE_PLACES_API_KEY` = `your_api_key_here`
4. Redeploy the site

## API Usage & Limits

### Google Places API Pricing

- **Free tier:** $200 credit/month (renews monthly)
- **Place Details:** $0.017 per request
- **Text Search:** $0.032 per request
- **Total per review load:** ~$0.049

**Estimated usage:**
- ~100 page views/day = $4.90/month
- ~500 page views/day = $24.50/month
- Well within free tier for typical traffic

### Optimization Strategy

**Current:** API call on every page load  
**Future optimization (if needed):**
- Cache reviews in memory for 1 hour
- Use static generation with revalidation
- Store reviews in database, refresh hourly

## Implementation

### Replace Jotform Widget on All Pages

Update these files to import `CustomGoogleReviews` instead of `GoogleReviewsWidget`:

1. **Homepage:** `src/app/page.tsx`
2. **HELOC:** `src/app/heloc/page.tsx`
3. **Second Mortgages:** `src/app/second-mortgages/page.tsx`
4. **Refinance:** `src/app/refinance/page.tsx`
5. **Home Purchase:** `src/app/home-purchase/page.tsx`

**Change:**
```tsx
import GoogleReviewsWidget from '@/components/GoogleReviewsWidget';
// ...
<GoogleReviewsWidget />
```

**To:**
```tsx
import CustomGoogleReviews from '@/components/CustomGoogleReviews';
// ...
<CustomGoogleReviews />
```

## Business Information

- **Business Name:** First Access Lending
- **Search Query:** "First Access Lending Virginia"
- **Parent Company:** East Coast Capital Corporation
- **Note:** The API automatically searches for and finds the correct Google Business listing

## Error Handling

The component gracefully handles:
- ❌ Missing API key → Shows error message with setup instructions
- ❌ Business not found → Shows helpful error
- ❌ Network issues → Displays loading state, then error if timeout
- ✅ No reviews yet → Still shows overall rating

## Testing

**Before API Key:**
- Component loads
- Shows error: "Google Places API key not configured"
- Provides clear setup instructions

**After API Key:**
- Fetches live Google reviews
- Displays overall rating and review count
- Shows carousel of individual reviews
- Navigation buttons work
- Responsive on mobile and desktop

## Next Steps

1. ✅ Create custom component (DONE)
2. ✅ Create API route (DONE)
3. ✅ Document setup (DONE)
4. ⏳ Get API key from Zach's Google Cloud account
5. ⏳ Add API key to Vercel environment variables
6. ⏳ Update all pages to use CustomGoogleReviews
7. ⏳ Deploy and verify on production
8. ⏳ Take screenshots for verification

## Deployment Checklist

- [ ] API key added to Vercel
- [ ] All pages updated with CustomGoogleReviews import
- [ ] Jotform script tags removed
- [ ] Site builds successfully
- [ ] Production deployment complete
- [ ] Reviews loading correctly on all pages
- [ ] Mobile responsive verified
- [ ] Screenshots captured

---

**Contact:** Ava (AI Assistant)  
**For API Key:** Contact Zachary Bosson (zachbosson@gmail.com)
