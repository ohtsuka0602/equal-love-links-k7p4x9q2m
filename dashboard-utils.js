(function attachDashboardUtils(root) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const TOKYO_TIME_ZONE = "Asia/Tokyo";

  function getTokyoParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TOKYO_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
      weekday: values.weekday || "",
    };
  }

  function getTokyoDateKey(date = new Date()) {
    const parts = getTokyoParts(date);
    return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  }

  function getTokyoDayStartUtc(date = new Date()) {
    const parts = getTokyoParts(date);
    return Date.UTC(parts.year, parts.month - 1, parts.day);
  }

  function formatTokyoTodayLabel(date = new Date()) {
    const parts = getTokyoParts(date);
    return `${parts.month}.${String(parts.day).padStart(2, "0")} ${parts.weekday.toUpperCase()}`;
  }

  function isSameTokyoDate(value, date = new Date()) {
    if (!value) {
      return false;
    }

    const todayKey = getTokyoDateKey(date);

    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      return value === todayKey;
    }

    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && getTokyoDateKey(parsed) === todayKey;
  }

  function getDaysUntilBirthday(birthday, now = new Date()) {
    const match = String(birthday || "").match(/^(?:\d{4}-)?(\d{2})-(\d{2})$/);

    if (!match) {
      return Number.POSITIVE_INFINITY;
    }

    const today = getTokyoParts(now);
    const todayStart = Date.UTC(today.year, today.month - 1, today.day);
    let nextBirthday = Date.UTC(today.year, Number(match[1]) - 1, Number(match[2]));

    if (nextBirthday < todayStart) {
      nextBirthday = Date.UTC(today.year + 1, Number(match[1]) - 1, Number(match[2]));
    }

    return Math.round((nextBirthday - todayStart) / MS_PER_DAY);
  }

  function getBirthdayLabel(birthday) {
    const match = String(birthday || "").match(/^(?:\d{4}-)?(\d{2})-(\d{2})$/);
    return match ? `${Number(match[1])}.${String(match[2]).padStart(2, "0")}` : "";
  }

  function getNextBirthday(members = [], now = new Date()) {
    return members
      .filter((member) => member?.type === "member" && member.birthday)
      .map((member) => ({ member, daysUntil: getDaysUntilBirthday(member.birthday, now) }))
      .filter((entry) => Number.isFinite(entry.daysUntil))
      .sort((left, right) => left.daysUntil - right.daysUntil)[0] || null;
  }

  function getTodayDashboardData({ scheduleItems = [], youtubeVideos = [], newsItems = [], members = [], now = new Date() }) {
    const todaySchedule = scheduleItems.filter((item) => isSameTokyoDate(item.date, now));
    const todayVideos = youtubeVideos.filter((item) => isSameTokyoDate(item.publishedAt, now));
    const todayNews = newsItems.filter((item) => isSameTokyoDate(item.date || item.publishedAt, now));

    return {
      dateLabel: formatTokyoTodayLabel(now),
      todayKey: getTokyoDateKey(now),
      schedule: todaySchedule,
      videos: todayVideos,
      news: todayNews,
      nextBirthday: getNextBirthday(members, now),
    };
  }

  function getFavoriteDashboardData({ favoriteNames = [], members = [], scheduleItems = [], now = new Date() }) {
    return favoriteNames
      .map((name) => members.find((member) => member?.type === "member" && member.name === name))
      .filter(Boolean)
      .map((member) => ({
        member,
        birthday: {
          daysUntil: getDaysUntilBirthday(member.birthday, now),
          label: getBirthdayLabel(member.birthday),
        },
        nextSchedule: findNextScheduleForMember(member, scheduleItems, now),
      }));
  }

  function findNextScheduleForMember(member, scheduleItems = [], now = new Date()) {
    const name = normalizeSearchText(member?.name || "");

    if (!name) {
      return null;
    }

    const todayKey = getTokyoDateKey(now);

    return scheduleItems
      .filter((item) => !item.date || item.date >= todayKey)
      .filter((item) => normalizeSearchText(item.title || "").includes(name))
      .sort((left, right) => getDateTime(left.date) - getDateTime(right.date))[0] || null;
  }

  function normalizeSearchText(value) {
    return String(value || "").replace(/\s+/g, "").trim();
  }

  function getDateTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
  }

  function normalizeChangeHistoryPayload(data) {
    const history = Array.isArray(data?.history) ? data.history : Array.isArray(data) ? data : [];
    return {
      meta: data?.meta || {},
      history: history
        .filter((item) => item && item.id && item.title)
        .sort((left, right) => getDateTime(right.occurredAt) - getDateTime(left.occurredAt))
        .slice(0, 100),
    };
  }

  const api = {
    TOKYO_TIME_ZONE,
    getTokyoDateKey,
    formatTokyoTodayLabel,
    isSameTokyoDate,
    getDaysUntilBirthday,
    getBirthdayLabel,
    getNextBirthday,
    getTodayDashboardData,
    getFavoriteDashboardData,
    findNextScheduleForMember,
    normalizeChangeHistoryPayload,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.EqualLoveDashboardUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
