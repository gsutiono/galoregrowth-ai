# GaloreGrowth.ai v8 — Cloudflare Forms, Turnstile & Lead Analytics

This package keeps the working Cloudflare Email + Analytics Engine setup and adds:

1. Cloudflare Turnstile support for both public forms.
2. A polished bilingual thank-you state after successful submissions.
3. A password-protected lead dashboard at `/admin/leads`.

The site **continues to work immediately after deployment** even before Turnstile/admin secrets are configured. Turnstile protection becomes enforced only after the Turnstile secret is added.

## Existing email flow

- From: `contact@galoregrowth.ai`
- To: `guno@galoregrowth.ai`
- Reply-To: visitor's email

## Step A — Deploy this package first

Keep the repository structure exactly as provided and push to GitHub. Cloudflare should redeploy automatically.

After deployment, test:

`https://galoregrowth.ai/api/health`

The existing email and Analytics Engine bindings should remain `true`.

## Step B — Enable Turnstile

In Cloudflare Dashboard, open **Turnstile** and create a widget:

- Widget name: `GaloreGrowth.ai Forms`
- Hostname: `galoregrowth.ai`
- Mode: Managed

Cloudflare will give you a **Site Key** and **Secret Key**.

In **Workers & Pages → galoregrowth-ai → Settings → Variables and Secrets**, add:

- Variable: `TURNSTILE_SITE_KEY` = your public site key
- Secret: `TURNSTILE_SECRET_KEY` = your secret key

Redeploy once after saving them.

The Worker validates every Turnstile token server-side with Cloudflare Siteverify. Failed verification is logged to Analytics Engine as `turnstile_failed`.

## Step C — Enable the private Lead Analytics dashboard

The dashboard queries your existing Analytics Engine dataset (`galoregrowth_leads`) through Cloudflare's SQL API.

### 1. Create an Analytics read API token

Cloudflare Dashboard → **My Profile / API Tokens → Create Token → Create Custom Token**

Permission:

`Account → Account Analytics → Read`

Restrict it to your GaloreGrowth.ai Cloudflare account if possible.

### 2. Add three Worker variables/secrets

Workers & Pages → `galoregrowth-ai` → Settings → Variables and Secrets:

- Variable: `CF_ACCOUNT_ID` = your 32-character Cloudflare account ID
- Secret: `CF_ANALYTICS_TOKEN` = the API token created above
- Secret: `ADMIN_PASSWORD` = a strong password only you know

Redeploy.

### 3. Open the dashboard

`https://galoregrowth.ai/admin/leads`

Your browser will ask for Basic Auth:

- Username: `guno`
- Password: the value you set for `ADMIN_PASSWORD`

The dashboard shows the last 30 days of:

- successful consultation submissions
- successful podcast guest submissions
- English vs Chinese leads
- daily successful lead trend
- top visitor countries
- success / validation / Turnstile / email-error outcomes

No lead names, email addresses, companies, or message content are stored in Analytics Engine.

## Health check

`/api/health` now also reports:

- `turnstileConfigured`
- `adminAnalyticsConfigured`

When everything is complete, both should be `true`.
