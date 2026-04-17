# 🚀 Quick Reference - 72H Launch

## URLs to Test
```
/launch              → 72H Launch Landing Page
/72h                 → Same as /launch
/?launch=1           → Same as /launch
/onboarding          → Post-Stripe onboarding
/first-mission       → Immediate real incident
/lab/first-mission   → Same as /first-mission
```

## Environment Variables Needed
```env
# PostHog Analytics
VITE_POSTHOG_KEY=your_posthog_project_key

# Stripe
STRIPE_PRICE_EARLY_ACCESS=price_xxxxxxxx  # Get from Stripe Dashboard
STRIPE_SECRET_KEY=sk_live_xxxxxxxx        # Your Stripe secret key
BASE_URL=https://winlab.cloud

# Optional (already in .env)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx
```

## Quick Test Commands
```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Test the launch landing page
# Open: http://localhost:5173/launch
```

## Stripe Setup (5 minutes)
1. Go to Stripe Dashboard → Products
2. Create product: "WINLAB Early Access"
3. Add pricing: $5/month (subscription)
4. Copy the Price ID
5. Add to `.env`: `STRIPE_PRICE_EARLY_ACCESS=price_xxxxxxxx`

## PostHog Setup (2 minutes)
1. Go to posthog.com → Create project
2. Copy Project API Key
3. Add to `.env`: `VITE_POSTHOG_KEY=phc_xxxxxxxx`
4. Done - events will auto-track

## Before Launch Checklist
- [ ] Set `STRIPE_PRICE_EARLY_ACCESS` in `.env`
- [ ] Set `VITE_POSTHOG_KEY` in `.env`
- [ ] Set `BASE_URL=https://winlab.cloud`
- [ ] Test `/launch` page loads
- [ ] Test Stripe checkout works
- [ ] Test `/onboarding` → `/first-mission` flow
- [ ] Test on mobile device
- [ ] Verify PostHog events firing
- [ ] Run `npm run build` (no errors)
- [ ] Deploy to production

## Monitoring After Launch
Check PostHog dashboard for:
- Terminal demo completion rate
- CTA click-through rate
- Checkout conversion rate
- First mission completion rate
- User drop-off points

---

*Launch Date: April 17, 2026 at 00:00*
*End Date: April 20, 2026 at 18:00*
*Target: 500 seats at $5 each*
