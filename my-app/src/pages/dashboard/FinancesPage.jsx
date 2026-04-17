import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../../backend/supabaseClient";
import {
  Box, Typography, Paper, Chip, LinearProgress, CircularProgress,
  Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, IconButton, RadioGroup, FormControlLabel,
  Radio, FormLabel, Switch, ToggleButtonGroup, ToggleButton,
} from "@mui/material";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import CloudIcon from "@mui/icons-material/Cloud";
import EmailIcon from "@mui/icons-material/Email";
import StorageIcon from "@mui/icons-material/Storage";
import DnsIcon from "@mui/icons-material/Dns";
import VisibilityIcon from "@mui/icons-material/Visibility";
import MapIcon from "@mui/icons-material/Map";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import apiFetch from "../../utils/apiFetch";

// ─── Service metadata ──────────────────────────────────────────────────────────
const SERVICE_CONFIG = {
  railway: {
    id: "railway", title: "Railway", billingCycle: "monthly",
    Icon: DnsIcon, color: "#7c3aed",
    description: "Backend API server for Lost & Hound. Handles all database operations, authentication, and business logic.",
    freeTier: "Hobby plan includes $5 free credit/month. Server sleeps after inactivity on free tier.",
    paidInfo: "Hobby: ~$5/mo. Pro: $20/mo. Billed based on CPU, RAM, and network usage.",
    links: [{ label: "Billing dashboard", url: "https://railway.app/account/billing" }],
    fields: ["cost", "plan", "notes"],
    costLabel: "Monthly cost ($)", costHint: "Leave blank to use live API data",
  },
  vision: {
    id: "vision", title: "Google Vision API", billingCycle: "monthly",
    Icon: VisibilityIcon, color: "#0ea5e9",
    description: "Screens every uploaded image for adult, violent, or racy content using SafeSearch before storing it.",
    freeTier: "1,000 SafeSearch calls/month free. Usage is auto-tracked in this dashboard.",
    paidInfo: "$1.50 per 1,000 calls after the free tier.",
    links: [
      { label: "Pricing", url: "https://cloud.google.com/vision/pricing" },
      { label: "Cloud Console", url: "https://console.cloud.google.com/apis/api/vision.googleapis.com/metrics" },
    ],
    fields: ["cost", "notes"],
    costLabel: "Monthly cost override ($)", costHint: "Set only if you've exceeded the free tier",
  },
  mapsWeb: {
    id: "mapsWeb", title: "Google Maps (Web)", billingCycle: "monthly",
    Icon: MapIcon, color: "#ea4335",
    description: "Powers the interactive lost item map on the web app. Renders map tiles and handles location search.",
    freeTier: "28,500 map loads/month free ($200 monthly credit applies).",
    paidInfo: "$7 per 1,000 map loads beyond the free tier.",
    links: [{ label: "Cloud Console", url: "https://console.cloud.google.com/apis/api/maps-backend.googleapis.com/metrics" }],
    fields: ["cost", "notes"],
    costLabel: "Monthly cost override ($)", costHint: "Monitor usage in Cloud Console — check often",
  },
  onesignal: {
    id: "onesignal", title: "OneSignal", billingCycle: "monthly",
    Icon: PhoneIphoneIcon, color: "#e54b4b",
    description: "Push notifications for the iOS app. Sends message alerts to users when they receive a new message.",
    freeTier: "Free: 10,000 push notifications/month.",
    paidInfo: "Growth: $9/mo (100K notifications). Professional: $99/mo (500K).",
    links: [{ label: "Dashboard", url: "https://app.onesignal.com" }],
    fields: ["cost", "notes"],
    costLabel: "Monthly cost override ($)", costHint: "Set only if exceeding 10k free tier",
  },
  mapsIos: {
    id: "mapsIos", title: "Maps SDK for iOS", billingCycle: "monthly",
    Icon: PhoneIphoneIcon, color: "#ea4335",
    description: "Powers the map on the iOS mobile app. Tracks user location and displays nearby lost items.",
    freeTier: "28,500 sessions/month free (shares $200 credit with web Maps).",
    paidInfo: "$7 per 1,000 sessions beyond the free tier.",
    links: [{ label: "Cloud Console", url: "https://console.cloud.google.com/apis/api/maps-ios-backend.googleapis.com/metrics" }],
    fields: ["cost", "notes"],
    costLabel: "Monthly cost override ($)", costHint: "Monitor usage in Cloud Console — check often",
  },
  gemini: {
    id: "gemini", title: "Gemini API", billingCycle: "monthly",
    Icon: AutoAwesomeIcon, color: "#8b5cf6",
    description: "Google's generative AI API used in the Lost & Hound platform.",
    freeTier: "Gemini 2.0 Flash: free within rate limits (15 RPM, 1,500 req/day).",
    paidInfo: "Pay-as-you-go: $0.075 per 1M input tokens, $0.30 per 1M output tokens (Flash).",
    links: [
      { label: "Cloud Console", url: "https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/metrics" },
      { label: "Pricing", url: "https://ai.google.dev/pricing" },
    ],
    fields: ["cost", "notes"],
    costLabel: "Monthly cost override ($)", costHint: "Set only if exceeding free tier",
  },
  supabase: {
    id: "supabase", title: "Supabase", billingCycle: "monthly",
    Icon: StorageIcon, color: "#3ecf8e",
    description: "PostgreSQL database, file storage, and real-time subscriptions. Stores listings, users, messages, tickets, and images.",
    freeTier: "Free: 500MB DB · 1GB storage · 50,000 MAU · 2GB bandwidth.",
    paidInfo: "Pro: $25/mo — 8GB DB, 100GB storage, 500,000 MAU.",
    links: [{ label: "Dashboard", url: "https://supabase.com/dashboard" }],
    fields: ["cost", "plan", "notes"],
    costLabel: "Monthly cost ($)", costHint: "e.g. 25 if on Pro plan",
  },
  resend: {
    id: "resend", title: "Resend", billingCycle: "monthly",
    Icon: EmailIcon, color: "#f59e0b",
    description: "Transactional email for support ticket confirmations and unread message notifications.",
    freeTier: "Free: 100 emails/day · 3,000/month · 1 domain.",
    paidInfo: "Starter: $20/mo (50K emails). Pro: $90/mo (100K emails).",
    links: [{ label: "Dashboard", url: "https://resend.com/overview" }],
    fields: ["cost", "plan", "notes"],
    costLabel: "Monthly cost ($)", costHint: "e.g. 20 if on Starter plan",
  },
  domain: {
    id: "domain", title: "thelostandhound.com", billingCycle: "yearly",
    Icon: CloudIcon, color: "#6366f1",
    description: "Domain registration. Required for the production site and email sending via Resend.",
    freeTier: null,
    paidInfo: "Annual renewal required. Cost depends on your registrar (Namecheap, GoDaddy, etc.).",
    links: [],
    fields: ["cost", "renewalDate", "notes"],
    costLabel: "Annual cost ($)", costHint: "Full yearly cost (e.g. 14)",
  },
};

const SERVICE_ORDER = ["railway", "vision", "onesignal", "mapsWeb", "mapsIos", "gemini", "supabase", "resend", "domain"];

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_OVERRIDES = {
  railway:   { cost: null, plan: "",      renewalDate: null, notes: "" },
  vision:    { cost: null, plan: null,    renewalDate: null, notes: "" },
  onesignal: { cost: null, plan: null,    renewalDate: null, notes: "" },
  mapsWeb:  { cost: null, plan: null,    renewalDate: null, notes: "" },
  mapsIos:  { cost: null, plan: null,    renewalDate: null, notes: "" },
  gemini:   { cost: null, plan: null,    renewalDate: null, notes: "" },
  supabase: { cost: null, plan: "Free",  renewalDate: null, notes: "" },
  resend:   { cost: null, plan: "Free",  renewalDate: null, notes: "" },
  domain:   { cost: 14,   plan: null,    renewalDate: "2026-09-01", notes: "" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}
function fmt(n) { return n == null ? "—" : `$${Number(n).toFixed(2)}`; }

// ─── Sub-components ───────────────────────────────────────────────────────────
function UsageBar({ value, max, label, isDark }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 90 ? "#dc2626" : pct >= 70 ? "#f59e0b" : "#16a34a";
  return (
    <Box sx={{ mt: 1.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="caption" fontWeight={700} sx={{ color }}>{value.toLocaleString()} / {max.toLocaleString()}</Typography>
      </Box>
      <LinearProgress variant="determinate" value={pct} sx={{
        height: 6, borderRadius: 3,
        backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb",
        "& .MuiLinearProgress-bar": { backgroundColor: color, borderRadius: 3 },
      }} />
    </Box>
  );
}

function ServiceCard({ config, badge, cost, children, isDark, onClick }) {
  const { Icon, color, title } = config;
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 2.5, borderRadius: 3, cursor: "pointer",
        borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb",
        background: isDark ? "#1A1A1B" : "#fff",
        transition: "box-shadow 0.15s, border-color 0.15s",
        "&:hover": {
          boxShadow: isDark ? "0 0 0 1px rgba(255,255,255,0.15)" : "0 0 0 1px #d1d5db",
          borderColor: isDark ? "rgba(255,255,255,0.25)" : "#d1d5db",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Icon sx={{ color, fontSize: 20 }} />
        <Typography fontWeight={700} sx={{ flex: 1 }}>{title}</Typography>
        {badge && (
          <Chip label={badge} size="small" sx={{
            fontSize: 10, height: 20, fontWeight: 700,
            background: badge === "Live" ? "rgba(22,163,74,0.15)" : badge === "Check Often" ? "rgba(234,67,53,0.12)" : "rgba(99,102,241,0.15)",
            color: badge === "Live" ? "#16a34a" : badge === "Check Often" ? "#ea4335" : "#6366f1",
          }} />
        )}
        {cost != null && (
          <Typography variant="body2" fontWeight={700} color="text.secondary">{cost}</Typography>
        )}
        <EditIcon sx={{ fontSize: 14, color: "text.disabled" }} />
      </Box>
      {children}
    </Paper>
  );
}


// ─── Service Modal ─────────────────────────────────────────────────────────────
function ServiceModal({ config, override, onSave, onClose, isDark, liveData, railwayData, pushData, showProjected }) {
  const [form, setForm] = useState({ cost: override.cost ?? "", plan: override.plan ?? "", renewalDate: override.renewalDate ?? "", notes: override.notes ?? "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    onSave({
      cost: form.cost === "" ? null : parseFloat(form.cost),
      plan: form.plan || null,
      renewalDate: form.renewalDate || null,
      notes: form.notes,
    });
  };

  const paperSx = { background: isDark ? "#1A1A1B" : "#fff" };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { ...paperSx, borderRadius: 3 } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
        <config.Icon sx={{ color: config.color, fontSize: 22 }} />
        <Typography fontWeight={800} sx={{ flex: 1 }}>{config.title}</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {/* About */}
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>About</Typography>
        <Typography variant="body2" sx={{ mt: 0.5, mb: 1.5 }}>{config.description}</Typography>

        {config.freeTier && (
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 1, borderColor: "rgba(22,163,74,0.3)", background: "rgba(22,163,74,0.05)" }}>
            <Typography variant="caption" fontWeight={700} sx={{ color: "#16a34a" }}>Free tier</Typography>
            <Typography variant="body2" sx={{ mt: 0.25 }}>{config.freeTier}</Typography>
          </Paper>
        )}
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 2, borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb" }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary">Paid tier</Typography>
          <Typography variant="body2" sx={{ mt: 0.25 }}>{config.paidInfo}</Typography>
        </Paper>

        {/* Railway live visual */}
        {railwayData && (() => {
          const CREDIT = 5;
          const usage = showProjected ? (railwayData.estimatedUsage ?? railwayData.currentUsage ?? 0) : (railwayData.currentUsage ?? 0);
          const charge = Math.max(CREDIT, usage);
          const remaining = CREDIT - usage;
          const over = remaining < 0;
          const pct = Math.min((usage / CREDIT) * 100, 100);
          const barColor = over ? "#dc2626" : pct >= 80 ? "#f59e0b" : "#7c3aed";
          return (
            <>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1.5 }}>
                Live billing — {showProjected ? "projected" : "so far this month"}
              </Typography>

              {/* Big stat row */}
              <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                {[
                  { label: "Usage", value: `$${usage.toFixed(2)}`, color: barColor },
                  { label: over ? "Upcharge" : "Credit left", value: over ? `+$${Math.abs(remaining).toFixed(2)}` : `$${remaining.toFixed(2)}`, color: over ? "#dc2626" : "#16a34a" },
                  { label: "Est. charge", value: `$${charge.toFixed(2)}`, color: "text.primary", bold: true },
                ].map(({ label, value, color, bold }) => (
                  <Paper key={label} variant="outlined" sx={{ flex: 1, p: 1.5, borderRadius: 2, textAlign: "center", borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb" }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>{label}</Typography>
                    <Typography variant="h6" fontWeight={bold ? 900 : 700} sx={{ color, fontSize: 18 }}>{value}</Typography>
                  </Paper>
                ))}
              </Box>

              {/* Credit bar */}
              <Box sx={{ mb: 0.75, display: "flex", justifyContent: "space-between" }}>
                <Typography variant="caption" color="text.secondary">$0</Typography>
                <Typography variant="caption" fontWeight={700} sx={{ color: barColor }}>{pct.toFixed(0)}% of $5 credit used</Typography>
                <Typography variant="caption" color="text.secondary">$5</Typography>
              </Box>
              <LinearProgress variant="determinate" value={pct} sx={{
                height: 10, borderRadius: 5, mb: 2,
                backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb",
                "& .MuiLinearProgress-bar": { backgroundColor: barColor, borderRadius: 5 },
              }} />

              {/* Plan + workspace */}
              <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                <Chip label={`${railwayData.plan} plan`} size="small" sx={{ fontWeight: 700, fontSize: 11, background: "rgba(124,58,237,0.12)", color: "#7c3aed" }} />
                <Chip label={railwayData.workspaceName} size="small" sx={{ fontSize: 11, background: isDark ? "rgba(255,255,255,0.07)" : "#f5f5f5" }} />
              </Box>
            </>
          );
        })()}

        {/* Vision live visual */}
        {liveData?.callCount != null && (() => {
          const pct = Math.min((liveData.callCount / liveData.freeLimit) * 100, 100);
          const remaining = liveData.freeLimit - liveData.callCount;
          const barColor = pct >= 90 ? "#dc2626" : pct >= 70 ? "#f59e0b" : "#0ea5e9";
          return (
            <>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1.5 }}>
                Usage — {liveData.month}
              </Typography>

              {/* Big stat row */}
              <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                {[
                  { label: "Calls used", value: liveData.callCount.toLocaleString(), color: barColor },
                  { label: "Remaining", value: remaining.toLocaleString(), color: remaining < 100 ? "#dc2626" : "#16a34a" },
                  { label: "Free limit", value: liveData.freeLimit.toLocaleString(), color: "text.secondary" },
                ].map(({ label, value, color }) => (
                  <Paper key={label} variant="outlined" sx={{ flex: 1, p: 1.5, borderRadius: 2, textAlign: "center", borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb" }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>{label}</Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ color, fontSize: 18 }}>{value}</Typography>
                  </Paper>
                ))}
              </Box>

              {/* Usage bar */}
              <Box sx={{ mb: 0.75, display: "flex", justifyContent: "space-between" }}>
                <Typography variant="caption" color="text.secondary">0 calls</Typography>
                <Typography variant="caption" fontWeight={700} sx={{ color: barColor }}>{pct.toFixed(1)}% of free tier</Typography>
                <Typography variant="caption" color="text.secondary">1,000 calls</Typography>
              </Box>
              <LinearProgress variant="determinate" value={pct} sx={{
                height: 10, borderRadius: 5, mb: 2,
                backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb",
                "& .MuiLinearProgress-bar": { backgroundColor: barColor, borderRadius: 5 },
              }} />
            </>
          );
        })()}

        {/* OneSignal push live visual */}
        {pushData && (() => {
          const pct = Math.min((pushData.sentCount / pushData.freeLimit) * 100, 100);
          const remaining = pushData.freeLimit - pushData.sentCount;
          const barColor = pct >= 90 ? "#dc2626" : pct >= 70 ? "#f59e0b" : "#e54b4b";
          return (
            <>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1.5 }}>
                Usage — {pushData.month}
              </Typography>
              <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                {[
                  { label: "Sent", value: pushData.sentCount.toLocaleString(), color: barColor },
                  { label: "Remaining", value: remaining.toLocaleString(), color: remaining < 500 ? "#dc2626" : "#16a34a" },
                  { label: "Free limit", value: pushData.freeLimit.toLocaleString(), color: "text.secondary" },
                ].map(({ label, value, color }) => (
                  <Paper key={label} variant="outlined" sx={{ flex: 1, p: 1.5, borderRadius: 2, textAlign: "center", borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb" }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>{label}</Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ color, fontSize: 18 }}>{value}</Typography>
                  </Paper>
                ))}
              </Box>
              <Box sx={{ mb: 0.75, display: "flex", justifyContent: "space-between" }}>
                <Typography variant="caption" color="text.secondary">0</Typography>
                <Typography variant="caption" fontWeight={700} sx={{ color: barColor }}>{pct.toFixed(1)}% of free tier</Typography>
                <Typography variant="caption" color="text.secondary">10,000</Typography>
              </Box>
              <LinearProgress variant="determinate" value={pct} sx={{
                height: 10, borderRadius: 5, mb: 2,
                backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb",
                "& .MuiLinearProgress-bar": { backgroundColor: barColor, borderRadius: 5 },
              }} />
            </>
          );
        })()}

        {/* Cost fields */}
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>Your costs</Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
          {config.fields.includes("cost") && (
            <TextField
              label={config.costLabel}
              helperText={config.costHint}
              type="number"
              size="small"
              value={form.cost}
              onChange={set("cost")}
              inputProps={{ min: 0, step: 0.01 }}
              fullWidth
            />
          )}
          {config.fields.includes("plan") && (
            <TextField label="Plan name" size="small" value={form.plan} onChange={set("plan")} placeholder="e.g. Free, Hobby, Pro" fullWidth />
          )}
          {config.fields.includes("renewalDate") && (
            <TextField label="Renewal date" type="date" size="small" value={form.renewalDate} onChange={set("renewalDate")} fullWidth InputLabelProps={{ shrink: true }} />
          )}
          {config.fields.includes("notes") && (
            <TextField label="Notes" size="small" value={form.notes} onChange={set("notes")} multiline rows={2} fullWidth placeholder="e.g. billing date, card on file, account email..." />
          )}
        </Box>

        {/* Links */}
        {config.links.length > 0 && (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 2 }}>
            {config.links.map((l) => (
              <Box key={l.url} component="a" href={l.url} target="_blank" rel="noopener noreferrer"
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: 12, fontWeight: 600, color: config.color, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                {l.label} <OpenInNewIcon sx={{ fontSize: 12 }} />
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} size="small" sx={{ textTransform: "none" }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" size="small" sx={{ textTransform: "none", fontWeight: 700 }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Expense Modal ─────────────────────────────────────────────────────────────
const EMPTY_EXPENSE = { name: "", amount: "", type: "monthly", date: "", notes: "" };

function ExpenseModal({ initial, onSave, onClose, isDark }) {
  const [form, setForm] = useState(initial ?? EMPTY_EXPENSE);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.name.trim() && form.amount !== "" && Number(form.amount) >= 0;

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, background: isDark ? "#1A1A1B" : "#fff" } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", pb: 1 }}>
        <Typography fontWeight={800} sx={{ flex: 1 }}>{initial ? "Edit expense" : "Add expense"}</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField label="Name" size="small" value={form.name} onChange={set("name")} placeholder="e.g. Design assets, Server upgrade" fullWidth required />
          <TextField label="Amount ($)" type="number" size="small" value={form.amount} onChange={set("amount")} inputProps={{ min: 0, step: 0.01 }} fullWidth required />

          <Box>
            <FormLabel sx={{ fontSize: 12, fontWeight: 700 }}>Frequency</FormLabel>
            <RadioGroup row value={form.type} onChange={set("type")} sx={{ mt: 0.5 }}>
              <FormControlLabel value="monthly"  control={<Radio size="small" />} label={<Typography variant="body2">Monthly</Typography>} />
              <FormControlLabel value="yearly"   control={<Radio size="small" />} label={<Typography variant="body2">Yearly</Typography>} />
              <FormControlLabel value="one-time" control={<Radio size="small" />} label={<Typography variant="body2">One-time</Typography>} />
            </RadioGroup>
          </Box>

          {form.type === "one-time" && (
            <TextField label="Date" type="date" size="small" value={form.date} onChange={set("date")} fullWidth InputLabelProps={{ shrink: true }} />
          )}

          <TextField label="Notes" size="small" value={form.notes} onChange={set("notes")} multiline rows={2} fullWidth placeholder="Optional context..." />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} size="small" sx={{ textTransform: "none" }}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={!valid} variant="contained" size="small" sx={{ textTransform: "none", fontWeight: 700 }}>
          {initial ? "Update" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Breakdown Modal ───────────────────────────────────────────────────────────
function BreakdownModal({ onClose, isDark, getServiceMonthly, getServiceYearly, expenses, setExpenseModal, deleteExpense, totalMonthly, totalYearly, onetimeTotal, showProjected, setShowProjected }) {
  const border = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";

  const Section = ({ title, children }) => (
    <Box sx={{ mb: 3 }}>
      <Typography variant="caption" fontWeight={800} sx={{ textTransform: "uppercase", letterSpacing: 0.8, color: "text.secondary", display: "block", mb: 1 }}>{title}</Typography>
      <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: border, overflow: "hidden", background: isDark ? "#111" : "#fafafa" }}>
        {children}
      </Paper>
    </Box>
  );

  const Row = ({ label, value, bold, muted, note }) => (
    <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 1, borderBottom: `1px solid ${border}`, "&:last-child": { borderBottom: "none" }, background: bold ? (isDark ? "rgba(22,163,74,0.06)" : "rgba(22,163,74,0.04)") : "transparent" }}>
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" fontWeight={bold ? 800 : 400} color={muted ? "text.disabled" : "text.primary"}>{label}</Typography>
        {note && <Typography variant="caption" color="text.disabled">{note}</Typography>}
      </Box>
      <Typography variant="body2" fontWeight={bold ? 800 : 500} sx={{ color: bold ? "#16a34a" : muted ? "text.disabled" : "text.primary" }}>{value}</Typography>
    </Box>
  );

  const monthlyServices = SERVICE_ORDER.filter((id) => SERVICE_CONFIG[id].billingCycle === "monthly" && getServiceMonthly(id) > 0);
  const monthlyExpenses = expenses.filter((e) => e.type === "monthly");
  const yearlyServices  = SERVICE_ORDER.filter((id) => SERVICE_CONFIG[id].billingCycle === "yearly" && getServiceYearly(id) > 0);
  const yearlyExpenses  = expenses.filter((e) => e.type === "yearly");
  const onetimeExpenses = expenses.filter((e) => e.type === "one-time");

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, background: isDark ? "#1A1A1B" : "#fff" } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
        <AttachMoneyIcon sx={{ color: "#16a34a", fontSize: 22 }} />
        <Typography fontWeight={800} sx={{ flex: 1 }}>Cost Breakdown</Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={showProjected ? "projected" : "actual"}
          onChange={(_, v) => { if (v) setShowProjected(v === "projected"); }}
          sx={{ "& .MuiToggleButton-root": { py: 0.25, px: 1.25, fontSize: 11, textTransform: "none" } }}
        >
          <ToggleButton value="projected">Projected</ToggleButton>
          <ToggleButton value="actual">Actual</ToggleButton>
        </ToggleButtonGroup>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>

        {/* Monthly recurring */}
        <Section title="Monthly recurring">
          {monthlyServices.map((id) => (
            <Row key={id} label={SERVICE_CONFIG[id].title} value={`$${getServiceMonthly(id).toFixed(2)}/mo`} />
          ))}
          {monthlyExpenses.map((e) => (
            <Box key={e.id} sx={{ display: "flex", alignItems: "center", px: 2, py: 1, borderBottom: `1px solid ${border}` }}>
              <Typography variant="body2" sx={{ flex: 1 }}>{e.name}</Typography>
              <Typography variant="body2" fontWeight={500}>${e.amount.toFixed(2)}/mo</Typography>
              <IconButton size="small" onClick={() => setExpenseModal(e)} sx={{ ml: 0.5, p: 0.5 }}><EditIcon sx={{ fontSize: 13 }} /></IconButton>
              <IconButton size="small" onClick={() => deleteExpense(e.id)} sx={{ p: 0.5 }}><DeleteIcon sx={{ fontSize: 13, color: "#dc2626" }} /></IconButton>
            </Box>
          ))}
          {monthlyServices.length === 0 && monthlyExpenses.length === 0 && (
            <Row label="No monthly costs" value="" muted />
          )}
          <Row label="Subtotal" value={`$${(SERVICE_ORDER.reduce((s, id) => s + getServiceMonthly(id), 0) + monthlyExpenses.reduce((s, e) => s + e.amount, 0)).toFixed(2)}/mo`} bold />
        </Section>

        {/* Annual */}
        <Section title="Annual / yearly">
          {yearlyServices.map((id) => (
            <Row key={id} label={SERVICE_CONFIG[id].title} value={`$${getServiceYearly(id).toFixed(2)}/yr`} note={`$${getServiceMonthly(id).toFixed(2)}/mo equivalent`} />
          ))}
          {yearlyExpenses.map((e) => (
            <Box key={e.id} sx={{ display: "flex", alignItems: "center", px: 2, py: 1, borderBottom: `1px solid ${border}` }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2">{e.name}</Typography>
                <Typography variant="caption" color="text.disabled">${(e.amount / 12).toFixed(2)}/mo equivalent</Typography>
              </Box>
              <Typography variant="body2" fontWeight={500}>${e.amount.toFixed(2)}/yr</Typography>
              <IconButton size="small" onClick={() => setExpenseModal(e)} sx={{ ml: 0.5, p: 0.5 }}><EditIcon sx={{ fontSize: 13 }} /></IconButton>
              <IconButton size="small" onClick={() => deleteExpense(e.id)} sx={{ p: 0.5 }}><DeleteIcon sx={{ fontSize: 13, color: "#dc2626" }} /></IconButton>
            </Box>
          ))}
          {yearlyServices.length === 0 && yearlyExpenses.length === 0 && (
            <Row label="No annual costs" value="" muted />
          )}
          {(yearlyServices.length > 0 || yearlyExpenses.length > 0) && (
            <Row label="Subtotal" value={`$${(yearlyServices.reduce((s, id) => s + getServiceYearly(id), 0) + yearlyExpenses.reduce((s, e) => s + e.amount, 0)).toFixed(2)}/yr`} bold />
          )}
        </Section>

        {/* One-time */}
        <Section title="One-time expenses">
          {onetimeExpenses.length === 0 ? (
            <Row label="No one-time expenses logged" value="" muted />
          ) : onetimeExpenses.map((e) => (
            <Box key={e.id} sx={{ display: "flex", alignItems: "center", px: 2, py: 1, borderBottom: `1px solid ${border}` }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2">{e.name}</Typography>
                {e.date && <Typography variant="caption" color="text.disabled">{new Date(e.date).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</Typography>}
                {e.notes && <Typography variant="caption" color="text.disabled" sx={{ display: "block" }}>{e.notes}</Typography>}
              </Box>
              <Typography variant="body2" fontWeight={500}>${e.amount.toFixed(2)}</Typography>
              <IconButton size="small" onClick={() => setExpenseModal(e)} sx={{ ml: 0.5, p: 0.5 }}><EditIcon sx={{ fontSize: 13 }} /></IconButton>
              <IconButton size="small" onClick={() => deleteExpense(e.id)} sx={{ p: 0.5 }}><DeleteIcon sx={{ fontSize: 13, color: "#dc2626" }} /></IconButton>
            </Box>
          ))}
          {onetimeTotal > 0 && <Row label="One-time total" value={`$${onetimeTotal.toFixed(2)}`} bold />}
        </Section>

        {/* Grand total */}
        <Section title="Grand total (recurring)">
          <Row label="Per month" value={`$${totalMonthly.toFixed(2)}/mo`} />
          <Row label="Per year" value={`$${totalYearly.toFixed(2)}/yr`} bold />
        </Section>

        <Button startIcon={<AddIcon />} fullWidth onClick={() => setExpenseModal("new")}
          sx={{ textTransform: "none", borderRadius: 2, border: `1px dashed ${isDark ? "rgba(255,255,255,0.2)" : "#d1d5db"}`, color: "text.secondary", "&:hover": { background: isDark ? "rgba(255,255,255,0.04)" : "#f9fafb" } }}>
          Add expense
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function FinancesPage() {
  const { isDark } = useOutletContext();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState(DEFAULT_OVERRIDES);
  const [expenses, setExpenses] = useState([]);
  const [openService, setOpenService] = useState(null);
  const [expenseModal, setExpenseModal] = useState(null); // null | "new" | expense object
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showProjected, setShowProjected] = useState(true);
  const mountedRef = useRef(true);
  const fetchConfig = useRef(() => {});

  fetchConfig.current = async () => {
    const [cfg, exp] = await Promise.all([
      apiFetch("/api/finances/config").catch(() => null),
      apiFetch("/api/finances/expenses").catch(() => []),
    ]);
    if (!mountedRef.current) return;
    if (cfg?.overrides) setOverrides({ ...DEFAULT_OVERRIDES, ...cfg.overrides });
    setExpenses(exp ?? []);
  };

  useEffect(() => {
    mountedRef.current = true;
    apiFetch("/api/finances/summary").then(setSummary).catch(() => {}).finally(() => setLoading(false));
    fetchConfig.current();

    const channel = supabase
      .channel("finances-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_config" }, () => fetchConfig.current())
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_expenses" }, () => fetchConfig.current())
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      apiFetch("/api/finances/summary").then(setSummary).catch(() => {}),
      fetchConfig.current(),
    ]);
    setRefreshing(false);
  };

  const saveOverride = async (id, data) => {
    const prev = overrides;
    const next = { ...overrides, [id]: { ...overrides[id], ...data } };
    setOverrides(next);
    setOpenService(null);
    await apiFetch("/api/finances/config", { method: "PATCH", body: JSON.stringify({ overrides: next }) })
      .catch(() => setOverrides(prev));
  };

  const saveExpense = async (form) => {
    if (expenseModal === "new") {
      await apiFetch("/api/finances/expenses", { method: "POST", body: JSON.stringify(form) });
    } else {
      await apiFetch(`/api/finances/expenses/${expenseModal.id}`, { method: "PATCH", body: JSON.stringify(form) });
    }
    setExpenseModal(null);
  };

  const deleteExpense = async (id) => {
    const prev = expenses;
    setExpenses((e) => e.filter((x) => x.id !== id));
    await apiFetch(`/api/finances/expenses/${id}`, { method: "DELETE" })
      .catch(() => setExpenses(prev));
  };

  // Cost resolution
  const vision = summary?.vision;
  const railway = summary?.railway;
  const push = summary?.push;
  const RAILWAY_HOBBY_CREDIT = 5;

  const getRailwayUsage = () => showProjected
    ? (railway?.estimatedUsage ?? railway?.currentUsage ?? 0)
    : (railway?.currentUsage ?? 0);

  const getRailwayCharge = () => {
    if (!railway) return 0;
    const usage = getRailwayUsage();
    return railway.plan === "HOBBY" ? Math.max(RAILWAY_HOBBY_CREDIT, usage) : usage;
  };

  const getServiceMonthly = (id) => {
    const ov = overrides[id]?.cost;
    if (ov != null) return id === "domain" ? ov / 12 : ov;
    if (id === "railway") return getRailwayCharge();
    if (id === "domain") return (overrides.domain?.cost ?? 14) / 12;
    return 0;
  };

  const getServiceYearly = (id) => {
    if (id === "domain") return overrides[id]?.cost ?? 14;
    return getServiceMonthly(id) * 12;
  };

  const recurringMonthly = expenses.filter((e) => e.type === "monthly").reduce((s, e) => s + e.amount, 0);
  const recurringYearly  = expenses.filter((e) => e.type === "yearly").reduce((s, e) => s + e.amount, 0);
  const onetimeTotal     = expenses.filter((e) => e.type === "one-time").reduce((s, e) => s + e.amount, 0);

  const serviceMonthlyTotal = SERVICE_ORDER.reduce((s, id) => s + getServiceMonthly(id), 0);
  const totalMonthly = serviceMonthlyTotal + recurringMonthly + recurringYearly / 12;
  const totalYearly  = totalMonthly * 12;

  // Card rendering helpers
  const getCardBadge = (id) => {
    if (id === "mapsWeb" || id === "mapsIos" || id === "gemini") return "Check Often";
    if (id === "vision" || id === "railway" || id === "onesignal") return "Live";
    return null;
  };

  const getCardCostLabel = (id) => {
    const m = getServiceMonthly(id);
    return m === 0 ? "Free tier" : `$${m.toFixed(2)}/mo`;
  };

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 260px" }, gap: 3, alignItems: "start" }}>

      {/* ── Left: header + service cards ── */}
      <Box>
        {/* Header */}
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 3, borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb", background: isDark ? "#1A1A1B" : "#fff", display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, background: "rgba(22,163,74,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AttachMoneyIcon sx={{ color: "#16a34a", fontSize: 24 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={800}>Infrastructure Costs</Typography>
            <Typography variant="body2" color="text.secondary">Click any card to update costs or view details.</Typography>
          </Box>
          {loading ? <CircularProgress size={20} /> : (
            <Box sx={{ textAlign: "right" }}>
              <Typography variant="h5" fontWeight={900} sx={{ color: "#16a34a" }}>~${totalMonthly.toFixed(2)}/mo</Typography>
              <Typography variant="caption" color="text.secondary">estimated total</Typography>
            </Box>
          )}
          <IconButton
            size="small"
            onClick={handleRefresh}
            disabled={refreshing}
            sx={{ color: "text.secondary", "&:hover": { background: isDark ? "#343536" : "#f5f5f5" } }}
          >
            <RefreshIcon sx={{ fontSize: 18, transition: "transform 0.4s", transform: refreshing ? "rotate(180deg)" : "none" }} />
          </IconButton>
        </Paper>

        {/* ── Service cards ── */}
        <Box>

        {/* Cards grid */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          {SERVICE_ORDER.map((id) => {
            const config = SERVICE_CONFIG[id];
            const ov = overrides[id];
            const days = id === "domain" ? daysUntil(ov?.renewalDate) : null;

            return (
              <ServiceCard key={id} config={config} badge={getCardBadge(id)} cost={getCardCostLabel(id)} isDark={isDark} onClick={() => setOpenService(id)}>
                {/* Railway live */}
                {id === "railway" && (loading ? <CircularProgress size={14} /> : railway ? (
                  <>
                    <Typography variant="caption" color="text.secondary">{railway.plan} plan · {railway.workspaceName}</Typography>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.75 }}>
                      <Typography variant="caption" color="text.secondary">Usage ({showProjected ? "projected" : "so far"})</Typography>
                      <Typography variant="body2" fontWeight={600}>${getRailwayUsage().toFixed(2)}</Typography>
                    </Box>
                    {railway.plan === "HOBBY" && (() => {
                      const usage = getRailwayUsage();
                      const remaining = RAILWAY_HOBBY_CREDIT - usage;
                      const over = remaining < 0;
                      return (
                        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">Hobby credit</Typography>
                          <Typography variant="body2" fontWeight={600} sx={{ color: over ? "#dc2626" : "#16a34a" }}>
                            {over ? `($${Math.abs(remaining).toFixed(2)} upcharge)` : `$${remaining.toFixed(2)} remaining`}
                          </Typography>
                        </Box>
                      );
                    })()}
                    <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5, pt: 0.5, borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"}` }}>
                      <Typography variant="caption" fontWeight={700}>Est. charge</Typography>
                      <Typography variant="body2" fontWeight={800}>${getRailwayCharge().toFixed(2)}</Typography>
                    </Box>
                  </>
                ) : <Typography variant="body2" color="text.secondary">Add RAILWAY_API_TOKEN to enable live billing.</Typography>)}

                {/* OneSignal live */}
                {id === "onesignal" && (loading ? <CircularProgress size={14} /> : push ? (
                  <>
                    <UsageBar value={push.sentCount} max={push.freeLimit} label={`Push notifications — ${push.month}`} isDark={isDark} />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                      {(push.freeLimit - push.sentCount).toLocaleString()} remaining before paid tier
                    </Typography>
                  </>
                ) : null)}

                {/* Vision live */}
                {id === "vision" && (loading ? <CircularProgress size={14} /> : vision ? (
                  <>
                    <UsageBar value={vision.callCount} max={vision.freeLimit} label={`SafeSearch calls — ${vision.month}`} isDark={isDark} />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                      {vision.freeLimit - vision.callCount} calls remaining before paid tier
                    </Typography>
                  </>
                ) : null)}

                {/* Domain renewal */}
                {id === "domain" && ov?.renewalDate && (
                  <Typography variant="body2" sx={{ fontWeight: 600, color: days != null && days <= 30 ? "#dc2626" : days != null && days <= 60 ? "#f59e0b" : "text.secondary" }}>
                    Renews {new Date(ov.renewalDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    {days != null && days <= 60 && ` — ${days} days`}
                  </Typography>
                )}

                {/* Maps / Gemini console link */}
                {(id === "mapsWeb" || id === "mapsIos" || id === "gemini") && (
                  <Box component="a" href={config.links[0]?.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                    sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 1, fontSize: 12, fontWeight: 600, color: config.color, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                    Cloud Console <OpenInNewIcon sx={{ fontSize: 11 }} />
                  </Box>
                )}

                {/* Plan / notes pill */}
                {ov?.plan && (
                  <Chip label={ov.plan} size="small" sx={{ mt: 1, height: 18, fontSize: 10, background: isDark ? "rgba(255,255,255,0.08)" : "#f5f5f5" }} />
                )}
              </ServiceCard>
            );
          })}
        </Box>
      </Box>
      </Box>

      {/* ── Right: compact ledger (click to expand) ── */}
      <Paper
        variant="outlined"
        onClick={() => setBreakdownOpen(true)}
        sx={{
          p: 2.5, borderRadius: 3, position: "sticky", top: 24, cursor: "pointer",
          borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb",
          background: isDark ? "#1A1A1B" : "#fff",
          transition: "box-shadow 0.15s, border-color 0.15s",
          "&:hover": { boxShadow: isDark ? "0 0 0 1px rgba(255,255,255,0.15)" : "0 0 0 1px #d1d5db", borderColor: isDark ? "rgba(255,255,255,0.25)" : "#d1d5db" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="subtitle2" fontWeight={800}>Cost Breakdown</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>click to expand</Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={showProjected ? "projected" : "actual"}
          onChange={(_, v) => { if (v) setShowProjected(v === "projected"); }}
          onClick={(e) => e.stopPropagation()}
          sx={{ mb: 1.5, "& .MuiToggleButton-root": { py: 0.25, px: 1, fontSize: 11, textTransform: "none", border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "#e5e7eb"}` } }}
        >
          <ToggleButton value="projected">Projected</ToggleButton>
          <ToggleButton value="actual">Actual</ToggleButton>
        </ToggleButtonGroup>

        {/* Column headers */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 1, pb: 1, borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "#e5e7eb"}` }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>Service</Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textAlign: "right", minWidth: 52 }}>/ mo</Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textAlign: "right", minWidth: 52 }}>/ yr</Typography>
        </Box>

        {loading ? <Box sx={{ py: 3, display: "flex", justifyContent: "center" }}><CircularProgress size={20} /></Box> : (
          <>
            {SERVICE_ORDER.map((id) => {
              const mo = getServiceMonthly(id);
              const yr = getServiceYearly(id);
              const free = mo === 0;
              return (
                <Box key={id} sx={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 1, py: 0.75, alignItems: "center" }}>
                  <Typography variant="body2" color="text.secondary" noWrap sx={{ fontSize: 12 }}>{SERVICE_CONFIG[id].title}</Typography>
                  <Typography variant="body2" sx={{ fontSize: 12, textAlign: "right", minWidth: 52, color: free ? "text.disabled" : "text.primary" }}>{free ? "Free" : `$${mo.toFixed(2)}`}</Typography>
                  <Typography variant="body2" sx={{ fontSize: 12, textAlign: "right", minWidth: 52, color: free ? "text.disabled" : "text.primary" }}>{free ? "Free" : `$${yr.toFixed(2)}`}</Typography>
                </Box>
              );
            })}

            {expenses.length > 0 && (
              <>
                <Divider sx={{ my: 1 }} />
                {expenses.map((e) => (
                  <Box key={e.id} sx={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 1, py: 0.75, alignItems: "center" }}>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ fontSize: 12 }}>{e.name}</Typography>
                    <Typography variant="body2" sx={{ fontSize: 12, textAlign: "right", minWidth: 52, color: e.type === "one-time" ? "text.disabled" : "text.primary" }}>
                      {e.type === "one-time" ? "—" : `$${(e.type === "yearly" ? e.amount / 12 : e.amount).toFixed(2)}`}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: 12, textAlign: "right", minWidth: 52 }}>${e.amount.toFixed(2)}</Typography>
                  </Box>
                ))}
              </>
            )}

            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 1, alignItems: "center" }}>
              <Typography variant="body2" fontWeight={800} sx={{ fontSize: 12 }}>Total</Typography>
              <Typography variant="body2" fontWeight={800} sx={{ fontSize: 12, textAlign: "right", minWidth: 52, color: "#16a34a" }}>${totalMonthly.toFixed(2)}</Typography>
              <Typography variant="body2" fontWeight={800} sx={{ fontSize: 12, textAlign: "right", minWidth: 52, color: "#16a34a" }}>${totalYearly.toFixed(2)}</Typography>
            </Box>
          </>
        )}
      </Paper>

      {/* ── Modals ── */}
      {openService && (
        <ServiceModal
          config={SERVICE_CONFIG[openService]}
          override={overrides[openService]}
          onSave={(data) => saveOverride(openService, data)}
          onClose={() => setOpenService(null)}
          isDark={isDark}
          liveData={openService === "vision" ? vision : null}
          railwayData={openService === "railway" ? railway : null}
          pushData={openService === "onesignal" ? push : null}
          showProjected={showProjected}
        />
      )}
      {expenseModal && (
        <ExpenseModal
          initial={expenseModal === "new" ? null : expenseModal}
          onSave={saveExpense}
          onClose={() => setExpenseModal(null)}
          isDark={isDark}
        />
      )}
      {breakdownOpen && (
        <BreakdownModal
          onClose={() => setBreakdownOpen(false)}
          isDark={isDark}
          getServiceMonthly={getServiceMonthly}
          getServiceYearly={getServiceYearly}
          expenses={expenses}
          setExpenseModal={setExpenseModal}
          deleteExpense={deleteExpense}
          totalMonthly={totalMonthly}
          totalYearly={totalYearly}
          onetimeTotal={onetimeTotal}
          showProjected={showProjected}
          setShowProjected={setShowProjected}
        />
      )}
    </Box>
  );
}
