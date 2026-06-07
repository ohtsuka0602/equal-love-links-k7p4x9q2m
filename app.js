const memberListEl = document.getElementById("memberList");
const statusEl = document.getElementById("status");
const reloadButton = document.getElementById("reloadButton");
const dailyPickEl = document.getElementById("dailyPick");
const filterButtons = document.querySelectorAll(".filter-button");

const favoriteStorageKey = "equalLoveFavoriteMembers";
const dailyPickStartDate = "2026-01-01";
const snsOrder = ["instagram", "x", "tiktok"];
const snsLabels = {
  instagram: "Instagram",
  x: "X",
  tiktok: "TikTok",
};
const snsIcons = {
  instagram: "assets/sns/instagram.svg",
  x: "assets/sns/x.svg",
  tiktok: "assets/sns/tiktok.svg",
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
};
const dailyPickSubtexts = {
  all: "\u4eca\u65e5\u306f\u3053\u306e\u30e1\u30f3\u30d0\u30fc\u306eSNS\u3078",
  instagram:
    "\u4eca\u65e5\u306f\u3053\u306e\u30e1\u30f3\u30d0\u30fc\u306eInstagram\u3078",
  x: "\u4eca\u65e5\u306f\u3053\u306e\u30e1\u30f3\u30d0\u30fc\u306eX\u3078",
  tiktok:
    "\u4eca\u65e5\u306f\u3053\u306e\u30e1\u30f3\u30d0\u30fc\u306eTikTok\u3078",
};

let members = [];
let favoriteNames = loadFavoriteNames();
let currentFilter = "all";

async function loadMembers() {
  setLoading(true);

  try {
    const response = await fetch(`data/members.json?ts=${Date.now()}`);

    if (!response.ok) {
      throw new Error(`members.json could not be loaded: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("members.json must be an array");
    }

    members = data.filter(isDisplayableMember);
    favoriteNames = pruneFavoriteNames(favoriteNames, members);
    saveFavoriteNames();
    render();
  } catch (error) {
    console.error(error);
    members = [];
    dailyPickEl.innerHTML = "";
    statusEl.textContent = messages.loadFailed;
    memberListEl.innerHTML = `<p class="empty-message">${messages.noData}</p>`;
  } finally {
    setLoading(false);
  }
}

function render() {
  renderDailyPick();
  renderMembers();
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

  dailyPickEl.innerHTML = `
    <article class="daily-pick-card">
      <div class="daily-pick-copy">
        <h2>${messages.dailyPickTitle}</h2>
        <p>${dailyPickSubtexts[currentFilter]}</p>
      </div>
      <div class="daily-pick-profile">
        <div class="daily-pick-image-wrap">
          <img class="daily-pick-image" src="${image}" alt="${name}" loading="lazy" referrerpolicy="no-referrer">
        </div>
        <div class="daily-pick-info">
          <h3>${name}</h3>
          <div class="sns-buttons">
            ${createSnsButtons(pick)}
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderMembers() {
  const filteredMembers = sortMembersForDisplay(
    members.filter((member) => matchesCurrentFilter(member) && hasAnySns(member))
  );

  if (filteredMembers.length === 0) {
    statusEl.textContent = messages.noMatches;
    memberListEl.innerHTML = `<p class="empty-message">${messages.changeFilters}</p>`;
    return;
  }

  const filterLabel = currentFilter === "all" ? "All" : snsLabels[currentFilter];
  statusEl.textContent = `${filteredMembers.length}\u4ef6\u3092\u8868\u793a\u4e2d (${filterLabel})`;
  memberListEl.innerHTML = filteredMembers.map(createMemberCard).join("");
}

function createMemberCard(member) {
  const name = escapeHtml(member.name);
  const typeLabel = member.type === "official" ? `<span class="member-type">${messages.official}</span>` : "";
  const favoriteButton = member.type === "member" ? createFavoriteButton(member) : "";
  const image = escapeHtml(member.image || "assets/official-love.png");

  return `
    <article class="member-card">
      <div class="member-image-wrap">
        <img class="member-image" src="${image}" alt="${name}" loading="lazy" referrerpolicy="no-referrer">
      </div>

      <div class="member-info">
        <div class="member-heading">
          <h2 class="member-name">${name}</h2>
          ${typeLabel}
          ${favoriteButton}
        </div>
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
    .filter((key) => currentFilter === "all" || currentFilter === key)
    .filter((key) => Boolean(sns[key]))
    .map((key) => createSnsButton(snsLabels[key], sns[key], key))
    .join("");
}

function createSnsButton(label, url, key) {
  return `
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
  `;
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
  return currentFilter === "all" || Boolean(member.sns?.[currentFilter]);
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

memberListEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-favorite-name]");

  if (!button) {
    return;
  }

  toggleFavorite(button.dataset.favoriteName);
});

reloadButton.addEventListener("click", loadMembers);

loadMembers();
