const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT_DIR = path.resolve(__dirname, "..");
const HISTORY_PATH = path.join(ROOT_DIR, "data", "change-history.json");
const MAX_HISTORY_ITEMS = 100;
const RETENTION_DAYS = 30;

async function main() {
  const result = await updateChangeHistory();
  console.log(`Change history baseline entries: ${Object.keys(result.baseline).length}`);
  console.log(`Change history new entries: ${result.addedCount}`);
  console.log(`Change history retained entries: ${result.history.length}`);
}

async function updateChangeHistory(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const historyPath = options.historyPath || path.join(rootDir, "data", "change-history.json");
  const now = options.now || new Date().toISOString();
  const previous = await readJson(historyPath, null);
  const previousBaseline = previous?.baseline || null;
  const previousHistory = Array.isArray(previous?.history) ? previous.history : [];
  const baseline = await buildCurrentBaseline(rootDir);

  if (!previousBaseline) {
    const output = {
      meta: {
        checkedAt: now,
        updatedAt: previous?.meta?.updatedAt || "",
        baselineCreatedAt: now,
        retentionDays: RETENTION_DAYS,
        maxItems: MAX_HISTORY_ITEMS,
      },
      baseline,
      history: [],
    };
    await writeJsonAtomically(historyPath, output);
    return { ...output, addedCount: 0 };
  }

  const entries = detectChanges(previousBaseline, baseline, now);
  const seenIds = new Set(previousHistory.map((item) => item.id));
  const newEntries = entries.filter((entry) => !seenIds.has(entry.id));
  const history = pruneHistory([...newEntries, ...previousHistory], now);
  const output = {
    meta: {
      ...(previous.meta || {}),
      checkedAt: now,
      updatedAt: newEntries.length > 0 ? now : previous.meta?.updatedAt || "",
      retentionDays: RETENTION_DAYS,
      maxItems: MAX_HISTORY_ITEMS,
    },
    baseline,
    history,
  };

  await writeJsonAtomically(historyPath, output);
  return { ...output, addedCount: newEntries.length };
}

async function buildCurrentBaseline(rootDir) {
  const [schedule, news, youtube, profiles] = await Promise.all([
    readJson(path.join(rootDir, "data", "schedule.json"), { schedule: [] }),
    readJson(path.join(rootDir, "data", "news.json"), { news: [] }),
    readJson(path.join(rootDir, "data", "youtube-videos.json"), { videos: [] }),
    readJson(path.join(rootDir, "data", "member-profiles.json"), { profiles: [] }),
  ]);

  return {
    schedule: buildListBaseline(getItems(schedule, "schedule"), "schedule"),
    news: buildListBaseline(getItems(news, "news"), "news"),
    youtube: buildListBaseline(getItems(youtube, "videos"), "youtube"),
    profiles: buildProfileBaseline(getItems(profiles, "profiles")),
  };
}

function getItems(data, key) {
  if (Array.isArray(data)) {
    return data;
  }

  return Array.isArray(data?.[key]) ? data[key] : [];
}

function buildListBaseline(items, type) {
  return Object.fromEntries(
    items
      .filter((item) => item && getStableKey(item, type))
      .map((item) => {
        const key = getStableKey(item, type);
        const comparable = getComparableListItem(item, type);
        return [key, { hash: hashJson(comparable), item: comparable }];
      })
  );
}

function buildProfileBaseline(profiles) {
  return Object.fromEntries(
    profiles
      .filter((profile) => profile && profile.id)
      .map((profile) => {
        const comparable = {
          id: profile.id || "",
          name: profile.name || "",
          nameEn: profile.nameEn || "",
          profileUrl: profile.profileUrl || "",
          image: profile.image || "",
          imageUrl: profile.imageUrl || "",
          imageSha256: profile.imageSha256 || "",
          avatarImage: profile.avatarImage || "",
          avatarImageSha256: profile.avatarImageSha256 || "",
          birthday: profile.birthday || "",
          birthplace: profile.birthplace || "",
          bloodType: profile.bloodType || "",
          zodiac: profile.zodiac || "",
          height: profile.height || "",
          hobby: profile.hobby || "",
          skill: profile.skill || "",
        };

        return [profile.id, { hash: hashJson(comparable), item: comparable }];
      })
  );
}

function getComparableListItem(item, type) {
  if (type === "youtube") {
    return {
      videoId: item.videoId || "",
      title: item.title || "",
      url: item.url || "",
      thumbnail: item.thumbnail || "",
      publishedAt: item.publishedAt || "",
      channelId: item.channelId || "",
      channelName: item.channelName || "",
      sourceName: item.sourceName || "",
      memberNames: Array.isArray(item.memberNames) ? item.memberNames : [],
    };
  }

  return {
    title: item.title || "",
    date: item.date || "",
    time: item.time || "",
    url: item.url || "",
    category: item.category || "",
  };
}

function detectChanges(previousBaseline, nextBaseline, occurredAt) {
  const entries = [];

  for (const type of ["schedule", "news", "youtube"]) {
    const previousItems = previousBaseline[type] || {};
    const nextItems = nextBaseline[type] || {};

    for (const [key, next] of Object.entries(nextItems)) {
      const previous = previousItems[key];

      if (!previous) {
        entries.push(createHistoryEntry(type, "added", key, next.item, occurredAt));
        continue;
      }

      if (previous.hash !== next.hash) {
        entries.push(createHistoryEntry(type, "changed", key, next.item, occurredAt));
      }
    }
  }

  const previousProfiles = previousBaseline.profiles || {};
  const nextProfiles = nextBaseline.profiles || {};

  for (const [key, next] of Object.entries(nextProfiles)) {
    const previous = previousProfiles[key];

    if (!previous) {
      entries.push(createProfileHistoryEntry("added", key, next.item, occurredAt, ["profile"]));
      continue;
    }

    if (previous.hash !== next.hash) {
      entries.push(createProfileHistoryEntry("changed", key, next.item, occurredAt, getProfileChangeKinds(previous.item, next.item)));
    }
  }

  return entries;
}

function getProfileChangeKinds(previous, next) {
  const kinds = [];
  const imageKeys = ["image", "imageUrl", "imageSha256", "avatarImage", "avatarImageSha256"];

  if (imageKeys.some((key) => previous?.[key] !== next?.[key])) {
    kinds.push("image");
  }

  if (Object.keys(next || {}).some((key) => !imageKeys.includes(key) && previous?.[key] !== next?.[key])) {
    kinds.push("profile");
  }

  return kinds.length > 0 ? kinds : ["profile"];
}

function createHistoryEntry(type, action, key, item, occurredAt) {
  const id = `${type}:${action}:${key}:${hashJson(item).slice(0, 12)}`;
  const labels = {
    schedule: "Schedule",
    news: "NEWS",
    youtube: "YouTube",
  };

  return {
    id,
    type,
    action,
    occurredAt,
    title: item.title || labels[type],
    url: item.url || "",
    date: item.date || item.publishedAt || "",
    category: item.category || "",
    memberNames: item.memberNames || [],
    sourceName: item.sourceName || item.channelName || "",
  };
}

function createProfileHistoryEntry(action, key, item, occurredAt, changeKinds) {
  const id = `profile:${action}:${key}:${hashJson(item).slice(0, 12)}`;
  const imageChanged = changeKinds.includes("image");

  return {
    id,
    type: "profile",
    action,
    occurredAt,
    memberId: item.id || key,
    memberName: item.name || "",
    title: imageChanged ? "プロフィール画像が更新されました" : "プロフィールが更新されました",
    url: item.profileUrl || "",
    changeKinds,
  };
}

function getStableKey(item, type) {
  if (type === "youtube") {
    return item.videoId || item.url || "";
  }

  return item.url || `${item.date || ""}|${item.title || ""}`;
}

function pruneHistory(history, now) {
  const cutoff = new Date(new Date(now).getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000).getTime();
  const seen = new Set();

  return history
    .filter((item) => {
      if (!item?.id || seen.has(item.id)) {
        return false;
      }

      seen.add(item.id);
      const occurredAt = new Date(item.occurredAt || 0).getTime();
      return Number.isNaN(occurredAt) || occurredAt >= cutoff;
    })
    .sort((left, right) => new Date(right.occurredAt || 0) - new Date(left.occurredAt || 0))
    .slice(0, MAX_HISTORY_ITEMS);
}

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
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

async function writeJsonAtomically(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, filePath);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  updateChangeHistory,
  buildCurrentBaseline,
  detectChanges,
  pruneHistory,
  getProfileChangeKinds,
};
