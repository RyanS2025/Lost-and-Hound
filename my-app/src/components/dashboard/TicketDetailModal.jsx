import { useState, useEffect, useRef } from "react";
import {
  Box, Typography, Chip, Button, IconButton, Modal,
  Alert, TextField, Select, MenuItem, CircularProgress, Autocomplete,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import SendIcon from "@mui/icons-material/Send";
import EditIcon from "@mui/icons-material/Edit";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DeleteIcon from "@mui/icons-material/Delete";
import apiFetch from "../../utils/apiFetch";
import { dismissKeyboard } from "../../utils/keyboard";
import {
  DEFAULT_TIME_ZONE,
  formatDateTime,
  formatRelativeDate,
} from "../../utils/timezone";
import {
  TICKET_STATUS_CONFIG,
  TICKET_STATUS_CONFIG_DARK,
  SEVERITY_OPTIONS,
  SEVERITY_OPTIONS_DARK,
  ENVIRONMENT_OPTIONS,
  EFFORT_OPTIONS,
} from "./dashboardConstants";

export default function TicketDetailModal({ ticket, onClose, onUpdateStatus, onDelete, onReply, isDark, timeZone = DEFAULT_TIME_ZONE, moderators = [] }) {
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [pendingReplies, setPendingReplies] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const chatBottomRef = useRef();
  const isSmall = useMediaQuery("(max-width:960px)");

  const [engEdit, setEngEdit] = useState({});
  const [engEditing, setEngEditing] = useState(false);
  const [engSaving, setEngSaving] = useState(false);
  const [engError, setEngError] = useState("");

  useEffect(() => {
    setReplyText("");
    setReplyError("");
    setPendingReplies([]);
    setEngError("");
    const hasEngData = !!(ticket?.severity || ticket?.assignee || ticket?.environment ||
      ticket?.estimated_effort || ticket?.repro_steps || ticket?.fix_notes || ticket?.fix_pr_url);
    setEngEditing(!hasEngData);
    setEngEdit({
      severity: ticket?.severity || "",
      assignee: ticket?.assignee || "",
      assignee_id: ticket?.assignee_id || null,
      environment: ticket?.environment || "",
      estimated_effort: ticket?.estimated_effort || "",
      repro_steps: ticket?.repro_steps || "",
      fix_notes: ticket?.fix_notes || "",
      fix_pr_url: ticket?.fix_pr_url || "",
      deadline: ticket?.deadline ? ticket.deadline.slice(0, 16) : "",
    });
    if (!isSmall) setChatOpen(true);
  }, [ticket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const serverReplyCount = ticket?.support_replies?.length ?? 0;
  useEffect(() => { setPendingReplies([]); }, [serverReplyCount]);

  const allReplies = [...(ticket?.support_replies || []), ...pendingReplies];

  useEffect(() => {
    if (chatOpen && allReplies.length) {
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [chatOpen, allReplies.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReply = async () => {
    const msg = replyText.trim();
    if (!msg || replySubmitting) return;
    setReplySubmitting(true);
    setReplyError("");
    try {
      await apiFetch(`/api/support-tickets/${ticket.id}/replies`, {
        method: "POST",
        body: JSON.stringify({ message: msg }),
      });
      setPendingReplies((prev) => [...prev, {
        id: Date.now(),
        is_moderator: true,
        message: msg,
        created_at: new Date().toISOString(),
      }]);
      setReplyText("");
      onReply?.();
    } catch (err) {
      setReplyError(err?.message || "Failed to send reply.");
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleEngSave = async () => {
    setEngSaving(true);
    setEngError("");
    try {
      await apiFetch(`/api/support-tickets/${ticket.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          severity: engEdit.severity || null,
          assignee: engEdit.assignee || null,
          assignee_id: engEdit.assignee_id || null,
          environment: engEdit.environment || null,
          estimated_effort: engEdit.estimated_effort || null,
          repro_steps: engEdit.repro_steps || null,
          fix_notes: engEdit.fix_notes || null,
          fix_pr_url: engEdit.fix_pr_url || null,
          deadline: engEdit.deadline || null,
        }),
      });
      setEngEditing(false);
      onReply?.();
    } catch (err) {
      setEngError(err?.message || "Failed to save engineering details.");
    } finally {
      setEngSaving(false);
    }
  };

  if (!ticket) return null;

  const statusCfg = (isDark ? TICKET_STATUS_CONFIG_DARK : TICKET_STATUS_CONFIG)[ticket.status] ?? TICKET_STATUS_CONFIG.open;
  const accent = isDark ? "#FF4500" : "#A84D48";
  const accentHover = isDark ? "#E03D00" : "#8f3e3a";

  return (
    <Modal
      open={!!ticket}
      onClose={onClose}
      slotProps={{ backdrop: { sx: { backdropFilter: "blur(1px)" } } }}
    >
      <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "row", outline: "none", mx: isSmall ? 1.5 : 0 }}>
        <Box sx={{ width: isSmall ? "min(580px, calc(100vw - 24px))" : 580, height: "90vh", maxHeight: 700, display: "flex", flexDirection: "column", background: isDark ? "#1A1A1B" : "#fff", border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #ecdcdc", borderRadius: chatOpen && !isSmall ? "12px 0 0 12px" : 3, boxShadow: "0 24px 64px rgba(0,0,0,0.28)", overflow: "hidden", boxSizing: "border-box", flexShrink: 0 }}>

          {/* Header */}
          <Box sx={{ px: 3, py: 2, flexShrink: 0, borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #f0e8e8", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 0.75 }}>
                {ticket.ticket_type && (
                  <Chip label={ticket.ticket_type} size="small" sx={{ fontWeight: 700, fontSize: 11, background: isDark ? "rgba(168,77,72,0.2)" : "#A84D4815", color: isDark ? "#FF6B3D" : "#A84D48" }} />
                )}
                <Chip label={statusCfg.label} size="small" sx={{ fontWeight: 700, fontSize: 11, background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }} />
                <Chip label={ticket.category} size="small" sx={{ fontWeight: 700, fontSize: 11, background: isDark ? "rgba(255,255,255,0.08)" : "#f5eded", color: isDark ? "#D7DADC" : "#5e3030" }} />
              </Box>
              <Typography fontWeight={800} fontSize={16} sx={{ color: "text.primary", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                {ticket.ticket_title}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0, mt: 0.25 }}>
              <IconButton size="small" onClick={() => setChatOpen(!chatOpen)} title="Toggle chat" sx={{ color: chatOpen ? accent : "text.secondary" }}>
                <ChatBubbleOutlineIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={onClose} sx={{ color: "text.secondary" }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {/* Scrollable body */}
          <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5, minHeight: 0 }}>
            {/* Metadata grid */}
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 2.5, p: 1.5, borderRadius: 2, background: isDark ? "#232324" : "#faf8f8", border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #f0e8e8" }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.25 }}>Submitted</Typography>
                <Typography variant="body2" fontWeight={600}>{formatDateTime(ticket.created_at, timeZone)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.25 }}>Claimed By</Typography>
                <Typography variant="body2" fontWeight={600} sx={{ color: ticket.claimed_by ? accent : "text.disabled", fontStyle: ticket.claimed_by ? "normal" : "italic" }}>
                  {ticket.claimed_by || "Unclaimed"}
                </Typography>
              </Box>
              {ticket.name && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.25 }}>Name</Typography>
                  <Typography variant="body2" fontWeight={600}>{ticket.name}</Typography>
                </Box>
              )}
              {ticket.email && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.25 }}>Email</Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: "anywhere" }}>{ticket.email}</Typography>
                </Box>
              )}
              {ticket.resolved_by && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.25 }}>Resolved By</Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ color: "#16a34a" }}>{ticket.resolved_by}</Typography>
                </Box>
              )}
              {ticket.resolved_at && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.25 }}>Resolved At</Typography>
                  <Typography variant="body2" fontWeight={600}>{formatDateTime(ticket.resolved_at, timeZone)}</Typography>
                </Box>
              )}
            </Box>

            {/* Description */}
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.75 }}>Description</Typography>
            <Box sx={{ p: 1.5, borderRadius: 2, background: isDark ? "#232324" : "#fdf7f7", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #f0e8e8", mb: 2.5 }}>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: isDark ? "#C8CACC" : "#5e5e5e", lineHeight: 1.6 }}>
                {ticket.ticket_desc}
              </Typography>
            </Box>

            {/* Image attachment */}
            {ticket.image_url && (
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.75 }}>Attachment</Typography>
                <Box component="img" src={ticket.image_url} alt="Attachment" sx={{ maxWidth: "100%", maxHeight: 280, borderRadius: 2, objectFit: "contain", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #ecdcdc", display: "block" }} />
              </Box>
            )}

            {/* Assignment — all ticket types */}
            <Box sx={{ mb: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
                <Box sx={{ flex: 1, height: 1, background: isDark ? "rgba(255,255,255,0.08)" : "#f0e8e8" }} />
                <Typography variant="caption" sx={{ fontWeight: 800, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap", fontSize: 10 }}>Assignment</Typography>
                <IconButton size="small" onClick={() => { setEngEditing(e => !e); setEngError(""); }}
                  title={engEditing ? "Cancel" : "Edit assignment"}
                  sx={{ color: engEditing ? accent : "text.disabled", p: 0.25 }}>
                  <EditIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <Box sx={{ flex: 1, height: 1, background: isDark ? "rgba(255,255,255,0.08)" : "#f0e8e8" }} />
              </Box>

              {engEditing ? (
                <>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mb: 1 }}>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.4, fontSize: 10 }}>Assignee</Typography>
                      <Autocomplete
                        size="small"
                        options={moderators}
                        getOptionLabel={(o) => o.name || ""}
                        value={moderators.find(m => m.id === engEdit.assignee_id) || null}
                        onChange={(_, mod) => setEngEdit(p => ({ ...p, assignee: mod?.name || null, assignee_id: mod?.id || null }))}
                        isOptionEqualToValue={(o, v) => o.id === v.id}
                        renderInput={(params) => <TextField {...params} placeholder="Search moderators…" sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5, fontSize: { xs: 16, md: 13 } } }} />}
                      />
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.4, fontSize: 10 }}>Deadline</Typography>
                      <TextField size="small" fullWidth type="datetime-local" value={engEdit.deadline || ""} onChange={(e) => setEngEdit(p => ({ ...p, deadline: e.target.value }))}
                        InputLabelProps={{ shrink: true }} sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5, fontSize: { xs: 16, md: 13 } } }} />
                    </Box>
                  </Box>

                  {/* Bug-only fields */}
                  {ticket.ticket_type === "Bug Report" && (
                    <>
                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mb: 1 }}>
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.4, fontSize: 10 }}>Severity</Typography>
                          <Select size="small" fullWidth displayEmpty value={engEdit.severity || ""} onChange={(e) => setEngEdit(p => ({ ...p, severity: e.target.value }))} sx={{ fontSize: 13, borderRadius: 1.5 }}>
                            <MenuItem value=""><em style={{ color: "#aaa" }}>None</em></MenuItem>
                            {SEVERITY_OPTIONS.map(s => (
                              <MenuItem key={s.value} value={s.value}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                                  {s.label}
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.4, fontSize: 10 }}>Environment</Typography>
                          <Select size="small" fullWidth displayEmpty value={engEdit.environment || ""} onChange={(e) => setEngEdit(p => ({ ...p, environment: e.target.value }))} sx={{ fontSize: 13, borderRadius: 1.5 }}>
                            <MenuItem value=""><em style={{ color: "#aaa" }}>None</em></MenuItem>
                            {ENVIRONMENT_OPTIONS.map(v => <MenuItem key={v} value={v}>{v === "ios" ? "iOS" : v.charAt(0).toUpperCase() + v.slice(1)}</MenuItem>)}
                          </Select>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.4, fontSize: 10 }}>Effort</Typography>
                          <Select size="small" fullWidth displayEmpty value={engEdit.estimated_effort || ""} onChange={(e) => setEngEdit(p => ({ ...p, estimated_effort: e.target.value }))} sx={{ fontSize: 13, borderRadius: 1.5 }}>
                            <MenuItem value=""><em style={{ color: "#aaa" }}>None</em></MenuItem>
                            {EFFORT_OPTIONS.map(v => <MenuItem key={v} value={v}>{v.toUpperCase()}</MenuItem>)}
                          </Select>
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.4, fontSize: 10 }}>Reproduction Steps</Typography>
                          <TextField size="small" fullWidth multiline minRows={2} maxRows={5} placeholder="How to reproduce this bug…" value={engEdit.repro_steps || ""} onChange={(e) => setEngEdit(p => ({ ...p, repro_steps: e.target.value }))}
                            inputProps={{ maxLength: 1000 }} sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5, fontSize: { xs: 16, md: 13 } } }} />
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.4, fontSize: 10 }}>Fix Notes</Typography>
                          <TextField size="small" fullWidth multiline minRows={2} maxRows={5} placeholder="What was changed to fix this…" value={engEdit.fix_notes || ""} onChange={(e) => setEngEdit(p => ({ ...p, fix_notes: e.target.value }))}
                            inputProps={{ maxLength: 1000 }} sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5, fontSize: { xs: 16, md: 13 } } }} />
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.4, fontSize: 10 }}>PR / Commit URL</Typography>
                          <TextField size="small" fullWidth placeholder="https://github.com/…" value={engEdit.fix_pr_url || ""} onChange={(e) => setEngEdit(p => ({ ...p, fix_pr_url: e.target.value }))}
                            inputProps={{ maxLength: 300 }} sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5, fontSize: { xs: 16, md: 13 } } }} />
                        </Box>
                      </Box>
                    </>
                  )}

                  {engError && <Alert severity="error" sx={{ mt: 1, py: 0, fontSize: 12 }}>{engError}</Alert>}
                  <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 1 }}>
                    <Button size="small" onClick={() => { setEngEditing(false); setEngError(""); }}
                      sx={{ color: "text.secondary", fontWeight: 700, fontSize: 12 }}>Cancel</Button>
                    <Button size="small" variant="contained" onClick={handleEngSave} disabled={engSaving}
                      endIcon={engSaving ? <CircularProgress size={12} color="inherit" /> : null}
                      sx={{ background: accent, "&:hover": { background: accentHover }, fontWeight: 700, borderRadius: 1.5, fontSize: 12 }}>
                      Save
                    </Button>
                  </Box>
                </>
              ) : (
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25, p: 1.5, borderRadius: 2, background: isDark ? "#1e1e1f" : "#faf8f8", border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #f0e8e8" }}>
                  {/* Assignee + Deadline always shown */}
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.25, fontSize: 10 }}>Assignee</Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ color: engEdit.assignee ? "text.primary" : "text.disabled", fontStyle: engEdit.assignee ? "normal" : "italic" }}>
                      {engEdit.assignee || "—"}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.25, fontSize: 10 }}>Deadline</Typography>
                    {engEdit.deadline ? (() => { const overdue = new Date(engEdit.deadline) < new Date(); return (
                      <Typography variant="body2" fontWeight={600} sx={{ color: overdue ? "#dc2626" : "#16a34a" }}>
                        {formatDateTime(engEdit.deadline, timeZone)}
                      </Typography>
                    ); })() : (
                      <Typography variant="body2" fontWeight={600} sx={{ color: "text.disabled", fontStyle: "italic" }}>—</Typography>
                    )}
                  </Box>

                  {/* Bug-only read view */}
                  {ticket.ticket_type === "Bug Report" && (
                    <>
                      {[
                        { label: "Severity", value: engEdit.severity ? (SEVERITY_OPTIONS.find(s => s.value === engEdit.severity)?.label || engEdit.severity) : null, color: SEVERITY_OPTIONS.find(s => s.value === engEdit.severity)?.color },
                        { label: "Environment", value: engEdit.environment ? (engEdit.environment === "ios" ? "iOS" : engEdit.environment.charAt(0).toUpperCase() + engEdit.environment.slice(1)) : null },
                        { label: "Effort", value: engEdit.estimated_effort ? engEdit.estimated_effort.toUpperCase() : null },
                      ].map(({ label, value, color }) => (
                        <Box key={label}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.25, fontSize: 10 }}>{label}</Typography>
                          <Typography variant="body2" fontWeight={600} sx={{ color: color || (value ? "text.primary" : "text.disabled"), fontStyle: value ? "normal" : "italic" }}>
                            {value || "—"}
                          </Typography>
                        </Box>
                      ))}
                      {engEdit.repro_steps && (
                        <Box sx={{ gridColumn: "1 / -1" }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.4, fontSize: 10 }}>Reproduction Steps</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: isDark ? "#C8CACC" : "#5e5e5e", lineHeight: 1.6 }}>{engEdit.repro_steps}</Typography>
                        </Box>
                      )}
                      {engEdit.fix_notes && (
                        <Box sx={{ gridColumn: "1 / -1" }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.4, fontSize: 10 }}>Fix Notes</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: isDark ? "#C8CACC" : "#5e5e5e", lineHeight: 1.6 }}>{engEdit.fix_notes}</Typography>
                        </Box>
                      )}
                      {engEdit.fix_pr_url && (
                        <Box sx={{ gridColumn: "1 / -1" }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.4, fontSize: 10 }}>PR / Commit</Typography>
                          <Box component="a" href={engEdit.fix_pr_url} target="_blank" rel="noopener noreferrer"
                            sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: accent, fontSize: 13, fontWeight: 600, textDecoration: "none", overflowWrap: "anywhere", wordBreak: "break-all", "&:hover": { textDecoration: "underline" } }}>
                            {engEdit.fix_pr_url}
                            <OpenInNewIcon sx={{ fontSize: 13, flexShrink: 0 }} />
                          </Box>
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              )}
            </Box>

            {/* Inline thread (small screens) */}
            {isSmall && (
              <>
                {allReplies.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.75 }}>
                      Thread ({allReplies.length})
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                      {allReplies.map((reply) => (
                        <Box key={reply.id} sx={{ p: 1.25, borderRadius: 1.5, background: reply.is_moderator ? (isDark ? "rgba(255,69,0,0.1)" : "rgba(168,77,72,0.05)") : (isDark ? "rgba(255,255,255,0.04)" : "#f9f5f4"), border: `1px solid ${reply.is_moderator ? (isDark ? "rgba(255,69,0,0.3)" : "rgba(168,77,72,0.18)") : (isDark ? "rgba(255,255,255,0.08)" : "#ecdcdc")}` }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                            <Chip label={reply.is_moderator ? "Support Team" : "User"} size="small" sx={{ height: 18, fontSize: "0.63rem", fontWeight: 700, background: reply.is_moderator ? (isDark ? "#FF4500" : "#A84D48") : (isDark ? "#333" : "#eee"), color: reply.is_moderator ? "#fff" : "text.secondary" }} />
                            <Typography variant="caption" sx={{ color: "text.disabled" }}>{formatRelativeDate(reply.created_at, timeZone)}</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{reply.message}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
                {ticket.status !== "closed" && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.75 }}>Reply as Support Team</Typography>
                    {replyError && <Alert severity="error" sx={{ py: 0, mb: 0.75, fontSize: 12 }}>{replyError}</Alert>}
                    <TextField multiline minRows={2} maxRows={5} fullWidth size="small" placeholder="Type a reply…" value={replyText} onChange={(e) => setReplyText(e.target.value)} inputProps={{ maxLength: 1000 }} sx={{ mb: 0.75, "& .MuiOutlinedInput-root": { borderRadius: 1.5, fontSize: { xs: 16, md: 13 } } }} />
                    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                      <Button size="small" variant="contained" disabled={!replyText.trim() || replySubmitting} onClick={handleReply} endIcon={replySubmitting ? <CircularProgress size={12} color="inherit" /> : null} sx={{ background: accent, "&:hover": { background: accentHover }, fontWeight: 700, borderRadius: 1.5, fontSize: 12 }}>Send Reply</Button>
                    </Box>
                  </Box>
                )}
              </>
            )}
          </Box>

          {/* Footer — status actions */}
          <Box sx={{ px: 3, py: 1.75, flexShrink: 0, borderTop: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #f0e8e8", background: isDark ? "#161617" : "#faf8f8", display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>Status:</Typography>
            {ticket.status === "open" && <Button size="small" onClick={() => onUpdateStatus(ticket.id, "in_progress")} sx={{ color: "#1e40af", fontWeight: 700, fontSize: 12 }}>Start</Button>}
            {ticket.status === "in_progress" && <Button size="small" onClick={() => onUpdateStatus(ticket.id, "resolved")} sx={{ color: "#16a34a", fontWeight: 700, fontSize: 12 }}>Resolve</Button>}
            {(ticket.status === "resolved" || ticket.status === "closed") && <Button size="small" onClick={() => onUpdateStatus(ticket.id, "open")} sx={{ color: "#92400e", fontWeight: 700, fontSize: 12 }}>Reopen</Button>}
            <Box sx={{ flex: 1 }} />
            {ticket.status !== "closed" && (
              <Button size="small" startIcon={<DeleteIcon sx={{ fontSize: 15 }} />}
                onClick={() => onUpdateStatus(ticket.id, "closed")}
                sx={{ color: "#64748b", fontWeight: 700, fontSize: 12, "&:hover": { background: "rgba(100,116,139,0.08)" } }}>
                Close
              </Button>
            )}
          </Box>
        </Box>

        {/* Chat panel (desktop only) */}
        {!isSmall && (
          <Box sx={{ width: chatOpen ? 320 : 0, height: "90vh", maxHeight: 700, overflow: "hidden", transition: "width 0.28s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0 }}>
            <Box sx={{ width: 320, height: "100%", display: "flex", flexDirection: "column", background: isDark ? "#141415" : "#f7f3f3", border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #ecdcdc", borderLeft: "none", borderRadius: "0 12px 12px 0", overflow: "hidden" }}>
              <Box sx={{ px: 2, py: 1.75, borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #f0e8e8", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <ChatBubbleOutlineIcon sx={{ fontSize: 18, color: accent }} />
                  <Typography fontWeight={800} fontSize={14}>Chat Thread</Typography>
                </Box>
                <IconButton size="small" onClick={() => setChatOpen(false)} sx={{ color: "text.secondary" }}><CloseIcon fontSize="small" /></IconButton>
              </Box>
              <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 1.5, display: "flex", flexDirection: "column", gap: 0.75, minHeight: 0 }}>
                {allReplies.length === 0 ? (
                  <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography variant="body2" sx={{ color: "text.disabled", fontStyle: "italic", textAlign: "center" }}>
                      No messages yet. Send one to start the thread.
                    </Typography>
                  </Box>
                ) : allReplies.map((reply) => (
                  <Box key={reply.id} sx={{ display: "flex", justifyContent: reply.is_moderator ? "flex-end" : "flex-start" }}>
                    <Box sx={{ maxWidth: "85%", px: 1.25, py: 1, borderRadius: reply.is_moderator ? "12px 4px 12px 12px" : "4px 12px 12px 12px", background: reply.is_moderator ? accent : (isDark ? "rgba(255,255,255,0.07)" : "#eee"), border: reply.is_moderator ? "none" : (isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #ddd"), boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, mb: 0.25, letterSpacing: 0.3, textAlign: reply.is_moderator ? "right" : "left", color: reply.is_moderator ? "rgba(255,255,255,0.75)" : (isDark ? "#A9AAAB" : "#888") }}>
                        {reply.is_moderator ? "You" : (ticket?.name || "User")}
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: reply.is_moderator ? "#fff" : "text.primary", lineHeight: 1.5, fontSize: 13 }}>{reply.message}</Typography>
                      <Typography sx={{ fontSize: 10, color: reply.is_moderator ? "rgba(255,255,255,0.65)" : "text.disabled", mt: 0.25, textAlign: reply.is_moderator ? "right" : "left" }}>
                        {new Date(reply.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Typography>
                    </Box>
                  </Box>
                ))}
                <div ref={chatBottomRef} />
              </Box>
              {ticket.status !== "closed" ? (
                <Box sx={{ px: 1.5, py: 1.25, borderTop: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #f0e8e8", flexShrink: 0 }}>
                  {replyError && <Alert severity="error" sx={{ mb: 0.75, py: 0, fontSize: 12 }}>{replyError}</Alert>}
                  <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
                    <TextField size="small" fullWidth multiline maxRows={4} placeholder="Reply as Support Team…" value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); dismissKeyboard(); } }} inputProps={{ maxLength: 1000 }} sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: { xs: 16, md: 13 } } }} />
                    <IconButton onClick={handleReply} disabled={!replyText.trim() || replySubmitting} sx={{ bgcolor: accent, color: "#fff", borderRadius: 2, width: 38, height: 38, flexShrink: 0, "&:hover": { bgcolor: accentHover }, "&.Mui-disabled": { bgcolor: isDark ? "#37383A" : "#e0d6d6" } }}>
                      {replySubmitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon sx={{ fontSize: 17 }} />}
                    </IconButton>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ px: 2, py: 1.25, borderTop: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #f0e8e8", flexShrink: 0 }}>
                  <Typography variant="caption" sx={{ color: "text.disabled", fontStyle: "italic" }}>This ticket is closed.</Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Modal>
  );
}
