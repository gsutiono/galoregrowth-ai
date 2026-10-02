const JSON_HEADERS = {
  "content-type": "application/json; charset=UTF-8",
  "cache-control": "no-store",
};

const EMAIL_TO = "guno@galoregrowth.ai";
const EMAIL_FROM = "contact@galoregrowth.ai";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function clean(value, max = 4000) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function escapeHtml(value) {
  return clean(value, 12000)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function safeUrl(value) {
  const v = clean(value, 1000);
  if (!v) return "";
  try {
    const u = new URL(v);
    return (u.protocol === "http:" || u.protocol === "https:") ? u.href : "";
  } catch {
    return "";
  }
}

function analytics(env, request, formType, language, outcome) {
  try {
    const url = new URL(request.url);
    const cf = request.cf || {};
    env.LEADS_ANALYTICS?.writeDataPoint({
      // blob1=form type, blob2=language, blob3=outcome,
      // blob4=country, blob5=path, blob6=referrer host
      blobs: [
        formType,
        language || "unknown",
        outcome,
        cf.country || "unknown",
        url.pathname,
        request.headers.get("referer") ? safeHostname(request.headers.get("referer")) : "direct",
      ],
      doubles: [1],
      indexes: [formType],
    });
  } catch (e) {
    console.log("analytics write skipped", e?.message || e);
  }
}

function safeHostname(url) {
  try { return new URL(url).hostname || "unknown"; }
  catch { return "unknown"; }
}

function fieldRow(label, value) {
  return `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:700;vertical-align:top">${escapeHtml(label)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(value) || "—"}</td>
  </tr>`;
}

async function sendLeadEmail(env, { type, language, fields, replyTo, meta }) {
  const isGuest = type === "podcast_guest";
  const subject = isGuest
    ? "GaloreGrowth.ai — Podcast Guest Interest"
    : "GaloreGrowth.ai — New Consultation Request";

  const title = isGuest ? "New Podcast Guest Interest" : "New Consultation Request";

  const rows = Object.entries(fields)
    .map(([label, value]) => fieldRow(label, value))
    .join("");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#16171d;max-width:760px;margin:auto">
      <div style="padding:22px 24px;background:#0b0d13;color:#fff;border-radius:14px 14px 0 0">
        <div style="font-size:12px;letter-spacing:.12em;color:#f2ca7a">GALOREGROWTH.AI</div>
        <h2 style="margin:8px 0 0">${title}</h2>
      </div>
      <div style="border:1px solid #ddd;border-top:0;padding:20px 24px;border-radius:0 0 14px 14px">
        <table style="width:100%;border-collapse:collapse">${rows}</table>
        <div style="margin-top:18px;color:#666;font-size:12px">
          Language: ${escapeHtml(language)}<br>
          Country: ${escapeHtml(meta.country)}<br>
          Page: ${escapeHtml(meta.pageUrl)}<br>
          Referrer: ${escapeHtml(meta.referrer || "Direct / unknown")}
        </div>
      </div>
    </div>`;

  const text = [
    title,
    "",
    ...Object.entries(fields).map(([k, v]) => `${k}: ${clean(v) || "—"}`),
    "",
    `Language: ${language}`,
    `Country: ${meta.country}`,
    `Page: ${meta.pageUrl}`,
    `Referrer: ${meta.referrer || "Direct / unknown"}`,
  ].join("\n");

  return env.EMAIL.send({
    to: EMAIL_TO,
    from: { email: EMAIL_FROM, name: "GaloreGrowth.ai Website" },
    replyTo,
    subject,
    html,
    text,
  });
}

async function handleContact(request, env) {
  const data = await request.formData();

  // Honeypot: bots often fill hidden fields.
  if (clean(data.get("_honey"), 200)) {
    analytics(env, request, "consultation", clean(data.get("language"), 10), "honeypot");
    return json({ success: true });
  }

  const name = clean(data.get("name"), 120);
  const email = clean(data.get("email"), 254);
  const company = clean(data.get("company"), 180);
  const challenge = clean(data.get("challenge"), 6000);
  const language = clean(data.get("language"), 10) || "en";
  const pageUrl = safeUrl(data.get("page_url")) || new URL(request.url).origin;
  const referrer = safeUrl(data.get("referrer"));

  if (!name || !validEmail(email) || !challenge) {
    analytics(env, request, "consultation", language, "validation_error");
    return json({ success: false, error: "Please complete the required fields." }, 400);
  }

  try {
    const result = await sendLeadEmail(env, {
      type: "consultation",
      language,
      replyTo: { email, name },
      fields: {
        Name: name,
        Email: email,
        Company: company,
        "What they want AI to improve": challenge,
      },
      meta: {
        country: request.cf?.country || "unknown",
        pageUrl,
        referrer,
      },
    });

    analytics(env, request, "consultation", language, "success");
    return json({ success: true, messageId: result?.messageId || null });
  } catch (e) {
    console.error("Contact email failed", e?.code, e?.message);
    analytics(env, request, "consultation", language, "email_error");
    return json({ success: false, error: "Email delivery failed. Please try again or email us directly." }, 502);
  }
}

async function handleGuest(request, env) {
  const data = await request.formData();

  if (clean(data.get("_honey"), 200)) {
    analytics(env, request, "podcast_guest", clean(data.get("language"), 10), "honeypot");
    return json({ success: true });
  }

  const name = clean(data.get("name"), 120);
  const email = clean(data.get("email"), 254);
  const company = clean(data.get("company"), 180);
  const title = clean(data.get("title"), 180);
  const industry = clean(data.get("industry"), 180);
  const link = clean(data.get("link"), 1000);
  const story = clean(data.get("story"), 7000);
  const language = clean(data.get("language"), 10) || "en";
  const pageUrl = safeUrl(data.get("page_url")) || new URL(request.url).origin;
  const referrer = safeUrl(data.get("referrer"));

  if (!name || !validEmail(email) || !company || !title || !story) {
    analytics(env, request, "podcast_guest", language, "validation_error");
    return json({ success: false, error: "Please complete the required fields." }, 400);
  }

  try {
    const result = await sendLeadEmail(env, {
      type: "podcast_guest",
      language,
      replyTo: { email, name },
      fields: {
        Name: name,
        Email: email,
        Company: company,
        "Title / Role": title,
        Industry: industry,
        "Website / LinkedIn": link,
        "Story / Topic": story,
      },
      meta: {
        country: request.cf?.country || "unknown",
        pageUrl,
        referrer,
      },
    });

    analytics(env, request, "podcast_guest", language, "success");
    return json({ success: true, messageId: result?.messageId || null });
  } catch (e) {
    console.error("Podcast guest email failed", e?.code, e?.message);
    analytics(env, request, "podcast_guest", language, "email_error");
    return json({ success: false, error: "Email delivery failed. Please try again or email us directly." }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/contact") {
      return handleContact(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/podcast-guest") {
      return handleGuest(request, env);
    }

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "GaloreGrowth.ai",
        emailBinding: Boolean(env.EMAIL),
        analyticsBinding: Boolean(env.LEADS_ANALYTICS),
      });
    }

    // Serve the static site.
    return env.ASSETS.fetch(request);
  },
};
