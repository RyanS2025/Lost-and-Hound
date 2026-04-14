// ─── Report Status ──────────────────────────────────────────
export const STATUS_CONFIG = {
  pending:   { bg: "#fff3cd", color: "#92400e", border: "#ffc107" },
  reviewed:  { bg: "#dcfce7", color: "#16a34a", border: "#86efac" },
  dismissed: { bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1" },
};
export const STATUS_CONFIG_DARK = {
  pending:   { bg: "#3a2f22", color: "#f6c66a", border: "rgba(245,158,11,0.5)" },
  reviewed:  { bg: "#1f3527", color: "#6ee7b7", border: "rgba(110,231,183,0.42)" },
  dismissed: { bg: "#2c3138", color: "#cbd5e1", border: "rgba(148,163,184,0.45)" },
};

// ─── Listing Importance ─────────────────────────────────────
export const IMPORTANCE_LABELS = { 3: "High", 2: "Medium", 1: "Low" };
export const IMPORTANCE_COLORS = { 3: "#b91c1c", 2: "#a16207", 1: "#1d4ed8" };

// ─── Bug Severity ────────────────────────────────────────────
export const SEVERITY_OPTIONS = [
  { value: "critical", label: "Critical", color: "#b91c1c", bg: "#fef2f2",            border: "#fca5a5" },
  { value: "high",     label: "High",     color: "#dc2626", bg: "#fff1f2",            border: "#fca5a5" },
  { value: "medium",   label: "Medium",   color: "#d97706", bg: "#fffbeb",            border: "#fcd34d" },
  { value: "low",      label: "Low",      color: "#2563eb", bg: "#eff6ff",            border: "#93c5fd" },
];
export const SEVERITY_OPTIONS_DARK = [
  { value: "critical", label: "Critical", color: "#f87171", bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.4)" },
  { value: "high",     label: "High",     color: "#f87171", bg: "rgba(220,38,38,0.12)",  border: "rgba(220,38,38,0.35)" },
  { value: "medium",   label: "Medium",   color: "#fbbf24", bg: "rgba(217,119,6,0.15)",  border: "rgba(217,119,6,0.4)" },
  { value: "low",      label: "Low",      color: "#60a5fa", bg: "rgba(37,99,235,0.15)",  border: "rgba(37,99,235,0.4)" },
];
export const ENVIRONMENT_OPTIONS = ["web", "ios", "android", "all"];
export const EFFORT_OPTIONS = ["xs", "s", "m", "l", "xl"];

// ─── Report Decisions ────────────────────────────────────────
export const DECISION_OPTIONS = [
  { value: "no_violation",       label: "No Violation",      color: "#16a34a", description: "Dismiss report — no action taken" },
  { value: "violation_3",        label: "3 Day Ban",         color: "#f59e0b", description: "Remove content + ban user for 3 days" },
  { value: "violation_30",       label: "30 Day Ban",        color: "#dc2626", description: "Remove content + ban user for 30 days" },
  { value: "violation_permanent",label: "Permanent Ban",     color: "#7f1d1d", description: "Remove content + permanently ban user" },
];
export const STOLEN_DECISION_OPTIONS = [
  { value: "no_violation",       label: "Insufficient Theft Evidence",         color: "#16a34a", description: "Dismiss theft claim and keep content active" },
  { value: "violation_3",        label: "Likely False Claim (3 Day Ban)",      color: "#f59e0b", description: "Remove content and issue a short suspension for suspected false ownership claim" },
  { value: "violation_30",       label: "Confirmed Fraud Claim (30 Day Ban)",  color: "#dc2626", description: "Remove content and apply longer suspension for confirmed fraudulent claim" },
  { value: "violation_permanent",label: "Severe Theft/Fraud (Permanent Ban)",  color: "#7f1d1d", description: "Remove content and permanently ban user for severe theft-related abuse" },
];

// ─── Ticket Status ────────────────────────────────────────────
export const TICKET_STATUS_CONFIG = {
  open:        { label: "Open",        bg: "#fff3cd", color: "#92400e", border: "#ffc107" },
  in_progress: { label: "In Progress", bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" },
  resolved:    { label: "Resolved",    bg: "#dcfce7", color: "#16a34a", border: "#86efac" },
  closed:      { label: "Closed",      bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1" },
};
export const TICKET_STATUS_CONFIG_DARK = {
  open:        { label: "Open",        bg: "#3a2f22", color: "#f6c66a", border: "rgba(245,158,11,0.5)" },
  in_progress: { label: "In Progress", bg: "#1e2a3a", color: "#93c5fd", border: "rgba(147,197,253,0.45)" },
  resolved:    { label: "Resolved",    bg: "#1f3527", color: "#6ee7b7", border: "rgba(110,231,183,0.42)" },
  closed:      { label: "Closed",      bg: "#2c3138", color: "#cbd5e1", border: "rgba(148,163,184,0.45)" },
};

// ─── Helpers ─────────────────────────────────────────────────
export function isStolenReport(report) {
  const reason  = (report?.reason  || "").toLowerCase();
  const details = (report?.details || "").toLowerCase();
  return reason.includes("stolen") || details.includes("stolen")
      || reason.includes("theft")  || details.includes("theft");
}

export function parseCoordinates(coordStr) {
  if (!coordStr || typeof coordStr !== "string") return null;
  const match = coordStr.match(/([\d.]+)°?\s*([NS])\s+([\d.]+)°?\s*([EW])/i);
  if (!match) {
    try {
      const obj = typeof coordStr === "string" ? JSON.parse(coordStr) : coordStr;
      if (obj.lat != null && obj.lng != null) return { lat: Number(obj.lat), lng: Number(obj.lng) };
    } catch { return null; }
    return null;
  }
  let lat = parseFloat(match[1]);
  let lng = parseFloat(match[3]);
  if (match[2].toUpperCase() === "S") lat = -lat;
  if (match[4].toUpperCase() === "W") lng = -lng;
  return { lat, lng };
}
