import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";

interface ScreenHeaderProps {
  title: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  onLeftPress?: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  showLogo?: boolean;
}

export default function ScreenHeader({ title, leftIcon, onLeftPress, rightIcon, onRightPress, showLogo = false }: ScreenHeaderProps) {
  const { t, themeMode, setThemeMode } = useTheme();

  const cycleTheme = () => {
    const modes: Array<"auto" | "light" | "dark"> = ["auto", "light", "dark"];
    setThemeMode(modes[(modes.indexOf(themeMode) + 1) % modes.length]);
  };

  const themeIcon = themeMode === "dark" ? "moon" : themeMode === "light" ? "sunny" : "contrast-outline";

  return (
    <View style={[styles.header, { borderBottomColor: t.separator }]}>
      {/* Left — fixed width so title stays centered */}
      <View style={styles.side}>
        {leftIcon && onLeftPress ? (
          <TouchableOpacity onPress={onLeftPress} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name={leftIcon} size={22} color={t.accent} />
          </TouchableOpacity>
        ) : showLogo ? (
          <Image source={require("../assets/AppLogo.jpeg")} style={styles.logo} resizeMode="contain" />
        ) : null}
      </View>

      {/* Title — always centered */}
      <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>{title}</Text>

      {/* Right — fixed width matching left */}
      <View style={[styles.side, styles.rightSide]}>
        <TouchableOpacity onPress={cycleTheme} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name={themeIcon} size={18} color={t.subtext} />
        </TouchableOpacity>
        {rightIcon && onRightPress ? (
          <TouchableOpacity onPress={onRightPress} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name={rightIcon} size={22} color={t.subtext} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: {
    width: 80,
    flexDirection: "row",
    alignItems: "center",
  },
  rightSide: {
    justifyContent: "flex-end",
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
});
