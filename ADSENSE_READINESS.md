# Monetization readiness

Reviewed 24 August 2026 against the implemented site and current Google publisher guidance.

## Completed before advertising integration

- Product, security, status, terms, and privacy claims match the working encrypted-delivery flow.
- About and guide pages identify the SecretShare Editorial Team and review dates.
- Ten original defensive-security guides have accurate reading times, article structured data, and authoritative review references.
- Desktop, mobile, JavaScript, and no-JavaScript navigation paths remain available.
- Every public HTML page has a title, description, canonical URL, Open Graph metadata, favicon, H1, and language declaration.
- `robots.txt` references an absolute sitemap and `sitemap.xml` lists editorial and trust pages.
- Contact roles use the production `secretshare.dev` domain.
- Runtime fonts use local system stacks; the site does not contact a third-party font provider.
- The privacy policy describes ciphertext storage, expiry, retrieval, local preferences, and future advertising boundaries.

## Advertising placement boundary

Advertising may be added only to manually reviewed editorial pages under `/guides/` and, if useful, the resources index. Never place advertising on:

- the homepage composer;
- `/s/{id}` recipient or secret states;
- privacy, terms, contact, security, API, status, error, or other non-editorial screens;
- pages containing unreviewed user-provided content or private communications.

## Complete when AdSense is connected

1. Verify that `hello@secretshare.dev`, `privacy@secretshare.dev`, and `security@secretshare.dev` receive mail.
2. Add the exact AdSense ownership code supplied by Google.
3. Publish `ads.txt` using the exact assigned publisher ID.
4. Configure a Google-certified CMP where required and update the privacy policy with actual vendors and controls.
5. Keep ad quantity below editorial content and avoid placements that resemble navigation or download controls.
6. Verify Search Console indexing, Core Web Vitals, live mobile navigation, and genuine traffic quality before requesting review.

Approval remains Google’s decision and cannot be guaranteed by a repository audit.
