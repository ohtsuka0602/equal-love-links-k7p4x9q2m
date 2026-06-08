const memberListEl = document.getElementById("memberList");
const statusEl = document.getElementById("status");
const reloadButton = document.getElementById("reloadButton");
const dailyPickEl = document.getElementById("dailyPick");
const youtubeVideosEl = document.getElementById("youtubeVideos");
const updatedAtEl = document.getElementById("updatedAt");
const filterButtons = document.querySelectorAll(".filter-button");
const targetButtons = document.querySelectorAll(".target-button");

const favoriteStorageKey = "equalLoveFavoriteMembers";
const dailyPickStartDate = "2026-01-01";
const snsOrder = ["youtube", "instagram", "x", "tiktok", "showroom"];
const snsLabels = {
  instagram: "Instagram",
  x: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
  showroom: "SHOWROOM",
};
const snsIcons = {
  instagram: "assets/sns/instagram.svg",
  x: "assets/sns/x.svg",
  tiktok: "assets/sns/tiktok.svg",
  youtube: "assets/sns/youtube.svg",
  showroom: "assets/sns/showroom.svg",
};
const fixedYoutubeLinks = {
  "=LOVE \u30aa\u30d5\u30a3\u30b7\u30e3\u30eb": "https://youtube.com/@equallove_?si=Gz5sMcLqE722nYoq",
  "\u5927\u8c37 \u6620\u7f8e\u91cc": "https://youtube.com/@mirinyaikolove?si=858PErgfTSsj1ewF",
  "\u4f50\u3005\u6728 \u821e\u9999": "https://youtube.com/@ikorabunohutari?si=86Ox9PoReIfsjT5L",
  "\u5c71\u672c \u674f\u5948": "https://youtube.com/@ikorabunohutari?si=86Ox9PoReIfsjT5L",
};
const fixedMemberMeta = {
  "大谷 映美里": { birthday: "03-15", birthdayLabel: "3月15日", memberColors: ["white", "purple"], memberColorLabels: ["白", "紫"] },
  "大場 花菜": { birthday: "02-04", birthdayLabel: "2月4日", memberColors: ["orange", "blue"], memberColorLabels: ["オレンジ", "青"] },
  "音嶋 莉沙": { birthday: "08-11", birthdayLabel: "8月11日", memberColors: ["light-blue", "pink"], memberColorLabels: ["水色", "濃いピンク"] },
  "齋藤 樹愛羅": { birthday: "11-26", birthdayLabel: "11月26日", memberColors: ["light-pink"], memberColorLabels: ["薄ピンク"] },
  "佐々木 舞香": { birthday: "01-21", birthdayLabel: "1月21日", memberColors: ["white"], memberColorLabels: ["白"] },
  "髙松 瞳": { birthday: "01-19", birthdayLabel: "1月19日", memberColors: ["red"], memberColorLabels: ["赤"] },
  "瀧脇 笙古": { birthday: "07-09", birthdayLabel: "7月9日", memberColors: ["yellow", "orange"], memberColorLabels: ["黄", "オレンジ"] },
  "野口 衣織": { birthday: "04-26", birthdayLabel: "4月26日", memberColors: ["purple"], memberColorLabels: ["紫"] },
  "諸橋 沙夏": { birthday: "08-03", birthdayLabel: "8月3日", memberColors: ["green"], memberColorLabels: ["緑"] },
  "山本 杏奈": { birthday: "11-30", birthdayLabel: "11月30日", memberColors: ["yellow", "blue"], memberColorLabels: ["黄", "青"] },
};
const colorPalette = {
  white: "#fafafa",
  purple: "#8a4fd6",
  orange: "#ff9a28",
  blue: "#2f7df6",
  "light-blue": "#65c9ff",
  pink: "#e84d8a",
  "light-pink": "#f8b8d1",
  red: "#e33445",
  yellow: "#ffd83d",
  green: "#49bf69",
  default: "#f6e8ef",
};

const messages = {
  loading: "\u8aad\u307f\u8fbc\u307f\u4e2d",
  reload: "\u66f4\u65b0",
  loadFailed:
    "\u30c7\u30fc\u30bf\u306e\u8aad\u307f\u8fbc\u307f\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u30ed\u30fc\u30ab\u30eb\u30b5\u30fc\u30d0\u30fc\u7d4c\u7531\u3067\u958b\u3044\u3066\u3044\u308b\u304b\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  noData: "\u8868\u793a\u3067\u304d\u308b\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093\u3002",
  noMatches: "\u6761\u4ef6\u306b\u5408\u3046\u30ea\u30f3\u30af\u306f\u3042\u308a\u307e\u305b\u3093\u3002",
  changeFilters:
    "\u30d5\u30a3\u30eb\u30bf\u30fc\u3092\u5909\u3048\u3066\u307f\u3066\u304f\u3060\u3055\u3044\u3002",
  official: "\u516c\u5f0f",
  favoriteAdd: "\u63a8\u3057\u306b\u767b\u9332",
  favoriteRemove: "\u63a8\u3057\u304b\u3089\u5916\u3059",
  dailyPickTitle: "DAILY PICK",
  dailyPickEmpty:
    "\u8868\u793a\u3067\u304d\u308b\u30e1\u30f3\u30d0\u30fc\u304c\u3044\u307e\u305b\u3093",
  youtubeVideosTitle: "YouTube最新動画",
  youtubeVideosEmpty: "表示できる最新動画がありません",
  youtubeVideosFailed: "最新動画を取得できませんでした",
};
const dailyPickSubtexts = {
  instagram:
    "\u4eca\u65e5\u306f\u3053\u306e\u30e1\u30f3\u30d0\u30fc\u306eInstagram\u3078",
  x: "\u4eca\u65e5\u306f\u3053\u306e\u30e1\u30f3\u30d0\u30fc\u306eX\u3078",
  tiktok:
    "\u4eca\u65e5\u306f\u3053\u306e\u30e1\u30f3\u30d0\u30fc\u306eTikTok\u3078",
  youtube:
    "\u4eca\u65e5\u306f\u3053\u306e\u30e1\u30f3\u30d0\u30fc\u306eYouTube\u3078",
  showroom:
    "\u4eca\u65e5\u306f\u3053\u306e\u30e1\u30f3\u30d0\u30fc\u306eSHOWROOM\u3078",
};

let members = [];
let meta = {};
let youtubeVideos = [];
let youtubeVideosMeta = {};
let youtubeVideosFailed = false;
let favoriteNames = loadFavoriteNames();
let currentFilter = "home";
let favoriteOnly = false;

async function loadMembers() {
  setLoading(true);

  try {
    const response = await fetch(`data/members.json?ts=${Date.now()}`);

    if (!response.ok) {
      throw new Error(`members.json could not be loaded: ${response.status}`);
    }

    const data = await response.json();
    const youtubeData = await loadYoutubeVideos();

    const normalizedData = normalizeMembersPayload(data);
    meta = normalizedData.meta;
    youtubeVideos = youtubeData.videos;
    youtubeVideosMeta = youtubeData.meta;
    youtubeVideosFailed = youtubeData.failed;
    members = normalizedData.members.map(applyFixedData).filter(isDisplayableMember);
    favoriteNames = pruneFavoriteNames(favoriteNames, members);
    saveFavoriteNames();
    renderUpdatedAt();
    render();
  } catch (error) {
    console.error(error);
    members = [];
    meta = {};
    youtubeVideos = [];
    youtubeVideosMeta = {};
    youtubeVideosFailed = false;
    dailyPickEl.innerHTML = "";
    youtubeVideosEl.innerHTML = "";
    youtubeVideosEl.hidden = true;
    updatedAtEl.textContent = "";
    statusEl.textContent = messages.loadFailed;
    memberListEl.innerHTML = `<p class="empty-message">${messages.noData}</p>`;
  } finally {
    setLoading(false);
  }
}

function render() {
  renderDailyPick();
  renderYoutubeVideos();
  renderMembers();
}

async function loadYoutubeVideos() {
  try {
    const response = await fetch(`data/youtube-videos.json?ts=${Date.now()}`);

    if (!response.ok) {
      throw new Error(`youtube-videos.json could not be loaded: ${response.status}`);
    }

    return normalizeYoutubeVideosPayload(await response.json());
  } catch (error) {
    console.warn(error);
    return { meta: {}, videos: [], failed: true };
  }
}

function renderDailyPick() {
  const pick = getDailyPick();

  if (!pick) {
    dailyPickEl.innerHTML = `
      <article class="daily-pick-card daily-pick-empty">
        <div>
          <h2>${messages.dailyPickTitle}</h2>
          <p>${messages.dailyPickEmpty}</p>
        </div>
      </article>
    `;
    return;
  }

  const name = escapeHtml(pick.name);
  const image = escapeHtml(pick.image || "assets/official-love.png");
  const ringStyle = createColorRingStyle(pick);
  const colorLabel = createColorLabel(pick);

  dailyPickEl.innerHTML = `
    <article class="daily-pick-card">
      <div class="daily-pick-copy">
        <h2>${messages.dailyPickTitle}</h2>
        <p>${dailyPickSubtexts[currentFilter]}</p>
      </div>
      <div class="daily-pick-profile">
        <div class="daily-pick-image-wrap color-ring" style="${ringStyle}">
          <img class="daily-pick-image" src="${image}" alt="${name}" loading="lazy" referrerpolicy="no-referrer">
        </div>
        <div class="daily-pick-info">
          <h3>${name}</h3>
          ${colorLabel}
          <div class="sns-buttons">
            ${createSnsButtons(pick)}
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderYoutubeVideos() {
  if (currentFilter !== "youtube") {
    youtubeVideosEl.hidden = true;
    youtubeVideosEl.innerHTML = "";
    return;
  }

  youtubeVideosEl.hidden = false;
  const checkedAt = formatMetaDate(youtubeVideosMeta.checkedAt);
  const metaLine = checkedAt ? `<p class="youtube-videos-meta">動画確認：${checkedAt}</p>` : "";
  const videos = youtubeVideos.slice(0, 5);
  const content = videos.length > 0
    ? `<div class="youtube-video-list">${videos.map(createYoutubeVideoCard).join("")}</div>`
    : `<p class="youtube-videos-empty">${youtubeVideosFailed ? messages.youtubeVideosFailed : messages.youtubeVideosEmpty}</p>`;

  youtubeVideosEl.innerHTML = `
    <section class="youtube-videos-card">
      <div class="youtube-videos-heading">
        <h2>${messages.youtubeVideosTitle}</h2>
        ${metaLine}
      </div>
      ${content}
    </section>
  `;
}

function createYoutubeVideoCard(video) {
  const title = escapeHtml(video.title || "YouTube動画");
  const channelName = escapeHtml(video.channelName || video.sourceName || "YouTube");
  const publishedAt = formatMetaDate(video.publishedAt);
  const thumbnail = escapeHtml(video.thumbnail || "assets/official-love.png");
  const url = escapeHtml(video.url || `https://www.youtube.com/watch?v=${video.videoId || ""}`);

  return `
    <a class="youtube-video-card" href="${url}" target="_blank" rel="noopener noreferrer">
      <span class="youtube-video-thumb">
        <img src="${thumbnail}" alt="" loading="lazy" referrerpolicy="no-referrer">
        <span class="youtube-play-mark" aria-hidden="true"></span>
      </span>
      <span class="youtube-video-body">
        <span class="youtube-video-title">${title}</span>
        <span class="youtube-video-channel">${channelName}</span>
        ${publishedAt ? `<span class="youtube-video-date">${publishedAt}</span>` : ""}
      </span>
    </a>
  `;
}

function renderMembers() {
  const filteredMembers = sortMembersForDisplay(
    members.filter((member) => matchesCurrentFilter(member) && matchesFavoriteOnly(member))
  );
  const targetLabel = favoriteOnly ? "推しだけ" : "全員";
  statusEl.textContent = `${filteredMembers.length}\u4ef6\u3092\u8868\u793a\u4e2d (${snsLabels[currentFilter]} / ${targetLabel})`;

  if (filteredMembers.length === 0) {
    memberListEl.innerHTML = `<p class="empty-message">${messages.changeFilters}</p>`;
    return;
  }

  memberListEl.innerHTML = filteredMembers.map(createMemberCard).join("");
}

function createMemberCard(member) {
  const name = escapeHtml(member.name);
  const typeLabel = member.type === "official" ? `<span class="member-type">${messages.official}</span>` : "";
  const favoriteButton = member.type === "member" ? createFavoriteButton(member) : "";
  const image = escapeHtml(member.image || "assets/official-love.png");
  const cardUrl = member.sns?.[currentFilter] || "";
  const clickableClass = cardUrl ? " is-clickable" : "";
  const ringStyle = createColorRingStyle(member);
  const colorLabel = createColorLabel(member);
  const birthday = createBirthdayLine(member);

  return `
    <article class="member-card${clickableClass}" ${cardUrl ? `data-card-url="${escapeHtml(cardUrl)}"` : ""}>
      <div class="member-image-wrap${ringStyle ? " color-ring" : ""}" ${ringStyle ? `style="${ringStyle}"` : ""}>
        <img class="member-image" src="${image}" alt="${name}" loading="lazy" referrerpolicy="no-referrer">
      </div>

      <div class="member-info">
        <div class="member-heading">
          <h2 class="member-name">${name}</h2>
          ${typeLabel}
          ${favoriteButton}
        </div>
        ${colorLabel}
        ${birthday}
        <div class="sns-buttons">
          ${createSnsButtons(member)}
        </div>
      </div>
    </article>
  `;
}

function createFavoriteButton(member) {
  const isFavorite = favoriteNames.includes(member.name);
  const label = isFavorite ? messages.favoriteRemove : messages.favoriteAdd;

  return `
    <button
      class="favorite-button${isFavorite ? " active" : ""}"
      type="button"
      data-favorite-name="${escapeHtml(member.name)}"
      aria-label="${label}"
      title="${label}"
    >
      ${isFavorite ? "\u2665" : "\u2661"}
    </button>
  `;
}

function createSnsButtons(member) {
  const sns = member.sns || {};

  return snsOrder
    .filter((key) => currentFilter === key)
    .filter((key) => Boolean(sns[key]))
    .map((key) => createSnsButton(snsLabels[key], sns[key], key, member))
    .join("");
}

function createSnsButton(label, url, key, member) {
  return `
    <span class="sns-button-wrap">
    <a
      class="sns-button sns-${key}"
      href="${escapeHtml(url)}"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="${label}"
      title="${label}"
    >
      <img class="sns-icon" src="${snsIcons[key]}" alt="" aria-hidden="true">
      <span class="visually-hidden">${label}</span>
    </a>
    ${createSnsBadge(member, key)}
    </span>
  `;
}

function createSnsBadge(member, key) {
  const status = member.badges?.[key] || "";

  if (status !== "new" && status !== "changed") {
    return "";
  }

  return `<span class="sns-badge">${status === "changed" ? "UPDATED" : "NEW"}</span>`;
}

function createColorRingStyle(member) {
  if (member.type !== "member" || !Array.isArray(member.memberColors) || member.memberColors.length === 0) {
    return "";
  }

  const colors = member.memberColors.map((color) => colorPalette[color] || colorPalette.default);
  const background = colors.length === 1
    ? colors[0]
    : `conic-gradient(${colors[1]} 0deg 180deg, ${colors[0]} 180deg 360deg)`;

  return `--member-ring:${escapeHtml(background)};`;
}

function createColorLabel(member) {
  if (member.type !== "member" || !Array.isArray(member.memberColorLabels) || member.memberColorLabels.length === 0) {
    return "";
  }

  return `<div class="member-color-label">${escapeHtml(member.memberColorLabels.join(" × "))}</div>`;
}

function createBirthdayLine(member) {
  if (member.type !== "member" || !member.birthdayLabel) {
    return "";
  }

  const birthdayBadge = isBirthdayToday(member.birthday) ? `<span class="birthday-badge">HAPPY BIRTHDAY</span>` : "";
  return `<div class="member-meta"><span>誕生日: ${escapeHtml(member.birthdayLabel)}</span>${birthdayBadge}</div>`;
}

function getDailyPick() {
  const candidates = members.filter(
    (member) => member.type === "member" && matchesCurrentFilter(member) && hasAnySns(member)
  );

  if (candidates.length === 0) {
    return null;
  }

  const dayNumber = getDayNumber();
  const cycleNumber = Math.floor(dayNumber / candidates.length);
  const indexInCycle = dayNumber % candidates.length;
  const shuffled = getCycleMembers(candidates, currentFilter, cycleNumber);

  return shuffled[indexInCycle] || null;
}

function getCycleMembers(candidates, filter, cycleNumber) {
  const current = seededShuffle(candidates, `${filter}-${cycleNumber}`);

  if (candidates.length <= 1 || cycleNumber === 0) {
    return current;
  }

  const previous = seededShuffle(candidates, `${filter}-${cycleNumber - 1}`);
  const previousLast = previous[previous.length - 1]?.name;

  if (current[0]?.name !== previousLast) {
    return current;
  }

  const swapIndex = current.findIndex((member) => member.name !== previousLast);

  if (swapIndex > 0) {
    [current[0], current[swapIndex]] = [current[swapIndex], current[0]];
  }

  return current;
}

function seededShuffle(items, seed) {
  const shuffled = [...items];
  let state = hashString(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = nextRandomState(state);
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function hashString(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function nextRandomState(state) {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

function getDayNumber() {
  const today = getLocalDateKey(new Date());
  const start = new Date(`${dailyPickStartDate}T00:00:00`);
  const current = new Date(`${today}T00:00:00`);

  return Math.max(0, Math.floor((current - start) / 86400000));
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function sortMembersForDisplay(displayMembers) {
  return [...displayMembers].sort((left, right) => {
    const leftGroup = getDisplayGroup(left);
    const rightGroup = getDisplayGroup(right);

    if (leftGroup !== rightGroup) {
      return leftGroup - rightGroup;
    }

    return getOriginalIndex(left) - getOriginalIndex(right);
  });
}

function getDisplayGroup(member) {
  if (member.type === "official") {
    return 0;
  }

  return favoriteNames.includes(member.name) ? 1 : 2;
}

function getOriginalIndex(member) {
  return members.findIndex((item) => item.name === member.name);
}

function matchesCurrentFilter(member) {
  return Boolean(member.sns?.[currentFilter]);
}

function matchesFavoriteOnly(member) {
  if (!favoriteOnly) {
    return true;
  }

  return member.type === "member" && favoriteNames.includes(member.name);
}

function normalizeMembersPayload(data) {
  if (Array.isArray(data)) {
    return { members: data, meta: {} };
  }

  if (data && Array.isArray(data.members)) {
    return {
      members: data.members,
      meta: data.meta || {},
    };
  }

  throw new Error("members.json must be an array or { members, meta }");
}

function normalizeYoutubeVideosPayload(data) {
  if (!data || !Array.isArray(data.videos)) {
    return { meta: {}, videos: [], failed: false };
  }

  return {
    meta: data.meta || {},
    videos: data.videos
      .filter((video) => video && (video.url || video.videoId))
      .sort((left, right) => new Date(right.publishedAt || 0) - new Date(left.publishedAt || 0))
      .slice(0, 5),
    failed: false,
  };
}

function applyFixedData(member) {
  const sns = member.sns || {};
  const fixedMeta = fixedMemberMeta[member.name] || {};
  const badges = member.badges || {};
  const fixedYoutube = fixedYoutubeLinks[member.name] || "";

  return {
    ...member,
    birthday: member.birthday || fixedMeta.birthday || "",
    birthdayLabel: member.birthdayLabel || fixedMeta.birthdayLabel || "",
    memberColors: fixedMeta.memberColors || member.memberColors || [],
    memberColorLabels: fixedMeta.memberColorLabels || member.memberColorLabels || [],
    badges: {
      ...badges,
      youtube: badges.youtube || (fixedYoutube && !sns.youtube ? "new" : ""),
    },
    sns: {
      instagram: sns.instagram || "",
      x: sns.x || "",
      tiktok: sns.tiktok || "",
      youtube: sns.youtube || fixedYoutube,
      showroom: sns.showroom || "",
    },
  };
}

function renderUpdatedAt() {
  const checkedAt = formatMetaDate(meta.checkedAt);
  const updatedAt = formatMetaDate(meta.updatedAt);

  if (!checkedAt && !updatedAt) {
    updatedAtEl.textContent = "";
    return;
  }

  const updateBadge = meta.checkedAt && meta.updatedAt && meta.checkedAt === meta.updatedAt
    ? `<span class="data-update-badge">更新あり</span>`
    : "";
  const lines = [
    checkedAt ? `<span>最終確認：${checkedAt}</span>` : "",
    updatedAt ? `<span>データ更新：${updatedAt}${updateBadge}</span>` : "",
  ].filter(Boolean);

  updatedAtEl.innerHTML = lines.join("");
}

function formatMetaDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isBirthdayToday(birthday) {
  if (!birthday) {
    return false;
  }

  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return birthday === `${month}-${day}`;
}

function isDisplayableMember(member) {
  return Boolean(member && typeof member.name === "string" && member.name.trim());
}

function hasAnySns(member) {
  return snsOrder.some((key) => Boolean(member.sns?.[key]));
}

function loadFavoriteNames() {
  try {
    const value = JSON.parse(localStorage.getItem(favoriteStorageKey) || "[]");
    return Array.isArray(value) ? value.filter((name) => typeof name === "string") : [];
  } catch {
    return [];
  }
}

function pruneFavoriteNames(names, currentMembers) {
  const validMemberNames = new Set(
    currentMembers.filter((member) => member.type === "member").map((member) => member.name)
  );

  return names.filter((name, index) => names.indexOf(name) === index && validMemberNames.has(name));
}

function saveFavoriteNames() {
  localStorage.setItem(favoriteStorageKey, JSON.stringify(favoriteNames));
}

function toggleFavorite(name) {
  if (favoriteNames.includes(name)) {
    favoriteNames = favoriteNames.filter((favoriteName) => favoriteName !== name);
  } else {
    favoriteNames = [...favoriteNames, name];
  }

  saveFavoriteNames();
  renderMembers();
}

function setLoading(isLoading) {
  reloadButton.disabled = isLoading;
  reloadButton.textContent = isLoading ? messages.loading : messages.reload;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    currentFilter = button.dataset.filter;
    render();
  });
});

targetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    targetButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    favoriteOnly = button.dataset.target === "favorites";
    renderMembers();
  });
});

memberListEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-favorite-name]");

  if (button) {
    toggleFavorite(button.dataset.favoriteName);
    return;
  }

  if (event.target.closest("a, button")) {
    return;
  }

  const card = event.target.closest("[data-card-url]");

  if (card?.dataset.cardUrl) {
    window.open(card.dataset.cardUrl, "_blank", "noopener,noreferrer");
  }
});

reloadButton.addEventListener("click", loadMembers);

const homeDashboardEl = document.getElementById("homeDashboard");
const targetButtonsEl = document.querySelector(".target-buttons");
const summaryEl = document.querySelector(".summary");

let newsItems = [];
let newsMeta = {};
let newsFailed = false;
let scheduleItems = [];
let scheduleMeta = {};
let scheduleFailed = false;

async function loadMembers() {
  setLoading(true);

  try {
    const response = await fetch(`data/members.json?ts=${Date.now()}`);

    if (!response.ok) {
      throw new Error(`members.json could not be loaded: ${response.status}`);
    }

    const [data, youtubeData, newsData, scheduleData] = await Promise.all([
      response.json(),
      loadYoutubeVideos(),
      loadNews(),
      loadSchedule(),
    ]);

    const normalizedData = normalizeMembersPayload(data);
    meta = normalizedData.meta;
    youtubeVideos = youtubeData.videos;
    youtubeVideosMeta = youtubeData.meta;
    youtubeVideosFailed = youtubeData.failed;
    newsItems = newsData.items;
    newsMeta = newsData.meta;
    newsFailed = newsData.failed;
    scheduleItems = scheduleData.items;
    scheduleMeta = scheduleData.meta;
    scheduleFailed = scheduleData.failed;
    members = normalizedData.members.map(applyFixedData).filter(isDisplayableMember);
    favoriteNames = pruneFavoriteNames(favoriteNames, members);
    saveFavoriteNames();
    renderUpdatedAt();
    render();
  } catch (error) {
    console.error(error);
    members = [];
    meta = {};
    youtubeVideos = [];
    youtubeVideosMeta = {};
    youtubeVideosFailed = false;
    newsItems = [];
    newsMeta = {};
    newsFailed = false;
    scheduleItems = [];
    scheduleMeta = {};
    scheduleFailed = false;
    if (homeDashboardEl) {
      homeDashboardEl.innerHTML = "";
      homeDashboardEl.hidden = true;
    }
    dailyPickEl.innerHTML = "";
    dailyPickEl.hidden = true;
    youtubeVideosEl.innerHTML = "";
    youtubeVideosEl.hidden = true;
    if (summaryEl) {
      summaryEl.hidden = false;
    }
    updatedAtEl.textContent = "";
    statusEl.textContent = messages.loadFailed;
    memberListEl.innerHTML = `<p class="empty-message">${messages.noData}</p>`;
  } finally {
    setLoading(false);
  }
}

async function loadNews() {
  return loadDashboardJson("news.json", normalizeNewsPayload, { meta: {}, items: [] });
}

async function loadSchedule() {
  return loadDashboardJson("schedule.json", normalizeSchedulePayload, { meta: {}, items: [] });
}

async function loadDashboardJson(fileName, normalizer, fallback) {
  try {
    const response = await fetch(`data/${fileName}?ts=${Date.now()}`);

    if (!response.ok) {
      throw new Error(`${fileName} could not be loaded: ${response.status}`);
    }

    return { ...normalizer(await response.json()), failed: false };
  } catch (error) {
    console.warn(error);
    return { ...fallback, failed: true };
  }
}

function render() {
  if (currentFilter === "home") {
    renderHomeDashboard();
    return;
  }

  if (homeDashboardEl) {
    homeDashboardEl.hidden = true;
    homeDashboardEl.innerHTML = "";
  }
  if (targetButtonsEl) {
    targetButtonsEl.hidden = false;
  }
  if (summaryEl) {
    summaryEl.hidden = false;
  }
  dailyPickEl.hidden = false;
  memberListEl.hidden = false;
  renderDailyPick();
  renderYoutubeVideos();
  renderMembers();
}

function renderHomeDashboard() {
  if (!homeDashboardEl) {
    return;
  }

  homeDashboardEl.hidden = false;
  if (targetButtonsEl) {
    targetButtonsEl.hidden = true;
  }
  if (summaryEl) {
    summaryEl.hidden = true;
  }
  dailyPickEl.hidden = true;
  dailyPickEl.innerHTML = "";
  youtubeVideosEl.hidden = true;
  youtubeVideosEl.innerHTML = "";
  memberListEl.hidden = true;
  memberListEl.innerHTML = "";
  statusEl.textContent = "";

  homeDashboardEl.innerHTML = [
    createHomeDailyPickSection(),
    createYoutubeVideosSection(3, { compact: true }),
    createNewsSection(),
    createScheduleSection(),
    createUpcomingBirthdaysSection(),
    createFavoriteMembersSection(),
  ].filter(Boolean).join("");
}

function renderDailyPick() {
  dailyPickEl.hidden = false;
  const pick = getDailyPick();

  if (!pick) {
    dailyPickEl.innerHTML = `
      <article class="daily-pick-card daily-pick-empty">
        <div>
          <h2>${messages.dailyPickTitle}</h2>
          <p>${messages.dailyPickEmpty}</p>
        </div>
      </article>
    `;
    return;
  }

  dailyPickEl.innerHTML = createDailyPickContent(
    pick,
    dailyPickSubtexts[currentFilter] || "今日はこのメンバーへ",
    false
  );
}

function createHomeDailyPickSection() {
  const pick = getHomeDailyPick();

  if (!pick) {
    return `
      <article class="daily-pick-card daily-pick-empty">
        <div>
          <h2>${messages.dailyPickTitle}</h2>
          <p>${messages.dailyPickEmpty}</p>
        </div>
      </article>
    `;
  }

  return createDailyPickContent(pick, "今日はこのメンバーのSNSへ", true);
}

function createDailyPickContent(pick, subtext, showAllSns) {
  const name = escapeHtml(pick.name);
  const image = escapeHtml(pick.image || "assets/official-love.png");
  const ringStyle = createColorRingStyle(pick);
  const colorLabel = createColorLabel(pick);
  const snsButtons = showAllSns ? createAllSnsButtons(pick) : createSnsButtons(pick);

  return `
    <article class="daily-pick-card">
      <div class="daily-pick-copy">
        <h2>${messages.dailyPickTitle}</h2>
        <p>${escapeHtml(subtext)}</p>
      </div>
      <div class="daily-pick-profile">
        <div class="daily-pick-image-wrap color-ring" style="${ringStyle}">
          <img class="daily-pick-image" src="${image}" alt="${name}" loading="lazy" referrerpolicy="no-referrer">
        </div>
        <div class="daily-pick-info">
          <h3>${name}</h3>
          ${colorLabel}
          <div class="sns-buttons${showAllSns ? " compact-sns-buttons" : ""}">
            ${snsButtons}
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderYoutubeVideos() {
  if (currentFilter !== "youtube") {
    youtubeVideosEl.hidden = true;
    youtubeVideosEl.innerHTML = "";
    return;
  }

  youtubeVideosEl.hidden = false;
  youtubeVideosEl.innerHTML = createYoutubeVideosSection(5, { compact: false });
}

function createYoutubeVideosSection(limit, options = {}) {
  const checkedAt = formatMetaDate(youtubeVideosMeta.checkedAt);
  const metaLine = checkedAt ? `<p class="youtube-videos-meta">動画確認：${checkedAt}</p>` : "";
  const videos = youtubeVideos.slice(0, limit);
  const content = videos.length > 0
    ? `<div class="youtube-video-list">${videos.map((video) => createYoutubeVideoCard(video, options)).join("")}</div>`
    : `<p class="youtube-videos-empty">${youtubeVideosFailed ? messages.youtubeVideosFailed : messages.youtubeVideosEmpty}</p>`;

  return `
    <section class="youtube-videos-card${options.compact ? " is-compact" : ""}">
      <div class="youtube-videos-heading">
        <h2>YouTube最新動画</h2>
        ${metaLine}
      </div>
      ${content}
    </section>
  `;
}

function createYoutubeVideoCard(video, options = {}) {
  const title = escapeHtml(video.title || "YouTube動画");
  const channelName = escapeHtml(video.channelName || video.sourceName || "YouTube");
  const publishedAt = formatMetaDate(video.publishedAt);
  const thumbnail = escapeHtml(video.thumbnail || "assets/official-love.png");
  const url = escapeHtml(video.url || `https://www.youtube.com/watch?v=${video.videoId || ""}`);
  const newBadge = isNewVideo(video.publishedAt) ? `<span class="video-new-badge">NEW</span>` : "";

  return `
    <a class="youtube-video-card${options.compact ? " is-compact" : ""}" href="${url}" target="_blank" rel="noopener noreferrer">
      <span class="youtube-video-thumb">
        <img src="${thumbnail}" alt="" loading="lazy" referrerpolicy="no-referrer">
        <span class="youtube-play-mark" aria-hidden="true"></span>
      </span>
      <span class="youtube-video-body">
        <span class="youtube-video-title">${title}${newBadge}</span>
        <span class="youtube-video-channel">${channelName}</span>
        ${publishedAt ? `<span class="youtube-video-date">${publishedAt}</span>` : ""}
      </span>
    </a>
  `;
}

function createNewsSection() {
  const content = newsItems.length > 0
    ? `<div class="dashboard-list">${newsItems.slice(0, 10).map(createNewsItem).join("")}</div>`
    : `<p class="dashboard-empty">${newsFailed ? "ニュースを取得できませんでした" : "最新ニュースはまだありません"}</p>`;

  return createDashboardSection("最新ニュース", content, createDashboardMeta(newsMeta.checkedAt));
}

function createNewsItem(item) {
  const title = escapeHtml(item.title || "ニュース");
  const date = formatDashboardDate(item.date);
  const category = item.category ? `<span class="dashboard-category">${escapeHtml(item.category)}</span>` : "";
  const url = escapeHtml(item.url || "#");

  return `
    <a class="dashboard-list-item" href="${url}" target="_blank" rel="noopener noreferrer">
      <span class="dashboard-item-main">
        <span class="dashboard-item-title">${title}</span>
        <span class="dashboard-item-meta">${[date, item.category ? escapeHtml(item.category) : ""].filter(Boolean).join(" / ")}</span>
      </span>
      ${category}
    </a>
  `;
}

function createScheduleSection() {
  const content = scheduleItems.length > 0
    ? `<div class="dashboard-list">${scheduleItems.slice(0, 10).map(createScheduleItem).join("")}</div>`
    : `<p class="dashboard-empty">${scheduleFailed ? "スケジュールを取得できませんでした" : "今後のスケジュールはまだありません"}</p>`;

  return createDashboardSection("今後のスケジュール", content, createDashboardMeta(scheduleMeta.checkedAt));
}

function createScheduleItem(item) {
  const title = escapeHtml(item.title || "スケジュール");
  const date = formatDashboardDate(item.date);
  const time = item.time ? escapeHtml(item.time) : "";
  const category = item.category ? `<span class="dashboard-category">${escapeHtml(item.category)}</span>` : "";
  const url = escapeHtml(item.url || "#");

  return `
    <a class="dashboard-list-item" href="${url}" target="_blank" rel="noopener noreferrer">
      <span class="dashboard-item-main">
        <span class="dashboard-item-title">${title}</span>
        <span class="dashboard-item-meta">${[date, time, item.category ? escapeHtml(item.category) : ""].filter(Boolean).join(" / ")}</span>
      </span>
      ${category}
    </a>
  `;
}

function createUpcomingBirthdaysSection() {
  const birthdays = getUpcomingBirthdays();

  if (birthdays.length === 0) {
    return "";
  }

  const content = `<div class="compact-member-list">${birthdays.map(createBirthdayMemberCard).join("")}</div>`;
  return createDashboardSection("近日誕生日", content);
}

function createBirthdayMemberCard(entry) {
  const member = entry.member;
  const name = escapeHtml(member.name);
  const image = escapeHtml(member.image || "assets/official-love.png");
  const ringStyle = createColorRingStyle(member);
  const countdown = escapeHtml(createBirthdayCountdownLabel(entry.daysUntil));

  return `
    <article class="compact-member-card">
      <div class="compact-member-image-wrap color-ring" style="${ringStyle}">
        <img class="compact-member-image" src="${image}" alt="${name}" loading="lazy" referrerpolicy="no-referrer">
      </div>
      <div class="compact-member-body">
        <div class="compact-member-heading">
          <h3>${name}</h3>
          <span class="compact-member-badge">${countdown}</span>
        </div>
        <div class="compact-member-meta">${escapeHtml(member.birthdayLabel || member.birthday)}</div>
        <div class="sns-buttons compact-sns-buttons">${createAllSnsButtons(member)}</div>
      </div>
    </article>
  `;
}

function createFavoriteMembersSection() {
  const favoriteMembers = favoriteNames
    .map((name) => members.find((member) => member.name === name && member.type === "member"))
    .filter(Boolean);
  const content = favoriteMembers.length > 0
    ? `<div class="compact-member-list">${favoriteMembers.map(createCompactMemberCard).join("")}</div>`
    : `<p class="dashboard-empty">推しメンバーを登録するとここに表示されます</p>`;

  return createDashboardSection("推しメンバー", content);
}

function createCompactMemberCard(member) {
  const name = escapeHtml(member.name);
  const image = escapeHtml(member.image || "assets/official-love.png");
  const ringStyle = createColorRingStyle(member);
  const colorLabel = createColorLabel(member);

  return `
    <article class="compact-member-card">
      <div class="compact-member-image-wrap color-ring" style="${ringStyle}">
        <img class="compact-member-image" src="${image}" alt="${name}" loading="lazy" referrerpolicy="no-referrer">
      </div>
      <div class="compact-member-body">
        <div class="compact-member-heading">
          <h3>${name}</h3>
          ${createFavoriteButton(member)}
        </div>
        ${colorLabel}
        <div class="sns-buttons compact-sns-buttons">${createAllSnsButtons(member)}</div>
      </div>
    </article>
  `;
}

function createDashboardSection(title, content, metaLine = "") {
  return `
    <section class="dashboard-section">
      <div class="dashboard-heading">
        <h2>${escapeHtml(title)}</h2>
        ${metaLine}
      </div>
      ${content}
    </section>
  `;
}

function createDashboardMeta(value) {
  const formatted = formatMetaDate(value);
  return formatted ? `<p class="dashboard-meta">確認：${formatted}</p>` : "";
}

function createAllSnsButtons(member) {
  const sns = member.sns || {};

  return snsOrder
    .filter((key) => Boolean(sns[key]))
    .map((key) => createSnsButton(snsLabels[key], sns[key], key, member))
    .join("");
}

function createSnsButtons(member) {
  if (currentFilter === "home") {
    return createAllSnsButtons(member);
  }

  const sns = member.sns || {};

  return snsOrder
    .filter((key) => currentFilter === key)
    .filter((key) => Boolean(sns[key]))
    .map((key) => createSnsButton(snsLabels[key], sns[key], key, member))
    .join("");
}

function getDailyPick() {
  const candidates = members.filter(
    (member) => member.type === "member" && matchesCurrentFilter(member) && hasAnySns(member)
  );

  return pickFromCandidates(candidates, currentFilter);
}

function getHomeDailyPick() {
  const candidates = members.filter((member) => member.type === "member" && hasAnySns(member));
  return pickFromCandidates(candidates, "home");
}

function pickFromCandidates(candidates, seedKey) {
  if (candidates.length === 0) {
    return null;
  }

  const dayNumber = getDayNumber();
  const cycleNumber = Math.floor(dayNumber / candidates.length);
  const indexInCycle = dayNumber % candidates.length;
  const shuffled = getCycleMembers(candidates, seedKey, cycleNumber);

  return shuffled[indexInCycle] || null;
}

function matchesCurrentFilter(member) {
  return currentFilter !== "home" && Boolean(member.sns?.[currentFilter]);
}

function normalizeNewsPayload(data) {
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.news)
      ? data.news
      : Array.isArray(data?.items)
        ? data.items
        : [];

  return {
    meta: data?.meta || {},
    items: items
      .filter((item) => item && item.title && item.url)
      .map((item) => ({
        title: String(item.title || "").trim(),
        date: String(item.date || "").trim(),
        url: String(item.url || "").trim(),
        category: String(item.category || "").trim(),
      }))
      .sort((left, right) => getDateTime(right.date) - getDateTime(left.date))
      .slice(0, 10),
  };
}

function normalizeSchedulePayload(data) {
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.schedule)
      ? data.schedule
      : Array.isArray(data?.items)
        ? data.items
        : [];

  return {
    meta: data?.meta || {},
    items: items
      .filter((item) => item && item.title && item.url)
      .map((item) => ({
        title: String(item.title || "").trim(),
        date: String(item.date || "").trim(),
        time: String(item.time || "").trim(),
        url: String(item.url || "").trim(),
        category: String(item.category || "").trim(),
      }))
      .sort((left, right) => getDateTime(left.date) - getDateTime(right.date))
      .slice(0, 10),
  };
}

function getUpcomingBirthdays() {
  return members
    .filter((member) => member.type === "member" && member.birthday)
    .map((member) => ({ member, daysUntil: getDaysUntilBirthday(member.birthday) }))
    .filter((entry) => entry.daysUntil >= 0 && entry.daysUntil <= 30)
    .sort((left, right) => left.daysUntil - right.daysUntil || getOriginalIndex(left.member) - getOriginalIndex(right.member));
}

function getDaysUntilBirthday(birthday) {
  const match = String(birthday).match(/^(\d{2})-(\d{2})$/);

  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let nextBirthday = new Date(now.getFullYear(), Number(match[1]) - 1, Number(match[2]));

  if (nextBirthday < today) {
    nextBirthday = new Date(now.getFullYear() + 1, Number(match[1]) - 1, Number(match[2]));
  }

  return Math.round((nextBirthday - today) / 86400000);
}

function createBirthdayCountdownLabel(daysUntil) {
  if (daysUntil === 0) {
    return "HAPPY BIRTHDAY";
  }

  if (daysUntil === 1) {
    return "明日";
  }

  return `あと${daysUntil}日`;
}

function isNewVideo(value) {
  const publishedAt = new Date(value);

  if (Number.isNaN(publishedAt.getTime())) {
    return false;
  }

  return Date.now() - publishedAt.getTime() <= 48 * 60 * 60 * 1000;
}

function formatDashboardDate(value) {
  if (!value) {
    return "";
  }

  const normalized = String(value).trim();
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(normalized) ? `${normalized}T00:00:00` : normalized);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(normalized);
  }

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function toggleFavorite(name) {
  if (favoriteNames.includes(name)) {
    favoriteNames = favoriteNames.filter((favoriteName) => favoriteName !== name);
  } else {
    favoriteNames = [...favoriteNames, name];
  }

  saveFavoriteNames();
  render();
}

if (homeDashboardEl) {
  homeDashboardEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-favorite-name]");

    if (button) {
      toggleFavorite(button.dataset.favoriteName);
    }
  });
}

loadMembers();
