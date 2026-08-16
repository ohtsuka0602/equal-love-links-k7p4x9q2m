const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");

test("all member profile images are generated assets matching recorded hashes", () => {
  const data = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "member-profiles.json"), "utf8"));
  const profiles = data.profiles.filter((profile) => profile.id && profile.imageSha256);

  assert.equal(profiles.length, 10);

  for (const profile of profiles) {
    assert.match(profile.image, /^assets\/generated\/profile-images\/.+\.jpg$/);

    const imagePath = path.join(rootDir, profile.image);
    const image = fs.readFileSync(imagePath);
    const sha256 = crypto.createHash("sha256").update(image).digest("hex");

    assert.equal(sha256, profile.imageSha256, profile.id);
  }
});

test("member image rendering uses the shared profile image resolver", () => {
  const app = fs.readFileSync(path.join(rootDir, "app.js"), "utf8");

  assert.match(app, /function applyProfileImagesToMembers/);
  assert.match(app, /function createMemberImageTag/);
  assert.match(app, /members = applyProfileImagesToMembers/);
  assert.doesNotMatch(app, /<img class="(?:daily-pick-image|member-image|compact-member-image)" src="\$\{image\}"/);
});
