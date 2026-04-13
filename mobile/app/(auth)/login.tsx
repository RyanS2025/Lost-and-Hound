import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { supabase } from "../../utils/supabaseClient";
import apiFetch, { setDeviceToken } from "../../utils/apiFetch";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import TermsModal from "../../components/TermsModal";

const NAME_MAX_LENGTH = 25;
const PASSWORD_MAX_LENGTH = 32;

export default function LoginScreen() {
  const router = useRouter();
  const { setMfaVerified } = useAuth();
  const { t, themeMode, setThemeMode } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [authStep, setAuthStep] = useState<"credentials" | "mfa">("credentials");
  const [otpCode, setOtpCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaChallengeId, setMfaChallengeId] = useState("");
  const [mfaQrUri, setMfaQrUri] = useState("");
  const [mfaIsEnrollment, setMfaIsEnrollment] = useState(false);
  const [mfaVerifying, setMfaVerifying] = useState(false);

  function cleanErrorMessage(msg: string): string {
    if (!msg) return "Something went wrong. Please try again.";
    const lower = msg.toLowerCase();
    if (lower.includes("email not confirmed")) return "EMAIL_NOT_CONFIRMED";
    if (lower.includes("user already registered") || lower.includes("email already registered"))
      return "An account with this email already exists.";
    if (msg.includes("Invalid login credentials")) return "Incorrect email or password.";
    if (msg.includes("user not found")) return "No account found with this email.";
    if (msg.includes("6 characters")) return "Password must be at least 6 characters.";
    if (msg.includes("rate limit")) return "Too many attempts. Please try again later.";
    if (msg.includes("valid email")) return "Please enter a valid email address.";
    return msg;
  }

  const startMfaFlow = async (existingFactorsData: any = null) => {
    let factorsData = existingFactorsData;
    if (!factorsData) {
      const { data, error: err } = await supabase.auth.mfa.listFactors();
      if (err) throw err;
      factorsData = data;
    }

    const totpFactors =
      factorsData?.all?.filter((f: any) => f.factor_type === "totp") ||
      factorsData?.totp || [];
    const verifiedFactor = totpFactors.find((f: any) => f.status === "verified") || null;

    if (verifiedFactor?.id) {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: verifiedFactor.id });
      if (challengeError) throw challengeError;
      setMfaFactorId(verifiedFactor.id);
      setMfaChallengeId(challengeData.id);
      setMfaQrUri("");
      setMfaIsEnrollment(false);
      setOtpCode("");
      setAuthStep("mfa");
      setMessage("Open your authenticator app and enter the current 6-digit code.");
      return;
    }

    for (const factor of totpFactors) {
      if (factor?.id) await supabase.auth.mfa.unenroll({ factorId: factor.id }).catch(() => null);
    }

    const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Lost & Hound ${new Date().toISOString().slice(0, 10)}`,
    });
    if (enrollError) throw enrollError;

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrollData.id });
    if (challengeError) throw challengeError;

    setMfaFactorId(enrollData.id);
    setMfaChallengeId(challengeData.id);
    setMfaQrUri(enrollData.totp?.uri || "");
    setMfaIsEnrollment(true);
    setOtpCode("");
    setAuthStep("mfa");
    setMessage("Set up your authenticator app, then enter the 6-digit code.");
  };

  const doSignUp = async () => {
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password, options: { data: { first_name: firstName.trim(), last_name: lastName.trim() } } });
      if (signUpError) { setError(cleanErrorMessage(signUpError.message)); return; }
      if (data.user?.identities?.length === 0) { setError("An account with this email already exists."); return; }
      setMessage("Check your email to confirm your account before signing in.");
      setFirstName(""); setLastName("");
    } catch (err: any) { setError(cleanErrorMessage(err.message || err.code)); }
    finally { setLoading(false); }
  };

  // Reset terms accepted when switching between sign-up and sign-in
  useEffect(() => { setTermsAccepted(false); }, [isSignUp]);

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    if (!email.endsWith("@northeastern.edu")) { setError("You must use a @northeastern.edu email address."); return; }
    if (isSignUp && (!firstName.trim() || !lastName.trim())) { setError("Please enter your first and last name."); return; }
    if (isSignUp && (firstName.trim().length > NAME_MAX_LENGTH || lastName.trim().length > NAME_MAX_LENGTH)) { setError(`Names must be ${NAME_MAX_LENGTH} characters or fewer.`); return; }
    if (password.length > PASSWORD_MAX_LENGTH) { setError(`Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`); return; }

    setLoading(true);
    try {
      if (isSignUp) {
        // Show terms modal first — signup happens after acceptance
        if (!termsAccepted) {
          setLoading(false);
          setTermsOpen(true);
          return;
        }
        await doSignUp();
      } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;

        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;
        const hasVerifiedTotp = (factorsData?.all || []).some((f: any) => f.factor_type === "totp" && f.status === "verified") || (factorsData?.totp || []).some((f: any) => f.status === "verified");

        if (!hasVerifiedTotp) { await startMfaFlow(factorsData); return; }

        let deviceTrusted = false;
        if (signInData?.session?.access_token) {
          try { const d = await apiFetch("/api/auth/check-device", { method: "POST" }); deviceTrusted = d?.trusted === true; } catch {}
        }
        if (deviceTrusted) { setMfaVerified(true); return; }
        await startMfaFlow();
      }
    } catch (err: any) { setError(cleanErrorMessage(err.message || err.code)); } finally { setLoading(false); }
  };

  const handleOtpSubmit = async () => {
    setError("");
    if (!/^\d{6}$/.test(otpCode)) { setError("Please enter a valid 6-digit authenticator code."); return; }
    if (!mfaFactorId || !mfaChallengeId) { setError("MFA challenge is missing. Please go back and sign in again."); return; }

    setMfaVerifying(true);
    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: mfaChallengeId, code: otpCode });
      if (verifyError) throw verifyError;
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) throw new Error("Session expired.");

      try {
        const trustResult = await apiFetch("/api/auth/trust-device", { method: "POST", body: JSON.stringify({ rememberDevice }) });
        if (trustResult?.deviceToken) await setDeviceToken(trustResult.deviceToken);
      } catch {}
      setMfaVerified(true);
    } catch (err: any) { setError(err.message || "Verification failed."); } finally { setMfaVerifying(false); }
  };

  const handleRefreshChallenge = async () => {
    setError(""); setMessage("");
    if (!mfaFactorId) return;
    setLoading(true);
    try {
      const { data: cd, error: ce } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (ce) throw ce;
      setMfaChallengeId(cd.id);
      setMessage("Challenge refreshed. Enter the current code.");
      setOtpCode("");
    } catch (err: any) { setError(err.message || "Failed to refresh challenge."); } finally { setLoading(false); }
  };

  // ── MFA Screen ──
  if (authStep === "mfa") {
    return (
      <LinearGradient colors={["#1a0a0a", "#030303", "#0a0505"]} style={styles.gradient}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <BlurView intensity={20} tint="dark" style={styles.glassCard}>
              <View style={styles.cardInner}>
                <Text style={styles.title}>Two-Factor Authentication</Text>
                <Text style={styles.subtitle}>
                  {mfaIsEnrollment
                    ? "Scan the QR code with your authenticator app, then enter the 6-digit code below."
                    : "Enter the 6-digit code from your authenticator app."}
                </Text>

                {mfaIsEnrollment && mfaQrUri ? (
                  <View style={styles.qrBox}>
                    <Text style={styles.qrLabel}>Manual entry key:</Text>
                    <Text style={styles.qrSecret} selectable>{mfaQrUri.split("secret=")[1]?.split("&")[0] || mfaQrUri}</Text>
                  </View>
                ) : null}

                <TextInput style={styles.input} placeholder="000000" placeholderTextColor="rgba(255,255,255,0.3)" value={otpCode} onChangeText={(t) => setOtpCode(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} autoFocus />

                <TouchableOpacity style={styles.checkboxRow} onPress={() => setRememberDevice(!rememberDevice)} activeOpacity={0.7}>
                  <View style={[styles.checkbox, rememberDevice && styles.checkboxChecked]}>
                    {rememberDevice && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Remember this device for 30 days</Text>
                </TouchableOpacity>

                {error ? <Text style={styles.error}>{error}</Text> : null}
                {message ? <Text style={styles.info}>{message}</Text> : null}

                <TouchableOpacity style={[styles.button, mfaVerifying && styles.buttonDisabled]} onPress={handleOtpSubmit} disabled={mfaVerifying}>
                  {mfaVerifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleRefreshChallenge} style={styles.linkBtn}>
                  <Text style={styles.linkText}>Refresh challenge</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setAuthStep("credentials"); setError(""); setMessage(""); supabase.auth.signOut(); }} style={styles.linkBtn}>
                  <Text style={styles.linkText}>Back to sign in</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  // ── Credentials Screen ──
  return (
    <>
    <LinearGradient colors={t.isDark ? ["#1a0a0a", "#030303", "#0a0505"] : ["#A84D48", "#7a2929", "#3d1515"]} style={styles.gradient}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Theme toggle */}
          <TouchableOpacity
            onPress={() => { const m: Array<"auto"|"light"|"dark"> = ["auto","light","dark"]; setThemeMode(m[(m.indexOf(themeMode)+1)%m.length]); }}
            style={{ alignSelf: "flex-end", marginBottom: 8 }}
          >
            <Ionicons name={themeMode === "dark" ? "moon" : themeMode === "light" ? "sunny" : "contrast-outline"} size={20} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>

          {/* Logo + Tagline */}
          <View style={styles.brandSection}>
            <Image source={require("../../assets/AppLogo.jpeg")} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brandTitle}>Lost & Hound</Text>
            <Text style={styles.brandTagline}>Find What's Lost,{"\n"}Help What's Found</Text>
            <Text style={styles.brandCaption}>Northeastern's community-powered{"\n"}lost & found platform.</Text>
          </View>

          {/* Glass Card */}
          <BlurView intensity={25} tint="dark" style={styles.glassCard}>
            <View style={styles.cardInner}>
              <Text style={styles.title}>{isSignUp ? "Create Account" : "Sign In"}</Text>
              <Text style={styles.subtitle}>
                {isSignUp ? "Already have an account? " : "Don't have an account? "}
                <Text style={styles.linkInline} onPress={() => { setIsSignUp(!isSignUp); setError(""); setMessage(""); }}>
                  {isSignUp ? "Sign In" : "Sign Up"}
                </Text>
              </Text>

              {isSignUp && (
                <>
                  <TextInput style={styles.input} placeholder="First name" placeholderTextColor="rgba(255,255,255,0.3)" value={firstName} onChangeText={(t) => setFirstName(t.slice(0, NAME_MAX_LENGTH))} autoCapitalize="words" />
                  <TextInput style={styles.input} placeholder="Last name" placeholderTextColor="rgba(255,255,255,0.3)" value={lastName} onChangeText={(t) => setLastName(t.slice(0, NAME_MAX_LENGTH))} autoCapitalize="words" />
                </>
              )}

              <TextInput style={styles.input} placeholder="you@northeastern.edu" placeholderTextColor="rgba(255,255,255,0.3)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress" />
              <TextInput style={styles.input} placeholder="Password" placeholderTextColor="rgba(255,255,255,0.3)" value={password} onChangeText={(t) => setPassword(t.slice(0, PASSWORD_MAX_LENGTH))} secureTextEntry textContentType="password" />

              {error ? (
                <View>
                  <Text style={styles.error}>{error === "EMAIL_NOT_CONFIRMED" ? "Please confirm your email before signing in." : error}</Text>
                  {error === "EMAIL_NOT_CONFIRMED" && email && (
                    <TouchableOpacity
                      style={{ marginTop: 6 }}
                      onPress={async () => {
                        try {
                          await supabase.auth.resend({ type: "signup", email });
                          setMessage("Verification email resent! Check your inbox.");
                          setError("");
                        } catch { setError("Failed to resend. Please try again."); }
                      }}
                    >
                      <Text style={[styles.linkText, { fontSize: 13 }]}>Resend verification email</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}
              {message ? <Text style={styles.info}>{message}</Text> : null}

              <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isSignUp ? "Sign Up" : "Sign In"}</Text>}
              </TouchableOpacity>

              {!isSignUp && (
                <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")} style={styles.linkBtn}>
                  <Text style={styles.linkText}>Forgot password?</Text>
                </TouchableOpacity>
              )}
            </View>
          </BlurView>

          <Text style={styles.footerCaption}>Made for Oasis @ Northeastern</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>

    <TermsModal
      visible={termsOpen}
      onClose={() => setTermsOpen(false)}
      onAccept={() => {
        setTermsAccepted(true);
        doSignUp();
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 40 },
  brandSection: { alignItems: "center", marginBottom: 28 },
  logo: { width: 80, height: 80, borderRadius: 20, marginBottom: 12 },
  brandTitle: { fontSize: 28, fontWeight: "900", color: "#fff", letterSpacing: 0.5 },
  brandTagline: { fontSize: 18, fontWeight: "800", color: "rgba(255,255,255,0.85)", textAlign: "center", marginTop: 8, lineHeight: 24 },
  brandCaption: { fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 8, lineHeight: 18 },
  glassCard: { borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  cardInner: { padding: 24 },
  title: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 20 },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 12,
  },
  button: { backgroundColor: "#A84D48", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  linkBtn: { marginTop: 16, alignItems: "center" },
  linkText: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 14 },
  linkInline: { color: "#fff", fontWeight: "800" },
  error: { color: "#fca5a5", fontSize: 13, marginBottom: 8, fontWeight: "600" },
  info: { color: "#86efac", fontSize: 13, marginBottom: 8, fontWeight: "600" },
  qrBox: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 16, marginBottom: 16, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  qrLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 8 },
  qrSecret: { color: "#FF6B4A", fontSize: 13, fontWeight: "600", textAlign: "center" },
  checkboxRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, marginTop: 4 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)", marginRight: 10, justifyContent: "center", alignItems: "center" },
  checkboxChecked: { backgroundColor: "#A84D48", borderColor: "#A84D48" },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  checkboxLabel: { color: "rgba(255,255,255,0.6)", fontSize: 13 },
  footerCaption: { textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 20 },
});
