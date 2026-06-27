import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Box, Typography, Paper, Button, TextField, Radio, RadioGroup,
  FormControlLabel, Checkbox, FormGroup, Select, MenuItem, FormControl,
  CircularProgress, Alert, LinearProgress, Slider,
} from "@mui/material";
import PollIcon from "@mui/icons-material/Poll";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import apiFetch from "../utils/apiFetch";
import { API_BASE } from "../utils/apiFetch";

function QuestionInput({ question, value, onChange, isDark }) {
  const accent = isDark ? "#FF4500" : "#A84D48";
  const { question_type: type, options: rawOptions, scale_min, scale_max } = question;
  const options = typeof rawOptions === "string" ? JSON.parse(rawOptions) : rawOptions;

  if (type === "short_answer") {
    return (
      <TextField
        fullWidth size="small" placeholder="Your answer"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ maxLength: 200 }}
        helperText={`${(value || "").length}/200`}
      />
    );
  }

  if (type === "paragraph") {
    return (
      <TextField
        fullWidth multiline rows={3} placeholder="Your answer"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ maxLength: 1000 }}
        helperText={`${(value || "").length}/1000`}
      />
    );
  }

  if (type === "multiple_choice") {
    return (
      <RadioGroup value={value || ""} onChange={(e) => onChange(e.target.value)}>
        {(options || []).map((opt) => (
          <FormControlLabel
            key={opt} value={opt} control={<Radio size="small" sx={{ color: accent, "&.Mui-checked": { color: accent } }} />}
            label={<Typography variant="body2">{opt}</Typography>}
          />
        ))}
      </RadioGroup>
    );
  }

  if (type === "checkbox") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <FormGroup>
        {(options || []).map((opt) => (
          <FormControlLabel
            key={opt}
            control={
              <Checkbox
                size="small"
                checked={selected.includes(opt)}
                onChange={(e) => {
                  if (e.target.checked) onChange([...selected, opt]);
                  else onChange(selected.filter((v) => v !== opt));
                }}
                sx={{ color: accent, "&.Mui-checked": { color: accent } }}
              />
            }
            label={<Typography variant="body2">{opt}</Typography>}
          />
        ))}
      </FormGroup>
    );
  }

  if (type === "dropdown") {
    return (
      <FormControl size="small" fullWidth>
        <Select value={value || ""} onChange={(e) => onChange(e.target.value)} displayEmpty>
          <MenuItem value="" disabled>Select an option</MenuItem>
          {(options || []).map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
        </Select>
      </FormControl>
    );
  }

  if (type === "linear_scale") {
    const min = scale_min ?? 1;
    const max = scale_max ?? 5;
    return (
      <Box sx={{ px: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">{min}</Typography>
          <Typography variant="caption" color="text.secondary">{max}</Typography>
        </Box>
        <Slider
          min={min} max={max} step={1}
          value={value ?? min}
          onChange={(_, v) => onChange(v)}
          marks
          valueLabelDisplay="auto"
          sx={{ color: accent }}
        />
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
            <Typography key={n} variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{n}</Typography>
          ))}
        </Box>
      </Box>
    );
  }

  return null;
}

export default function PollPage({ effectiveTheme = "light" }) {
  const isDark = effectiveTheme === "dark";
  const { slug } = useParams();
  const accent = isDark ? "#FF4500" : "#A84D48";
  const cardBorder = isDark ? "1px solid rgba(255,255,255,0.12)" : "1.5px solid #ecdcdc";
  const cardBg = isDark ? "#1A1A1B" : "#fff";

  const [poll, setPoll] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loadingPoll, setLoadingPoll] = useState(true);

  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/api/polls/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setLoadError(d.error);
        else setPoll(d.poll);
      })
      .catch(() => setLoadError("Failed to load poll."))
      .finally(() => setLoadingPoll(false));
  }, [slug]);

  const questions = poll?.questions || [];
  const progress = questions.length ? Math.round(((currentQ) / questions.length) * 100) : 0;

  const handleAnswer = (qId, val) => setAnswers((prev) => ({ ...prev, [qId]: val }));

  const handleNext = () => {
    const q = questions[currentQ];
    if (q.required && !answers[q.id] && answers[q.id] !== 0) {
      setSubmitError("This question is required.");
      return;
    }
    setSubmitError("");
    if (currentQ < questions.length - 1) setCurrentQ((n) => n + 1);
  };

  const handleBack = () => { setSubmitError(""); setCurrentQ((n) => n - 1); };

  const handleSubmit = async () => {
    const q = questions[currentQ];
    if (q.required && !answers[q.id] && answers[q.id] !== 0) {
      setSubmitError("This question is required.");
      return;
    }
    setSubmitError("");
    setSubmitting(true);
    try {
      await apiFetch(`/api/polls/${slug}/respond`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPoll) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: accent }} />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box sx={{ maxWidth: 480, mx: "auto", px: 3, py: 8, textAlign: "center" }}>
        <PollIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Poll Unavailable</Typography>
        <Typography color="text.secondary" variant="body2">{loadError}</Typography>
      </Box>
    );
  }

  if (submitted) {
    return (
      <Box sx={{ maxWidth: 520, mx: "auto", px: 3, py: 8, textAlign: "center" }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 56, color: "#16a34a", mb: 2 }} />
        <Typography variant="h5" fontWeight={900} sx={{ mb: 1 }}>Response submitted!</Typography>
        <Typography color="text.secondary" variant="body2">
          Thanks for completing <strong>{poll.title}</strong>. Your response has been recorded.
        </Typography>
      </Box>
    );
  }

  const q = questions[currentQ];
  const isLast = currentQ === questions.length - 1;

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 5 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <Box component="img" src="/TabLogo.png" alt="" sx={{ height: 28, width: 28, objectFit: "contain" }} />
        <Typography variant="caption" sx={{ fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.8 }}>
          Lost &amp; Hound
        </Typography>
      </Box>

      {/* Poll title card */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: cardBorder, background: cardBg, p: { xs: 2.5, sm: 3 }, mb: 2.5, borderTop: `4px solid ${accent}` }}>
        <Typography variant="h5" fontWeight={900} sx={{ mb: 0.5, color: isDark ? "#D7DADC" : "#1a1a1a" }}>
          {poll.title}
        </Typography>
        {poll.description && (
          <Typography variant="body2" color="text.secondary">{poll.description}</Typography>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          {questions.length} question{questions.length !== 1 ? "s" : ""}
        </Typography>
      </Paper>

      {/* Progress */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Question {currentQ + 1} of {questions.length}</Typography>
          <Typography variant="caption" color="text.secondary">{progress}%</Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ borderRadius: 2, height: 5, bgcolor: isDark ? "rgba(255,255,255,0.08)" : "#f0e8e8", "& .MuiLinearProgress-bar": { bgcolor: accent } }}
        />
      </Box>

      {/* Question card */}
      {q && (
        <Paper elevation={0} sx={{ borderRadius: 3, border: cardBorder, background: cardBg, p: { xs: 2.5, sm: 3 }, mb: 2 }}>
          <Typography variant="body1" fontWeight={700} sx={{ mb: 2, color: isDark ? "#D7DADC" : "#1a1a1a" }}>
            {q.question_text}
            {q.required && <Typography component="span" sx={{ color: "error.main", ml: 0.5 }}>*</Typography>}
          </Typography>

          <QuestionInput
            question={q}
            value={answers[q.id]}
            onChange={(val) => handleAnswer(q.id, val)}
            isDark={isDark}
          />

          {submitError && (
            <Alert severity="error" sx={{ mt: 1.5, py: 0.5, borderRadius: 2, fontSize: 13 }}>{submitError}</Alert>
          )}
        </Paper>
      )}

      {/* Navigation */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Button
          onClick={handleBack}
          disabled={currentQ === 0}
          sx={{ textTransform: "none", fontWeight: 600, color: "text.secondary" }}
        >
          Back
        </Button>
        {isLast ? (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting}
            sx={{
              background: accent, "&:hover": { background: isDark ? "#E03D00" : "#8a3d39" },
              textTransform: "none", fontWeight: 700, borderRadius: 2, px: 4,
            }}
          >
            {submitting ? <CircularProgress size={16} color="inherit" /> : "Submit"}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            sx={{
              background: accent, "&:hover": { background: isDark ? "#E03D00" : "#8a3d39" },
              textTransform: "none", fontWeight: 700, borderRadius: 2, px: 4,
            }}
          >
            Next
          </Button>
        )}
      </Box>
    </Box>
  );
}
