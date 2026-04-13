import { useColorScheme } from "react-native";

export const BRAND = {
  accent: "#A84D48",
  accentHover: "#8f3e3a",
  accentDark: "#FF4500",
  accentDarkHover: "#E03D00",
};

export const LIGHT = {
  bg: "#f5f0f0",
  card: "rgba(255,255,255,0.65)",
  cardSolid: "#fff",
  cardBorder: "rgba(168,77,72,0.12)",
  text: "#3d2020",
  subtext: "#6b6b6b",
  muted: "#999",
  inputBg: "rgba(255,255,255,0.7)",
  inputBorder: "rgba(168,77,72,0.18)",
  accent: "#A84D48",
  accentHover: "#8f3e3a",
  tabBar: "rgba(255,255,255,0.72)",
  tabBarBorder: "rgba(168,77,72,0.1)",
  separator: "rgba(168,77,72,0.08)",
};

export const DARK = {
  bg: "#030303",
  card: "rgba(26,26,27,0.75)",
  cardSolid: "#1A1A1B",
  cardBorder: "rgba(255,255,255,0.1)",
  text: "#D7DADC",
  subtext: "#B8BABD",
  muted: "#818384",
  inputBg: "rgba(45,45,46,0.8)",
  inputBorder: "rgba(255,255,255,0.14)",
  accent: "#FF4500",
  accentHover: "#E03D00",
  tabBar: "rgba(26,26,27,0.85)",
  tabBarBorder: "rgba(255,255,255,0.08)",
  separator: "rgba(255,255,255,0.06)",
};

export type ThemeColors = typeof LIGHT;

export function useThemeColors(): ThemeColors & { isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { ...(isDark ? DARK : LIGHT), isDark };
}
