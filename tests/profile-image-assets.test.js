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
    assert.match(profile.avatarImage, /^assets\/generated\/profile-avatars\/.+\.jpg$/);

    const avatarPath = path.join(rootDir, profile.avatarImage);
    const avatar = fs.readFileSync(avatarPath);
    const avatarSha256 = crypto.createHash("sha256").update(avatar).digest("hex");

    assert.equal(avatarSha256, profile.avatarImageSha256, `${profile.id} avatar`);
    assert.equal(profile.avatarWidth, "512", `${profile.id} avatar width`);
    assert.equal(profile.avatarHeight, "512", `${profile.id} avatar height`);
  }
});

test("member image rendering uses the shared profile image resolver", () => {
  const app = fs.readFileSync(path.join(rootDir, "app.js"), "utf8");
  const css = fs.readFileSync(path.join(rootDir, "style.css"), "utf8");

  assert.match(app, /function resolveMemberImage/);
  assert.match(app, /function applyProfileImagesToMembers/);
  assert.match(app, /function createMemberImageTag/);
  assert.match(app, /members = applyProfileImagesToMembers/);
  assert.match(app, /displayImage: resolvedImage\.displayImage/);
  assert.match(app, /avatarImage: resolvedImage\.avatarImage/);
  assert.match(app, /profileDisplayImage: resolvedImage\.profileDisplayImage/);
  assert.match(app, /matchedProfile\?\.avatarImage/);
  assert.match(app, /legacyImage: member\.image/);
  assert.match(app, /data-image-role="\$\{role\}"/);
  assert.match(app, /data-fallback-src="\$\{fallbackImage\}"/);
  assert.doesNotMatch(app, /<img class="(?:daily-pick-image|member-image|compact-member-image)" src="\$\{image\}"/);
  assert.doesNotMatch(app, /<img class="member-profile-image" src="\$\{image\}"/);
  assert.match(css, /object-position: var\(--member-image-position, 50% 24%\)/);
});
