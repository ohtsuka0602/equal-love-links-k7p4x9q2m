const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const PROFILE_URL = "https://sp.equal-love.jp/feature/profile_fs";
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT_DIR, "data", "members.json");
const DEBUG_DIR = path.join(ROOT_DIR, "debug");
const MEMBER_ASSET_DIR = path.join(ROOT_DIR, "assets", "members");
const SNS_KEYS = ["instagram", "x", "tiktok", "youtube", "showroom"];
const FIXED_YOUTUBE_LINKS = {
  "=LOVE \u30aa\u30d5\u30a3\u30b7\u30e3\u30eb": "https://youtube.com/@equallove_?si=Gz5sMcLqE722nYoq",
  "\u5927\u8c37 \u6620\u7f8e\u91cc": "https://youtube.com/@mirinyaikolove?si=858PErgfTSsj1ewF",
  "\u97f3\u5d8b \u8389\u6c99": "https://youtube.com/@risa_yousugaokashii",
  "\u4f50\u3005\u6728 \u821e\u9999": "https://youtube.com/@ikorabunohutari?si=86Ox9PoReIfsjT5L",
  "\u8af8\u6a4b \u6c99\u590f": "https://www.youtube.com/@tsunhashigo",
  "\u5c71\u672c \u674f\u5948": "https://youtube.com/@ikorabunohutari?si=86Ox9PoReIfsjT5L",
};
const FIXED_MEMBER_META = {
  "大谷 映美里": { birthday: "03-15", birthdayLabel: "3月15日", memberColors: ["white", "purple"], memberColorLabels: ["白", "紫"] },
  "大場 花菜": { birthday: "02-04", birthdayLabel: "2月4日", memberColors: ["orange", "blue"], memberColorLabels: ["オレンジ", "青"] },
  "音嶋 莉沙": { birthday: "08-11", birthdayLabel: "8月11日", memberColors: ["light-blue", "pink"], memberColorLabels: ["水色", "濃いピンク"] },
  "齋藤 樹愛羅": { birthday: "11-26", birthdayLabel: "11月26日", memberColors: ["light-pink"], memberColorLabels: ["薄ピンク"] },
  "佐々木 舞香": { birthday: "01-21", birthdayLabel: "1月21日", memberColors: ["white"], memberColorLabels: ["白"] },
  "髙松 瞳": { birthday: "01-19", birthdayLabel: "1月19日", memberColors: ["red"], memberColorLabels: ["赤"] },
  "瀧脇 笙古": { birthday: "07-09", birthdayLabel: "7月9日", memberColors: ["yellow", "orange"], memberColorLabels: ["黄", "オレンジ"] },
  "野口 衣織": { birthday: "04-26", birthdayLabel: "4月26日", memberColors: ["purple"], memberColorLabels: ["紫"] },
  "諸橋 沙夏": { birthday: "08-03", birthdayLabel: "8月3日", memberColors: ["green"], memberColorLabels: ["緑"] },
  "山本 杏奈": { birthday: "11-30", birthdayLabel: "11月30日", memberColors: ["yellow", "blue"], memberColorLabels: ["黄", "青"] },
};
const OFFICIAL_MEMBER = {
  name: "=LOVE オフィシャル",
  image: "assets/official-love.png",
  sns: {
    instagram: "https://www.instagram.com/equal_love.official?igsh=OWtqdjBnYzJvOXBy",
    x: "https://x.com/equal_love_12?s=21&t=qpSEjRlbXxEJSyu7RsnLCg",
    tiktok: "https://www.tiktok.com/@equal_love_12?_r=1&_t=ZS-970UVFiCfbu",
    youtube: FIXED_YOUTUBE_LINKS["=LOVE \u30aa\u30d5\u30a3\u30b7\u30e3\u30eb"],
    showroom: "",
  },
  type: "official",
};

async function main() {
  const existingData = await readExistingData();
  const existingMembersByName = createMemberMap(existingData.members);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  try {
    console.log(`Fetch target URL: ${PROFILE_URL}`);
    const response = await page.goto(PROFILE_URL, { waitUntil: "networkidle", timeout: 60000 });
    const responseStatus = response?.status() || "unknown";
    const responseHeaders = response?.headers() || {};
    const responseContentType = responseHeaders["content-type"] || "unknown";
    await page.waitForTimeout(2500);

    await fs.mkdir(DEBUG_DIR, { recursive: true });
    const html = await page.content();
    console.log(`HTTP status: ${responseStatus}`);
    console.log(`Response content-type: ${responseContentType}`);
    console.log(`Response length: ${html.length}`);

    await fs.writeFile(path.join(DEBUG_DIR, "profile.html"), html, "utf8");
    await page.screenshot({ path: path.join(DEBUG_DIR, "profile.png"), fullPage: true });

    const members = await page.evaluate(extractMembersFromDom);
    const normalizedMembers = members.map(normalizeMember).filter(isValidMember);
    const uniqueMembers = dedupeMembers(normalizedMembers);
    console.log(`Extracted member count: raw=${members.length}, normalized=${normalizedMembers.length}, unique=${uniqueMembers.length}`);
    console.log(`Existing member count: ${existingData.members.length}`);

    await fs.writeFile(
      path.join(DEBUG_DIR, "profile-summary.json"),
      `${JSON.stringify({
        targetUrl: PROFILE_URL,
        responseStatus,
        responseContentType,
        responseLength: html.length,
        extractedRawCount: members.length,
        extractedNormalizedCount: normalizedMembers.length,
        extractedUniqueCount: uniqueMembers.length,
        existingMemberCount: existingData.members.length,
        checkedAt: new Date().toISOString(),
      }, null, 2)}\n`,
      "utf8"
    );

    if (uniqueMembers.length === 0) {
      if (existingData.members.length > 0) {
        const checkedAt = new Date().toISOString();
        await writeJsonAtomically({
          meta: {
            ...existingData.meta,
            checkedAt,
          },
          members: existingData.members,
        });
        console.warn("No member data was extracted. Kept existing members.json so downstream updates can continue.");
        return;
      }

      throw new Error("No member data was extracted and no existing members.json data is available.");
    }

    const checkedAt = new Date().toISOString();
    const localizedMembers = await captureMemberImages(page, uniqueMembers, existingMembersByName, checkedAt);
    const comparedResults = localizedMembers.map((member) =>
      applyDiffMetadata(member, existingMembersByName.get(member.name), checkedAt)
    );
    const comparedMembers = comparedResults.map((result) => result.member);
    const hasContentUpdates = comparedResults.some((result) => result.hasContentUpdates);
    const output = {
      meta: {
        ...existingData.meta,
        checkedAt,
        updatedAt: hasContentUpdates ? checkedAt : existingData.meta.updatedAt || checkedAt,
      },
      members: [OFFICIAL_MEMBER, ...comparedMembers],
    };

    await writeJsonAtomically(output);
    console.log(
      hasContentUpdates
        ? `Updated ${path.relative(ROOT_DIR, DATA_PATH)} with ${output.members.length} records.`
        : `Checked official profile. No member SNS link or image changes detected.`
    );
  } finally {
    await browser.close();
  }
}

async function readExistingData() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const data = JSON.parse(raw);

    if (Array.isArray(data)) {
      return { meta: {}, members: data };
    }

    if (data && Array.isArray(data.members)) {
      return {
        meta: data.meta || {},
        members: data.members,
      };
    }

    throw new Error("members.json must be an array or { members, meta }");
  } catch (error) {
    if (error.code === "ENOENT") {
      return { meta: {}, members: [] };
    }

    throw error;
  }
}

function createMemberMap(members) {
  return new Map((members || []).map((member) => [member.name, member]));
}

function applyDiffMetadata(member, previousMember, checkedAt) {
  const badges = { ...(previousMember?.badges || {}) };
  let hasContentUpdates = false;

  for (const key of SNS_KEYS) {
    const previousUrl = cleanUrl(previousMember?.sns?.[key]);
    const currentUrl = cleanUrl(member.sns?.[key]);

    if (!previousUrl && currentUrl) {
      badges[key] = "new";
      hasContentUpdates = true;
    } else if (previousUrl && currentUrl && previousUrl !== currentUrl) {
      badges[key] = "changed";
      hasContentUpdates = true;
    } else if (previousUrl && !currentUrl) {
      delete badges[key];
      hasContentUpdates = true;
    }
  }

  const previousImageSourceUrl = cleanUrl(previousMember?.imageSourceUrl);
  const currentImageSourceUrl = cleanUrl(member.imageSourceUrl);
  const imageChanged = Boolean(previousImageSourceUrl && currentImageSourceUrl && previousImageSourceUrl !== currentImageSourceUrl);

  if (imageChanged) {
    badges.image = "changed";
    hasContentUpdates = true;
  }

  return {
    member: {
      ...member,
      imageUpdatedAt: imageChanged ? checkedAt : previousMember?.imageUpdatedAt || undefined,
      badges,
    },
    hasContentUpdates,
  };
}

async function writeJsonAtomically(data) {
  const temporaryPath = `${DATA_PATH}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, DATA_PATH);
}

function extractMembersFromDom() {
  const socialPatterns = {
    instagram: /instagram\.com/i,
    x: /(x\.com|twitter\.com)/i,
    tiktok: /tiktok\.com/i,
    showroom: /showroom-live\.com/i,
  };

  const anchors = Array.from(document.querySelectorAll("a[href]"));
  const socialAnchors = anchors.filter((anchor) =>
    Object.values(socialPatterns).some((pattern) => pattern.test(anchor.href))
  );

  const candidates = socialAnchors
    .map((anchor) => findMemberContainer(anchor, socialPatterns))
    .filter(Boolean);

  return candidates.map((container) => {
    const links = Array.from(container.querySelectorAll("a[href]"));
    const image = findBestImage(container);

    return {
      name: findBestName(container),
      image,
      sns: {
        instagram: findUrl(links, socialPatterns.instagram),
        x: findUrl(links, socialPatterns.x),
        tiktok: findUrl(links, socialPatterns.tiktok),
        showroom: findUrl(links, socialPatterns.showroom),
      },
      type: "member",
    };
  });

  function findMemberContainer(anchor, patterns) {
    const profileItem = anchor.closest?.(".profileList > li");

    if (profileItem) {
      return profileItem;
    }

    let node = anchor;

    for (let depth = 0; depth < 7 && node; depth += 1) {
      const links = Array.from(node.querySelectorAll?.("a[href]") || []);
      const socialCount = links.filter((link) =>
        Object.values(patterns).some((pattern) => pattern.test(link.href))
      ).length;
      const hasImage = Boolean(node.querySelector?.("img"));
      const text = compactText(node.textContent);

      if (socialCount > 0 && hasImage && text.length >= 2 && text.length <= 120) {
        return node;
      }

      node = node.parentElement;
    }

    return anchor.parentElement;
  }

  function findBestImage(container) {
    const images = Array.from(container.querySelectorAll("img"));
    const styleImage = images
      .map((img) => img.style?.backgroundImage || "")
      .map((value) => value.match(/url\(["']?(.+?)["']?\)/)?.[1] || "")
      .find(Boolean);

    if (styleImage) {
      return new URL(styleImage, location.href).href;
    }

    const image = images.find((img) => {
      const raw = img.currentSrc || img.src || img.dataset.src || "";
      return raw && !/dummy|ico_|icon|svg/i.test(raw);
    });
    const rawUrl = image?.currentSrc || image?.src || image?.dataset.src || "";

    return rawUrl ? new URL(rawUrl, location.href).href : "";
  }

  function findBestName(container) {
    const nameNode = container.querySelector(".name");

    if (nameNode) {
      const clone = nameNode.cloneNode(true);
      clone.querySelectorAll(".yomi").forEach((node) => node.remove());
      const name = compactText(clone.textContent);

      if (isLikelyName(name)) {
        return name;
      }
    }

    const explicit = [
      "[class*='name' i]",
      "[class*='member' i]",
      "h1",
      "h2",
      "h3",
      "p",
      "span",
    ]
      .flatMap((selector) => Array.from(container.querySelectorAll(selector)))
      .map((node) => compactText(node.textContent))
      .find(isLikelyName);

    if (explicit) {
      return explicit;
    }

    const imageAlt = Array.from(container.querySelectorAll("img"))
      .map((img) => compactText(img.alt))
      .find(isLikelyName);

    if (imageAlt) {
      return imageAlt;
    }

    return compactText(container.textContent)
      .replace(/Instagram|TikTok|Twitter|X/g, "")
      .trim();
  }

  function findUrl(links, pattern) {
    const link = links.find((anchor) => pattern.test(anchor.href));
    return link ? link.href : "";
  }

  function compactText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function isLikelyName(value) {
    return Boolean(value && value.length >= 2 && value.length <= 30 && !/Instagram|TikTok|Twitter|follow/i.test(value));
  }
}

async function captureMemberImages(page, members, existingMembersByName, checkedAt) {
  await fs.mkdir(MEMBER_ASSET_DIR, { recursive: true });

  const localized = [];
  const thumbs = page.locator(".profileList > li .thumb");

  for (let index = 0; index < members.length; index += 1) {
    const member = members[index];
    const previousMember = existingMembersByName.get(member.name) || {};
    const previousImage = cleanUrl(previousMember.image);
    const previousImageSourceUrl = cleanUrl(previousMember.imageSourceUrl);
    const currentImageSourceUrl = cleanUrl(member.imageSourceUrl);
    const shouldUpdateImage = !previousImage || Boolean(currentImageSourceUrl && previousImageSourceUrl !== currentImageSourceUrl);
    const localImage = shouldUpdateImage ? await screenshotMemberImage(thumbs.nth(index), member) : previousImage;

    localized.push({
      ...member,
      image: localImage || previousImage || member.imageSourceUrl,
      imageUpdatedAt: shouldUpdateImage && previousImageSourceUrl ? checkedAt : previousMember.imageUpdatedAt,
    });
  }

  return localized;
}

async function screenshotMemberImage(locator, member) {
  const sourceUrl = cleanUrl(member.imageSourceUrl || member.image);
  const source = sourceUrl ? new URL(sourceUrl) : null;
  const slug = source ? slugFromImageUrl(source) : slugFromName(member.name);
  const absolutePath = path.join(MEMBER_ASSET_DIR, `${slug}.png`);
  const relativePath = path.relative(ROOT_DIR, absolutePath).replaceAll(path.sep, "/");

  try {
    await locator.screenshot({ path: absolutePath });
    return relativePath;
  } catch (error) {
    console.warn(`Could not screenshot ${member.name} image: ${error.message}`);
    return downloadMemberImage(member);
  }
}

async function downloadMemberImage(member) {
  const sourceUrl = cleanUrl(member.imageSourceUrl || member.image);

  if (!sourceUrl) {
    return "";
  }

  const source = new URL(sourceUrl);
  const extension = path.extname(source.pathname) || ".jpg";
  const filename = `${slugFromImageUrl(source)}${extension}`;
  const absolutePath = path.join(MEMBER_ASSET_DIR, filename);
  const relativePath = path.relative(ROOT_DIR, absolutePath).replaceAll(path.sep, "/");

  try {
    const response = await fetch(sourceUrl);

    if (!response.ok) {
      throw new Error(`Image returned ${response.status}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());

    if (bytes.length === 0) {
      throw new Error("Image response was empty");
    }

    await fs.writeFile(absolutePath, bytes);
    return relativePath;
  } catch (error) {
    console.warn(`Could not download ${member.name} image: ${error.message}`);
    return "";
  }
}

function slugFromImageUrl(url) {
  return path.basename(url.pathname, path.extname(url.pathname)).replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
}

function slugFromName(name) {
  return cleanText(name)
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "member";
}

function normalizeMember(member) {
  const name = cleanText(member.name);
  const fixedMeta = FIXED_MEMBER_META[name] || {};
  const fixedYoutube = FIXED_YOUTUBE_LINKS[name] || "";
  const imageSourceUrl = cleanUrl(member.image);

  return {
    name,
    image: "",
    imageSourceUrl,
    birthday: fixedMeta.birthday || "",
    birthdayLabel: fixedMeta.birthdayLabel || "",
    memberColors: fixedMeta.memberColors || [],
    memberColorLabels: fixedMeta.memberColorLabels || [],
    sns: {
      instagram: cleanUrl(member.sns?.instagram),
      x: cleanUrl(member.sns?.x),
      tiktok: cleanUrl(member.sns?.tiktok),
      youtube: cleanUrl(member.sns?.youtube || fixedYoutube),
      showroom: cleanUrl(member.sns?.showroom),
    },
    type: "member",
  };
}

function isValidMember(member) {
  return Boolean(member.name && member.imageSourceUrl && hasAnySns(member));
}

function dedupeMembers(members) {
  const seen = new Set();

  return members.filter((member) => {
    const key = member.name;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function hasAnySns(member) {
  return Boolean(member.sns.instagram || member.sns.x || member.sns.tiktok || member.sns.youtube || member.sns.showroom);
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanUrl(value) {
  return String(value || "").trim();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
