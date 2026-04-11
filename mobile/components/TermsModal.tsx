import { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Modal, NativeSyntheticEvent, NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";

const SECTIONS = [
  { title: "1. Disclaimer", content: "Lost & Hound is a student-made project created as part of Oasis @ Northeastern University. This platform is not officially affiliated with or endorsed by Northeastern University\u2014it is an independent student initiative. Users acknowledge that Lost & Hound is maintained by students and may have limitations or changes without notice." },
  { title: "2. Eligibility", content: "Lost & Hound is designed for Northeastern University students. You must register using a valid @northeastern.edu email address. By creating an account, you confirm that you are affiliated with Northeastern University and that the information you provide is accurate." },
  { title: "3. Platform Purpose & Limitations", content: "Lost & Hound is a community-powered platform that connects people who have found lost items with people who may have lost them. The platform serves solely as a communication tool and bulletin board. Lost & Hound does not verify ownership of any items, does not facilitate the physical exchange of items, and does not guarantee that any lost item will be recovered." },
  { title: "4. No False Claims & Code of Conduct", content: "You agree not to falsely claim ownership of items that do not belong to you. Falsely claiming an item is a violation of these Terms and may constitute theft under applicable law. You agree not to post fraudulent, misleading, or deceptive listings. Violations may result in immediate account suspension and permanent bans." },
  { title: "5. Messaging & Harassment Policy", content: "The in-app messaging system is provided solely for communication related to lost and found items. You agree not to use messaging for harassment, threats, intimidation, stalking, solicitation, spam, or any form of abusive behavior. All messages are subject to review by moderators in the event of a report." },
  { title: "6. Safety & Liability Disclaimer", content: "LOST & HOUND, ITS CREATORS, DEVELOPERS, AND OPERATORS ARE NOT RESPONSIBLE FOR ANY LOSS, THEFT, DAMAGE, INJURY, OR HARM OF ANY KIND ARISING FROM THE USE OF THIS PLATFORM. You acknowledge that all interactions with other users, including in-person meetings for item exchanges, are conducted entirely at your own risk." },
  { title: "7. Assumption of Risk", content: "By using Lost & Hound, you expressly acknowledge and agree that you assume all risks associated with using this platform, communicating with other users, and any in-person interactions that result from using this platform." },
  { title: "8. Moderation & Ban Policy", content: "Lost & Hound employs moderators who have the authority to review reported content, remove listings or messages that violate these Terms, and issue temporary or permanent bans. Moderation decisions are made at the sole discretion of the moderation team." },
  { title: "9. Data Handling & Privacy", content: "When you create an account, we store your first name, last name, email address, and campus preference. Your data is stored securely using Supabase infrastructure. We do not sell, share, or distribute your personal information to third parties. You may delete your account at any time through the Settings page." },
  { title: "10. Indemnification", content: "You agree to indemnify, defend, and hold harmless Lost & Hound, its creators, developers, operators, and contributors from any claims, damages, losses, liabilities, costs, or expenses arising from your use of the platform or your violation of these Terms." },
  { title: "11. Limitation of Liability", content: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, LOST & HOUND AND ITS CREATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES. THE PLATFORM IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\" WITHOUT WARRANTIES OF ANY KIND." },
  { title: "12. Changes to Terms", content: "We reserve the right to modify these Terms at any time. Continued use of Lost & Hound after changes are posted constitutes your acceptance of the updated Terms." },
  { title: "13. Governing Law", content: "These Terms shall be governed by and construed in accordance with the laws of the Commonwealth of Massachusetts. Any disputes shall be subject to the exclusive jurisdiction of the courts located in Suffolk County, Massachusetts." },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onAccept?: () => void;
  readOnly?: boolean;
}

export default function TermsModal({ visible, onClose, onAccept, readOnly = false }: Props) {
  const { t } = useTheme();
  const [accepted, setAccepted] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setAccepted(false);
      setScrolledToBottom(false);
    }
  }, [visible]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const atBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
    if (atBottom) setScrolledToBottom(true);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <SafeAreaView style={{ flex: 1, justifyContent: "center", padding: 12 }}>
          <View style={[styles.card, { backgroundColor: t.cardSolid, borderColor: t.cardBorder }]}>

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: t.separator }]}>
              <View style={styles.headerLeft}>
                <View style={[styles.iconBox, { backgroundColor: t.isDark ? "rgba(255,69,0,0.16)" : "rgba(168,77,72,0.08)" }]}>
                  <Ionicons name="document-text" size={20} color={t.accent} />
                </View>
                <View>
                  <Text style={[styles.headerTitle, { color: t.text }]}>Terms & Conditions</Text>
                  <Text style={[styles.headerSubtitle, { color: t.subtext }]}>
                    {readOnly ? "Review the full terms" : "Please read before creating your account"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={22} color={t.muted} />
              </TouchableOpacity>
            </View>

            {/* Scrollable content */}
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={true}
            >
              <Text style={[styles.intro, { color: t.subtext }]}>
                {readOnly
                  ? "Welcome to Lost & Hound \u2014 a student-made lost and found platform for Northeastern University. Please review the full terms and conditions below."
                  : "Welcome to Lost & Hound \u2014 a student-made lost and found platform for Northeastern University. By creating an account, you agree to the following terms."}
              </Text>

              {SECTIONS.map((section, i) => (
                <View key={i} style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: t.isDark ? "#FFBEA4" : "#3d2020" }]}>
                    {section.title}
                  </Text>
                  <Text style={[styles.sectionContent, { color: t.subtext }]}>
                    {section.content}
                  </Text>
                  {i < SECTIONS.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: t.separator }]} />
                  )}
                </View>
              ))}

              <View style={[styles.noticeBox, { backgroundColor: t.isDark ? "#232324" : "#fdf7f7", borderColor: t.cardBorder }]}>
                <Text style={[styles.noticeLabel, { color: t.subtext }]}>Last updated: March 2026</Text>
                <Text style={[styles.noticeText, { color: t.muted }]}>If you have questions about these Terms, contact the Lost & Hound team.</Text>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: t.separator, backgroundColor: t.isDark ? "#161617" : "#faf8f8" }]}>
              {!readOnly && !scrolledToBottom && (
                <Text style={[styles.scrollHint, { color: t.muted }]}>
                  ↓ Scroll to the bottom to continue
                </Text>
              )}

              {readOnly ? (
                <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: t.accent }]} onPress={onClose}>
                  <Text style={styles.acceptBtnText}>Close</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => { if (scrolledToBottom) setAccepted(!accepted); }}
                    activeOpacity={scrolledToBottom ? 0.7 : 1}
                  >
                    <View style={[
                      styles.checkbox,
                      !scrolledToBottom && { borderColor: t.isDark ? "#4A4A4B" : "#ddd" },
                      scrolledToBottom && { borderColor: t.accent },
                      accepted && { backgroundColor: t.accent, borderColor: t.accent },
                    ]}>
                      {accepted && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <Text style={[
                      styles.checkboxLabel,
                      { color: scrolledToBottom ? t.text : (t.isDark ? "#787A7C" : "#bbb") },
                    ]}>
                      I have read and agree to the Terms & Conditions
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.acceptBtn,
                      { backgroundColor: accepted ? t.accent : (t.isDark ? "#37383A" : "#e0d6d6") },
                    ]}
                    onPress={() => { if (accepted) { onAccept?.(); onClose(); } }}
                    disabled={!accepted}
                    activeOpacity={accepted ? 0.7 : 1}
                  >
                    <Text style={[
                      styles.acceptBtnText,
                      !accepted && { color: t.isDark ? "#808285" : "#aaa" },
                    ]}>
                      Accept & Create Account
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, maxHeight: "95%", borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "900" },
  headerSubtitle: { fontSize: 11, fontWeight: "600", marginTop: 1 },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 20 },
  intro: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "800", marginBottom: 6 },
  sectionContent: { fontSize: 13, lineHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 16 },
  noticeBox: { marginTop: 8, padding: 14, borderRadius: 10, borderWidth: 1 },
  noticeLabel: { fontSize: 11, fontWeight: "700", marginBottom: 4 },
  noticeText: { fontSize: 11 },
  footer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  scrollHint: { textAlign: "center", fontSize: 11, fontWeight: "600", marginBottom: 8 },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  checkboxLabel: { fontSize: 13, fontWeight: "600", flex: 1 },
  acceptBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  acceptBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
