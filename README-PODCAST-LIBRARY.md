# Podcast Library — Phase 1 (staging only)

Based on the supplied `galoregrowth-ai-staging.zip` snapshot. Existing site shell, forms, Juno preview and Worker API logic retained.

## New features
- Featured carousel with swipe and arrows
- Working client-side title/guest/topic/description search and category filters
- JSON-backed episode cards, latest publication first
- Shareable `/podcast/<slug>` detail routes, browser back, HTML5 video player when `status=published` and `videoUrl` is set
- English/Chinese labels and episode metadata

## Episode media status
- Episode 0 **Meet Juno** is enabled for playback using `https://media.galoregrowth.ai/meet-juno.MP4` (Cloudflare R2 custom domain, browser playback verified by the site owner).
- The `meet-juno-poster.jpg` remains a **temporary placeholder** copied from the existing site. Replace it with approved artwork when available.
- `publishedDate` is left `null` because the publication date has not been confirmed.
- Episode 1 remains Coming Soon.
- The R2 Public Development URL is not used. The production media URL is case-sensitive (`.MP4`).

## Deploy safely
1. Merge these additions into the GitHub `staging` branch only, not `main`.
2. Existing `.github/workflows/deploy-staging.yml` deploys Worker `galoregrowth-ai-stage`.
3. Verify `/podcast/meet-juno` direct navigation and reload on `stage.galoregrowth.ai`.
4. Verify guest application and consultation forms still exist (staging submissions remain disabled by original Worker policy).
5. After staging signoff, plan a separate controlled production merge with production-specific Wrangler settings.

## Files changed
- `public/index.html` — adds Podcast Library inside original Podcast section, stylesheet/script, and root `<base>`
- `public/podcast/episodes.json` — episode metadata
- `public/podcast/library.css` — scoped styling
- `public/podcast/library.js` — carousel, search, filters, detail navigation, share
- `public/podcast/media/` — placeholders
- `src/index.js` — narrow SPA shell fallback for `/podcast/<slug>`
- `wrangler.jsonc` — ensure `/podcast/*` reaches Worker for deep links

No new endpoints or secrets. No MP4 embedded in HTML.
