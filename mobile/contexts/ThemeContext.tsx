import { createContext, useContext, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

const LIGHT = {
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

const DARK = {
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

type ThemeMode = "auto" | "light" | "dark";

interface ThemeContextType {
  t: ThemeColors & { isDark: boolean };
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  t: { ...DARK, isDark: true },
  themeMode: "auto",
  setThemeMode: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");

  const isDark =
    themeMode === "dark" ? true :
    themeMode === "light" ? false :
    systemScheme === "dark";

  const t = { ...(isDark ? DARK : LIGHT), isDark };

  return (
    <ThemeContext.Provider value={{ t, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
