# Calculator Secret URL

**Preview URL:** https://first-access-lending-website.vercel.app/calc-preview-9d4f2a8e

(Note: Site is deployed on Vercel subdomain. Custom domain firstaccesslending.com is not yet configured.)

## Status
- ✅ Live and functional
- ✅ Hidden from search engines (noindex)
- ✅ Removed from navigation
- ✅ Share with friends via direct link

## Features
- Auto-fetches current conventional and FHA rates from Mortgage News Daily
- Loan type toggle (Conventional / FHA)
- State income tax calculations
- PMI/MIP calculations
- Tax savings analysis with deduction breakdown
- Email PDF reports

## When Ready to Launch Publicly

1. **Create public route:**
   - Copy `src/app/calc-preview-9d4f2a8e` to `src/app/calculator`
   - Or rename the secret folder back to `calculator`

2. **Add to navigation:**
   - Edit `src/components/Header.tsx`
   - Add calculator links back to desktop and mobile menus

3. **Enable SEO:**
   - See Trello card #118
   - Change `layout.tsx`: `robots: { index: true, follow: true }`

4. **Deploy:**
   - Commit and push → auto-deploys to production

---

**Created:** March 16, 2026  
**By:** Ava
