# AdSense launch checklist

The repository is intentionally in development mode. It contains no AdSense publisher ID, ad tag, ad request, advertising cookie, or production-domain metadata.

## Already implemented

- The homepage identifies the secret-sharing interface as a non-operational prototype.
- Product, security, API, and status claims distinguish implemented behavior from planned architecture.
- Placeholder navigation links were replaced with real pages.
- About, Contact, Terms, Security, Status, API, Privacy, and Resources pages exist.
- The learning center contains ten original articles.
- The privacy policy explicitly says advertising is not configured.
- Editorial content is separated from the composer, recipient preview, and legal pages.

## Complete only after a domain and AdSense account exist

1. Publish on the final HTTPS domain and verify every page is publicly crawlable.
2. Replace reserved `@privacylock.io` contact addresses if that domain is not selected, and verify that the mailboxes receive messages.
3. Add a canonical URL and Open Graph URL to each public page using the final origin.
4. Add the AdSense ownership meta tag or script supplied by Google. Never invent a `ca-pub-` identifier.
5. Create `/ads.txt` using the exact publisher ID shown in AdSense, for example:
   `google.com, pub-REPLACE_WITH_REAL_ID, DIRECT, f08c47fec0942fa0`
6. Enable Google Privacy & Messaging or another Google-certified CMP for regions where it is required. The current development banner is not a TCF CMP.
7. Update `privacy.html` with the actual advertising vendors, purposes, retention, user controls, and final data-controller contact.
8. Add ad code only to editorial guide pages. Do not place it on `index.html`, `privacy.html`, `terms.html`, the prototype composer/recipient experience, status pages, or future secret-reading routes.
9. Add a persistent “Privacy and cookie settings” revocation control supplied by the chosen CMP.
10. Generate `sitemap.xml` and add its final absolute URL to `robots.txt`.
11. Verify the site in Search Console, test Core Web Vitals, and confirm no broken links or inaccessible pages.
12. Request AdSense review only when the live site is complete and receiving genuine traffic.

Ad placement containers are deliberately absent. They should be introduced only after the publisher ID, CMP configuration, and final domain are known.
