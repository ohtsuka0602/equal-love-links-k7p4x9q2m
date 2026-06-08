const path = require("node:path");
const { fetchOfficialList } = require("./fetch-official-list");

const ROOT_DIR = path.resolve(__dirname, "..");

fetchOfficialList({
  label: "news",
  type: "news",
  rootDir: ROOT_DIR,
  rootKey: "news",
  url: "https://sp.equal-love.jp/news/",
  outputPath: path.join(ROOT_DIR, "data", "news.json"),
  maxItems: 10,
  sort: "desc",
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
