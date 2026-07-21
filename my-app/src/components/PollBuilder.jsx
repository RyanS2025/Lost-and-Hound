import { useState } from "react";
import {
  Box, Typography, TextField, Select, MenuItem, FormControl, InputLabel,
  Switch, FormControlLabel, Button, IconButton, Paper, Chip, Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

const QUESTION_TYPES = [
  { value: "short_answer",    label: "Short answer" },
  { value: "paragraph",       label: "Paragraph" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "checkbox",        label: "Checkboxes" },
  { value: "dropdown",        label: "Dropdown" },
  { value: "linear_scale",    label: "Linear scale" },
];

function newQuestion() {
  return {
    _key: Math.random().toString(36).slice(2),
    question_text: "",
    question_type: "multiple_choice",
    options: ["Option 1", "Option 2"],
    scale_min: 1,
    scale_max: 5,
    required: false,
  };
}

function QuestionCard({ q, idx, total, onChange, onDelete, onMove, isDark }) {
  const border = isDark ? "rgba(255,255,255,0.1)" : "#ecdcdc";
  const bg = isDark ? "#1A1A1B" : "#fff";
  const accent = isDark ? "#FF4500" : "#A84D48";

  const hasOptions = ["multiple_choice", "checkbox", "dropdown"].includes(q.question_type);

  const updateOption = (i, val) => {
    const opts = [...(q.options || [])];
    opts[i] = val;
    onChange({ ...q, options: opts });
  };

  const addOption = () => onChange({ ...q, options: [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`] });
  const removeOption = (i) => {
    const opts = q.options.filter((_, oi) => oi !== i);
    onChange({ ...q, options: opts.length ? opts : ["Option 1"] });
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        border: `1px solid ${border}`,
        background: bg,
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <Box sx={{ display: "flex", alignItems: "center", px: 1.5, pt: 1, gap: 0.5 }}>
        <DragIndicatorIcon sx={{ fontSize: 18, color: "text.disabled", mr: 0.5 }} />
        <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 700, mr: "auto" }}>
          Question {idx + 1}
        </Typography>
        <IconButton size="small" onClick={() => onMove(idx, -1)} disabled={idx === 0} sx={{ color: "text.disabled" }}>
          <ArrowUpwardIcon sx={{ fontSize: 15 }} />
        </IconButton>
        <IconButton size="small" onClick={() => onMove(idx, 1)} disabled={idx === total - 1} sx={{ color: "text.disabled" }}>
          <ArrowDownwardIcon sx={{ fontSize: 15 }} />
        </IconButton>
        <IconButton size="small" onClick={() => onDelete(idx)} sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}>
          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      <Box sx={{ px: 2, pb: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {/* Question text + type row */}
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Question"
            value={q.question_text}
            onChange={(e) => onChange({ ...q, question_text: e.target.value })}
            sx={{ flex: 1, minWidth: 180 }}
            inputProps={{ maxLength: 300 }}
          />
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <Select
              value={q.question_type}
              onChange={(e) => {
                const t = e.target.value;
                const opts = hasOptions ? q.options : ["Option 1", "Option 2"];
                onChange({ ...q, question_type: t, options: opts });
              }}
            >
              {QUESTION_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Options for choice types */}
        {hasOptions && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, pl: 1 }}>
            {(q.options || []).map((opt, oi) => (
              <Box key={oi} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box sx={{
                  width: q.question_type === "checkbox" ? 14 : 14,
                  height: 14,
                  borderRadius: q.question_type === "checkbox" ? 0.5 : "50%",
                  border: `2px solid ${isDark ? "rgba(255,255,255,0.3)" : "#ccc"}`,
                  flexShrink: 0,
                }} />
                <TextField
                  size="small"
                  value={opt}
                  onChange={(e) => updateOption(oi, e.target.value)}
                  sx={{ flex: 1 }}
                  inputProps={{ style: { fontSize: 13 }, maxLength: 100 }}
                />
                <IconButton size="small" onClick={() => removeOption(oi)} sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}>
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ))}
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={addOption}
              sx={{ alignSelf: "flex-start", textTransform: "none", fontSize: 12, color: accent, fontWeight: 600 }}
            >
              Add option
            </Button>
          </Box>
        )}

        {/* Linear scale config */}
        {q.question_type === "linear_scale" && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, pl: 1 }}>
            <FormControl size="small" sx={{ minWidth: 80 }}>
              <InputLabel>Min</InputLabel>
              <Select label="Min" value={q.scale_min} onChange={(e) => onChange({ ...q, scale_min: e.target.value })}>
                {[0, 1].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary">to</Typography>
            <FormControl size="small" sx={{ minWidth: 80 }}>
              <InputLabel>Max</InputLabel>
              <Select label="Max" value={q.scale_max} onChange={(e) => onChange({ ...q, scale_max: e.target.value })}>
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <Box sx={{ display: "flex", gap: 0.5 }}>
              {Array.from({ length: q.scale_max - q.scale_min + 1 }, (_, i) => q.scale_min + i).map((n) => (
                <Chip key={n} label={n} size="small" sx={{ fontSize: 11, height: 22 }} />
              ))}
            </Box>
          </Box>
        )}

        <Divider sx={{ borderColor: isDark ? "rgba(255,255,255,0.07)" : "#f0e8e8" }} />

        {/* Required toggle */}
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={q.required}
                onChange={(e) => onChange({ ...q, required: e.target.checked })}
                sx={{
                  "& .MuiSwitch-switchBase.Mui-checked": { color: accent },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: accent },
                }}
              />
            }
            label={<Typography variant="caption" fontWeight={600}>Required</Typography>}
            labelPlacement="start"
          />
        </Box>
      </Box>
    </Paper>
  );
}

export default function PollBuilder({ value, onChange, isDark }) {
  const accent = isDark ? "#FF4500" : "#A84D48";
  const border = isDark ? "rgba(255,255,255,0.1)" : "#ecdcdc";

  const questions = value || [];

  const updateQuestion = (idx, updated) => {
    const next = questions.map((q, i) => (i === idx ? updated : q));
    onChange(next);
  };

  const deleteQuestion = (idx) => onChange(questions.filter((_, i) => i !== idx));

  const moveQuestion = (idx, dir) => {
    const next = [...questions];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const addQuestion = () => onChange([...questions, newQuestion()]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {questions.length === 0 && (
        <Box sx={{ textAlign: "center", py: 3, border: `2px dashed ${border}`, borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">No questions yet. Add one below.</Typography>
        </Box>
      )}

      {questions.map((q, idx) => (
        <QuestionCard
          key={q._key}
          q={q}
          idx={idx}
          total={questions.length}
          onChange={(updated) => updateQuestion(idx, updated)}
          onDelete={deleteQuestion}
          onMove={moveQuestion}
          isDark={isDark}
        />
      ))}

      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={addQuestion}
        sx={{
          textTransform: "none",
          fontWeight: 700,
          borderColor: isDark ? "rgba(255,255,255,0.2)" : "#ddd",
          color: accent,
          borderStyle: "dashed",
          borderRadius: 2,
          py: 1,
          "&:hover": { borderColor: accent, bgcolor: isDark ? "rgba(255,69,0,0.07)" : "rgba(168,77,72,0.05)" },
        }}
      >
        Add question
      </Button>
    </Box>
  );
}
