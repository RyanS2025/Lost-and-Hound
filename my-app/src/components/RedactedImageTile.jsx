import { Box, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

/**
 * Stands in for a photo that sensitive-content screening rejected.
 *
 * There is nothing to reveal here: the image was deleted from storage before
 * the listing row was ever written, and no derivative of it was kept. The blur
 * is synthetic — a blurred gradient, not a downsampled copy of what the
 * student uploaded. That distinction is the whole point. Blurring the real
 * photo would mean storing data derived from an ID card in order to say we
 * are not storing the ID card.
 *
 * Implementation note: the frost comes from blurring an oversized child inside
 * an `overflow: hidden` parent, NOT from `backdrop-filter`. backdrop-filter
 * needs content behind it to sample and is unreliable in the iOS WKWebView
 * this app ships in via Capacitor.
 */
export default function RedactedImageTile({ variant = "card", isDark = false, sx = {} }) {
  const showCaption = variant !== "thumb";
  const showExplanation = variant === "hero";

  const iconSize = { thumb: 22, card: 26, hero: 34 }[variant] ?? 26;

  return (
    <Box
      role="img"
      aria-label="Photo hidden — it appeared to contain sensitive personal information"
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 2,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        px: showCaption ? 1.5 : 0,
        background: isDark ? "#232324" : "#f5f0f0",
        border: isDark ? "1px solid rgba(255,255,255,0.14)" : "1.5px solid #ecdcdc",
        ...sx,
      }}
    >
      {/* Decorative only, and inert to screen readers — the label above says
          everything this conveys. Inset past the edges so the blur has room to
          fall off rather than fading to the background at the border. */}
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          inset: -24,
          filter: "blur(18px)",
          background: isDark
            ? "radial-gradient(circle at 28% 30%, rgba(168,77,72,0.40), transparent 58%), radial-gradient(circle at 76% 72%, rgba(120,120,128,0.34), transparent 55%), linear-gradient(135deg, #2D2D2E 0%, #3a3335 55%, #262627 100%)"
            : "radial-gradient(circle at 28% 30%, rgba(168,77,72,0.24), transparent 58%), radial-gradient(circle at 76% 72%, rgba(196,168,167,0.40), transparent 55%), linear-gradient(135deg, #efe6e6 0%, #e4d7d7 55%, #f5f0f0 100%)",
        }}
      />

      <Box sx={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
        <LockOutlinedIcon sx={{ fontSize: iconSize, color: isDark ? "#d8a5a2" : "#A84D48" }} />

        {showCaption && (
          <Typography
            variant="caption"
            fontWeight={800}
            sx={{ color: isDark ? "#E8E6E3" : "#6b4a48", lineHeight: 1.3 }}
          >
            Photo hidden
          </Typography>
        )}

        {showExplanation && (
          <Typography
            variant="caption"
            sx={{ color: isDark ? "#B8BABD" : "#8a6f6e", maxWidth: 320, lineHeight: 1.4 }}
          >
            This photo was removed because it looked like an ID, bank card, or personal
            document. It was never saved.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
