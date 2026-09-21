// Local crime news scraper — runs daily, and once with --backfill to cover recent months.
//
//   node jobs/news/scrape.mjs                  # daily: new articles in this month's (and last month's) sitemaps + BBC RSS
//   node jobs/news/scrape.mjs --backfill 3     # every article from the last 3 months
//   node jobs/news/scrape.mjs --limit 10       # stop after 10 article fetches (testing)
//
// How it finds articles: each publisher lists every article in a monthly sitemap
// (URL + date). We keep local-news URLs whose slug looks like crime, fetch the
// page politely (robots.txt rules and crawl-delay honoured), and pull out facts:
// headline, publish time, police.uk category, and the streets / areas it names.
//
// What it stores: those facts and the link. Never the article text, and the text
// is never sent to an AI model — these publishers opt out of AI crawlers, so
// extraction is plain string matching against our own street and place lists.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { loadGazetteer } from "./gazetteer.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "data", "news-archive");
const UA = "Mozilla/5.0 (compatible; CovLeamCrimeMap/1.0; local crime map, links back to every article)";

// Slug words that suggest a crime story. Deliberately broad: a false positive
// costs one polite fetch; a miss loses the story.
const CRIME_SLUG =
  /stab|knife|knives|machete|blade|attack|assault|punch|rob|mugg|burgl|break-in|theft|thief|thieves|stole|steal|shoplift|arrest|police|cops|court|jail|prison|sentenc|charged|guilty|trial|murder|kill|manslaughter|rape|sexual|grope|harass|stalk|drug|cannabis|cocaine|heroin|dealer|weapon|gun|shot|firearm|arson|fire-started|vandal|criminal|crime|disorder|brawl|fight|affray|anti-social|asb|carjack|stolen|fraud|scam|abuse|predator|thug|paedo|groom|hate|missing|wanted|appeal|cctv|raid|seiz|offender|victim|injur|dies|died|death|body/;

const SOURCES = [
  {
    id: "coventrylive",
    name: "CoventryLive",
    origin: "https://www.coventrytelegraph.net",
    sitemap: (ym) => `https://www.coventrytelegraph.net/sitemaps/map_art_${ym}-01.xml`,
    keep: (path) => /^\/news\/(coventry-news|local-news)\//.test(path) && CRIME_SLUG.test(path),
  },
  // Warwickshire World (Leamington Courier) is left out on purpose: its Cloudflare
  // challenges automated clients, and we don't work around bot protection.
  {
    id: "bbc",
    name: "BBC News",
    origin: "https://www.bbc.co.uk",
    rss: "https://feeds.bbci.co.uk/news/england/coventry_and_warwickshire/rss.xml",
    keep: (_path, title) => CRIME_SLUG.test((title ?? "").toLowerCase().replace(/\s+/g, "-")),
  },
];

// ---------- polite fetching ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hostRules = new Map(); // origin -> { disallow: RegExp[], delayMs, last }

async function rulesFor(origin) {
  if (hostRules.has(origin)) return hostRules.get(origin);
  const rules = { disallow: [], delayMs: 3000, last: 0 };
  try {
    const txt = await (await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": UA } })).text();
    let applies = false;
    for (const raw of txt.split(/\r?\n/)) {
      const line = raw.split("#")[0].trim();
      const [k, ...rest] = line.split(":");
      const v = rest.join(":").trim();
      if (/^user-agent$/i.test(k)) applies = v === "*";
      else if (applies && /^disallow$/i.test(k) && v) rules.disallow.push(new RegExp("^" + v.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")));
      else if (applies && /^crawl-delay$/i.test(k)) rules.delayMs = Math.max(rules.delayMs, Number(v) * 1000);
    }
  } catch {
    rules.delayMs = 10000;
  }
  hostRules.set(origin, rules);
  return rules;
}

async function politeGet(url) {
  const u = new URL(url);
  const rules = await rulesFor(u.origin);
  if (rules.disallow.some((re) => re.test(u.pathname + u.search))) return { status: "robots" };
  const wait = rules.last + rules.delayMs - Date.now();
  if (wait > 0) await sleep(wait);
  rules.last = Date.now();
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xml" }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return { status: `http-${res.status}` };
    return { status: "ok", text: await res.text() };
  } catch (err) {
    return { status: `error-${err.name}` };
  }
}

// ---------- discovery ----------
const xml = new XMLParser({ ignoreAttributes: true });
const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

async function discover(source, months) {
  const found = [];
  if (source.sitemap) {
    for (const ym of months) {
      const r = await politeGet(source.sitemap(ym));
      if (r.status !== "ok") {
        console.warn(`  ${source.id} ${ym} sitemap: ${r.status}`);
        continue;
      }
      for (const u of asArray(xml.parse(r.text)?.urlset?.url)) {
        const url = String(u.loc);
        const path = new URL(url).pathname;
        if (source.keep(path)) found.push({ url, lastmod: u.lastmod });
      }
    }
  }
  if (source.rss) {
    const r = await politeGet(source.rss);
    if (r.status === "ok") {
      for (const it of asArray(xml.parse(r.text)?.rss?.channel?.item)) {
        const url = String(it.link).replace(/\?.*$/, "");
        if (source.keep(new URL(url).pathname, String(it.title))) found.push({ url, lastmod: it.pubDate });
      }
    }
  }
  return found;
}

// ---------- page parsing (facts only) ----------
const decode = (s) =>
  String(s ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

function parseArticle(html) {
  let headline = "";
  let published = "";
  let body = "";
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    let j;
    try {
      j = JSON.parse(m[1]);
    } catch {
      continue;
    }
    for (const node of asArray(j["@graph"] ?? j)) {
      if (!/Article/.test(String(node?.["@type"]))) continue;
      headline ||= decode(node.headline);
      published ||= node.datePublished ?? "";
      body ||= decode(node.articleBody ?? "");
    }
  }
  const meta = (name) => html.match(new RegExp(`<meta[^>]+(?:property|name)="${name}"[^>]+content="([^"]*)"`))?.[1] ?? "";
  headline ||= decode(meta("og:title"));
  published ||= meta("article:published_time");
  if (!body) {
    body = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, " "))).join(" ");
  }
  // publishers splice promos into the body ("newsletters from across Coventry, including
  // Longford, Earlsdon, Tile Hill…") which would tag every article with those areas
  body = body
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !/newsletter|sign up|subscribe|stay up to date|whatsapp|follow us|download (our|the) app|read more|more stories|join our|click here|facebook group|our community/i.test(s))
    .join(" ");
  const tags = decode(meta("news_keywords") || meta("keywords"))
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return { headline: headline.trim(), published, body: body.replace(/\s+/g, " "), tags };
}

// ---------- classification (keyword rules, no AI) ----------
const RULES = [
  ["violent-crime", /\b(murder\w*|manslaughter|stabb\w*|stabbed|assault\w*|attack\w*|punch\w*|rape\w*|sexual\w*|grop\w*|harass\w*|stalk\w*|domestic abuse|coercive|strangl\w*|glassed|grooming|groomed|indecent|voyeur\w*)\b/i],
  ["robbery", /\b(robb\w*|mugg\w*|carjack\w*|at knifepoint|held up)\b/i],
  ["possession-of-weapons", /\b(possession of (a |an )?(knife|bladed|offensive weapon|firearm)|carrying (a )?(knife|machete|weapon)|knife crime|zombie knife|machete)\b/i],
  ["burglary", /\b(burglar\w*|break-in|broke into|breaking into)\b/i],
  ["vehicle-crime", /\b(car thie\w*|stole (a|his|her|the) (car|van|vehicle)|stolen (car|van|vehicle)|theft of (a |the )?(car|vehicle|van)|catalytic converter|keyless)\b/i],
  ["bicycle-theft", /\b(bike|bicycle|e-bike) (theft|thie\w*|stolen)\b/i],
  ["criminal-damage-arson", /\b(arson\w*|deliberately (set|started)|criminal damage|vandal\w*|graffiti)\b/i],
  ["shoplifting", /\b(shoplift\w*)\b/i],
  ["drugs", /\b(drugs?|cannabis|cocaine|heroin|county lines|dealer\w*|nitrous)\b/i],
  ["public-order", /\b(affray|disorder|brawl|public order|violent disorder|riot)\b/i],
  ["anti-social-behaviour", /\b(anti-social|antisocial|asb)\b/i],
  ["other-theft", /\b(theft|thie\w*|stole|stolen|steal\w*)\b/i],
  ["other-crime", /\b(fraud\w*|scam\w*|dangerous driving|drink[- ]driv\w*|drug[- ]driv\w*|blackmail|bribery|perverting|modern slavery|trafficking|smuggl\w*|brothel|arrest\w*|charged|jailed|convicted|sentenced)\b/i],
];
const COURT = /\b(crown court|magistrates'? court|jailed|sentenced|pleaded|found guilty|convicted|trial|jury|remanded|spared jail|suspended sentence)\b/i;
const IN_TOWNS = /\b(Coventry|Leamington|Kenilworth|Whitnash|Warwick(?! Crown Court| University| Law| Business School)|University of Warwick)\b/;
const OUT_TOWNS = /\b(Nuneaton|Rugby|Bedworth|Birmingham|Solihull|Stratford|Southam|Wellesbourne|Atherstone|Alcester|Shipston|Kineton|Wolverhampton|Walsall|Dudley|Sandwell|West Bromwich|Leicester|Northampton|Hinckley|Redditch|Daventry|Banbury)\b/;

// Court reports give people's home addresses ("Jane Doe, 34, of Keresley Road, Coventry,
// was jailed…", "a 24-year-old man from Tile Hill"). Those are where someone lives, not
// where a crime happened, and pinning them would put a defendant's home on the map.
const RESIDENCE = [
  /\b\d{1,3},\s+(?:of|from)\s+[^.;]*?(?=,\s*(?:was|were|has|had|is|who|appeared|admitted|pleaded|denied|will|faces|received)\b|[.;])/g,
  /\baged\s+\d{1,3},?\s+(?:of|from)\s+[^.;]*?(?=,|[.;])/g,
  // these three consume only the capitalised place name, so "…from Tile Hill was stabbed on Walsgrave Road" keeps the incident street
  /(\b\d{1,3}-year-old\b[^.;]*?)\s+(?:of|from)\s+(?:[A-Z][\w'’-]*[\s,]*)+/g,
  /\bwho lives? (?:in|on|at)\s+(?:[A-Z][\w'’-]*[\s,]*)+/g,
  /\b(?:his|her|their) home (?:in|on|at)\s+(?:[A-Z][\w'’-]*[\s,]*)+/g,
];
function stripResidence(text) {
  let t = text;
  for (const re of RESIDENCE) t = t.replace(re, (m, keep) => (typeof keep === "string" ? `${keep} ` : " "));
  return t;
}

function classify(headline, body) {
  const lede = `${headline}. ${body.slice(0, 900)}`;
  for (const [cat, re] of RULES) if (re.test(headline)) return cat;
  for (const [cat, re] of RULES) if (re.test(lede)) return cat;
  return null;
}

// ---------- main ----------
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const backfill = flag("--backfill", 0);
const limit = flag("--limit", Infinity);
// re-fetch articles already in the archive and re-extract them with the current rules
const refresh = args.includes("--refresh");

function monthsBack(n) {
  const out = [];
  const d = new Date();
  for (let i = 0; i < n; i++) out.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  return out.reverse();
}
const months = backfill ? monthsBack(backfill) : monthsBack(new Date().getUTCDate() <= 3 ? 2 : 1);

mkdirSync(OUT, { recursive: true });
const INDEX = join(OUT, "_seen.json");
const seen = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, "utf8")) : {};
const monthFiles = new Map();
const monthFile = (ym) => {
  if (!monthFiles.has(ym)) {
    const p = join(OUT, `${ym}.json`);
    monthFiles.set(ym, existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : { month: ym, articles: [] });
  }
  return monthFiles.get(ym);
};
const idOf = (url) => createHash("sha1").update(url).digest("hex").slice(0, 12);
const { extract } = loadGazetteer(ROOT);

let fetched = 0;
const tally = {};
const bump = (k) => (tally[k] = (tally[k] ?? 0) + 1);
const drop = (id) => {
  for (const f of monthFiles.values()) f.articles = f.articles.filter((x) => x.id !== id);
};
function save() {
  for (const [ym, f] of monthFiles) {
    f.articles.sort((a, b) => a.published.localeCompare(b.published));
    writeFileSync(join(OUT, `${ym}.json`), JSON.stringify(f, null, 1) + "\n");
  }
  writeFileSync(INDEX, JSON.stringify(Object.fromEntries(Object.entries(seen).sort()), null, 0) + "\n");
}

async function archivedCandidates(source) {
  const out = [];
  for (const ym of months) {
    for (const a of monthFile(ym).articles) if (a.source === source.name) out.push({ url: a.url, lastmod: a.published });
  }
  return out;
}

for (const source of SOURCES) {
  const candidates = refresh ? await archivedCandidates(source) : (await discover(source, months)).filter((c) => !seen[idOf(c.url)]);
  console.log(`${source.name}: ${candidates.length} ${refresh ? "archived articles to re-check" : "new candidate articles"} (${months.join(", ")})`);
  for (const c of candidates) {
    if (fetched >= limit) break;
    const id = idOf(c.url);
    const r = await politeGet(c.url);
    fetched++;
    if (fetched % 20 === 0) {
      save(); // an interrupted run keeps what it has done
      console.log(`  … ${fetched} fetched`, JSON.stringify(tally));
    }
    if (r.status !== "ok") {
      seen[id] = r.status;
      bump(r.status);
      continue;
    }
    const a = parseArticle(r.text);
    const category = classify(a.headline, a.body);
    if (!category) {
      seen[id] = "not-crime";
      drop(id);
      bump("not-crime");
      continue;
    }
    const facts = extract(stripResidence(`${a.headline}. ${a.body} ${a.tags.join(". ")}`));
    const inArea = facts.streets.length > 0 || facts.areas.length > 0 || (IN_TOWNS.test(`${a.headline} ${a.body.slice(0, 600)}`) && !OUT_TOWNS.test(a.headline));
    if (!inArea) {
      seen[id] = "out-of-area";
      drop(id);
      bump("out-of-area");
      continue;
    }
    const published = new Date(a.published || c.lastmod || Date.now()).toISOString();
    const record = {
      id,
      url: c.url,
      source: source.name,
      title: a.headline,
      published,
      category,
      court: COURT.test(`${a.headline} ${a.body.slice(0, 600)}`),
      streets: facts.streets,
      areas: facts.areas,
      place: facts.place,
      tags: a.tags.slice(0, 12),
    };
    drop(id);
    monthFile(published.slice(0, 7)).articles.push(record);
    seen[id] = "crime";
    bump(facts.place ? `crime-${facts.place.precision}` : "crime-town-only");
  }
}

save();
console.log(`done: ${fetched} fetched`, JSON.stringify(tally));
