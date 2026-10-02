# GaloreGrowth.ai — Cloudflare Worker Backend

This project serves the static GaloreGrowth.ai website and adds two Cloudflare Worker API endpoints:

- `POST /api/contact`
- `POST /api/podcast-guest`

Both endpoints:
1. validate the submitted form,
2. reject simple bot/honeypot submissions,
3. email the submission to `GaloreGrowth.ai@gmail.com`,
4. set Reply-To to the visitor's email,
5. record privacy-conscious custom analytics in Workers Analytics Engine.

The Analytics Engine dataset stores event metadata only (form type, language, success/failure, country, path, referrer host). It does NOT store the visitor's name, email, company, or message.

## Cloudflare setup before deploying

### 1. Verify the destination inbox
In Cloudflare Dashboard:
**Email > Email Routing > Destination addresses**

Add and verify:
`GaloreGrowth.ai@gmail.com`

Cloudflare requires the destination address to be verified before a `send_email` binding can send to it.

### 2. Configure sending for galoregrowth.ai
In Cloudflare Dashboard:
**Compute / Email Service > Email Sending**

Onboard `galoregrowth.ai` if the Email Sending option is available for your account. Cloudflare may add SPF/DKIM/DMARC-related DNS records automatically.

The Worker sends website notifications as:
`website@galoregrowth.ai`

The visitor's email is used as `Reply-To`, so pressing Reply in Gmail replies directly to the prospect.

If the dashboard asks you to approve/allow the sender address, allow:
`website@galoregrowth.ai`

### 3. GitHub repository structure

Your repository should look like:

```
galoregrowth-ai/
├── package.json
├── wrangler.jsonc
├── src/
│   └── index.js
└── public/
    ├── index.html
    ├── favicon.ico
    ├── galoregrowth-hero-en.mp4
    ├── galoregrowth-hero-zh.mp4
    └── assets/
        ├── galore-logo.png
        └── guno-portrait.png
```

### 4. Cloudflare Git deployment settings

Keep the GitHub repository connected to the existing Worker.

Recommended settings:
- Production branch: `main`
- Build command: `npm install`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

If Cloudflare automatically installs package dependencies, Build command may also be left blank. The critical deploy command is:
`npx wrangler deploy`

### 5. Test the backend

After deployment, open:

`https://galoregrowth.ai/api/health`

Expected JSON:
```json
{
  "ok": true,
  "service": "GaloreGrowth.ai",
  "emailBinding": true,
  "analyticsBinding": true
}
```

Then submit one test consultation from the website.

## Analytics

Dataset:
`galoregrowth_leads`

The dataset is automatically created after the first write.

Field mapping:
- `blob1` = form type (`consultation` or `podcast_guest`)
- `blob2` = language (`en` or `zh`)
- `blob3` = outcome (`success`, `validation_error`, `email_error`, `honeypot`)
- `blob4` = visitor country from Cloudflare request metadata
- `blob5` = API path
- `blob6` = referrer hostname or `direct`
- `double1` = 1
- `index1` = form type

Example SQL — submissions by form and result:

```sql
SELECT
  blob1 AS form_type,
  blob3 AS outcome,
  SUM(_sample_interval * double1) AS events
FROM galoregrowth_leads
WHERE timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY form_type, outcome
ORDER BY events DESC
```

Example SQL — successful leads by language:

```sql
SELECT
  blob2 AS language,
  SUM(_sample_interval * double1) AS successful_leads
FROM galoregrowth_leads
WHERE blob3 = 'success'
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY language
ORDER BY successful_leads DESC
```

## Recommended next security upgrade

Once the forms are working, add Cloudflare Turnstile to both forms. The Worker already has honeypot protection, but Turnstile is the better defense once public traffic grows.
