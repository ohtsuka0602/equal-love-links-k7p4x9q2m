const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getTokyoDateKey,
  getTodayDashboardData,
  getDaysUntilBirthday,
  getFavoriteDashboardData,
  normalizeChangeHistoryPayload,
} = require("../dashboard-utils");

test("TODAY uses Asia/Tokyo date across UTC day boundary", () => {
  const now = new Date("2026-09-06T15:30:00.000Z");
  assert.equal(getTokyoDateKey(now), "2026-09-07");

  const today = getTodayDashboardData({
    now,
    scheduleItems: [
      { title: "Today live", date: "2026-09-07", url: "/today" },
      { title: "Yesterday live", date: "2026-09-06", url: "/yesterday" },
    ],
    youtubeVideos: [
      { title: "Tokyo morning video", publishedAt: "2026-09-06T15:05:00.000Z", url: "/video" },
      { title: "Previous day video", publishedAt: "2026-09-06T14:59:00.000Z", url: "/old-video" },
    ],
    newsItems: [
      { title: "Today news", date: "2026-09-07", url: "/news" },
      { title: "Old news", date: "2026-09-06", url: "/old-news" },
    ],
    members: [
      { type: "member", name: "A", birthday: "09-07" },
      { type: "member", name: "B", birthday: "01-01" },
    ],
  });

  assert.equal(today.schedule.length, 1);
  assert.equal(today.videos.length, 1);
  assert.equal(today.news.length, 1);
  assert.equal(today.nextBirthday.member.name, "A");
  assert.equal(today.nextBirthday.daysUntil, 0);
});

test("birthday countdown handles year rollover in JST", () => {
  assert.equal(getDaysUntilBirthday("01-01", new Date("2026-12-31T15:01:00.000Z")), 0);
  assert.equal(getDaysUntilBirthday("12-31", new Date("2026-12-31T15:01:00.000Z")), 364);
});

test("MY FAVORITE uses favorite names and only trusts explicit member name schedule matches", () => {
  const members = [
    { type: "member", name: "音嶋 莉沙", birthday: "08-11", memberColorLabels: ["水色", "濃ピンク"], sns: { youtube: "https://example.com" } },
    { type: "member", name: "大谷 映美里", birthday: "03-15", sns: {} },
  ];
  const favorites = getFavoriteDashboardData({
    now: new Date("2026-08-01T00:00:00.000Z"),
    favoriteNames: ["音嶋 莉沙"],
    members,
    scheduleItems: [
      { title: "音嶋莉沙 出演", date: "2026-08-03", url: "/risa" },
      { title: "メンバー出演", date: "2026-08-02", url: "/unknown" },
    ],
  });

  assert.equal(favorites.length, 1);
  assert.equal(favorites[0].member.name, "音嶋 莉沙");
  assert.equal(favorites[0].birthday.daysUntil, 10);
  assert.equal(favorites[0].nextSchedule.url, "/risa");
});

test("change history payload is normalized and capped", () => {
  const payload = normalizeChangeHistoryPayload({
    meta: { checkedAt: "now" },
    history: Array.from({ length: 101 }, (_, index) => ({
      id: `id-${index}`,
      title: `Item ${index}`,
      occurredAt: `2026-09-${String((index % 30) + 1).padStart(2, "0")}T00:00:00.000Z`,
    })),
  });

  assert.equal(payload.meta.checkedAt, "now");
  assert.equal(payload.history.length, 100);
});
