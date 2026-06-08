const path = require("node:path");
const { fetchOfficialList } = require("./fetch-official-list");

const ROOT_DIR = path.resolve(__dirname, "..");

fetchOfficialList({
  label: "schedule",
  type: "schedule",
  rootDir: ROOT_DIR,
  rootKey: "schedule",
  url: "https://sp.equal-love.jp/schedule/?range=future_event_end_time&sort=asc",
  outputPath: path.join(ROOT_DIR, "data", "schedule.json"),
  maxItems: 10,
  sort: "asc",
  viewport: { width: 1280, height: 900 },
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
