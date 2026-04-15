import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

const ACCENT = "#A84D48";

export default function DemoDisclaimerModal({ open, onClose, isDark = false }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: isDark ? "#1A1A1B" : "#fff",
          border: isDark ? "1px solid rgba(255,255,255,0.14)" : `1.5px solid #ecdcdc`,
        },
      }}
    >
      <DialogTitle sx={{ pb: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <InfoOutlinedIcon sx={{ color: ACCENT, fontSize: 22 }} />
          <Typography fontWeight={800} fontSize={17} sx={{ color: isDark ? "#D7DADC" : "#2d2d2d" }}>
            You're in Demo Mode
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" sx={{ color: isDark ? "#B8BABD" : "#555", lineHeight: 1.7 }}>
          This is a <strong>fake environment</strong> — all data is fictional and no real accounts are involved.
        </Typography>
        <Typography variant="body2" sx={{ color: isDark ? "#B8BABD" : "#555", lineHeight: 1.7, mt: 1.5 }}>
          Some features are intentionally disabled:
        </Typography>
        <Box component="ul" sx={{ mt: 0.5, pl: 2.5, color: isDark ? "#B8BABD" : "#555" }}>
          {[
            "Creating or resolving posts",
            "Submitting support tickets",
            "Changing account settings",
            "Reporting users or listings",
          ].map((item) => (
            <Typography key={item} component="li" variant="body2" sx={{ lineHeight: 1.8 }}>
              {item}
            </Typography>
          ))}
        </Box>
        <Typography variant="body2" sx={{ color: isDark ? "#B8BABD" : "#555", lineHeight: 1.7, mt: 1.5 }}>
          Everything else — browsing the feed, exploring the map, and reading messages — works as normal.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={onClose}
          variant="contained"
          fullWidth
          sx={{
            background: ACCENT,
            color: "#fff",
            fontWeight: 700,
            borderRadius: 2,
            textTransform: "none",
            "&:hover": { background: "#8f3e3a" },
          }}
        >
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
}
