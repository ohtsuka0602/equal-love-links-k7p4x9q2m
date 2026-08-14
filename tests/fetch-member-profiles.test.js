const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const { fetchMemberProfiles } = require("../scripts/fetch-member-profiles");

test("profile list and detail pages produce joined profile output", async () => {
  const workspace = await createWorkspace();
  await writeMembers(workspace);
  await writeProfiles(workspace, [
    member("otani_emiri", "大谷 映美里", "OTANI EMIRI"),
    member("takamatsu_hitomi", "髙松 瞳", "TAKAMATSU HITOMI", { birthplace: "東京都" }),
  ]);

  const result = await runFixture(workspace, ["otani_emiri", "takamatsu_hitomi"], "2026-07-20T01:00:00+09:00");
  const output = await readJson(path.join(workspace, "data", "member-profiles.json"));

  assert.equal(result.summary.profileLinkCount, 2);
  assert.equal(result.summary.profileSuccessCount, 2);
  assert.equal(output.profiles.length, 2);
  assert.equal(output.profiles[0].id, "otani-emiri");
  assert.equal(output.profiles[0].image, "assets/members/otani_emiri.png");
  assert.equal(output.profiles[0].birthday, "1998-03-15");
  assert.equal(output.profiles[1].name, "髙松 瞳");
});

test("field order changes, empty optional fields, and duplicate list items are handled", async () => {
  const workspace = await createWorkspace();
  await writeMembers(workspace);
  await writeProfiles(workspace, [
    member("saito_kiara", "齋藤 樹愛羅", "SAITO KIARA", {
      hobby: "",
      skill: "",
      fieldOrder: ["身長", "出身地", "生年月日", "星座", "血液型", "趣味", "特技"],
    }),
  ]);

  await runFixture(workspace, ["saito_kiara", "saito_kiara"], "2026-07-20T01:00:00+09:00");
  const output = await readJson(path.join(workspace, "data", "member-profiles.json"));
  const summary = await readJson(path.join(workspace, "debug", "member-profile-summary.json"));

  assert.equal(summary.profileLinkCount, 1);
  assert.equal(output.profiles.length, 1);
  assert.equal(output.profiles[0].name, "齋藤 樹愛羅");
  assert.equal(output.profiles[0].birthplace, "東京都");
  assert.equal("hobby" in output.profiles[0], false);
  assert.equal("skill" in output.profiles[0], false);
});

test("one failed profile keeps the previous per-member data", async () => {
  const workspace = await createWorkspace();
  await writeMembers(workspace);
  await writeExistingProfiles(workspace, [
    profile("otani-emiri", "大谷 映美里", { hobby: "古い趣味" }),
    profile("oba-hana", "大場 花菜", { hobby: "既存の趣味" }),
  ]);
  await writeProfiles(workspace, [member("otani_emiri", "大谷 映美里", "OTANI EMIRI", { hobby: "新しい趣味" })]);

  await runFixture(workspace, ["otani_emiri", "oba_hana"], "2026-07-20T02:00:00+09:00");
  const output = await readJson(path.join(workspace, "data", "member-profiles.json"));

  assert.equal(output.profiles.length, 2);
  assert.equal(output.profiles.find((item) => item.id === "otani-emiri").hobby, "新しい趣味");
  assert.equal(output.profiles.find((item) => item.id === "oba-hana").hobby, "既存の趣味");
});

test("all profile failures preserve existing JSON without updating checkedAt", async () => {
  const workspace = await createWorkspace();
  await writeMembers(workspace);
  await writeExistingProfiles(workspace, [profile("morohashi-sana", "諸橋 沙夏", { checkedAt: "old" })]);

  await runFixture(workspace, ["morohashi_sana"], "2026-07-20T03:00:00+09:00");
  const output = await readJson(path.join(workspace, "data", "member-profiles.json"));

  assert.equal(output.profiles.length, 1);
  assert.equal(output.profiles[0].name, "諸橋 沙夏");
  assert.equal(output.meta.checkedAt, "2026-07-01T00:00:00.000Z");
  assert.equal(output.meta.updatedAt, "2026-07-01T00:00:00.000Z");
  assert.equal(output.meta.lastAttemptAt, "2026-07-19T18:00:00.000Z");
});

test("content changes update updatedAt, unchanged content only updates checkedAt, and new members are detected", async () => {
  const workspace = await createWorkspace();
  await writeMembers(workspace);
  await writeProfiles(workspace, [
    member("otani_emiri", "大谷 映美里", "OTANI EMIRI"),
    member("takiwaki_shoko", "瀧脇 笙古", "TAKIWAKI SHOKO"),
  ]);

  await runFixture(workspace, ["otani_emiri", "takiwaki_shoko"], "2026-07-20T01:00:00+09:00");
  const initial = await readJson(path.join(workspace, "data", "member-profiles.json"));

  await runFixture(workspace, ["otani_emiri", "takiwaki_shoko"], "2026-07-20T02:00:00+09:00");
  const unchanged = await readJson(path.join(workspace, "data", "member-profiles.json"));
  assert.equal(unchanged.meta.checkedAt, "2026-07-19T17:00:00.000Z");
  assert.equal(unchanged.meta.updatedAt, initial.meta.updatedAt);

  await writeProfiles(workspace, [
    member("otani_emiri", "大谷 映美里", "OTANI EMIRI", { height: "156cm" }),
    member("takiwaki_shoko", "瀧脇 笙古", "TAKIWAKI SHOKO"),
    member("yamamoto_anna", "山本 杏奈", "YAMAMOTO ANNA"),
  ]);
  await runFixture(workspace, ["otani_emiri", "takiwaki_shoko", "yamamoto_anna"], "2026-07-20T03:00:00+09:00");
  const changed = await readJson(path.join(workspace, "data", "member-profiles.json"));

  assert.equal(changed.meta.updatedAt, "2026-07-19T18:00:00.000Z");
  assert.equal(changed.profiles.find((item) => item.id === "otani-emiri").height, "156cm");
  assert.equal(changed.profiles.some((item) => item.id === "yamamoto-anna"), true);
});

test("profile image URL changes update output and updatedAt", async () => {
  const workspace = await createWorkspace();
  await writeMembers(workspace);
  await writeExistingProfiles(workspace, [
    profile("otani-emiri", "螟ｧ隹ｷ 譏鄒朱㈹", {
      imageUrl: "https://equal-love.jp/image/profile/otani_emiri_original_old.jpg",
      imageSha256: "old-hash",
      imageVersion: "old-hash",
    }),
  ]);
  await writeProfiles(workspace, [member("otani_emiri", "螟ｧ隹ｷ 譏鄒朱㈹", "OTANI EMIRI")]);

  await runFixture(workspace, ["otani_emiri"], "2026-07-20T04:00:00+09:00", {
    imageMetadataFetcher: imageMetadata("new-image-hash"),
  });
  const output = await readJson(path.join(workspace, "data", "member-profiles.json"));
  const item = output.profiles[0];

  assert.equal(item.imageUrl, "https://equal-love.jp/image/profile/otani_emiri_original.jpg");
  assert.equal(item.imageSha256, "new-image-hash");
  assert.equal(item.imageVersion, "new-image-hash");
  assert.equal(output.meta.updatedAt, "2026-07-19T19:00:00.000Z");
});

test("same profile image URL and hash keep updatedAt unchanged", async () => {
  const workspace = await createWorkspace();
  await writeMembers(workspace);
  await writeExistingProfiles(workspace, [
    profile("otani-emiri", "螟ｧ隹ｷ 譏鄒朱㈹", {
      imageSha256: "same-image-hash",
      imageVersion: "same-image-hash",
      imageContentLength: "100",
      profileUrl: pathToFileURL(path.join(workspace, "feature", "otani_emiri.html")).href,
    }),
  ]);
  await writeProfiles(workspace, [member("otani_emiri", "螟ｧ隹ｷ 譏鄒朱㈹", "OTANI EMIRI")]);

  await runFixture(workspace, ["otani_emiri"], "2026-07-20T05:00:00+09:00", {
    imageMetadataFetcher: imageMetadata("same-image-hash"),
  });
  const output = await readJson(path.join(workspace, "data", "member-profiles.json"));

  assert.equal(output.meta.checkedAt, "2026-07-19T20:00:00.000Z");
  assert.equal(output.meta.updatedAt, "2026-07-01T00:00:00.000Z");
});

test("same profile image URL with changed image hash updates updatedAt", async () => {
  const workspace = await createWorkspace();
  await writeMembers(workspace);
  await writeExistingProfiles(workspace, [
    profile("otani-emiri", "螟ｧ隹ｷ 譏鄒朱㈹", {
      imageSha256: "old-image-hash",
      imageVersion: "old-image-hash",
    }),
  ]);
  await writeProfiles(workspace, [member("otani_emiri", "螟ｧ隹ｷ 譏鄒朱㈹", "OTANI EMIRI")]);

  await runFixture(workspace, ["otani_emiri"], "2026-07-20T06:00:00+09:00", {
    imageMetadataFetcher: imageMetadata("changed-image-hash"),
  });
  const output = await readJson(path.join(workspace, "data", "member-profiles.json"));

  assert.equal(output.profiles[0].imageUrl, "https://equal-love.jp/image/profile/otani_emiri_original.jpg");
  assert.equal(output.profiles[0].imageSha256, "changed-image-hash");
  assert.equal(output.meta.updatedAt, "2026-07-19T21:00:00.000Z");
});

test("profile image metadata failure preserves existing image metadata", async () => {
  const workspace = await createWorkspace();
  await writeMembers(workspace);
  await writeExistingProfiles(workspace, [
    profile("otani-emiri", "螟ｧ隹ｷ 譏鄒朱㈹", {
      imageSha256: "kept-image-hash",
      imageVersion: "kept-image-hash",
      imageContentLength: "12345",
      profileUrl: pathToFileURL(path.join(workspace, "feature", "otani_emiri.html")).href,
    }),
  ]);
  await writeProfiles(workspace, [member("otani_emiri", "螟ｧ隹ｷ 譏鄒朱㈹", "OTANI EMIRI")]);

  await runFixture(workspace, ["otani_emiri"], "2026-07-20T07:00:00+09:00", {
    imageMetadataFetcher: async () => {
      throw new Error("image unavailable");
    },
  });
  const output = await readJson(path.join(workspace, "data", "member-profiles.json"));

  assert.equal(output.profiles[0].imageSha256, "kept-image-hash");
  assert.equal(output.profiles[0].imageVersion, "kept-image-hash");
  assert.equal(output.profiles[0].imageContentLength, "12345");
  assert.equal(output.meta.updatedAt, "2026-07-01T00:00:00.000Z");
});

async function runFixture(workspace, slugs, now, options = {}) {
  const listPath = path.join(workspace, "profile.html");
  await fs.writeFile(listPath, makeListHtml(workspace, slugs), "utf8");

  return fetchMemberProfiles({
    rootDir: workspace,
    sourceUrl: pathToFileURL(listPath).href,
    outputPath: path.join(workspace, "data", "member-profiles.json"),
    membersPath: path.join(workspace, "data", "members.json"),
    debugDir: path.join(workspace, "debug"),
    now,
    settleTimeout: 0,
    ...options,
  });
}

async function createWorkspace() {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "equal-love-profiles-"));
  await fs.mkdir(path.join(workspace, "feature"), { recursive: true });
  await fs.mkdir(path.join(workspace, "data"), { recursive: true });
  return workspace;
}

async function writeMembers(workspace) {
  const members = ["otani_emiri", "takamatsu_hitomi", "saito_kiara", "oba_hana", "morohashi_sana", "takiwaki_shoko", "yamamoto_anna"].map((slug) => ({
    name: nameBySlug(slug),
    type: "member",
    image: `assets/members/${slug}.png`,
    imageSourceUrl: `https://equal-love.jp/image/profile/${slug}.jpg`,
  }));

  await fs.writeFile(path.join(workspace, "data", "members.json"), `${JSON.stringify({ meta: {}, members }, null, 2)}\n`, "utf8");
}

async function writeProfiles(workspace, profiles) {
  for (const item of profiles) {
    await fs.writeFile(path.join(workspace, "feature", `${item.slug}.html`), makeDetailHtml(item), "utf8");
  }
}

async function writeExistingProfiles(workspace, profiles) {
  await fs.writeFile(
    path.join(workspace, "data", "member-profiles.json"),
    `${JSON.stringify({
      meta: {
        checkedAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
      profiles,
    }, null, 2)}\n`,
    "utf8"
  );
}

function makeListHtml(workspace, slugs) {
  return `<!doctype html><html><body><section id="profile"><ul class="profileList">
    ${slugs.map((slug) => {
      const item = member(slug, nameBySlug(slug), romanBySlug(slug));
      const detailPath = pathToFileURL(path.join(workspace, "feature", `${slug}.html`)).href;

      return `<li><a href="${detailPath}"><p class="thumb"><img alt="${item.name}" src="/dummy.png" style="background-image:url(https://equal-love.jp/image/profile/${slug}.jpg);"></p></a><p class="name">${item.name}<span class="yomi">${item.nameEn}</span></p></li>`;
    }).join("")}
  </ul></section></body></html>`;
}

function makeDetailHtml(item) {
  const fieldValues = {
    "血液型": item.bloodType,
    "星座": item.zodiac,
    "身長": item.height,
    "生年月日": item.birthday,
    "出身地": item.birthplace,
    "趣味": item.hobby,
    "特技": item.skill,
  };
  const order = item.fieldOrder || Object.keys(fieldValues);

  return `<!doctype html><html><body><section id="profile"><div class="profDetail">
    <div class="ph"><img src="/dummy.png" alt="${item.name}" style="background-image:url(https://equal-love.jp/image/profile/${item.slug}_original.jpg);"></div>
    <div class="statusArea"><p>${item.name}<span class="name">${item.nameEn}</span></p>
      <dl>${order.map((label) => `<dt>${label}</dt><dd>${fieldValues[label] || ""}</dd>`).join("")}</dl>
    </div>
  </div></section></body></html>`;
}

function member(slug, name, nameEn, overrides = {}) {
  return {
    slug,
    name,
    nameEn,
    birthday: "1998/3/15",
    birthplace: "東京都",
    bloodType: "O型",
    zodiac: "うお座",
    height: "155cm",
    hobby: "メイク",
    skill: "ジョッキ持ち",
    ...overrides,
  };
}

function profile(id, name, overrides = {}) {
  return {
    id,
    name,
    nameEn: romanBySlug(id.replace(/-/g, "_")),
    profileUrl: `https://equal-love.jp/feature/${id.replace(/-/g, "_")}`,
    image: `assets/members/${id.replace(/-/g, "_")}.png`,
    imageUrl: `https://equal-love.jp/image/profile/${id.replace(/-/g, "_")}_original.jpg`,
    birthday: "1998-03-15",
    birthplace: "東京都",
    bloodType: "O型",
    zodiac: "うお座",
    height: "155cm",
    hobby: "メイク",
    skill: "ジョッキ持ち",
    ...overrides,
  };
}

function nameBySlug(slug) {
  return {
    otani_emiri: "大谷 映美里",
    takamatsu_hitomi: "髙松 瞳",
    saito_kiara: "齋藤 樹愛羅",
    oba_hana: "大場 花菜",
    morohashi_sana: "諸橋 沙夏",
    takiwaki_shoko: "瀧脇 笙古",
    yamamoto_anna: "山本 杏奈",
  }[slug] || slug;
}

function romanBySlug(slug) {
  return slug.replace(/_/g, " ").toUpperCase();
}

function imageMetadata(sha256) {
  return async () => ({
    status: 200,
    contentLength: "100",
    etag: "",
    lastModified: "",
    sha256,
  });
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}
