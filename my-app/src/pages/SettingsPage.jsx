// --- SettingsPage: User account settings UI ---
import { useState } from "react";
import { supabase } from "../../backend/supabaseClient";
import apiFetch from "../utils/apiFetch";
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Divider,
  Select,
  MenuItem,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import { useAuth } from "../AuthContext";
import Avatar from "@mui/material/Avatar";
import SettingsIcon from "@mui/icons-material/Settings";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import { CAMPUSES } from "../constants/campuses";
import { TIME_ZONE_OPTIONS } from "../utils/timezone";

const NAME_MAX_LENGTH = 25;

export default function SettingsPage({
  themeMode = "auto",
  setThemeMode = () => {},
  timeZone,
  setTimeZone = () => {},
  effectiveTheme = "light",
}) {
  const isDark = effectiveTheme === "dark";
  const BRAND = {
    maroon: isDark ? "#C96E47" : "#7a2929",
    maroonDark: isDark ? "#B35D38" : "#5e1f1f",
    maroonLight: isDark ? "#DA8864" : "#a04040",
    maroonFaint: isDark ? "rgba(201,110,71,0.12)" : "rgba(122,41,41,0.06)",
    maroonFaintHover: isDark ? "rgba(201,110,71,0.18)" : "rgba(122,41,41,0.10)",
    cardBorder: isDark ? "rgba(255,255,255,0.14)" : "rgba(122,41,41,0.12)",
    textPrimary: isDark ? "#D7DADC" : "#2d2d2d",
    textSecondary: isDark ? "#818384" : "#6b6b6b",
    bg: isDark ? "#101214" : "#f9f5f4",
    dot: isDark ? "rgba(255,255,255,0.07)" : "rgba(122,41,41,0.18)",
    surface: isDark ? "#1A1A1B" : "#fff",
    inputBg: isDark ? "#2D2D2E" : "#fff",
  };

  const { user, profile, updateProfile, logout, forgotPassword } = useAuth();
  const [message, setMessage] = useState("");

  const [editMode, setEditMode] = useState(false);
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [nameMessage, setNameMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [defaultCampus, setDefaultCampus] = useState(
    profile?.default_campus || "boston"
  );
  const [campusMessage, setCampusMessage] = useState("");

  const handleSaveCampus = async (campusId) => {
    if (!user?.id) return;
    setDefaultCampus(campusId);
    setCampusMessage("");
    try {
      await apiFetch("/api/profile/campus", {
        method: "PATCH",
        body: JSON.stringify({ default_campus: campusId }),
      });
      updateProfile({ default_campus: campusId });
      setCampusMessage("Default campus updated!");
      setTimeout(() => setCampusMessage(""), 2000);
    } catch {
      setCampusMessage("Error updating campus.");
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    setMessage("");
    const { error } = await forgotPassword(user.email);
    if (error) {
      setMessage("Error sending password reset email.");
    } else {
      setMessage("Password reset email sent! Check your inbox.");
    }
  };

  const handleSaveName = async () => {
    if (!user?.id) return;
    setNameMessage("");

    if (
      firstName.trim().length > NAME_MAX_LENGTH ||
      lastName.trim().length > NAME_MAX_LENGTH
    ) {
      setNameMessage(`First and last name must be ${NAME_MAX_LENGTH} characters or fewer.`);
      return;
    }

    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ first_name: firstName, last_name: lastName }),
      });
      updateProfile({ first_name: firstName, last_name: lastName });
      setNameMessage("Name updated!");
      setEditMode(false);
    } catch {
      setNameMessage("Error updating name.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    setDeleteMessage("");
    try {
      await apiFetch("/api/profile", { method: "DELETE" });
      // Auth user is already deleted server-side, sign out locally to clear session
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      setDeleteMessage("Error deleting account. Please contact support.");
      setDeleteOpen(false);
    }
  };

  // --- Shared button styles ---
  const btnMain = {
    bgcolor: BRAND.maroon,
    color: "#fff",
    fontWeight: 600,
    borderRadius: 2,
    textTransform: "none",
    py: 1,
    fontSize: "0.9rem",
    boxShadow: "none",
    "&:hover": {
      bgcolor: BRAND.maroonDark,
      boxShadow: isDark
        ? "0 2px 8px rgba(201,110,71,0.22)"
        : "0 2px 8px rgba(122,41,41,0.25)",
    },
  };

  const btnOutline = {
    color: BRAND.maroon,
    borderColor: BRAND.cardBorder,
    fontWeight: 600,
    borderRadius: 2,
    textTransform: "none",
    py: 1,
    fontSize: "0.9rem",
    "&:hover": {
      borderColor: BRAND.maroon,
      bgcolor: BRAND.maroonFaint,
    },
  };

  // --- Reusable section label ---
  const SectionLabel = ({ children, icon: Icon, color }) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
      {Icon && (
        <Icon
          sx={{ fontSize: 18, color: color || BRAND.maroon, opacity: 0.7 }}
        />
      )}
      <Typography
        variant="overline"
        sx={{
          color: color || BRAND.textSecondary,
          letterSpacing: 1.5,
          fontWeight: 700,
          fontSize: "0.7rem",
        }}
      >
        {children}
      </Typography>
    </Box>
  );

  // --- Styled text field overrides for maroon focus ---
  const textFieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: 2,
      bgcolor: BRAND.inputBg,
      color: BRAND.textPrimary,
      "&.Mui-focused fieldset": {
        borderColor: BRAND.maroon,
      },
      "& fieldset": {
        borderColor: BRAND.cardBorder,
      },
    },
    "& .MuiInputLabel-root": {
      color: BRAND.textSecondary,
    },
    "& .MuiInputLabel-root.Mui-focused": {
      color: BRAND.maroon,
    },
  };

  return (
    <>
      {/* --- Dotted background (matches login page) --- */}
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          backgroundColor: BRAND.bg,
          backgroundImage:
            `radial-gradient(circle, ${BRAND.dot} 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* --- Centered content --- */}
      <Box
        sx={{
          minHeight: "calc(100dvh - 100px)",
          boxSizing: "border-box",
          display: "flex",
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "center",
          px: 2,
          py: { xs: 2, md: 3 },
        }}
      >
        <Container component="main" maxWidth="md">
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, sm: 4, md: 4 },
              width: "100%",
              borderRadius: 3,
              backgroundColor: BRAND.surface,
              border: `1px solid ${BRAND.cardBorder}`,
              boxShadow: "0 10px 40px rgba(0,0,0,0.12), 0 2px 10px rgba(0,0,0,0.06)",
            }}
          >
            {/* --- Header row --- */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                mb: 1,
              }}
            >
              <Avatar
                sx={{
                  bgcolor: BRAND.maroonFaint,
                  color: BRAND.maroon,
                  width: 52,
                  height: 52,
                }}
              >
                <SettingsIcon fontSize="large" />
              </Avatar>
              <Box>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 700, color: BRAND.textPrimary }}
                >
                  Account Settings
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: BRAND.textSecondary, mt: 0.25 }}
                >
                  Manage your profile and security
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 3, borderColor: BRAND.cardBorder }} />

            {/* --- Two-column layout --- */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: { xs: 3, sm: 5 },
              }}
            >
              {/* === LEFT COLUMN: Profile & Security === */}
              <Box>
                <SectionLabel icon={EditOutlinedIcon}>Profile</SectionLabel>

                {/* Email */}
                <Box
                  sx={{
                    bgcolor: BRAND.maroonFaint,
                    borderRadius: 2,
                    px: 2,
                    py: 1.5,
                    mb: 2,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: BRAND.textSecondary, fontWeight: 500 }}
                  >
                    Email
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: BRAND.maroon }}
                  >
                    {user?.email}
                  </Typography>
                </Box>

                {/* Name */}
                <Box
                  sx={{
                    bgcolor: BRAND.maroonFaint,
                    borderRadius: 2,
                    px: 2,
                    py: 1.5,
                    mb: 2,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: BRAND.textSecondary, fontWeight: 500 }}
                  >
                    Name
                  </Typography>
                  {editMode ? (
                    <Box sx={{ mt: 1 }}>
                      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5, mb: 1.5 }}>
                        <TextField
                          label="First Name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value.slice(0, NAME_MAX_LENGTH))}
                          size="small"
                          inputProps={{ maxLength: NAME_MAX_LENGTH }}
                          helperText={`${firstName.length}/${NAME_MAX_LENGTH}`}
                          sx={{ flex: 1, borderRadius: 2, ...textFieldSx }}
                        />
                        <TextField
                          label="Last Name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value.slice(0, NAME_MAX_LENGTH))}
                          size="small"
                          inputProps={{ maxLength: NAME_MAX_LENGTH }}
                          helperText={`${lastName.length}/${NAME_MAX_LENGTH}`}
                          sx={{ flex: 1, borderRadius: 2, ...textFieldSx }}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ color: BRAND.textSecondary, display: "block", mb: 1 }}>
                        Max {NAME_MAX_LENGTH} characters for first and last name.
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        <Button
                          variant="contained"
                          size="small"
                          sx={{ ...btnMain, py: 0.5, px: 2.5 }}
                          onClick={handleSaveName}
                        >
                          Save
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          sx={{ ...btnOutline, py: 0.5, px: 2 }}
                          onClick={() => {
                            setEditMode(false);
                            setNameMessage("");
                          }}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, color: BRAND.maroon }}
                      >
                        {profile?.first_name} {profile?.last_name}
                      </Typography>
                      <Button
                        size="small"
                        sx={{
                          ml: 1,
                          color: BRAND.maroon,
                          textTransform: "none",
                          fontWeight: 600,
                          minWidth: "auto",
                          fontSize: "0.8rem",
                          "&:hover": { bgcolor: BRAND.maroonFaintHover },
                        }}
                        onClick={() => {
                          setFirstName(profile?.first_name || "");
                          setLastName(profile?.last_name || "");
                          setNameMessage("");
                          setEditMode(true);
                        }}
                      >
                        Edit
                      </Button>
                    </Box>
                  )}
                </Box>
                {nameMessage && (
                  <Alert
                    severity={nameMessage.includes("Error") ? "error" : "success"}
                    sx={{ mt: 1, borderRadius: 2 }}
                  >
                    {nameMessage}
                  </Alert>
                )}

                <Divider sx={{ my: 2.5, borderColor: BRAND.cardBorder }} />

                {/* -- Security -- */}
                <SectionLabel icon={LockOutlinedIcon}>Security</SectionLabel>
                {message && (
                  <Alert
                    severity={message.includes("Error") ? "error" : "success"}
                    sx={{ mb: 1.5, borderRadius: 2 }}
                  >
                    {message}
                  </Alert>
                )}
                <Button
                  variant="contained"
                  sx={{ ...btnMain, width: "100%" }}
                  onClick={handleChangePassword}
                >
                  Change Password
                </Button>

                <Divider sx={{ my: 2.5, borderColor: BRAND.cardBorder }} />

                {/* -- Log Out -- */}
                <SectionLabel icon={LogoutOutlinedIcon}>Log Out</SectionLabel>
                <Button
                  variant="outlined"
                  sx={{ ...btnOutline, width: "100%" }}
                  onClick={logout}
                  startIcon={<LogoutOutlinedIcon />}
                >
                  Log Out
                </Button>
              </Box>

              {/* === RIGHT COLUMN: Appearance, Preferences, Danger Zone === */}
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                {/* -- Appearance -- */}
                <SectionLabel icon={DarkModeOutlinedIcon}>Appearance</SectionLabel>
                <Box
                  sx={{
                    bgcolor: BRAND.maroonFaint,
                    borderRadius: 2,
                    px: 2,
                    py: 1.5,
                    mb: 2.5,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: BRAND.textSecondary,
                      fontWeight: 500,
                      mb: 0.75,
                      display: "block",
                    }}
                  >
                    Theme
                  </Typography>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={themeMode}
                      onChange={(e) => setThemeMode(e.target.value)}
                      sx={{
                        bgcolor: BRAND.inputBg,
                        color: BRAND.textPrimary,
                        borderRadius: 2,
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: BRAND.cardBorder,
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: BRAND.maroon,
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                          borderColor: BRAND.maroon,
                        },
                        "& .MuiSvgIcon-root": {
                          color: BRAND.textSecondary,
                        },
                      }}
                    >
                      <MenuItem value="auto">Device Default</MenuItem>
                      <MenuItem value="light">Light</MenuItem>
                      <MenuItem value="dark">Dark</MenuItem>
                    </Select>
                  </FormControl>
                  <Typography
                    variant="caption"
                    sx={{ color: BRAND.textSecondary, mt: 1, display: "block" }}
                  >
                    {themeMode === "auto"
                      ? `Following Device Default (${effectiveTheme} mode).`
                      : `Currently using ${effectiveTheme} mode.`}
                  </Typography>
                </Box>

                {/* -- Preferences -- */}
                <SectionLabel icon={LocationOnOutlinedIcon}>
                  Preferences
                </SectionLabel>
                <Box
                  sx={{
                    bgcolor: BRAND.maroonFaint,
                    borderRadius: 2,
                    px: 2,
                    py: 1.5,
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: BRAND.textSecondary,
                      fontWeight: 500,
                      mb: 0.75,
                      display: "block",
                    }}
                  >
                    Default campus
                  </Typography>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={defaultCampus}
                      onChange={(e) => handleSaveCampus(e.target.value)}
                      displayEmpty
                      sx={{
                        bgcolor: BRAND.inputBg,
                        color: BRAND.textPrimary,
                        borderRadius: 2,
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: BRAND.cardBorder,
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: BRAND.maroon,
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                          borderColor: BRAND.maroon,
                        },
                        "& .MuiSvgIcon-root": {
                          color: BRAND.textSecondary,
                        },
                      }}
                    >
                      {CAMPUSES.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name}, {c.state}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <Box
                  sx={{
                    bgcolor: BRAND.maroonFaint,
                    borderRadius: 2,
                    px: 2,
                    py: 1.5,
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: BRAND.textSecondary,
                      fontWeight: 500,
                      mb: 0.75,
                      display: "block",
                    }}
                  >
                    Time zone
                  </Typography>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={timeZone}
                      onChange={(e) => setTimeZone(e.target.value)}
                      sx={{
                        bgcolor: BRAND.inputBg,
                        color: BRAND.textPrimary,
                        borderRadius: 2,
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: BRAND.cardBorder,
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: BRAND.maroon,
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                          borderColor: BRAND.maroon,
                        },
                        "& .MuiSvgIcon-root": {
                          color: BRAND.textSecondary,
                        },
                      }}
                    >
                      {TIME_ZONE_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label} ({option.description})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Typography
                    variant="caption"
                    sx={{ color: BRAND.textSecondary, mt: 1, display: "block" }}
                  >
                    All listing, message, and moderation times follow this setting. Eastern Time is the default.
                  </Typography>
                </Box>
                {campusMessage && (
                  <Alert
                    severity={
                      campusMessage.includes("Error") ? "error" : "success"
                    }
                    sx={{ mt: 0.5, borderRadius: 2 }}
                  >
                    {campusMessage}
                  </Alert>
                )}

                <Divider sx={{ my: 2.5, borderColor: BRAND.cardBorder }} />

                <SectionLabel icon={DeleteOutlineIcon} color="#d32f2f">
                  Danger Zone
                </SectionLabel>
                {deleteMessage && (
                  <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }}>
                    {deleteMessage}
                  </Alert>
                )}
                <Button
                  variant="outlined"
                  color="error"
                  sx={{
                    width: "100%",
                    fontWeight: 600,
                    borderRadius: 2,
                    textTransform: "none",
                    py: 1,
                    fontSize: "0.9rem",
                  }}
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete Account
                </Button>
              </Box>
            </Box>
          </Paper>
        </Container>
      </Box>

      {/* --- Delete confirmation dialog --- */}
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            px: 1,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Delete your account?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This action is permanent and cannot be undone. All your data will be
            removed. Are you sure you want to continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDeleteOpen(false)}
            sx={{
              color: BRAND.textSecondary,
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteAccount}
            sx={{
              fontWeight: 600,
              borderRadius: 2,
              textTransform: "none",
              boxShadow: "none",
            }}
          >
            Yes, Delete My Account
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}