const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { updateChangeHistory } = require("../scripts/update-change-history");

test("initial run creates a baseline without flooding WHAT'S NEW", async () => {
  const workspace = await createWorkspace();
  await writeData(workspace, {
    schedule: [{ title: "Existing schedule", date: "2026-09-10", url: "/schedule/1" }],
    news: [{ title: "Existing news", date: "2026-09-09", url: "/news/1" }],
    videos: [{ videoId: "video-1", title: "Existing video", url: "/watch/1", publishedAt: "2026-09-08T00:00:00.000Z" }],
    profiles: [{ id: "otoshima-risa", name: "音嶋 莉沙", imageSha256: "old-image", image: "old.jpg" }],
  });

  const result = await updateChangeHistory({ rootDir: workspace, now: "2026-09-10T00:00:00.000Z" });

  assert.equal(result.history.length, 0);
  assert.equal(result.meta.baselineCreatedAt, "2026-09-10T00:00:00.000Z");
});

test("added and changed items are recorded once, while checkedAt-only reruns are ignored", async () => {
  const workspace = await createWorkspace();
  await writeData(workspace, {
    schedule: [{ title: "Schedule 1", date: "2026-09-10", url: "/schedule/1" }],
    news: [{ title: "News 1", date: "2026-09-09", url: "/news/1" }],
    videos: [{ videoId: "video-1", title: "Video 1", url: "/watch/1", publishedAt: "2026-09-08T00:00:00.000Z" }],
    profiles: [{ id: "otoshima-risa", name: "音嶋 莉沙", imageSha256: "old-image", image: "old.jpg" }],
  });
  await updateChangeHistory({ rootDir: workspace, now: "2026-09-10T00:00:00.000Z" });

  await writeData(workspace, {
    schedule: [
      { title: "Schedule 1 changed", date: "2026-09-10", url: "/schedule/1" },
      { title: "Schedule 2", date: "2026-09-11", url: "/schedule/2" },
    ],
    news: [
      { title: "News 1", date: "2026-09-09", url: "/news/1" },
      { title: "News 2", date: "2026-09-10", url: "/news/2" },
    ],
    videos: [
      { videoId: "video-1", title: "Video 1", url: "/watch/1", publishedAt: "2026-09-08T00:00:00.000Z" },
      { videoId: "video-2", title: "Video 2", url: "/watch/2", publishedAt: "2026-09-10T00:00:00.000Z" },
    ],
    profiles: [{ id: "otoshima-risa", name: "音嶋 莉沙", imageSha256: "new-image", image: "new.jpg" }],
  });

  const changed = await updateChangeHistory({ rootDir: workspace, now: "2026-09-11T00:00:00.000Z" });
  assert.equal(changed.addedCount, 5);
  assert.equal(changed.history.filter((item) => item.type === "schedule").length, 2);
  assert.equal(changed.history.some((item) => item.type === "profile" && item.changeKinds.includes("image")), true);

  const rerun = await updateChangeHistory({ rootDir: workspace, now: "2026-09-11T01:00:00.000Z" });
  assert.equal(rerun.addedCount, 0);
  assert.equal(rerun.history.length, changed.history.length);
  assert.equal(rerun.meta.updatedAt, "2026-09-11T00:00:00.000Z");
});

test("history is capped and pruned by retention window", async () => {
  const workspace = await createWorkspace();
  await writeData(workspace, { schedule: [], news: [], videos: [], profiles: [] });
  await updateChangeHistory({ rootDir: workspace, now: "2026-09-01T00:00:00.000Z" });

  const existing = {
    meta: { checkedAt: "old", updatedAt: "old", baselineCreatedAt: "old" },
    baseline: { schedule: {}, news: {}, youtube: {}, profiles: {} },
    history: [
      { id: "old", type: "news", action: "added", occurredAt: "2026-07-01T00:00:00.000Z", title: "Old" },
      ...Array.from({ length: 120 }, (_, index) => ({
        id: `recent-${index}`,
        type: "news",
        action: "added",
        occurredAt: "2026-09-01T00:00:00.000Z",
        title: `Recent ${index}`,
      })),
    ],
  };
  await fs.writeFile(path.join(workspace, "data", "change-history.json"), `${JSON.stringify(existing, null, 2)}\n`, "utf8");

  const result = await updateChangeHistory({ rootDir: workspace, now: "2026-09-15T00:00:00.000Z" });
  assert.equal(result.history.length, 100);
  assert.equal(result.history.some((item) => item.id === "old"), false);
});

async function createWorkspace() {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "equal-love-history-"));
  await fs.mkdir(path.join(workspace, "data"), { recursive: true });
  return workspace;
}

async function writeData(workspace, data) {
  await fs.writeFile(
    path.join(workspace, "data", "schedule.json"),
    `${JSON.stringify({ meta: { checkedAt: new Date().toISOString() }, schedule: data.schedule }, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(workspace, "data", "news.json"),
    `${JSON.stringify({ meta: { checkedAt: new Date().toISOString() }, news: data.news }, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(workspace, "data", "youtube-videos.json"),
    `${JSON.stringify({ meta: { checkedAt: new Date().toISOString() }, videos: data.videos }, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(workspace, "data", "member-profiles.json"),
    `${JSON.stringify({ meta: { checkedAt: new Date().toISOString() }, profiles: data.profiles }, null, 2)}\n`,
    "utf8"
  );
}
