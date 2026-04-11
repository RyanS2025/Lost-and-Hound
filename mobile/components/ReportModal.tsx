import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Modal, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import apiFetch from "../utils/apiFetch";
import { successHaptic } from "../utils/haptics";

const REPORT_REASON_MAX_LENGTH = 50;
const REPORT_DETAILS_MAX_LENGTH = 250;

const POST_REASONS = [
  "Stolen item / theft concern",
  "False or misleading listing",
  "Inappropriate content",
  "Spam",
  "Already resolved / duplicate",
  "Other",
];

const USER_REASONS = [
  "Stolen item / theft concern",
  "Harassment or threatening behavior",
  "Scam or fraud attempt",
  "Impersonation",
  "Inappropriate messages",
  "Other",
];

interface Props {
  visible: boolean;
  onClose: () => void;
  type: "post" | "user";
  targetId: string;
  targetLabel: string;
}

export default function ReportModal({ visible, onClose, type, targetId, targetLabel }: Props) {
  const { t } = useTheme();
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const reasons = type === "post" ? POST_REASONS : USER_REASONS;
  const isOther = reason === "Other";
  const isStolen = reason === "Stolen item / theft concern";

  const handleSubmit = async () => {
    if (!reason) return;
    if (isOther && !customReason.trim()) { setError("Please enter a reason."); return; }

    setSubmitting(true);
    setError("");

    const row: any = {
      reason: isOther ? customReason.trim() : reason,
      details: details.trim() || null,
    };
    if (type === "post") row.reported_listing_id = targetId;
    else row.reported_user_id = targetId;

    try {
      await apiFetch("/api/reports", { method: "POST", body: JSON.stringify(row) });
      successHaptic();
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setReason(""); setCustomReason(""); setDetails("");
      setSubmitted(false); setError("");
    }, 200);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <SafeAreaView style={{ flex: 1, justifyContent: "center", padding: 20 }}>
          <View style={[styles.card, { backgroundColor: t.cardSolid, borderColor: t.cardBorder }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: t.text }]}>
                Report {type === "post" ? "Post" : "User"}
              </Text>
              <TouchableOpacity onPress={handleClose} hitSlop={12}>
                <Ionicons name="close-circle" size={28} color={t.muted} />
              </TouchableOpacity>
            </View>

            {submitted ? (
              <View style={styles.successView}>
                <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                <Text style={[styles.successTitle, { color: t.text }]}>Report submitted</Text>
                <Text style={[styles.successSubtitle, { color: t.subtext }]}>
                  Thanks for helping keep the community safe. We'll review this shortly.
                </Text>
                <TouchableOpacity style={[styles.doneBtn, { backgroundColor: t.accent }]} onPress={handleClose}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={[styles.label, { color: t.subtext }]}>
                  Reporting: <Text style={{ fontWeight: "800", color: t.text }}>{targetLabel}</Text>
                </Text>

                <Text style={[styles.sectionLabel, { color: t.subtext }]}>
                  Why are you reporting this {type === "post" ? "post" : "user"}?
                </Text>

                {reasons.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.reasonRow,
                      {
                        borderColor: reason === r ? t.accent : t.cardBorder,
                        backgroundColor: reason === r
                          ? (t.isDark ? "rgba(168,77,72,0.12)" : "rgba(168,77,72,0.06)")
                          : r === "Stolen item / theft concern"
                            ? (t.isDark ? "rgba(127,29,29,0.22)" : "#fef2f2")
                            : "transparent",
                      },
                    ]}
                    onPress={() => setReason(r)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.radio, reason === r && { borderColor: t.accent }]}>
                      {reason === r && <View style={[styles.radioInner, { backgroundColor: t.accent }]} />}
                    </View>
                    <Text style={[
                      styles.reasonText,
                      { color: r === "Stolen item / theft concern" ? "#dc2626" : t.text },
                      r === "Stolen item / theft concern" && { fontWeight: "800" },
                    ]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}

                {isStolen && (
                  <View style={[styles.warningBox, { borderColor: t.isDark ? "rgba(245,158,11,0.45)" : "#fcd34d", backgroundColor: t.isDark ? "rgba(146,64,14,0.22)" : "#fffbeb" }]}>
                    <Ionicons name="warning" size={16} color="#f59e0b" />
                    <Text style={{ color: t.isDark ? "#f6c66a" : "#92400e", fontSize: 12, fontWeight: "600", flex: 1 }}>
                      High priority: select this only if theft is suspected.
                    </Text>
                  </View>
                )}

                {isOther && (
                  <>
                    <TextInput
                      style={[styles.input, { backgroundColor: t.inputBg, color: t.text, borderColor: t.inputBorder }]}
                      placeholder="Enter report reason"
                      placeholderTextColor={t.muted}
                      value={customReason}
                      onChangeText={(txt) => setCustomReason(txt.slice(0, REPORT_REASON_MAX_LENGTH))}
                      maxLength={REPORT_REASON_MAX_LENGTH}
                    />
                    <Text style={[styles.charCount, { color: t.muted }]}>{customReason.length}/{REPORT_REASON_MAX_LENGTH}</Text>
                  </>
                )}

                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: t.inputBg, color: t.text, borderColor: t.inputBorder, marginTop: 12 }]}
                  placeholder="Additional details (optional)"
                  placeholderTextColor={t.muted}
                  value={details}
                  onChangeText={(txt) => setDetails(txt.slice(0, REPORT_DETAILS_MAX_LENGTH))}
                  multiline
                  maxLength={REPORT_DETAILS_MAX_LENGTH}
                />
                <Text style={[styles.charCount, { color: t.muted }]}>{details.length}/{REPORT_DETAILS_MAX_LENGTH}</Text>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: t.accent, opacity: reason && !submitting && (!isOther || customReason.trim()) ? 1 : 0.5 }]}
                  onPress={handleSubmit}
                  disabled={!reason || submitting || (isOther && !customReason.trim())}
                >
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Report</Text>}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { maxHeight: "85%", borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: "900" },
  content: { padding: 16, paddingTop: 4 },
  label: { fontSize: 14, marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", justifyContent: "center", alignItems: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  reasonText: { fontSize: 14, fontWeight: "600", flex: 1 },
  warningBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 8 },
  input: { borderRadius: 10, padding: 12, fontSize: 14, borderWidth: 1, marginTop: 8 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  charCount: { fontSize: 11, textAlign: "right", marginTop: 2 },
  error: { color: "#ef4444", fontSize: 13, fontWeight: "600", marginTop: 8 },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 16 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  successView: { alignItems: "center", padding: 24, gap: 8 },
  successTitle: { fontSize: 18, fontWeight: "800" },
  successSubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  doneBtn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, marginTop: 8 },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
