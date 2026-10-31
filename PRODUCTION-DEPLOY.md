# GaloreGrowth.ai production release — 2026-10-30

## CRITICAL: Verify Worker routing before uploading
This repository deploys Cloudflare Worker `galoregrowth-ai` (NOT `galoregrowth-ai-stage`).
In Cloudflare dashboard, **Workers & Pages → galoregrowth.ai domain route**, check which Worker is currently bound to `galoregrowth.ai` / `www.galoregrowth.ai`.
If it is NOT named `galoregrowth-ai`, change `name` in `wrangler.jsonc` to the **actual currently routed production Worker** BEFORE deploying. Creating a new Worker without moving the route will NOT repair the live site.

## Deploy from repo root (Cloudflare Workers)
1. Make a backup of current production Worker and settings.
2. In existing production Worker Settings, note existing bindings/secrets and ensure they are retained: `EMAIL`, `LEADS_ANALYTICS`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `ADMIN_PASSWORD`, `CF_ACCOUNT_ID`, `CF_ANALYTICS_TOKEN` as applicable.
3. `npm install` then `npx wrangler deploy` using authorized production Cloudflare account.
4. Verify hostname custom domain/route still points to the deployed Worker. If this project is instead deployed through Cloudflare Pages/GitHub integration, configure the correct project/root and publish `public` folder; the Worker API must be separately attached for forms and dynamic podcast routes.

## Smoke tests (on live hostname)
- `/` loads the homepage and its CSS/layout; Hero player uses Cloudflare Stream Episode 2.
- `/podcast/episodes.json` returns JSON (not HTML, not 403/404).
- `/podcast/library.js` returns JavaScript; `/podcast/media/episode-2-ai-in-action.jpg` returns the supplied cover.
- `/podcast/episode-2` loads homepage shell and reveals Episode 2 details.
- `/api/health` returns JSON; `emailBinding` reflects whether email integration is configured.
- Test bilingual language switch, navbar and contact/guest forms.
- Confirm Stream allowed origins include `https://galoregrowth.ai` and `https://www.galoregrowth.ai`.

## Code corrections / caveats
- The previous staging Worker rejected POST routes and blocked admin endpoints. This release uses the corrected Worker handler.
- `public/index.html` is canonical (and synchronized with root index.html); `public/` is the Cloudflare static assets directory.
- Latest podcast auto-plays muted only while in viewport; browsers may restrict autoplay. The player falls back to Episode 2 if JSON loading fails.
- Contact forms depend on real `EMAIL` binding. Source fixes cannot supply missing platform-side bindings.
- Deployment was **not** performed here. Public website currently could not be reached reliably by the available inspection environment, so live functionality is not certified.
