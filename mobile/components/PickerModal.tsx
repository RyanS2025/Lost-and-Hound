import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Modal, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";

interface Option {
  label: string;
  value: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: Option[];
  selected: string;
  onSelect: (value: string) => void;
}

export default function PickerModal({ visible, onClose, title, options, selected, onSelect }: Props) {
  const { t } = useTheme();

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.card, { backgroundColor: t.cardSolid, borderColor: t.cardBorder }]}>
              <Text style={[styles.title, { color: t.text }]}>{title}</Text>
              <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.option, { borderBottomColor: t.separator }]}
                    onPress={() => { onSelect(opt.value); onClose(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, { color: selected === opt.value ? t.accent : t.text }]}>{opt.label}</Text>
                    {selected === opt.value && <Ionicons name="checkmark" size={18} color={t.accent} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 32 },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden", paddingTop: 16 },
  title: { fontSize: 16, fontWeight: "800", paddingHorizontal: 16, marginBottom: 8 },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  optionText: { fontSize: 15, fontWeight: "600" },
});
