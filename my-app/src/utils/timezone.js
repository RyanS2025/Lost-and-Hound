export const DEFAULT_TIME_ZONE = "America/New_York";

const DAY_IN_MS = 86400000;

const TIME_ZONE_GROUPS = [
  {
    value: "America/New_York",
    label: "Eastern Time",
    description: "ET",
  },
  {
    value: "America/Chicago",
    label: "Central Time",
    description: "CT",
  },
  {
    value: "America/Denver",
    label: "Mountain Time",
    description: "MT",
  },
  {
    value: "America/Los_Angeles",
    label: "Pacific Time",
    description: "PT",
  },
  {
    value: "Europe/London",
    label: "London Time",
    description: "UK",
  },
];

export const TIME_ZONE_OPTIONS = TIME_ZONE_GROUPS;

const VALID_TIME_ZONES = new Set(TIME_ZONE_OPTIONS.map((option) => option.value));
const ISO_WITHOUT_TIME_ZONE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

function formatParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function toDate(value) {
  if (value == null || value === "") return null;

  const normalizedValue =
    typeof value === "string" && ISO_WITHOUT_TIME_ZONE_REGEX.test(value)
      ? `${value}Z`
      : value;

  const date = value instanceof Date ? value : new Date(normalizedValue);
  return isValidDate(date) ? date : null;
}

function dayStamp(date, timeZone) {
  const parts = formatParts(date, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

export function resolveTimeZone(timeZone) {
  return VALID_TIME_ZONES.has(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

export function formatDateTime(value, timeZone) {
  const date = toDate(value);
  if (!date) return "";

  const resolvedTimeZone = resolveTimeZone(timeZone);
  const dateLabel = date.toLocaleDateString("en-US", {
    timeZone: resolvedTimeZone,
    month: "short",
    day: "numeric",
  });
  const timeLabel = date.toLocaleTimeString("en-US", {
    timeZone: resolvedTimeZone,
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dateLabel} at ${timeLabel}`;
}

export function formatCalendarDate(value, timeZone, options = {}) {
  const date = toDate(value);
  if (!date) return "";

  return date.toLocaleDateString("en-US", {
    timeZone: resolveTimeZone(timeZone),
    month: "long",
    day: "numeric",
    year: "numeric",
    ...options,
  });
}

export function formatTime(value, timeZone) {
  const date = toDate(value);
  if (!date) return "";

  return date.toLocaleTimeString("en-US", {
    timeZone: resolveTimeZone(timeZone),
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeDate(value, timeZone, { compact = false } = {}) {
  const date = toDate(value);
  if (!date) return "";

  const resolvedTimeZone = resolveTimeZone(timeZone);
  const diff = Math.floor(
    (dayStamp(new Date(), resolvedTimeZone) - dayStamp(date, resolvedTimeZone)) / DAY_IN_MS
  );

  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return compact ? `${diff}d ago` : `${diff} days ago`;
}