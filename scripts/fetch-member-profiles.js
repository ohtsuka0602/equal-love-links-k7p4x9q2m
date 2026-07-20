const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const PROFILE_LIST_URL = "https://equal-love.jp/feature/profile";
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT_DIR, "data", "member-profiles.json");
const MEMBERS_PATH = path.join(ROOT_DIR, "data", "members.json");
const DEBUG_DIR = path.join(ROOT_DIR, "debug");
const MIN_EXPECTED_PROFILES = 8;

async function fetchMemberProfiles(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const outputPath = options.outputPath || path.join(rootDir, "data", "member-profiles.json");
  const membersPath = options.membersPath || path.join(rootDir, "data", "members.json");
  const debugDir = options.debugDir || path.join(rootDir, "debug");
  const sourceUrl = options.sourceUrl || PROFILE_LIST_URL;
  const now = getNowIso(options);
  const existingData = await readJson(outputPath, { meta: {}, profiles: [] });
  const existingProfiles = normalizeExistingProfiles(existingData);
  const existingById = new Map(existingProfiles.map((profile) => [profile.id, profile]));
  const existingMembers = normalizeExistingMembers(await readJson(membersPath, { members: [] }));
  const membersById = new Map(existingMembers.map((member) => [getMemberId(member), member]).filter(([id]) => id));
  const summary = createInitialSummary(sourceUrl, existingProfiles.length, now);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: options.viewport || { width: 1280, height: 900 },
    userAgent:
      options.userAgent ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });

  try {
    console.log(`Fetch target URL: ${sourceUrl}`);
    const listResponse = await page.goto(sourceUrl, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(options.settleTimeout ?? 1500);

    const listHtml = await page.content();
    summary.list = createResponseSummary(page, listResponse, listHtml);
    logResponseSummary(summary.list);
    await fs.mkdir(debugDir, { recursive: true });
    await fs.writeFile(path.join(debugDir, "profile-list.html"), listHtml, "utf8");

    const rawLinks = await page.evaluate(extractProfileListFromDom);
    const profileLinks = dedupeProfiles(rawLinks.map(normalizeProfileListItem).filter((item) => item.id && item.profileUrl));
    summary.profileLinkCount = profileLinks.length;
    console.log(`Profile link count: ${profileLinks.length}`);

    if (!listResponse?.ok() || profileLinks.length === 0) {
      const reason = !listResponse?.ok() ? `list HTTP status ${listResponse?.status() || "unknown"}` : "no profile URLs extracted";
      await preserveExistingOutput(outputPath, debugDir, existingData, existingProfiles, summary, reason, false);
      return { output: existingData, summary };
    }

    const fetchedProfiles = [];

    for (const listItem of profileLinks) {
      const profile = await fetchOneProfile(browser, listItem, options, summary);

      if (profile) {
        fetchedProfiles.push(profile);
      }
    }

    const normalizedProfiles = dedupeProfiles(
      fetchedProfiles
        .map((profile) => joinExistingMemberData(profile, membersById, existingById))
        .map(normalizeProfile)
        .filter((profile) => profile.id && profile.name)
    );
    summary.profileSuccessCount = fetchedProfiles.length;
    summary.profileFailureCount = summary.failures.length;
    summary.normalizedCount = normalizedProfiles.length;
    summary.existingMemberCount = existingMembers.filter((member) => member.type === "member").length;

    console.log(`Profile success count: ${summary.profileSuccessCount}`);
    console.log(`Profile failure count: ${summary.profileFailureCount}`);
    console.log(`Normalized count: ${summary.normalizedCount}`);
    console.log(`Existing profile count: ${existingProfiles.length}`);
    console.log(`Existing member count: ${summary.existingMemberCount}`);

    if (normalizedProfiles.length === 0) {
      await preserveExistingOutput(outputPath, debugDir, existingData, existingProfiles, summary, "all profile fetches failed", false);
      return { output: existingData, summary };
    }

    if (normalizedProfiles.length < MIN_EXPECTED_PROFILES && existingProfiles.length >= MIN_EXPECTED_PROFILES) {
      await preserveExistingOutput(
        outputPath,
        debugDir,
        existingData,
        existingProfiles,
        summary,
        `low extraction count: ${normalizedProfiles.length}`,
        false
      );
      return { output: existingData, summary };
    }

    const outputProfiles = mergePartialFailures(normalizedProfiles, profileLinks, existingById);
    summary.outputCount = outputProfiles.length;
    const updatedAt = hasProfilesChanged(existingProfiles, outputProfiles)
      ? now
      : existingData.meta?.updatedAt || now;
    const output = {
      meta: {
        ...(existingData.meta || {}),
        sourceUrl,
        finalUrl: summary.list.finalUrl,
        checkedAt: now,
        updatedAt,
        lastAttemptAt: now,
        lastSuccessAt: now,
      },
      profiles: outputProfiles,
    };

    summary.checkedAt = output.meta.checkedAt;
    summary.updatedAt = output.meta.updatedAt;
    await writeJsonAtomically(outputPath, output);
    await writeSummary(debugDir, summary);
    console.log(`Output count: ${summary.outputCount}`);
    console.log(`Checked at: ${summary.checkedAt}`);
    console.log(`Updated at: ${summary.updatedAt}`);
    console.log(`Updated ${path.relative(rootDir, outputPath)} with ${outputProfiles.length} member profiles.`);
    return { output, summary };
  } finally {
    await browser.close();
  }
}

async function fetchOneProfile(browser, listItem, options, summary) {
  const page = await browser.newPage({
    viewport: options.viewport || { width: 1280, height: 900 },
    userAgent:
      options.userAgent ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });

  try {
    console.log(`Fetch profile URL: ${listItem.profileUrl}`);
    const response = await page.goto(listItem.profileUrl, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(options.settleTimeout ?? 800);
    const html = await page.content();
    const responseSummary = createResponseSummary(page, response, html);
    const rawProfile = await page.evaluate(extractProfileDetailFromDom);
    const profile = normalizeProfile({
      ...listItem,
      ...rawProfile,
      profileUrl: responseSummary.finalUrl || listItem.profileUrl,
      listImageUrl: listItem.imageUrl,
    });
    const missingFields = getMissingFields(profile);
    const ok = response?.ok() && profile.name;

    if (!ok) {
      summary.failures.push({
        id: listItem.id,
        name: listItem.name,
        profileUrl: listItem.profileUrl,
        httpStatus: responseSummary.status,
        missingFields,
      });
      console.warn(`Profile failed: ${listItem.name || listItem.id} ${listItem.profileUrl} status=${responseSummary.status}`);
      return null;
    }

    if (missingFields.length > 0) {
      console.warn(`Profile missing fields: ${profile.name} ${missingFields.join(", ")}`);
    }

    summary.details.push({
      id: profile.id,
      name: profile.name,
      profileUrl: profile.profileUrl,
      httpStatus: responseSummary.status,
      finalUrl: responseSummary.finalUrl,
      responseContentType: responseSummary.contentType,
      responseLength: responseSummary.length,
      missingFields,
    });
    return profile;
  } catch (error) {
    summary.failures.push({
      id: listItem.id,
      name: listItem.name,
      profileUrl: listItem.profileUrl,
      httpStatus: "error",
      error: error.message,
      missingFields: [],
    });
    console.warn(`Profile failed: ${listItem.name || listItem.id} ${listItem.profileUrl} ${error.message}`);
    return null;
  } finally {
    await page.close();
  }
}

async function preserveExistingOutput(outputPath, debugDir, existingData, existingProfiles, summary, reason, markChecked) {
  const now = summary.attemptedAt;
  const output = {
    meta: {
      ...(existingData.meta || {}),
      lastAttemptAt: now,
      ...(markChecked ? { checkedAt: now } : {}),
    },
    profiles: existingProfiles,
  };

  summary.warning = reason;
  summary.outputCount = existingProfiles.length;
  summary.checkedAt = output.meta.checkedAt || "";
  summary.updatedAt = output.meta.updatedAt || "";
  await writeJsonAtomically(outputPath, output);
  await writeSummary(debugDir, summary);
  console.warn(`Profile update skipped: ${reason}. Existing member-profiles.json was preserved.`);
}

function extractProfileListFromDom() {
  const items = Array.from(document.querySelectorAll("#profile .profileList > li, .profileList > li"));

  return items.map((item) => {
    const anchor = item.querySelector('a[href*="/feature/"]');
    const nameNode = item.querySelector(".name");
    const nameClone = nameNode ? nameNode.cloneNode(true) : null;
    const yomi = nameClone?.querySelector(".yomi");
    const image = findBestImage(item);

    yomi?.remove();

    return {
      name: compactText(nameClone?.textContent || item.querySelector("img")?.alt || ""),
      nameEn: compactText(nameNode?.querySelector(".yomi")?.textContent || ""),
      profileUrl: toAbsoluteUrl(anchor?.getAttribute("href") || ""),
      imageUrl: image,
    };
  });

  function findBestImage(container) {
    const image = Array.from(container.querySelectorAll("img")).find(Boolean);
    const styleImage = image?.style?.backgroundImage || image?.getAttribute("style") || "";
    const match = styleImage.match(/url\(["']?(.+?)["']?\)/);
    const raw = match?.[1] || image?.currentSrc || image?.src || image?.dataset?.src || "";
    return raw ? toAbsoluteUrl(raw) : "";
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
}

function extractProfileDetailFromDom() {
  const root = document.querySelector("#profile .profDetail") || document.querySelector("#profile") || document.body;
  const image = findBestImage(root);
  const status = root.querySelector(".statusArea");
  const nameLine = status?.querySelector("p") || root.querySelector("h1, h2, p");
  const nameClone = nameLine ? nameLine.cloneNode(true) : null;
  const englishNode = nameClone?.querySelector(".name, .yomi");
  const nameEn = compactText(englishNode?.textContent || "");

  englishNode?.remove();

  const fields = {};
  const labels = Array.from(root.querySelectorAll("dt, th, [class*='label' i], [class*='title' i]"));

  for (const labelNode of labels) {
    const label = compactText(labelNode.textContent);
    const valueNode = labelNode.nextElementSibling;
    const value = compactText(valueNode?.textContent || "");

    if (label && value) {
      fields[label] = value;
    }
  }

  return {
    name: compactText(nameClone?.textContent || document.querySelector("img[alt]")?.alt || ""),
    nameEn,
    imageUrl: image,
    birthday: fields["生年月日"] || "",
    birthplace: fields["出身地"] || "",
    bloodType: fields["血液型"] || "",
    zodiac: fields["星座"] || "",
    height: fields["身長"] || "",
    hobby: fields["趣味"] || "",
    skill: fields["特技"] || "",
  };

  function findBestImage(container) {
    const images = Array.from(container.querySelectorAll("img"));
    const image = images.find((img) => {
      const raw = img.getAttribute("style") || img.currentSrc || img.src || "";
      return /profile/i.test(raw) || compactText(img.alt);
    });
    const styleImage = image?.style?.backgroundImage || image?.getAttribute("style") || "";
    const match = styleImage.match(/url\(["']?(.+?)["']?\)/);
    const raw = match?.[1] || image?.currentSrc || image?.src || image?.dataset?.src || "";
    return raw ? toAbsoluteUrl(raw) : "";
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
}

function normalizeProfileListItem(item) {
  const profileUrl = cleanUrl(item.profileUrl);
  const id = idFromProfileUrl(profileUrl);

  return {
    id,
    name: cleanText(item.name),
    nameEn: cleanText(item.nameEn),
    profileUrl,
    imageUrl: cleanUrl(item.imageUrl),
  };
}

function normalizeProfile(profile) {
  const profileUrl = cleanUrl(profile.profileUrl);
  const id = cleanText(profile.id) || idFromProfileUrl(profileUrl);
  const imageUrl = cleanUrl(profile.imageUrl || profile.listImageUrl);

  return removeEmpty({
    id,
    name: cleanText(profile.name),
    nameEn: cleanText(profile.nameEn),
    profileUrl,
    image: cleanUrl(profile.image),
    imageUrl,
    birthday: normalizeBirthday(profile.birthday),
    birthplace: cleanText(profile.birthplace),
    bloodType: cleanText(profile.bloodType),
    zodiac: cleanText(profile.zodiac),
    height: cleanText(profile.height),
    hobby: cleanText(profile.hobby),
    skill: cleanText(profile.skill),
  });
}

function joinExistingMemberData(profile, membersById, existingById) {
  const member = membersById.get(profile.id);
  const existing = existingById.get(profile.id);

  return {
    ...existing,
    ...profile,
    image: member?.image || existing?.image || "",
    imageUrl: profile.imageUrl || existing?.imageUrl || member?.imageSourceUrl || "",
  };
}

function mergePartialFailures(profiles, profileLinks, existingById) {
  const successfulIds = new Set(profiles.map((profile) => profile.id));
  const missingExisting = profileLinks
    .filter((link) => !successfulIds.has(link.id) && existingById.has(link.id))
    .map((link) => existingById.get(link.id));

  return dedupeProfiles([...profiles, ...missingExisting]);
}

function dedupeProfiles(profiles) {
  const seen = new Set();

  return profiles.filter((profile) => {
    const key = profile.id || profile.profileUrl || profile.name;

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function hasProfilesChanged(previousProfiles = [], nextProfiles = []) {
  return JSON.stringify(previousProfiles) !== JSON.stringify(nextProfiles);
}

function getMissingFields(profile) {
  const required = ["birthday", "birthplace", "height", "hobby", "skill"];
  return required.filter((key) => !profile[key]);
}

function normalizeBirthday(value) {
  const text = cleanText(value);
  const match = text.match(/^(20\d{2}|19\d{2})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);

  if (!match) {
    return text;
  }

  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function idFromProfileUrl(value) {
  try {
    const url = new URL(value);
    const baseName = path.basename(url.pathname.replace(/\/+$/g, ""));
    return baseName
      .replace(new RegExp(`${escapeRegExp(path.extname(baseName))}$`), "")
      .replace(/_fs$/i, "")
      .replace(/_/g, "-")
      .toLowerCase();
  } catch {
    return "";
  }
}

function getMemberId(member) {
  if (!member || member.type !== "member") {
    return "";
  }

  const candidates = [member.imageSourceUrl, member.image]
    .map((value) => {
      try {
        const url = new URL(String(value || ""), "https://local.example/");
        return path.basename(url.pathname, path.extname(url.pathname)).replace(/_/g, "-").toLowerCase();
      } catch {
        return "";
      }
    })
    .filter(Boolean);

  return candidates[0] || "";
}

function normalizeExistingProfiles(data) {
  if (Array.isArray(data)) {
    return data;
  }

  return Array.isArray(data?.profiles) ? data.profiles : [];
}

function normalizeExistingMembers(data) {
  if (Array.isArray(data)) {
    return data;
  }

  return Array.isArray(data?.members) ? data.members : [];
}

function createInitialSummary(sourceUrl, existingProfileCount, now) {
  return {
    targetUrl: sourceUrl,
    attemptedAt: now,
    existingProfileCount,
    profileLinkCount: 0,
    profileSuccessCount: 0,
    profileFailureCount: 0,
    normalizedCount: 0,
    existingMemberCount: 0,
    outputCount: 0,
    details: [],
    failures: [],
  };
}

function createResponseSummary(page, response, html) {
  return {
    status: response?.status() || "unknown",
    contentType: response?.headers()?.["content-type"] || "unknown",
    length: html.length,
    finalUrl: page.url(),
  };
}

function logResponseSummary(summary) {
  console.log(`HTTP status: ${summary.status}`);
  console.log(`Response content-type: ${summary.contentType}`);
  console.log(`Response length: ${summary.length}`);
  console.log(`Final response URL: ${summary.finalUrl}`);
}

async function writeSummary(debugDir, summary) {
  await fs.mkdir(debugDir, { recursive: true });
  await fs.writeFile(path.join(debugDir, "member-profile-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

async function writeJsonAtomically(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, filePath);
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

function removeEmpty(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== ""));
}

function getNowIso(options = {}) {
  return options.now ? new Date(options.now).toISOString() : new Date().toISOString();
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanUrl(value) {
  return String(value || "").trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (require.main === module) {
  fetchMemberProfiles().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  fetchMemberProfiles,
  extractProfileListFromDom,
  extractProfileDetailFromDom,
  normalizeProfile,
  idFromProfileUrl,
};
