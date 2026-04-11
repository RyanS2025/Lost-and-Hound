import { useState } from "react";
import { useTimezone } from "../contexts/TimezoneContext";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "../utils/supabaseClient";
import apiFetch from "../utils/apiFetch";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import ScreenHeader from "../components/ScreenHeader";
import { CAMPUSES } from "../constants/campuses";
import TermsModal from "../components/TermsModal";
import { TIME_ZONE_OPTIONS } from "../utils/timezone";

const NAME_MAX_LENGTH = 25;

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const { user, profile, updateProfile, logout } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [savingName, setSavingName] = useState(false);

  const [passwordStep, setPasswordStep] = useState<"idle" | "verify" | "change">("idle");
  const [currentPassword, setCurrentPassword] = useState("");
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [savingCampus, setSavingCampus] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const { timezone, setTimezone } = useTimezone();

  const handleSaveName = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setSavingName(true);
    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim() }),
      });
      updateProfile({ first_name: firstName.trim(), last_name: lastName.trim() });
      setEditingName(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update name.");
    }
    setSavingName(false);
  };

  const handleVerifyCurrentPassword = async () => {
    if (!currentPassword.trim()) {
      Alert.alert("Error", "Please enter your current password.");
      return;
    }
    setVerifyingPassword(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user?.email,
        password: currentPassword,
      });
      if (error) throw error;
      setPasswordStep("change");
      setCurrentPassword("");
    } catch (err: any) {
      Alert.alert("Verification Failed", "Incorrect password.");
    }
    setVerifyingPassword(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      });
      Alert.alert("Success", "Password updated successfully.");
      setPasswordStep("idle");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to change password.");
    }
    setSavingPassword(false);
  };

  const handleCampusChange = async (campusId: string) => {
    setSavingCampus(true);
    try {
      await apiFetch("/api/profile/campus", {
        method: "PATCH",
        body: JSON.stringify({ default_campus: campusId }),
      });
      updateProfile({ default_campus: campusId });
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update campus.");
    }
    setSavingCampus(false);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account, all your listings, messages, and data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch("/api/profile", { method: "DELETE" });
              await logout();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete account.");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
      <ScreenHeader title="Settings" leftIcon="chevron-back" onLeftPress={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile */}
        <Text style={[styles.sectionTitle, { color: t.muted }]}>Profile</Text>
        <View style={[styles.card, { backgroundColor: t.cardSolid, borderColor: t.cardBorder }]}>
          <Text style={[styles.label, { color: t.muted }]}>Email</Text>
          <Text style={[styles.value, { color: t.text }]}>{user?.email || ""}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: t.cardSolid, borderColor: t.cardBorder }]}>
          <Text style={[styles.label, { color: t.muted }]}>Name</Text>
          {editingName ? (
            <View style={{ gap: 8 }}>
              <TextInput
                style={[styles.input, { backgroundColor: t.inputBg, color: t.text }]}
                value={firstName}
                onChangeText={(txt) => setFirstName(txt.slice(0, NAME_MAX_LENGTH))}
                placeholder="First name"
                placeholderTextColor="#818384"
              />
              <TextInput
                style={[styles.input, { backgroundColor: t.inputBg, color: t.text }]}
                value={lastName}
                onChangeText={(txt) => setLastName(txt.slice(0, NAME_MAX_LENGTH))}
                placeholder="Last name"
                placeholderTextColor="#818384"
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: t.accent }]} onPress={handleSaveName} disabled={savingName}>
                  {savingName ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={() => { setEditingName(false); setFirstName(profile?.first_name || ""); setLastName(profile?.last_name || ""); }}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={[styles.value, { color: t.text }]}>{profile?.first_name} {profile?.last_name}</Text>
              <TouchableOpacity onPress={() => setEditingName(true)}>
                <Text style={[styles.editLink, { color: t.accent }]}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Security */}
        <Text style={[styles.sectionTitle, { color: t.muted }]}>Security</Text>
        <View style={[styles.card, { backgroundColor: t.cardSolid, borderColor: t.cardBorder }]}>
          {passwordStep === "idle" ? (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: t.accent }]} onPress={() => setPasswordStep("verify")}>
              <Text style={styles.actionButtonText}>Change Password</Text>
            </TouchableOpacity>
          ) : passwordStep === "verify" ? (
            <View style={{ gap: 8 }}>
              <Text style={[{ fontSize: 13, fontWeight: "600", color: t.subtext }]}>Enter your current password to continue</Text>
              <TextInput
                style={[styles.input, { backgroundColor: t.inputBg, color: t.text }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Current password"
                placeholderTextColor="#818384"
                secureTextEntry
                autoFocus
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: t.accent }]} onPress={handleVerifyCurrentPassword} disabled={verifyingPassword}>
                  {verifyingPassword ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Verify</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={() => { setPasswordStep("idle"); setCurrentPassword(""); }}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <TextInput
                style={[styles.input, { backgroundColor: t.inputBg, color: t.text }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New password"
                placeholderTextColor="#818384"
                secureTextEntry
              />
              <TextInput
                style={[styles.input, { backgroundColor: t.inputBg, color: t.text }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                placeholderTextColor="#818384"
                secureTextEntry
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: t.accent }]} onPress={handleChangePassword} disabled={savingPassword}>
                  {savingPassword ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Update</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={() => { setPasswordStep("idle"); setNewPassword(""); setConfirmPassword(""); }}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Campus */}
        <Text style={[styles.sectionTitle, { color: t.muted }]}>Default Campus</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.campusContainer}>
          {CAMPUSES.map((c: any) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => handleCampusChange(c.id)}
              style={[styles.campusChip, { backgroundColor: profile?.default_campus === c.id ? t.accent : t.cardSolid, borderColor: profile?.default_campus === c.id ? t.accent : t.cardBorder }]}
              disabled={savingCampus}
            >
              <Text style={[styles.campusChipText, { color: profile?.default_campus === c.id ? "#fff" : t.subtext }]}>
                {c.name}, {c.state}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Timezone — manual preference, independent of campus */}
        <Text style={[styles.sectionTitle, { color: t.muted }]}>Time Zone</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.campusContainer}>
          {TIME_ZONE_OPTIONS.map((tz: any) => {
            const isActive = tz.value === timezone;
            return (
              <TouchableOpacity
                key={tz.value}
                onPress={() => setTimezone(tz.value)}
                style={[styles.campusChip, { backgroundColor: isActive ? t.accent : t.cardSolid, borderColor: isActive ? t.accent : t.cardBorder }]}
              >
                <Text style={[styles.campusChipText, { color: isActive ? "#fff" : t.subtext }]}>{tz.label} ({tz.description})</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* About */}
        <Text style={[styles.sectionTitle, { color: t.muted }]}>About</Text>
        <View style={[styles.card, { backgroundColor: t.cardSolid, borderColor: t.cardBorder }]}>
          <TouchableOpacity style={styles.aboutRow} onPress={() => Alert.alert("Credits", "Lost & Hound was built by Nahom Hailemelekot, Benjamin Hailu, Liam Pulsifer, and Ryan Sinha.\n\nProject context: Oasis @ Northeastern University.")}>
            <Ionicons name="people-outline" size={18} color={t.subtext} />
            <Text style={[styles.aboutText, { color: t.text }]}>Credits</Text>
            <Ionicons name="chevron-forward" size={16} color={t.muted} />
          </TouchableOpacity>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.separator }} />
          <TouchableOpacity style={styles.aboutRow} onPress={() => Alert.alert("Disclaimer", "Lost & Hound is a student-made project created as part of Oasis @ Northeastern University.\n\nThis project is not affiliated with, endorsed by, or related to Northeastern University. It is an independent student initiative.")}>
            <Ionicons name="information-circle-outline" size={18} color={t.subtext} />
            <Text style={[styles.aboutText, { color: t.text }]}>Disclaimer</Text>
            <Ionicons name="chevron-forward" size={16} color={t.muted} />
          </TouchableOpacity>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.separator }} />
          <TouchableOpacity style={styles.aboutRow} onPress={() => setTermsOpen(true)}>
            <Ionicons name="document-text-outline" size={18} color={t.subtext} />
            <Text style={[styles.aboutText, { color: t.text }]}>Terms & Conditions</Text>
            <Ionicons name="chevron-forward" size={16} color={t.muted} />
          </TouchableOpacity>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.separator }} />
          <TouchableOpacity style={styles.aboutRow} onPress={() => Alert.alert("Privacy & Data", "We store account profile information and app content needed to operate Lost & Hound, including listings and messages.\n\nData may be reviewed by moderators only when reports are submitted or policy enforcement is required.\n\nYou can request account removal from Settings, subject to moderation and legal retention requirements.")}>
            <Ionicons name="shield-checkmark-outline" size={18} color={t.subtext} />
            <Text style={[styles.aboutText, { color: t.text }]}>Privacy & Data</Text>
            <Ionicons name="chevron-forward" size={16} color={t.muted} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={[styles.logoutButton, { borderColor: t.accent }]} onPress={logout}>
          <Text style={[styles.logoutText, { color: t.accent }]}>Log Out</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>

      <TermsModal visible={termsOpen} onClose={() => setTermsOpen(false)} readOnly />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.14)" },
  headerTitle: { fontSize: 18, fontWeight: "900" },
  backText: { fontWeight: "700", fontSize: 15 },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontWeight: "800", fontSize: 12, textTransform: "uppercase", marginTop: 20, marginBottom: 8, letterSpacing: 1 },
  card: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 8 },
  label: { fontSize: 11, fontWeight: "700", marginBottom: 4 },
  value: { fontSize: 15, fontWeight: "600" },
  editLink: { fontWeight: "700", fontSize: 13 },
  input: { borderRadius: 8, padding: 12, fontSize: 15, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  saveButton: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cancelButton: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  cancelButtonText: { color: "#B8BABD", fontWeight: "700", fontSize: 14 },
  actionButton: { borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  actionButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  campusContainer: { gap: 6, paddingBottom: 8 },
  campusChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  campusChipText: { fontWeight: "700", fontSize: 12 },
  aboutRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  aboutText: { flex: 1, fontSize: 14, fontWeight: "600" },
  logoutButton: { marginTop: 24, borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  logoutText: { fontWeight: "700", fontSize: 15 },
  deleteButton: { marginTop: 12, borderWidth: 1, borderColor: "#ef4444", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  deleteText: { color: "#ef4444", fontWeight: "700", fontSize: 15
  },
});
