# Patrick Foley – Révision linguistique et rédaction

A static bilingual website (French by default, English in `/en/`). It has no framework, no third-party scripts and self-hosted fonts.

## Pages

| FR | EN |
| --- | --- |
| `index.html` (accueil complet) | `en/index.html` |
| `services.html` | `en/services.html` |
| `a-propos.html` | `en/about.html` |
| `contact.html` | `en/contact.html` |
| `confidentialite.html` | `en/privacy.html` |
| `merci.html` (noindex) | `en/thank-you.html` (noindex) |

The generator also produces `sitemap.xml` (with hreflang), `robots.txt` and `site.webmanifest`.

## Editing

All copy lives in `build/content.mjs`. The layout and settings are in `build/build.mjs` (the `SITE` object). After making changes:

```bash
npm run build     # regenerates the HTML pages
npm run images    # (optional) regenerates the favicon, icons and Open Graph images, requires Playwright
npm run serve     # local preview at http://localhost:4173
```

## Before going live

Fill these in under `SITE` in `build/build.mjs`, then run `npm run build`:

- `url`: the final domain. Canonical URLs, Open Graph, sitemap and schema.org data depend on it.
- `linkedin` / `facebook`: the profile URLs. These links appear in the footer only once they are set.
- `portrait`: the path to a professional photo (e.g. `assets/patrick-foley.jpg`). When it is empty, a monogram is shown instead.
- `formAction`: where the form is sent.
  - **Netlify**: leave it as `/`. The form is already set up for Netlify Forms, including file uploads and the `website` honeypot.
  - **Other hosts**: use a Formspree, Basin or Getform URL (or similar).

If sending fails, visitors see an error message with a pre-filled `mailto:` link, so no request is lost.

## Anti-spam and accessibility

- Invisible honeypot field, plus a minimum fill time of 3 seconds.
- Client-side validation: required fields, email format, file type and size (10 MB), and a consent checkbox (Law 25).
- Errors are announced to screen readers, with a clickable summary of what to fix.
- Keyboard navigation, a skip-to-content link, visible focus styles and AA contrast.
- Animations are turned off when the visitor's system requests reduced motion (`prefers-reduced-motion`).
