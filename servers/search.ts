import axios from "axios";
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { chromium, devices } from "playwright";
import { toolsJson, ChatAssistant, isMCP, isCli } from "../sim-mcp.js";
import { extract } from "@extractus/article-extractor";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
];

const SEARCH_ENGINES = [
  { t: "https://www.google.com/search?q={q}&start={page}", p: (n) => n * 10 },
  { t: "https://www.bing.com/search?q={q}&first={page}", p: (n) => n * 10 + 1 },
  { t: "https://duckduckgo.com/?q={q}&s={page}", p: (n) => n * 10 },
  { t: "https://search.brave.com/search?q={q}", p: (_) => null },
];

const NOISE = [
  /People also ask/g,
  /Client Challenge/g,
  /JavaScript is disabled[\s\S]+?browser/gi,
  /Please enable JavaScript[\s\S]+?browser/gi,
];

function random<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

function isSearchResult(url: string) {
  return /bing\.com\/search|google\.[a-z]+\/search|duckduckgo\.com|search\.brave\.com\/search/.test(
    url
  );
}

function extractLinks(html: string, from: string, d: number) {
  const $ = cheerio.load(html);
  const out: any[] = [];
  $("a[href]").each((_, e) => {
    const h: string = $(e).attr("href") ?? "";
    if (/^https?:\/\//.test(h))
      out.push({ url: h, depth: d + 1, parentUrl: from });
  });
  return out;
}

function cleanContent(html: string, maxLen = 1000): string {
  if (!html) return "";
  const $ = cheerio.load(html);
  $("script,style,nav,img,svg,noscript,footer,header,form").remove();
  $("br").replaceWith("\n");
  $("div,p,h1,h2,h3,h4,h5,h6,li").after("\n");
  let t = $.text();
  NOISE.forEach((r) => (t = t.replace(r, "")));
  t = t
    .replace(/\n\s*\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (maxLen && t.length > maxLen) t = t.slice(0, maxLen) + "...";
  return t;
}

async function fetchDynamic(url: string) {
  const ua = random(USER_AGENTS),
    vps = [
      { width: 1280, height: 800 },
      { width: 1920, height: 1080 },
      { width: 375, height: 812 },
    ];
  const vp = random(vps),
    m = ua.includes("iPhone"),
    ctx = {
      userAgent: ua,
      viewport: vp,
      locale: "en-US",
      deviceScaleFactor: m ? 3 : 1,
      isMobile: m,
      hasTouch: m,
    };
  const b = await chromium.launch({ headless: true }),
    c = await b.newContext(ctx),
    p = await c.newPage();
  await p.waitForTimeout(500 + Math.random() * 1000);
  await p.goto(url, { waitUntil: "networkidle", timeout: 7000 });
  await p.mouse.move(Math.random() * vp.width, Math.random() * vp.height);
  await p.waitForTimeout(200 + Math.random() * 500);
  await p.keyboard.press("PageDown");
  await p.waitForTimeout(200 + Math.random() * 500);
  await p.waitForTimeout(400 + Math.random() * 800);
  const html = await p.content();
  await b.close();
  return html;
}

function searchEngineResults(q: string, pages = 1) {
  return SEARCH_ENGINES.flatMap((e) =>
    e.p(1) === null
      ? [{ url: e.t.replace("{q}", encodeURIComponent(q)), depth: 0 }]
      : Array(pages)
          .fill(0)
          .map((_, i) => ({
            url: e.t
              .replace("{q}", encodeURIComponent(q))
              .replace("{page}", String(e.p(i))),
            depth: 0,
          }))
  );
}

export interface ParallelWebSearchInput {
  query: string;
}
export async function ParallelWebSearch(
  ParallelWebSearchInput: ParallelWebSearchInput
) {
  let query = ParallelWebSearchInput.query;
  let numResults = 10,
    depth = 1,
    pagesPerEngine = 1;
  const n = numResults,
    seen = new Set(),
    out: any[] = [],
    initial = searchEngineResults(query, pagesPerEngine);

  const CONCURRENCY = 5;
  let idx = 0;
  async function worker() {
    while (idx < initial.length && out.length < n) {
      const r = initial[idx++];
      await crawl(r, 0);
    }
  }

  async function crawl(r, d) {
    if (seen.has(r.url) || out.length >= n) return;
    seen.add(r.url);
    console.log(`Crawling: ${r.url} (depth: ${d})`);
    let html = "";
    try {
      html = await fetchDynamic(r.url);
    } catch (e) {
      console.error(`Failed to fetch ${r.url}:`, e);
      return;
    }
    if (isSearchResult(r.url))
      return await Promise.all(
        extractLinks(html, r.url, d).map((l) => crawl(l, d + 1))
      );
    let art: any = null;
    try {
      art = await extract(r.url);
    } catch {}
    if (art?.content)
      out.push({
        url: art.url,
        title: art.title,
        description: art.description,
        content: cleanContent(art.content),
        image: art.image,
        author: art.author,
        published: art.published,
        ttr: art.ttr,
        depth: r.depth,
        parentUrl: r.parentUrl,
      });
    if (d >= depth || !art?.content) return;
    await Promise.all(
      extractLinks(art.content, r.url, d).map((l) => crawl(l, d + 1))
    );
  }

  await Promise.all(Array(CONCURRENCY).fill(0).map(worker));
  return out.slice(0, n);
}

if (isCli()) {
  (async () => {
    const bot = new ChatAssistant({
      instructions:
        'For example, when the user says "BTC price", call ParallelWebSearch with query: "BTC price".',
      tools: [ParallelWebSearch],
    });
    let res: any;
    do {
      res = await bot.decide(
        "Search for the BTBC stock analysis and provide a summary."
      );
      console.log(res);
      console.log("Assistant:", res.text);
      await bot.prompt("End");
    } while (res.type !== "exit");
  })();
}
