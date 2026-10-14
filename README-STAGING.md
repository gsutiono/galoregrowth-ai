# GaloreGrowth Juno UI Staging v10.8

This is a UI-only preview. No LLM, ElevenLabs, LiveAvatar, Stripe or paid sessions are connected. All POST requests are disabled on staging; the existing forms display but cannot submit. No production email or analytics bindings are included.

## Safe deployment via GitHub + Cloudflare Workers

1. Create a **new private GitHub repository** `galoregrowth-stage` (simplest isolation) and upload the **contents of this folder** to its main branch. Do NOT push this package to the production repository/branch.
2. Cloudflare Dashboard > Workers & Pages > Create > Import a repository / Connect to Git. Select `galoregrowth-stage` and create a **new Worker**, name `galoregrowth-ai-stage`. Use build command `npm install` if requested, deployment command `npx wrangler deploy` if requested. Confirm Worker name in wrangler.jsonc. Exact dashboard labels may vary.
3. After deployment, visit the generated `*.workers.dev` URL and test EN/中文, mobile, Juno buttons and microphone. The microphone may require HTTPS/browser permissions.
4. Cloudflare > Workers & Pages > `galoregrowth-ai-stage` > Settings > Domains & Routes > Add > Custom Domain > `stage.galoregrowth.ai`. The domain must be in the same Cloudflare account/zone; Cloudflare typically creates the required DNS record automatically.
5. Keep production Worker `galoregrowth-ai` and production GitHub repo untouched. Check both Worker names before each deployment.
6. Consider Cloudflare Access protection for the staging hostname, so previews are not publicly accessible. Configure a staging-only Turnstile widget later if forms are enabled.

## Production protection

- Worker name: `galoregrowth-ai-stage`, different from production `galoregrowth-ai`.
- No production Send Email / Analytics Engine bindings.
- All POST requests rejected; no real form submissions.
- No payment or real-time avatar calls.
- Placeholder image is **Guno founder portrait**, not a representation of Juno; replace with real Juno assets later.
- Pricing shown is illustrative only.

To add real Juno, verify current provider APIs, configure separate staging secrets and server-side quotas, then enable services one at a time.
