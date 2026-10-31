(() => {
"use strict";
const $ = id => document.getElementById(id);
const el = $("podcastLibrary");
if (!el) return;
let episodes = [], filter = "all", query = "", lang = "en";
const copy = {
 en:{featured:"Featured Episodes",intro:"Explore our conversations about business and AI.",search:"Search titles, guests, topics, descriptions…",all:"All",full:"Full Episodes",short:"Short Clips",behind:"Behind the Scenes",soon:"Coming Soon",back:"← Back to Podcast Library",share:"Share episode",copied:"Link copied",related:"Related Episodes",empty:"No episodes match your search.",watch:"Watch Episode",notready:"Video coming soon",published:"Published",duration:"Duration",guest:"Guest"},
 zh:{featured:"精选节目",intro:"探索商业与人工智能的精彩对话。",search:"搜索标题、嘉宾、主题及介绍…",all:"全部",full:"完整节目",short:"短片",behind:"幕后花絮",soon:"即将推出",back:"← 返回节目库",share:"分享节目",copied:"链接已复制",related:"相关节目",empty:"没有找到符合条件的节目。",watch:"播放节目",notready:"视频即将上线",published:"发布日期",duration:"时长",guest:"嘉宾"}
};
const t = k => copy[lang][k] || k;
const val = x => typeof x === "object" && x !== null ? (x[lang] || x.en || "") : (x || "");
const esc = x => String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const text = x => esc(val(x));
const date = d => d ? new Date(d+"T12:00:00").toLocaleDateString(lang==="zh"?"zh-CN":"en-US",{year:"numeric",month:"short",day:"numeric"}) : "";
const urlFor = e => "/podcast/"+encodeURIComponent(e.slug);
const youtubeId = url => { try { const u=new URL(url); if(u.hostname==="youtu.be")return u.pathname.slice(1).split("/")[0]; if(u.hostname.endsWith("youtube.com"))return u.searchParams.get("v") || u.pathname.match(/\/(?:embed|shorts)\/([^/]+)/)?.[1] || ""; }catch(_){} return ""; };
// Resolve missing duration from Cloudflare's public HLS playlist, where permitted by CORS.
// Never substitute a guessed runtime; retain a graceful fallback when access is denied.
async function resolveDuration(e){
 if(e.duration || e.videoProvider!=="cloudflare" || !e.videoUrl) return;
 try {
  const m=e.videoUrl.match(/^(https:\/\/[^/]+\/[^/]+)\/iframe/);
  if(!m)return;
  const root=m[1];
  const pull=async url=>{const r=await fetch(url,{mode:"cors",signal:AbortSignal.timeout(7000)});if(!r.ok)throw Error("Playlist HTTP "+r.status);return r.text()};
  const master=await pull(root+"/manifest/video.m3u8");
  let playlist=master;
  if(master.includes("#EXT-X-STREAM-INF")){
    const lines=master.split(/\r?\n/);
    const idx=lines.findIndex(line=>line.startsWith("#EXT-X-STREAM-INF"));
    const variant=lines.slice(idx+1).find(line=>line.trim()&&!line.startsWith("#"));
    if(!variant)return;
    playlist=await pull(new URL(variant,root+"/manifest/video.m3u8").href);
  }
  const samples=[...playlist.matchAll(/^#EXTINF:([\d.]+)/gm)];
  if(!samples.length)return;
  const secs=Math.round(samples.reduce((n,x)=>n+Number(x[1]),0));
  if(!Number.isFinite(secs)||secs<1)return;
  e.duration=Math.floor(secs/3600)?`${Math.floor(secs/3600)}:${String(Math.floor(secs%3600/60)).padStart(2,"0")}:${String(secs%60).padStart(2,"0")}`:`${Math.floor(secs/60)}:${String(secs%60).padStart(2,"0")}`;
  renderRoute();
 }catch(err){console.debug("Video duration lookup not available",err);}
}

const isReady = e => e.status==="published" && !!e.videoUrl;
const category = e => e.category==="full-episodes"?t("full"):e.category==="short-clips"?t("short"):t("behind");
const thumb = e => `<img class="pl-thumb" loading="lazy" src="${esc(e.thumbnail||"/podcast/media/episode-1-poster.svg")}" alt="${text(e.title)}">`;
function card(e,featured=false){
 return `<article class="${featured?"pl-feature":"pl-card"}"><a href="${urlFor(e)}" data-pl-route="${esc(e.slug)}">${thumb(e)}<div class="pl-pill">${esc(category(e))}${!isReady(e)?" · "+t("soon"):""}</div><h4>${text(e.title)}</h4></a><div class="pl-meta">${e.episodeNumber!=null?"EP "+String(e.episodeNumber).padStart(2,"0")+(e.duration?" · ":""):""}${esc(e.duration||"")}${e.publishedDate?" · "+date(e.publishedDate):""}</div><p>${text(e.description)}</p></article>`;
}
function renderList(){
 $("plHeading").textContent=t("featured");$("plSubheading").textContent=t("intro");$("plSearch").placeholder=t("search");
 const fs=[["all","all"],["full-episodes","full"],["short-clips","short"],["behind-the-scenes","behind"]];
 $("plFilters").innerHTML=fs.map(([v,k])=>`<button type="button" class="pl-filter" data-pl-filter="${v}" aria-pressed="${filter===v}">${t(k)}</button>`).join("");
 $("plFeatured").innerHTML=episodes.filter(e=>e.featured).sort((a,b)=>(b.episodeNumber??-1)-(a.episodeNumber??-1)).map(e=>card(e,true)).join("");
 const q=query.toLocaleLowerCase();
 const results=episodes.filter(e=>(filter==="all"||e.category===filter)&&(!q||[val(e.title),val(e.description),e.guest?.name||"",e.guest?.role||"",...(e.tags||[])].join(" ").toLocaleLowerCase().includes(q))).sort((a,b)=>(b.publishedDate||"").localeCompare(a.publishedDate||"")||(b.episodeNumber??0)-(a.episodeNumber??0));
 $("plGrid").innerHTML=results.length?results.map(e=>card(e)).join(""):`<p class="pl-empty">${t("empty")}</p>`;
}
function renderDetail(e){
 $("plList").hidden=true;$("plDetail").hidden=false;
 const video=isReady(e)?(e.videoProvider==="youtube"?`<div class="pl-video" style="position:relative;aspect-ratio:16/9;height:auto;overflow:hidden;background:#000"><iframe src="https://www.youtube-nocookie.com/embed/${esc(youtubeId(e.videoUrl))}?rel=0" title="${text(e.title)}" loading="lazy" style="border:0;position:absolute;inset:0;width:100%;height:100%" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`:e.videoProvider==="cloudflare"?`<div class="pl-video" style="position:relative;aspect-ratio:16/9;height:auto;overflow:hidden;background:#000"><iframe src="${esc(e.videoUrl)}" title="${text(e.title)}" loading="lazy" style="border:0;position:absolute;inset:0;width:100%;height:100%" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`:`<video class="pl-video" controls playsinline preload="metadata" poster="${esc(e.thumbnail)}"><source src="${esc(e.videoUrl)}" type="video/mp4">${t("notready")}</video>`):`<img class="pl-poster" src="${esc(e.thumbnail)}" alt="${text(e.title)}"><div class="pl-status">${t("notready")}</div>`;
 const other=episodes.filter(x=>x.id!==e.id).slice(0,2);
 $("plDetail").innerHTML=`<button type="button" class="pl-back" id="plBack">${t("back")}</button><div class="pl-info"><div class="pl-kicker">${esc(e.series||"The GaloreGrowth Podcast")} · EP ${String(e.episodeNumber??0).padStart(2,"0")}</div><h3>${text(e.title)}</h3><div class="pl-meta">${esc(category(e))}${e.publishedDate?" · "+t("published")+": "+date(e.publishedDate):""}${e.duration?" · "+t("duration")+": "+esc(e.duration):""}</div></div>${video}<div class="pl-info"><p>${text(e.description)}</p>${e.guest?`<p><strong>${t("guest")}:</strong> ${esc(e.guest.name)}${e.guest.role?" · "+esc(e.guest.role):""}</p>`:""}<div class="pl-tags">${(e.tags||[]).map(x=>`<span class="pl-tag">${esc(x)}</span>`).join("")}</div><div class="pl-detail-actions"><button type="button" class="pl-share" id="plShare">${t("share")}</button></div></div>${other.length?`<div class="pl-related"><h4>${t("related")}</h4><div class="pl-grid">${other.map(x=>card(x)).join("")}</div></div>`:""}`;
 $("plBack").onclick=()=>navigate(null);
 $("plShare").onclick=async()=>{const link=location.href;try{if(navigator.share)await navigator.share({title:val(e.title),url:link});else{await navigator.clipboard.writeText(link);$("plShare").textContent=t("copied")}}catch{}};
 document.title=val(e.title)+" — The GaloreGrowth Podcast";
}
function stopEpisodePlayback(){
 // Pause native videos before removing their sources.
 $("plDetail").querySelectorAll("video").forEach(video=>{
  try { video.pause(); video.removeAttribute("src"); video.querySelectorAll("source").forEach(source=>source.removeAttribute("src")); video.load(); } catch (_) {}
 });
 // Removing the iframe unloads Cloudflare Stream and stops its audio.
 $("plDetail").querySelectorAll("iframe").forEach(frame=>frame.remove());
}
function renderRoute(){
 stopEpisodePlayback();
 const match=location.pathname.match(/^\/podcast\/([a-z0-9-]+)\/?$/i);
 const e=match?episodes.find(x=>x.slug===decodeURIComponent(match[1])):null;
 if(e){renderDetail(e);el.scrollIntoView({block:"start",behavior:"instant"});}
 else{$("plList").hidden=false;$("plDetail").hidden=true;renderList();document.title="GaloreGrowth.ai — Find the Right AI Tools for Your Business";}
}
function navigate(slug){history.pushState({podcast:true},"",slug?"/podcast/"+encodeURIComponent(slug):"/#podcast");renderRoute();}
el.addEventListener("click",e=>{
 const link=e.target.closest("[data-pl-route]");
 if(link){e.preventDefault();navigate(link.dataset.plRoute);return;}
 const b=e.target.closest("[data-pl-filter]");
 if(b){filter=b.dataset.plFilter;renderList();}
});
$("plSearch").addEventListener("input",e=>{query=e.target.value.trim();renderList();});
$("plPrev").onclick=()=> $("plFeatured").scrollBy({left:-Math.max(250,$("plFeatured").clientWidth*.75),behavior:"smooth"});
$("plNext").onclick=()=> $("plFeatured").scrollBy({left:Math.max(250,$("plFeatured").clientWidth*.75),behavior:"smooth"});
window.addEventListener("popstate",renderRoute);
function language(){const zh=document.documentElement.lang?.toLowerCase().startsWith("zh")||document.querySelector(".lang-btn.active")?.dataset.lang==="zh"||document.querySelector('[data-lang="zh"].active');return zh?"zh":"en";}
const observer=new MutationObserver(()=>{const next=language();if(next!==lang){lang=next;renderRoute();}});
observer.observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
document.querySelectorAll("[data-lang]").forEach(x=>x.addEventListener("click",()=>setTimeout(()=>{lang=language();renderRoute();},0)));
fetch("/podcast/episodes.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Episode data unavailable");return r.json()}).then(data=>{
 episodes=Array.isArray(data.episodes)?data.episodes:[];lang=language();renderRoute();
 episodes.forEach(resolveDuration);
}).catch(()=>{$("plGrid").innerHTML='<p class="pl-empty">Podcast data could not be loaded. / 节目数据加载失败。</p>';});
})();