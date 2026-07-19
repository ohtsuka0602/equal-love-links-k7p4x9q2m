const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const { fetchOfficialList } = require("../scripts/fetch-official-list");

const NOW = "2026-07-20T00:00:00+09:00";

test("schedule extraction survives many past items, deduplicates, and keeps the first 10 future items", async () => {
  const workspace = await createWorkspace();
  const outputPath = path.join(workspace, "data", "schedule.json");
  const pastItems = Array.from({ length: 55 }, (_, index) => ({
    day: (index % 19) + 1,
    title: `Past ${String(index + 1).padStart(2, "0")}`,
    url: `/schedule/detail/past-${index + 1}`,
  }));
  const futureItems = makeFutureItems(15);
  const html = makeCalendarHtml([...pastItems, ...futureItems, futureItems[4]]);

  await runFixture(workspace, outputPath, html, "2026-07-20T01:00:00+09:00");

  const output = await readJson(outputPath);
  const summary = await readJson(path.join(workspace, "debug", "schedule-summary.json"));

  assert.equal(summary.rawExtractedCount, 71);
  assert.equal(summary.dateFilteredCount, 16);
  assert.equal(summary.deduplicatedCount, 15);
  assert.equal(summary.finalOutputCount, 10);
  assert.equal(output.schedule.length, 10);
  assert.deepEqual(output.schedule.map((item) => item.title), futureItems.slice(0, 10).map((item) => item.title));
  assert.equal(output.schedule[0].date, "2026-07-20");
  assert.equal(output.schedule[9].date, "2026-07-29");
  assert.equal(output.schedule.filter((item) => item.title === futureItems[4].title).length, 1);
});

test("new earlier future item and changed existing item update output and updatedAt", async () => {
  const workspace = await createWorkspace();
  const outputPath = path.join(workspace, "data", "schedule.json");
  const initialItems = makeFutureItems(10, { startDay: 21 });

  await runFixture(workspace, outputPath, makeCalendarHtml(initialItems), "2026-07-20T01:00:00+09:00");
  const initial = await readJson(outputPath);

  const changed = {
    ...initialItems[1],
    title: "Future 02 changed",
  };
  const added = {
    day: 20,
    title: "New Early Future",
    url: "/schedule/detail/new-early",
  };
  const modifiedItems = [added, initialItems[0], changed, ...initialItems.slice(2)];

  await runFixture(workspace, outputPath, makeCalendarHtml(modifiedItems), "2026-07-20T02:00:00+09:00");
  const output = await readJson(outputPath);

  assert.equal(output.meta.checkedAt, "2026-07-19T17:00:00.000Z");
  assert.equal(output.meta.updatedAt, "2026-07-19T17:00:00.000Z");
  assert.notEqual(output.meta.updatedAt, initial.meta.updatedAt);
  assert.equal(output.schedule[0].title, "New Early Future");
  assert.equal(output.schedule.some((item) => item.title === "Future 02"), false);
  assert.equal(output.schedule.some((item) => item.title === "Future 02 changed"), true);
});

test("unchanged output refreshes checkedAt but preserves updatedAt", async () => {
  const workspace = await createWorkspace();
  const outputPath = path.join(workspace, "data", "schedule.json");
  const html = makeCalendarHtml(makeFutureItems(10));

  await runFixture(workspace, outputPath, html, "2026-07-20T01:00:00+09:00");
  const initial = await readJson(outputPath);

  await runFixture(workspace, outputPath, html, "2026-07-20T03:00:00+09:00");
  const output = await readJson(outputPath);

  assert.equal(output.meta.checkedAt, "2026-07-19T18:00:00.000Z");
  assert.equal(output.meta.updatedAt, initial.meta.updatedAt);
});

test("items beyond the first 10 are extracted but intentionally omitted from final output", async () => {
  const workspace = await createWorkspace();
  const outputPath = path.join(workspace, "data", "schedule.json");

  await runFixture(workspace, outputPath, makeCalendarHtml(makeFutureItems(12)), "2026-07-20T01:00:00+09:00");
  const output = await readJson(outputPath);
  const summary = await readJson(path.join(workspace, "debug", "schedule-summary.json"));

  assert.equal(summary.deduplicatedCount, 12);
  assert.equal(summary.finalOutputCount, 10);
  assert.equal(output.schedule.some((item) => item.title === "Future 11"), false);
  assert.equal(output.schedule.some((item) => item.title === "Future 12"), false);
});

async function createWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), "equal-love-schedule-"));
}

async function runFixture(workspace, outputPath, html, now) {
  const htmlPath = path.join(workspace, "fixture.html");
  await fs.writeFile(htmlPath, html, "utf8");
  await fetchOfficialList({
    label: "schedule",
    type: "schedule",
    rootDir: workspace,
    rootKey: "schedule",
    url: pathToFileURL(htmlPath).href,
    outputPath,
    maxItems: 10,
    sort: "asc",
    now,
    settleTimeout: 0,
  });
}

function makeFutureItems(count, options = {}) {
  const startDay = options.startDay || 20;

  return Array.from({ length: count }, (_, index) => {
    const dayNumber = startDay + index;
    const month = dayNumber <= 31 ? 7 : 8;
    const day = dayNumber <= 31 ? dayNumber : dayNumber - 31;

    return {
      month,
      day,
      title: `Future ${String(index + 1).padStart(2, "0")}`,
      url: `/schedule/detail/future-${index + 1}`,
    };
  });
}

function makeCalendarHtml(items) {
  const july = items.filter((item) => (item.month || 7) === 7);
  const august = items.filter((item) => item.month === 8);

  return `<!doctype html>
<html>
  <body>
    ${makeMonth("2026 7 July", july)}
    ${makeMonth("2026 8 August", august)}
  </body>
</html>`;
}

function makeMonth(label, items) {
  return `<section class="calendar"><h2>${label}</h2>${items.map(makeCell).join("\n")}</section>`;
}

function makeCell(item) {
  const category = item.category || "MEDIA";

  return `<div class="cell">
    ${item.day}
    <a href="${item.url}">
      <span class="tag">${category}</span>
      <span class="title">${item.title}</span>
    </a>
  </div>`;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}
