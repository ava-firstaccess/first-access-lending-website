# Reviews API Decision - February 12, 2026

## Decision: Use Google Places API (5 reviews max)

### Why Not Google My Business API?

We explored using the GMB API to fetch 50+ reviews instead of the 5-review limit from Places API.

**Blockers encountered:**
1. **API application required** - Google requires formal application for GMB API access
2. **Designed for agencies** - Application questions target multi-client agencies (1000+ locations), not single business owners
3. **Billing requirement** - Even though free, requires Google Cloud billing account
4. **Quota issues** - Default quota set to 0 requests/minute without approval
5. **Complexity vs. benefit** - OAuth flow, token management, /tmp storage workarounds for Vercel

**Conclusion:** Not worth the complexity for incremental reviews. Places API with 5 reviews is simpler, more reliable, and sufficient for our needs.

### Implementation

- **API:** Google Places API (existing)
- **Endpoint:** `/api/google-reviews`
- **Max Reviews:** 5 (Google limitation)
- **Auth:** API key (simple)
- **Carousel:** Infinite loop, responsive 1-4 reviews visible

### Code Cleanup (Feb 12, 2026)

Removed GMB-related code:
- `/api/auth/google/*` routes (OAuth flow)
- `/api/gmb-reviews` endpoint
- `/admin/setup` page
- `src/lib/google-auth.ts` (token management)
- GMB documentation files

All GMB code committed to git history (commit range: ddb7c8b → b48bbdd) for reference if ever needed.
