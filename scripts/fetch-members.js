const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const PROFILE_URL = "https://sp.equal-love.jp/feature/profile_fs";
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT_DIR, "data", "members.json");
const DEBUG_DIR = path.join(ROOT_DIR, "debug");
const MEMBER_ASSET_DIR = path.join(ROOT_DIR, "assets", "members");
const FIXED_YOUTUBE_LINKS = {
  "=LOVE \u30aa\u30d5\u30a3\u30b7\u30e3\u30eb": "https://youtube.com/@equallove_?si=Gz5sMcLqE722nYoq",
  "\u5927\u8c37 \u6620\u7f8e\u91cc": "https://youtube.com/@mirinyaikolove?si=858PErgfTSsj1ewF",
  "\u4f50\u3005\u6728 \u821e\u9999": "https://youtube.com/@ikorabunohutari?si=86Ox9PoReIfsjT5L",
  "\u5c71\u672c \u674f\u5948": "https://youtube.com/@ikorabunohutari?si=86Ox9PoReIfsjT5L",
};
const OFFICIAL_MEMBER = {
  name: "=LOVE オフィシャル",
  image: "assets/official-love.png",
  sns: {
    instagram: "https://www.instagram.com/equal_love.official?igsh=OWtqdjBnYzJvOXBy",
    x: "https://x.com/equal_love_12?s=21&t=qpSEjRlbXxEJSyu7RsnLCg",
    tiktok: "https://www.tiktok.com/@equal_love_12?_r=1&_t=ZS-970UVFiCfbu",
    youtube: FIXED_YOUTUBE_LINKS["=LOVE \u30aa\u30d5\u30a3\u30b7\u30e3\u30eb"],
  },
  type: "official",
};

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  try {
    await page.goto(PROFILE_URL, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2500);

    await fs.mkdir(DEBUG_DIR, { recursive: true });
    await fs.writeFile(path.join(DEBUG_DIR, "profile.html"), await page.content(), "utf8");
    await page.screenshot({ path: path.join(DEBUG_DIR, "profile.png"), fullPage: true });

    const members = await page.evaluate(extractMembersFromDom);
    const normalizedMembers = members.map(normalizeMember).filter(isValidMember);
    const uniqueMembers = dedupeMembers(normalizedMembers);

    if (uniqueMembers.length === 0) {
      throw new Error("No member data was extracted. Existing members.json was not changed.");
    }

    const localizedMembers = await captureMemberImages(page, uniqueMembers);
    const output = [OFFICIAL_MEMBER, ...localizedMembers];

    await fs.writeFile(DATA_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(`Updated ${path.relative(ROOT_DIR, DATA_PATH)} with ${output.length} records.`);
  } finally {
    await browser.close();
  }
}

function extractMembersFromDom() {
  const socialPatterns = {
    instagram: /instagram\.com/i,
    x: /(x\.com|twitter\.com)/i,
    tiktok: /tiktok\.com/i,
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

async function captureMemberImages(page, members) {
  await fs.mkdir(MEMBER_ASSET_DIR, { recursive: true });

  const localized = [];
  const thumbs = page.locator(".profileList > li .thumb");

  for (let index = 0; index < members.length; index += 1) {
    const member = members[index];
    const localImage = await screenshotMemberImage(thumbs.nth(index), member);
    localized.push({
      ...member,
      image: localImage || member.image,
    });
  }

  return localized;
}

async function screenshotMemberImage(locator, member) {
  const sourceUrl = cleanUrl(member.image);
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
  const sourceUrl = cleanUrl(member.image);

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

  return {
    name,
    image: cleanUrl(member.image),
    sns: {
      instagram: cleanUrl(member.sns?.instagram),
      x: cleanUrl(member.sns?.x),
      tiktok: cleanUrl(member.sns?.tiktok),
      youtube: cleanUrl(member.sns?.youtube || FIXED_YOUTUBE_LINKS[name]),
    },
    type: "member",
  };
}

function isValidMember(member) {
  return Boolean(member.name && member.image && hasAnySns(member));
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
  return Boolean(member.sns.instagram || member.sns.x || member.sns.tiktok);
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
