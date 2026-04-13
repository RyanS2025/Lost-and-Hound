import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../utils/supabaseClient";
import { useTheme } from "../../contexts/ThemeContext";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setMessage("");

    if (!email.endsWith("@northeastern.edu")) {
      setError("You must use a @northeastern.edu email address.");
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) throw resetError;
      setMessage("Check your email for a password reset link.");
    } catch (err: any) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your Northeastern email and we'll send you a reset link.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="you@northeastern.edu"
            placeholderTextColor="#818384"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.info}>{message}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send Reset Link</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.linkButton}>
            <Text style={styles.linkText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030303",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#1A1A1B",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#D7DADC",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#B8BABD",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#2D2D2E",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: "#D7DADC",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#A84D48",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  linkButton: {
    marginTop: 16,
    alignItems: "center",
  },
  linkText: {
    color: "#A84D48",
    fontWeight: "700",
    fontSize: 14,
  },
  error: {
    color: "#ef4444",
    fontSize: 13,
    marginBottom: 8,
    fontWeight: "600",
  },
  info: {
    color: "#22c55e",
    fontSize: 13,
    marginBottom: 8,
    fontWeight: "600",
  },
});
