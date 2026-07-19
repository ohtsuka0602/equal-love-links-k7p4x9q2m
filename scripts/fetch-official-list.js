const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const DEFAULT_MAX_ITEMS = 10;
const DEFAULT_EXTRACT_LIMIT = null;
const CATEGORY_WORDS = [
  "NEWS",
  "INFO",
  "LIVE",
  "MEDIA",
  "RELEASE",
  "EVENT",
  "TV",
  "RADIO",
  "MAGAZINE",
  "WEB",
  "GOODS",
  "OTHER",
  "ニュース",
  "お知らせ",
  "ライブ",
  "メディア",
  "リリース",
  "イベント",
  "グッズ",
  "出演",
  "舞台",
];

async function fetchOfficialList(config) {
  const maxItems = config.maxItems || DEFAULT_MAX_ITEMS;
  const extractLimit = config.extractLimit ?? DEFAULT_EXTRACT_LIMIT;
  const existingData = await readJson(config.outputPath, { meta: {}, [config.rootKey]: [] });
  const existingItems = normalizeExistingItems(existingData, config.rootKey);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: config.viewport || { width: 390, height: 844 },
    userAgent:
      config.userAgent ||
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  try {
    console.log(`Fetch target URL: ${config.url}`);
    const response = await page.goto(config.url, { waitUntil: "networkidle", timeout: 60000 });
    const responseStatus = response?.status() || "unknown";
    const responseHeaders = response?.headers() || {};
    const responseContentType = responseHeaders["content-type"] || "unknown";
    await page.waitForTimeout(config.settleTimeout ?? 1500);

    const finalUrl = page.url();
    const html = await page.content();
    console.log(`HTTP status: ${responseStatus}`);
    console.log(`Response content-type: ${responseContentType}`);
    console.log(`Response length: ${html.length}`);
    console.log(`Final response URL: ${finalUrl}`);

    const extractedItems = await page.evaluate(extractOfficialItemsFromDom, {
      type: config.type,
      maxItems: extractLimit,
      categoryWords: CATEGORY_WORDS,
    });
    const prepared = prepareItems(extractedItems, config);
    const nextItems = prepared.items.slice(0, maxItems);
    const checkedAt = getNowIso(config);
    const summary = {
      label: config.label,
      targetUrl: config.url,
      finalUrl,
      responseStatus,
      responseContentType,
      responseLength: html.length,
      rawExtractedCount: prepared.counts.raw,
      normalizedCount: prepared.counts.normalized,
      dateFilteredCount: prepared.counts.dateFiltered,
      categoryFilteredCount: prepared.counts.categoryFiltered,
      deduplicatedCount: prepared.counts.deduplicated,
      finalOutputCount: nextItems.length,
      existingItemCount: existingItems.length,
      checkedAt,
    };

    logFetchSummary(summary);
    await writeDebugArtifacts(config, html, summary);

    if (nextItems.length === 0) {
      const message = `No ${config.label} items were extracted. Existing JSON was not changed.`;

      if (existingItems.length > 0) {
        console.warn(message);
        await writeJsonAtomically(config.outputPath, {
          meta: {
            ...(existingData.meta || {}),
            checkedAt,
          },
          [config.rootKey]: existingItems,
        });
        return;
      }

      throw new Error(message);
    }

    const updatedAt = hasListChanged(existingItems, nextItems)
      ? checkedAt
      : existingData.meta?.updatedAt || checkedAt;
    const output = {
      meta: {
        ...(existingData.meta || {}),
        checkedAt,
        updatedAt,
      },
      [config.rootKey]: nextItems,
    };

    await writeJsonAtomically(config.outputPath, output);
    console.log(`Updated ${path.relative(config.rootDir, config.outputPath)} with ${nextItems.length} ${config.label} items.`);
  } finally {
    await browser.close();
  }
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

function normalizeExistingItems(data, rootKey) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.[rootKey])) {
    return data[rootKey];
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
}

function prepareItems(items, config) {
  const seen = new Set();
  const rawItems = items || [];
  const normalized = rawItems
    .map((item) => normalizeItem(item, config.type))
    .filter((item) => item.title && item.url);
  const todayKey = getTokyoDateKey(config.now ? new Date(config.now) : new Date());
  const dateFiltered = normalized.filter((item) => config.type !== "schedule" || !item.date || item.date >= todayKey);
  const categoryFiltered = dateFiltered;
  const prepared = categoryFiltered.filter((item) => {
    const key = `${item.url}|${item.title}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  const sorted = prepared.sort((left, right) => {
    const leftDate = getDateTime(left.date);
    const rightDate = getDateTime(right.date);

    return config.sort === "asc" ? leftDate - rightDate : rightDate - leftDate;
  });

  return {
    items: sorted,
    counts: {
      raw: rawItems.length,
      normalized: normalized.length,
      dateFiltered: dateFiltered.length,
      categoryFiltered: categoryFiltered.length,
      deduplicated: prepared.length,
    },
  };
}

function normalizeItem(item, type) {
  const date = normalizeDate(item.date);
  const category = cleanText(item.category);
  const base = {
    title: cleanOfficialTitle(item.title, category, date),
    date,
    url: cleanUrl(item.url),
    category,
  };

  if (type === "schedule") {
    return {
      ...base,
      time: normalizeTime(item.time),
    };
  }

  return base;
}

function hasListChanged(previousItems = [], nextItems = []) {
  return JSON.stringify(previousItems) !== JSON.stringify(nextItems);
}

async function writeJsonAtomically(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, filePath);
}

async function writeDebugArtifacts(config, html, summary) {
  const debugDir = path.join(config.rootDir, "debug");

  await fs.mkdir(debugDir, { recursive: true });
  await fs.writeFile(path.join(debugDir, `${config.label}.html`), html, "utf8");
  await fs.writeFile(path.join(debugDir, `${config.label}-summary.json`), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

function logFetchSummary(summary) {
  console.log(`Raw extracted count: ${summary.rawExtractedCount}`);
  console.log(`Normalized count: ${summary.normalizedCount}`);
  console.log(`Date-filtered count: ${summary.dateFilteredCount}`);
  console.log(`Category-filtered count: ${summary.categoryFilteredCount}`);
  console.log(`Deduplicated count: ${summary.deduplicatedCount}`);
  console.log(`Final output count: ${summary.finalOutputCount}`);
  console.log(`Existing ${summary.label} count: ${summary.existingItemCount}`);
  console.log(`Checked at: ${summary.checkedAt}`);
}

function extractOfficialItemsFromDom(options) {
  const anchors = Array.from(document.querySelectorAll("a[href]"));
  const items = [];

  for (const anchor of anchors) {
    const url = toAbsoluteUrl(anchor.getAttribute("href"));

    if (!isTargetUrl(url, options.type)) {
      continue;
    }

    const container = findListContainer(anchor, options.type);
    const title = findTitle(anchor, container);
    const text = compactText(container?.textContent || anchor.textContent);

    if (!title || title.length < 2) {
      continue;
    }

    items.push({
      title,
      date: options.type === "schedule" ? findScheduleDate(anchor) || findDate(text) : findDate(text),
      time: findTime(text),
      url,
      category: findCategory(container, text),
    });

    if (Number.isFinite(options.maxItems) && items.length >= options.maxItems) {
      break;
    }
  }

  return items;

  function isTargetUrl(value, type) {
    if (!value) {
      return false;
    }

    try {
      const urlObject = new URL(value);
      const pathName = urlObject.pathname.replace(/\/+$/g, "");

      if (type === "news") {
        return /\/news\/detail\//.test(`${pathName}/`);
      }

      return /\/schedule\/detail\//.test(`${pathName}/`);
    } catch {
      return false;
    }
  }

  function findListContainer(anchor, type) {
    const selectors = [
      "li",
      "article",
      "[class*='item' i]",
      "[class*='list' i]",
      type === "news" ? "[class*='news' i]" : "[class*='schedule' i]",
    ];

    for (const selector of selectors) {
      const node = anchor.closest(selector);

      if (node && compactText(node.textContent).length >= compactText(anchor.textContent).length) {
        return node;
      }
    }

    let node = anchor.parentElement;

    for (let depth = 0; depth < 4 && node; depth += 1) {
      const text = compactText(node.textContent);

      if (text.length >= 8 && text.length <= 500) {
        return node;
      }

      node = node.parentElement;
    }

    return anchor;
  }

  function findTitle(anchor, container) {
    const direct = compactText(anchor.textContent);

    if (isUsableTitle(direct)) {
      return direct;
    }

    const selectors = [
      "[class*='title' i]",
      "[class*='ttl' i]",
      "h1",
      "h2",
      "h3",
      "p",
      "span",
    ];

    for (const selector of selectors) {
      const title = Array.from(container?.querySelectorAll(selector) || [])
        .map((node) => compactText(node.textContent))
        .find(isUsableTitle);

      if (title) {
        return title;
      }
    }

    return direct;
  }

  function findScheduleDate(anchor) {
    const cell = anchor.closest(".cell");
    const dayMatch = compactText(cell?.textContent).match(/^(\d{1,2})\b/);
    const yearMonth = findCalendarYearMonth(anchor);

    if (!dayMatch || !yearMonth) {
      return "";
    }

    return `${yearMonth.year}-${String(yearMonth.month).padStart(2, "0")}-${String(Number(dayMatch[1])).padStart(2, "0")}`;
  }

  function findCalendarYearMonth(anchor) {
    const scope = anchor.closest(".calendar") || document;
    const text = compactText(scope.textContent);
    const match = text.match(/(20\d{2})\s+(\d{1,2})\s+[A-Za-z]+/);

    if (match) {
      return { year: match[1], month: Number(match[2]) };
    }

    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() + 1 };
  }
  function findDate(text) {
    const full = text.match(/(20\d{2})[.\/年-]\s*(\d{1,2})[.\/月-]\s*(\d{1,2})/);

    if (full) {
      return `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
    }

    const short = text.match(/(\d{1,2})[.\/月]\s*(\d{1,2})(?:日)?/);

    if (!short) {
      return "";
    }

    const today = new Date();
    let year = today.getFullYear();
    const month = Number(short[1]);
    const day = Number(short[2]);
    const candidate = new Date(year, month - 1, day);

    if (candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate()) && options.type === "schedule") {
      year += 1;
    }

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function findTime(text) {
    const match = text.match(/\b(\d{1,2}:\d{2})(?:\s*[~-]\s*(\d{1,2}:\d{2}))?/);

    if (!match) {
      return "";
    }

    return match[2] ? `${match[1]}-${match[2]}` : match[1];
  }

  function findCategory(container, text) {
    const categoryFromNode = Array.from(
      container?.querySelectorAll("[class*='cat' i], [class*='tag' i], [class*='label' i], [class*='type' i]") || []
    )
      .map((node) => compactText(node.textContent))
      .find(isCategory);

    if (categoryFromNode) {
      return categoryFromNode;
    }

    return options.categoryWords.find((word) => new RegExp(`(^|\\s)${escapeRegExp(word)}($|\\s)`, "i").test(text)) || "";
  }

  function isUsableTitle(value) {
    return Boolean(value && value.length >= 2 && value.length <= 160 && !/^\d{4}[.\/\-年]/.test(value));
  }

  function isCategory(value) {
    return Boolean(value && value.length <= 24 && options.categoryWords.some((word) => value.includes(word)));
  }

  function toAbsoluteUrl(value) {
    try {
      return new URL(value, location.href).href;
    } catch {
      return "";
    }
  }

  function compactText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

function cleanOfficialTitle(value, category, date) {
  let title = cleanText(value);

  if (category) {
    title = title.replace(new RegExp(`^${escapeRegExp(category)}\\s*`), "");
  }

  title = title
    .replace(/^(20\d{2})[.\/年-]\s*(\d{1,2})[.\/月-]\s*(\d{1,2})(?:日)?\s*/u, "")
    .replace(/^New!\s*/i, "")
    .replace(/^(20\d{2})[.\/年-]\s*(\d{1,2})[.\/月-]\s*(\d{1,2})(?:日)?\s*/u, "")
    .trim();

  if (date) {
    const compactDate = date.replaceAll("-", "");
    title = title.replace(new RegExp(`^${compactDate}\\s*`), "").trim();
  }

  return title;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function getTokyoDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getNowIso(config = {}) {
  return config.now ? new Date(config.now).toISOString() : new Date().toISOString();
}
function normalizeDate(value) {
  const text = cleanText(value);
  const match = text.match(/^(20\d{2})-(\d{2})-(\d{2})$/);

  if (match) {
    return text;
  }

  const parsed = new Date(text);

  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function normalizeTime(value) {
  return cleanText(value).replace(/\s+/g, "");
}

function getDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanUrl(value) {
  return String(value || "").trim();
}

module.exports = {
  fetchOfficialList,
  prepareItems,
};
