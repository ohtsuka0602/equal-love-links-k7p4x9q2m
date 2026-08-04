const assert = require("node:assert/strict");
const test = require("node:test");

const {
  collectYoutubeTargets,
  dedupeVideos,
  getChannelDescriptor,
  normalizeYoutubeChannelUrl,
} = require("../scripts/fetch-youtube-videos");

test("collects Morohashi Sana YouTube handle and keeps shared channels deduped", () => {
  const targets = collectYoutubeTargets([
    {
      name: "=LOVE オフィシャル",
      type: "official",
      sns: { youtube: "https://youtube.com/@equallove_?si=abc" },
    },
    {
      name: "佐々木 舞香",
      type: "member",
      sns: { youtube: "https://youtube.com/@ikorabunohutari?si=one" },
    },
    {
      name: "山本 杏奈",
      type: "member",
      sns: { youtube: "https://youtube.com/@ikorabunohutari?si=two" },
    },
    {
      name: "諸橋 沙夏",
      type: "member",
      sns: { youtube: "https://www.youtube.com/@tsunhashigo" },
    },
  ]);

  const morohashi = targets.find((target) => target.memberNames.includes("諸橋 沙夏"));
  const shared = targets.find((target) => target.url === "https://www.youtube.com/@ikorabunohutari");

  assert.equal(morohashi.url, "https://www.youtube.com/@tsunhashigo");
  assert.deepEqual(morohashi.memberNames, ["諸橋 沙夏"]);
  assert.equal(getChannelDescriptor(morohashi).type, "handle");
  assert.equal(getChannelDescriptor(morohashi).value, "tsunhashigo");
  assert.deepEqual(shared.memberNames, ["佐々木 舞香", "山本 杏奈"]);
  assert.equal(targets.length, 3);
});

test("normalizes YouTube handles without keeping tracking query strings", () => {
  assert.equal(
    normalizeYoutubeChannelUrl("https://youtube.com/@tsunhashigo?si=tracking"),
    "https://www.youtube.com/@tsunhashigo"
  );
});

test("dedupes latest videos by video ID", () => {
  const videos = dedupeVideos([
    { videoId: "same", sourceName: "諸橋 沙夏" },
    { videoId: "same", sourceName: "別チャンネル" },
    { videoId: "other", sourceName: "諸橋 沙夏" },
  ]);

  assert.deepEqual(videos.map((video) => video.videoId), ["same", "other"]);
});
