# Email Domain Migration: @winlab.io → @winlab.cloud

**Date:** 10 April 2026  
**Status:** ✅ Completed

## Summary

All email addresses on the site have been migrated from `@winlab.io` to `@winlab.cloud`.

## Emails Changed

| Old Email | New Email | Usage |
|---|---|---|
| `sales@winlab.io` | `sales@winlab.cloud` | Business plan inquiries, Enterprise contact, footer |
| `support@winlab.io` | `support@winlab.cloud` | Data deletion requests, legal policies footer, support CTA |

## Files Modified (Source)

| File | Occurrences |
|---|---|
| `src/PricingTable.jsx` | 1 |
| `src/AboutPage.jsx` | 3 |
| `src/LegalLayout.jsx` | 2 |
| `src/LandingPage.jsx` | 2 |
| **Total** | **8** |

## Build

- `dist/` rebuilt successfully via `npm run build`
- Zero remaining references to `@winlab.io` in `dist/`

## Contexts Updated

- PricingTable — Business plan mailto link
- LandingPage — Enterprise "Contact Sales" mailto link + footer company links
- AboutPage — Trial request form email, FAQ answer, support CTA button
- LegalLayout — Privacy policy data deletion clause, footer contact link
