// --- SettingsPage: User account settings UI ---
import { useState } from "react";
import { supabase } from "../supabaseClient";
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
import { CAMPUSES } from "../constants/campuses";

export default function SettingsPage() {
  const { user, profile, updateProfile, logout, forgotPassword } = useAuth();
  const [message, setMessage] = useState("");

  const [editMode, setEditMode] = useState(false);
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [nameMessage, setNameMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [defaultCampus, setDefaultCampus] = useState(profile?.default_campus || "boston");
  const [campusMessage, setCampusMessage] = useState("");

  const handleSaveCampus = async (campusId) => {
    if (!user?.id) return;
    setDefaultCampus(campusId);
    setCampusMessage("");
    const { error } = await supabase
      .from("profiles")
      .update({ default_campus: campusId })
      .eq("id", user.id);
    if (error) {
      setCampusMessage("Error updating campus.");
    } else {
      updateProfile({ default_campus: campusId });
      setCampusMessage("Default campus updated!");
      setTimeout(() => setCampusMessage(""), 2000);
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
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: firstName, last_name: lastName })
      .eq("id", user.id);
    if (error) {
      setNameMessage("Error updating name.");
    } else {
      updateProfile({ first_name: firstName, last_name: lastName });
      setNameMessage("Name updated!");
      setEditMode(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    setDeleteMessage("");
    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user.id);
      if (error) throw error;
      await supabase.auth.signOut();
    } catch {
      setDeleteMessage("Error deleting account. Please contact support.");
      setDeleteOpen(false);
    }
  };

  const btnMain = {
    bgcolor: "#7a2929",
    color: "#fff",
    fontWeight: 600,
    "&:hover": { bgcolor: "#5e1f1f" },
  };

  const btnOutline = {
    color: "#7a2929",
    borderColor: "#7a2929",
    fontWeight: 600,
    "&:hover": {
      borderColor: "#5e1f1f",
      bgcolor: "rgba(122,41,41,0.04)",
    },
  };

  return (
    <>
      {/* --- Background --- */}
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          background:
            "linear-gradient(135deg, #e06057 0%, #cf544b 40%, #7a2929 100%)",
        }}
      />

      {/* --- Centered content --- */}
      <Box
        sx={{
          height: "calc(100vh - 120px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
          py: 3,
        }}
      >
        <Container component="main" maxWidth="lg">
          <Paper
            elevation={6}
            sx={{
              p: { xs: 4, sm: 5, md: 6 },
              width: "100%",
              borderRadius: 3,
              backgroundColor: "rgba(255,255,255,0.97)",
              boxShadow: "0px 10px 30px rgba(0,0,0,0.15)",
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
              <Avatar sx={{ bgcolor: "#7a2929", width: 56, height: 56 }}>
                <SettingsIcon fontSize="large" />
              </Avatar>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  Account Settings
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Manage your profile and security
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 3 }} />

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
                <Typography
                  variant="overline"
                  sx={{ color: "text.secondary", letterSpacing: 1.5 }}
                >
                  Profile
                </Typography>

                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.25 }}>
                    Email
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: "#7a2929" }}>
                    {user?.email}
                  </Typography>
                </Box>

                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.25 }}>
                    Name
                  </Typography>
                  {editMode ? (
                    <Box sx={{ mt: 1 }}>
                      <Box sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
                        <TextField
                          label="First Name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          size="small"
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          label="Last Name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          size="small"
                          sx={{ flex: 1 }}
                        />
                      </Box>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Button variant="contained" size="small" sx={btnMain} onClick={handleSaveName}>
                          Save
                        </Button>
                        <Button
                          variant="outlined" size="small" sx={btnOutline}
                          onClick={() => { setEditMode(false); setNameMessage(""); }}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: "#7a2929" }}>
                        {profile?.first_name} {profile?.last_name}
                      </Typography>
                      <Button
                        size="small"
                        sx={{ ml: 1, color: "#7a2929", textTransform: "none", fontWeight: 600, minWidth: "auto" }}
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
                  {nameMessage && (
                    <Alert severity={nameMessage.includes("Error") ? "error" : "success"} sx={{ mt: 1.5 }}>
                      {nameMessage}
                    </Alert>
                  )}
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* -- Security -- */}
                <Typography variant="overline" sx={{ color: "text.secondary", letterSpacing: 1.5 }}>
                  Security
                </Typography>
                {message && (
                  <Alert severity={message.includes("Error") ? "error" : "success"} sx={{ mt: 1, mb: 1 }}>
                    {message}
                  </Alert>
                )}
                <Button
                  variant="contained"
                  sx={{ ...btnMain, mt: 1, width: "100%" }}
                  onClick={handleChangePassword}
                >
                  Change Password
                </Button>
              </Box>

              {/* === RIGHT COLUMN: Preferences, Session, Danger Zone === */}
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                {/* -- Preferences -- */}
                <Typography variant="overline" sx={{ color: "text.secondary", letterSpacing: 1.5 }}>
                  Preferences
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
                  <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                    Default campus
                  </Typography>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <Select
                      value={defaultCampus}
                      onChange={(e) => handleSaveCampus(e.target.value)}
                      displayEmpty
                    >
                      {CAMPUSES.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name}, {c.state}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                {campusMessage && (
                  <Alert severity={campusMessage.includes("Error") ? "error" : "success"} sx={{ mt: 1 }}>
                    {campusMessage}
                  </Alert>
                )}

                <Divider sx={{ my: 2 }} />

                {/* -- Session -- */}
                <Typography variant="overline" sx={{ color: "text.secondary", letterSpacing: 1.5 }}>
                  Session
                </Typography>
                <Button
                  variant="outlined"
                  sx={{ ...btnOutline, width: "100%", mt: 1 }}
                  onClick={logout}
                >
                  Log Out
                </Button>

                <Divider sx={{ my: 2 }} />

                {/* -- Danger zone -- */}
                <Typography variant="overline" sx={{ color: "error.main", letterSpacing: 1.5 }}>
                  Danger Zone
                </Typography>
                {deleteMessage && (
                  <Alert severity="error" sx={{ mt: 1, mb: 1 }}>
                    {deleteMessage}
                  </Alert>
                )}
                <Button
                  variant="outlined" color="error"
                  sx={{ width: "100%", fontWeight: 600, mt: 1 }}
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
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete your account?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This action is permanent and cannot be undone. All your data will be
            removed. Are you sure you want to continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDeleteOpen(false)}
            sx={{ color: "text.secondary" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteAccount}
            sx={{ fontWeight: 600 }}
          >
            Yes, Delete My Account
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}