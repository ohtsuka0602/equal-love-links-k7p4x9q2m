const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const MEMBERS_PATH = path.join(ROOT_DIR, "data", "members.json");
const VIDEOS_PATH = path.join(ROOT_DIR, "data", "youtube-videos.json");
const MAX_VIDEOS = 5;
const API_BASE_URL = "https://www.googleapis.com/youtube/v3";

async function main() {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.warn("YOUTUBE_API_KEY is not set. Existing youtube-videos.json was not changed.");
    return;
  }

  const existingData = await readJson(VIDEOS_PATH, { meta: {}, videos: [] });
  const membersData = await readJson(MEMBERS_PATH, { members: [] });
  const members = normalizeMembersPayload(membersData).members;
  const targets = collectYoutubeTargets(members);
  const checkedAt = new Date().toISOString();
  console.log(`YouTube target count: ${targets.length}`);

  if (targets.length === 0) {
    await writeJsonAtomically({
      meta: {
        ...existingData.meta,
        checkedAt,
        updatedAt: hasVideoContentChanged(existingData.videos, []) ? checkedAt : existingData.meta?.updatedAt || checkedAt,
      },
      videos: [],
    });
    console.log("No YouTube channels were found in members.json.");
    return;
  }

  const videos = [];
  let resolvedCount = 0;

  for (const target of targets) {
    try {
      const descriptor = getChannelDescriptor(target);
      console.log(
        `YouTube target: ${target.sourceName} ${descriptor?.type || "unknown"}=${descriptor?.value || ""} ${target.url}`
      );
      const channel = await resolveChannel(target, apiKey);

      if (!channel) {
        console.warn(`Could not resolve YouTube channel: ${target.url}`);
        continue;
      }

      resolvedCount += 1;
      console.log(`Resolved YouTube channel: ${target.sourceName} -> ${channel.title || channel.id} (${channel.id})`);
      const channelVideos = await fetchLatestChannelVideos(channel, target, apiKey);
      console.log(`Fetched YouTube videos: ${target.sourceName} ${channelVideos.length}`);
      videos.push(...channelVideos);
    } catch (error) {
      console.warn(`Could not fetch YouTube videos for ${target.url}: ${error.message}`);
    }
  }

  const latestVideos = dedupeVideos(videos)
    .sort((left, right) => new Date(right.publishedAt || 0) - new Date(left.publishedAt || 0))
    .slice(0, MAX_VIDEOS);
  console.log(`Resolved YouTube channel count: ${resolvedCount}`);
  console.log(`Fetched YouTube video count: ${videos.length}`);
  console.log(`Final YouTube video count: ${latestVideos.length}`);

  if (resolvedCount === 0 && existingData.videos?.length > 0) {
    console.warn("No YouTube channels could be fetched. Existing youtube-videos.json was not changed.");
    return;
  }

  const updatedAt = hasVideoContentChanged(existingData.videos, latestVideos)
    ? checkedAt
    : existingData.meta?.updatedAt || checkedAt;

  await writeJsonAtomically({
    meta: {
      ...existingData.meta,
      checkedAt,
      updatedAt,
    },
    videos: latestVideos,
  });

  console.log(`Updated ${path.relative(ROOT_DIR, VIDEOS_PATH)} with ${latestVideos.length} videos.`);
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

function normalizeMembersPayload(data) {
  if (Array.isArray(data)) {
    return { members: data };
  }

  if (data && Array.isArray(data.members)) {
    return { members: data.members };
  }

  return { members: [] };
}

function collectYoutubeTargets(members) {
  const targetsByUrl = new Map();

  for (const member of members) {
    const url = normalizeYoutubeChannelUrl(member?.sns?.youtube);

    if (!url) {
      continue;
    }

    const existing = targetsByUrl.get(url) || {
      url,
      sourceName: member.name,
      memberNames: [],
    };

    if (member.type !== "official" && member.name && !existing.memberNames.includes(member.name)) {
      existing.memberNames.push(member.name);
    }

    targetsByUrl.set(url, existing);
  }

  return Array.from(targetsByUrl.values());
}

function normalizeYoutubeChannelUrl(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return "";
  }

  try {
    const url = new URL(rawValue);
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "").toLowerCase();

    if (host !== "youtube.com" && host !== "youtu.be") {
      return "";
    }

    const segments = url.pathname.split("/").filter(Boolean);

    if (segments.length === 0) {
      return "";
    }

    const [first, second] = segments;
    const type = first.toLowerCase();

    if (first.startsWith("@")) {
      return `https://www.youtube.com/${first.toLowerCase()}`;
    }

    if ((type === "channel" || type === "user" || type === "c") && second) {
      return `https://www.youtube.com/${type}/${second}`;
    }

    return "";
  } catch {
    return "";
  }
}

function getChannelDescriptor(target) {
  const url = new URL(target.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const [first, second] = segments;

  if (first?.startsWith("@")) {
    return { type: "handle", value: first.slice(1) };
  }

  if (first === "channel" && second) {
    return { type: "id", value: second };
  }

  if (first === "user" && second) {
    return { type: "username", value: second };
  }

  if (first === "c" && second) {
    return { type: "custom", value: second };
  }

  return null;
}

async function resolveChannel(target, apiKey) {
  const descriptor = getChannelDescriptor(target);

  if (!descriptor) {
    return null;
  }

  if (descriptor.type === "id") {
    return fetchChannelByParams({ id: descriptor.value }, apiKey);
  }

  if (descriptor.type === "username") {
    return fetchChannelByParams({ forUsername: descriptor.value }, apiKey);
  }

  if (descriptor.type === "handle") {
    return (
      (await fetchChannelByParams({ forHandle: descriptor.value }, apiKey)) ||
      (await fetchChannelByParams({ forHandle: `@${descriptor.value}` }, apiKey))
    );
  }

  return searchChannel(descriptor.value, apiKey);
}

async function fetchChannelByParams(params, apiKey) {
  const data = await youtubeApiGet("channels", {
    part: "snippet,contentDetails",
    ...params,
    maxResults: "1",
    key: apiKey,
  });
  const item = data.items?.[0];

  if (!item) {
    return null;
  }

  return {
    id: item.id,
    title: item.snippet?.title || "",
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads || "",
  };
}

async function searchChannel(query, apiKey) {
  const data = await youtubeApiGet("search", {
    part: "snippet",
    q: query,
    type: "channel",
    maxResults: "1",
    key: apiKey,
  });
  const item = data.items?.[0];
  const channelId = item?.id?.channelId;

  if (!channelId) {
    return null;
  }

  return fetchChannelByParams({ id: channelId }, apiKey);
}

async function fetchLatestChannelVideos(channel, target, apiKey) {
  if (!channel.uploadsPlaylistId) {
    return [];
  }

  const data = await youtubeApiGet("playlistItems", {
    part: "snippet,contentDetails",
    playlistId: channel.uploadsPlaylistId,
    maxResults: String(MAX_VIDEOS),
    key: apiKey,
  });

  return (data.items || [])
    .map((item) => {
      const videoId = item.contentDetails?.videoId;

      if (!videoId) {
        return null;
      }

      const snippet = item.snippet || {};
      const thumbnail = selectThumbnail(snippet.thumbnails);

      return {
        videoId,
        title: snippet.title || "",
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail,
        publishedAt: item.contentDetails?.videoPublishedAt || snippet.publishedAt || "",
        channelId: channel.id,
        channelName: channel.title || snippet.channelTitle || "",
        sourceName: target.sourceName,
        memberNames: target.memberNames,
      };
    })
    .filter(Boolean);
}

function selectThumbnail(thumbnails) {
  return thumbnails?.maxres?.url || thumbnails?.high?.url || thumbnails?.medium?.url || thumbnails?.default?.url || "";
}

async function youtubeApiGet(endpoint, params) {
  const url = new URL(`${API_BASE_URL}/${endpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url);

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`YouTube API ${endpoint} returned ${response.status}: ${message.slice(0, 200)}`);
  }

  return response.json();
}

function dedupeVideos(videos) {
  const seen = new Set();

  return videos.filter((video) => {
    if (seen.has(video.videoId)) {
      return false;
    }

    seen.add(video.videoId);
    return true;
  });
}

function hasVideoContentChanged(previousVideos = [], nextVideos = []) {
  return JSON.stringify(previousVideos) !== JSON.stringify(nextVideos);
}

async function writeJsonAtomically(data) {
  const temporaryPath = `${VIDEOS_PATH}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, VIDEOS_PATH);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  collectYoutubeTargets,
  normalizeYoutubeChannelUrl,
  getChannelDescriptor,
  dedupeVideos,
};
