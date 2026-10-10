const JSON_HEADERS = {
  "content-type": "application/json; charset=UTF-8",
  "cache-control": "no-store",
};
const EMAIL_TO = "guno@galoregrowth.ai";
const EMAIL_FROM = "contact@galoregrowth.ai";
const DATASET = "galoregrowth_leads";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
function clean(value, max = 4000) { return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max); }
function escapeHtml(value) { return clean(value, 12000).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254; }
function safeUrl(value) {
  const v=clean(value,1000); if(!v) return "";
  try { const u=new URL(v); return (u.protocol==="http:"||u.protocol==="https:")?u.href:""; } catch { return ""; }
}
function safeHostname(value) { try { return new URL(value).hostname || "unknown"; } catch { return "unknown"; } }

function analytics(env, request, formType, language, outcome) {
  try {
    const url=new URL(request.url), cf=request.cf||{};
    env.LEADS_ANALYTICS?.writeDataPoint({
      blobs:[formType, language||"unknown", outcome, cf.country||"unknown", url.pathname,
        request.headers.get("referer") ? safeHostname(request.headers.get("referer")) : "direct"],
      doubles:[1], indexes:[formType]
    });
  } catch(e) { console.log("analytics write skipped", e?.message||e); }
}

async function verifyTurnstile(request, env, token, expectedAction) {
  // Safe rollout: when no secret is configured the site remains operational, but not yet protected.
  if (!env.TURNSTILE_SECRET_KEY) return { success:true, skipped:true };
  if (!token) return { success:false, errorCodes:["missing-input-response"] };
  const body=new FormData();
  body.set("secret", env.TURNSTILE_SECRET_KEY);
  body.set("response", token);
  const ip=request.headers.get("CF-Connecting-IP"); if(ip) body.set("remoteip", ip);
  const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {method:"POST", body});
  const result=await r.json();
  if (!result.success) return result;
  if (expectedAction && result.action && result.action !== expectedAction) return {success:false,errorCodes:["action-mismatch"]};
  return result;
}

function fieldRow(label,value){return `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:700;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(value)||"—"}</td></tr>`;}
async function sendLeadEmail(env,{type,language,fields,replyTo,meta}){
  const isGuest=type==="podcast_guest";
  const subject=isGuest?"GaloreGrowth.ai — Podcast Guest Interest":"GaloreGrowth.ai — New Consultation Request";
  const title=isGuest?"New Podcast Guest Interest":"New Consultation Request";
  const rows=Object.entries(fields).map(([k,v])=>fieldRow(k,v)).join("");
  const html=`<div style="font-family:Arial,Helvetica,sans-serif;color:#16171d;max-width:760px;margin:auto"><div style="padding:22px 24px;background:#0b0d13;color:#fff;border-radius:14px 14px 0 0"><div style="font-size:12px;letter-spacing:.12em;color:#f2ca7a">GALOREGROWTH.AI</div><h2 style="margin:8px 0 0">${title}</h2></div><div style="border:1px solid #ddd;border-top:0;padding:20px 24px;border-radius:0 0 14px 14px"><table style="width:100%;border-collapse:collapse">${rows}</table><div style="margin-top:18px;color:#666;font-size:12px">Language: ${escapeHtml(language)}<br>Country: ${escapeHtml(meta.country)}<br>Page: ${escapeHtml(meta.pageUrl)}<br>Referrer: ${escapeHtml(meta.referrer||"Direct / unknown")}</div></div></div>`;
  const text=[title,"",...Object.entries(fields).map(([k,v])=>`${k}: ${clean(v)||"—"}`),"",`Language: ${language}`,`Country: ${meta.country}`,`Page: ${meta.pageUrl}`,`Referrer: ${meta.referrer||"Direct / unknown"}`].join("\n");
  return env.EMAIL.send({to:EMAIL_TO,from:{email:EMAIL_FROM,name:"GaloreGrowth.ai Website"},replyTo,subject,html,text});
}

async function handleContact(request,env){
  const data=await request.formData(); const language=clean(data.get("language"),10)||"en";
  if(clean(data.get("_honey"),200)){analytics(env,request,"consultation",language,"honeypot");return json({success:true});}
  const tv=await verifyTurnstile(request,env,clean(data.get("cf-turnstile-response"),2200),"consultation");
  if(!tv.success){analytics(env,request,"consultation",language,"turnstile_failed");return json({success:false,code:"turnstile_failed",error:"Security verification failed."},403);}
  const name=clean(data.get("name"),120), email=clean(data.get("email"),254), company=clean(data.get("company"),180), challenge=clean(data.get("challenge"),6000);
  const pageUrl=safeUrl(data.get("page_url"))||new URL(request.url).origin, referrer=safeUrl(data.get("referrer"));
  if(!name||!validEmail(email)||!challenge){analytics(env,request,"consultation",language,"validation_error");return json({success:false,error:"Please complete the required fields."},400);}
  try { const result=await sendLeadEmail(env,{type:"consultation",language,replyTo:{email,name},fields:{Name:name,Email:email,Company:company,"What they want AI to improve":challenge},meta:{country:request.cf?.country||"unknown",pageUrl,referrer}}); analytics(env,request,"consultation",language,"success"); return json({success:true,messageId:result?.messageId||null}); }
  catch(e){console.error("Contact email failed",e?.code,e?.message);analytics(env,request,"consultation",language,"email_error");return json({success:false,error:"Email delivery failed. Please try again or email us directly."},502);}
}
async function handleGuest(request,env){
  const data=await request.formData(); const language=clean(data.get("language"),10)||"en";
  if(clean(data.get("_honey"),200)){analytics(env,request,"podcast_guest",language,"honeypot");return json({success:true});}
  const tv=await verifyTurnstile(request,env,clean(data.get("cf-turnstile-response"),2200),"podcast_guest");
  if(!tv.success){analytics(env,request,"podcast_guest",language,"turnstile_failed");return json({success:false,code:"turnstile_failed",error:"Security verification failed."},403);}
  const name=clean(data.get("name"),120), email=clean(data.get("email"),254), company=clean(data.get("company"),180), title=clean(data.get("title"),180), industry=clean(data.get("industry"),180), link=clean(data.get("link"),1000), story=clean(data.get("story"),7000);
  const pageUrl=safeUrl(data.get("page_url"))||new URL(request.url).origin, referrer=safeUrl(data.get("referrer"));
  if(!name||!validEmail(email)||!company||!title||!story){analytics(env,request,"podcast_guest",language,"validation_error");return json({success:false,error:"Please complete the required fields."},400);}
  try { const result=await sendLeadEmail(env,{type:"podcast_guest",language,replyTo:{email,name},fields:{Name:name,Email:email,Company:company,"Title / Role":title,Industry:industry,"Website / LinkedIn":link,"Story / Topic":story},meta:{country:request.cf?.country||"unknown",pageUrl,referrer}}); analytics(env,request,"podcast_guest",language,"success"); return json({success:true,messageId:result?.messageId||null}); }
  catch(e){console.error("Podcast guest email failed",e?.code,e?.message);analytics(env,request,"podcast_guest",language,"email_error");return json({success:false,error:"Email delivery failed. Please try again or email us directly."},502);}
}

function unauthorized(){return new Response("Authentication required",{status:401,headers:{"WWW-Authenticate":'Basic realm="GaloreGrowth.ai Lead Analytics"',"cache-control":"no-store"}});}
function adminAuthorized(request,env){
  if(!env.ADMIN_PASSWORD) return false;
  const h=request.headers.get("Authorization")||""; if(!h.startsWith("Basic ")) return false;
  try { const [u,p]=atob(h.slice(6)).split(":"); return u==="guno" && p===env.ADMIN_PASSWORD; } catch { return false; }
}
async function analyticsQuery(env,sql){
  if(!env.CF_ACCOUNT_ID||!env.CF_ANALYTICS_TOKEN) throw new Error("Analytics dashboard is not configured yet.");
  const endpoint=`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`;
  const r=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${env.CF_ANALYTICS_TOKEN}`},body:sql});
  if(!r.ok) throw new Error(`Analytics query failed (${r.status}): ${await r.text()}`);
  return r.json();
}
async function adminStats(env){
  const summarySQL=`SELECT blob1 AS form_type, blob2 AS language, blob3 AS outcome, SUM(_sample_interval * double1) AS events FROM ${DATASET} WHERE timestamp >= NOW() - INTERVAL '30' DAY GROUP BY form_type, language, outcome ORDER BY events DESC FORMAT JSON`;
  const dailySQL=`SELECT formatDateTime(toStartOfDay(timestamp), '%Y-%m-%d') AS day, blob1 AS form_type, SUM(_sample_interval * double1) AS events FROM ${DATASET} WHERE timestamp >= NOW() - INTERVAL '30' DAY AND blob3 = 'success' GROUP BY day, form_type ORDER BY day ASC FORMAT JSON`;
  const countrySQL=`SELECT blob4 AS country, SUM(_sample_interval * double1) AS events FROM ${DATASET} WHERE timestamp >= NOW() - INTERVAL '30' DAY AND blob3 = 'success' GROUP BY country ORDER BY events DESC LIMIT 8 FORMAT JSON`;
  const [summary,daily,countries]=await Promise.all([analyticsQuery(env,summarySQL),analyticsQuery(env,dailySQL),analyticsQuery(env,countrySQL)]);
  return {summary:summary.data||[],daily:daily.data||[],countries:countries.data||[]};
}
function dashboardHTML(){return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GaloreGrowth.ai Lead Analytics</title><style>body{margin:0;background:#090b10;color:#f5f7fb;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:1050px;margin:auto;padding:34px 20px}.top{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:24px}.ey{color:#e9c67a;letter-spacing:.12em;font-size:12px}.muted{color:#9298a8}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card,.panel{border:1px solid #252a36;background:#11141c;border-radius:16px;padding:18px}.num{font-size:34px;font-weight:750}.grid{display:grid;grid-template-columns:1.4fr .6fr;gap:14px;margin-top:14px}.bars{display:grid;gap:9px;margin-top:12px}.barrow{display:grid;grid-template-columns:95px 1fr 44px;gap:10px;align-items:center}.bar{height:10px;border-radius:99px;background:#252a36;overflow:hidden}.fill{height:100%;background:linear-gradient(90deg,#55d8ff,#916cff);border-radius:99px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px;border-bottom:1px solid #252a36;font-size:13px}button{background:#171b25;border:1px solid #303746;color:white;border-radius:10px;padding:9px 12px;cursor:pointer}@media(max-width:760px){.cards{grid-template-columns:1fr 1fr}.grid{grid-template-columns:1fr}.top{align-items:start;flex-direction:column}}</style></head><body><div class="wrap"><div class="top"><div><div class="ey">GALOREGROWTH.AI</div><h1 style="margin:5px 0 2px">Lead Analytics</h1><div class="muted">Last 30 days • consultation and podcast submissions</div></div><button onclick="load()">Refresh</button></div><div class="cards"><div class="card"><div class="muted">Consultations</div><div class="num" id="consult">—</div></div><div class="card"><div class="muted">Podcast Guests</div><div class="num" id="podcast">—</div></div><div class="card"><div class="muted">English</div><div class="num" id="en">—</div></div><div class="card"><div class="muted">中文</div><div class="num" id="zh">—</div></div></div><div class="grid"><div class="panel"><h3>Successful leads by day</h3><div id="daily" class="bars"></div></div><div class="panel"><h3>Top countries</h3><div id="countries" class="bars"></div></div></div><div class="panel" style="margin-top:14px"><h3>Submission outcomes</h3><table><thead><tr><th>Form</th><th>Language</th><th>Outcome</th><th>Events</th></tr></thead><tbody id="rows"></tbody></table></div><p class="muted" id="status"></p></div><script>const n=x=>Number(x||0);function esc(x){return String(x).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}async function load(){status.textContent='Loading…';try{const r=await fetch('/api/admin/stats');if(!r.ok)throw new Error(await r.text());const d=await r.json();const success=d.summary.filter(x=>x.outcome==='success');consult.textContent=success.filter(x=>x.form_type==='consultation').reduce((a,b)=>a+n(b.events),0);podcast.textContent=success.filter(x=>x.form_type==='podcast_guest').reduce((a,b)=>a+n(b.events),0);en.textContent=success.filter(x=>x.language==='en').reduce((a,b)=>a+n(b.events),0);zh.textContent=success.filter(x=>x.language==='zh').reduce((a,b)=>a+n(b.events),0);rows.innerHTML=d.summary.map(function(x){return '<tr><td>'+esc(x.form_type)+'</td><td>'+esc(x.language)+'</td><td>'+esc(x.outcome)+'</td><td>'+n(x.events)+'</td></tr>';}).join('');const byDay={};d.daily.forEach(function(x){byDay[x.day]=(byDay[x.day]||0)+n(x.events);});const days=Object.entries(byDay).slice(-14),mx=Math.max(1,...days.map(function(x){return x[1];}));daily.innerHTML=days.length?days.map(function(pair){const k=pair[0],v=pair[1];return '<div class="barrow"><span>'+k.slice(5)+'</span><div class="bar"><div class="fill" style="width:'+(v/mx*100)+'%"></div></div><b>'+v+'</b></div>';}).join(''):'<span class="muted">No successful submissions yet.</span>';const cm=Math.max(1,...d.countries.map(function(x){return n(x.events);}));countries.innerHTML=d.countries.length?d.countries.map(function(x){return '<div class="barrow"><span>'+esc(x.country)+'</span><div class="bar"><div class="fill" style="width:'+(n(x.events)/cm*100)+'%"></div></div><b>'+n(x.events)+'</b></div>';}).join(''):'<span class="muted">No data yet.</span>';status.textContent='Updated '+new Date().toLocaleString();}catch(e){status.textContent=e.message;}}load()</script></body></html>`;}

export default { async fetch(request,env){
  if(request.method!=="GET" && request.method!=="HEAD") return json({error:"Staging preview: all submissions disabled"},403);
  if(new URL(request.url).pathname.startsWith("/admin/")) return new Response("Disabled on staging",{status:404});
  const url=new URL(request.url);
  if(request.method==="POST"&&url.pathname==="/api/contact") return handleContact(request,env);
  if(request.method==="POST"&&url.pathname==="/api/podcast-guest") return handleGuest(request,env);
  if(url.pathname==="/api/config") return json({turnstileSiteKey:env.TURNSTILE_SITE_KEY||""});
  if(url.pathname==="/api/health") return json({ok:true,service:"GaloreGrowth.ai",emailBinding:Boolean(env.EMAIL),analyticsBinding:Boolean(env.LEADS_ANALYTICS),turnstileConfigured:Boolean(env.TURNSTILE_SITE_KEY&&env.TURNSTILE_SECRET_KEY),adminAnalyticsConfigured:Boolean(env.CF_ACCOUNT_ID&&env.CF_ANALYTICS_TOKEN&&env.ADMIN_PASSWORD)});
  if(url.pathname==="/admin/leads"||url.pathname==="/admin/leads/") { if(!adminAuthorized(request,env)) return unauthorized(); return new Response(dashboardHTML(),{headers:{"content-type":"text/html; charset=UTF-8","cache-control":"no-store"}}); }
  if(url.pathname==="/api/admin/stats") { if(!adminAuthorized(request,env)) return unauthorized(); try{return json(await adminStats(env));}catch(e){console.error(e);return json({error:e.message},500);} }
  return env.ASSETS.fetch(request);
}};
