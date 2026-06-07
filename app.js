const memberListEl = document.getElementById("memberList");
const statusEl = document.getElementById("status");
const reloadButton = document.getElementById("reloadButton");
const searchInput = document.getElementById("searchInput");
const filterButtons = document.querySelectorAll(".filter-button");

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
    "\u30d5\u30a3\u30eb\u30bf\u30fc\u3084\u691c\u7d22\u6761\u4ef6\u3092\u5909\u3048\u3066\u307f\u3066\u304f\u3060\u3055\u3044\u3002",
  official: "\u516c\u5f0f",
  member: "\u30e1\u30f3\u30d0\u30fc",
};

let members = [];
let currentFilter = "all";
let searchQuery = "";

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
    renderMembers();
  } catch (error) {
    console.error(error);
    members = [];
    statusEl.textContent = messages.loadFailed;
    memberListEl.innerHTML = `<p class="empty-message">${messages.noData}</p>`;
  } finally {
    setLoading(false);
  }
}

function renderMembers() {
  const filteredMembers = members.filter((member) => {
    const matchesFilter = currentFilter === "all" || Boolean(member.sns?.[currentFilter]);
    const matchesSearch = normalize(member.name).includes(normalize(searchQuery));

    return matchesFilter && matchesSearch && hasAnySns(member);
  });

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
        </div>
        <div class="sns-buttons">
          ${createSnsButtons(member)}
        </div>
      </div>
    </article>
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

function isDisplayableMember(member) {
  return Boolean(member && typeof member.name === "string" && member.name.trim());
}

function hasAnySns(member) {
  return snsOrder.some((key) => Boolean(member.sns?.[key]));
}

function setLoading(isLoading) {
  reloadButton.disabled = isLoading;
  reloadButton.textContent = isLoading ? messages.loading : messages.reload;
}

function normalize(value) {
  return String(value || "").trim().toLocaleLowerCase("ja-JP");
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
    renderMembers();
  });
});

searchInput.addEventListener("input", (event) => {
  searchQuery = event.target.value;
  renderMembers();
});

reloadButton.addEventListener("click", loadMembers);

loadMembers();
