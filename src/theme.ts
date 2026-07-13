import { ThemeType } from "./types.js";

export interface ThemeConfig {
  bg: string;
  card: string;
  border: string;
  accent: string;
  text: string;
  textSecondary: string;
  shadow: string;
  inputBg: string;
}

export const themes: Record<ThemeType, ThemeConfig> = {
  dark: {
    bg: "#090909",
    card: "#181818",
    border: "#2a2a2a",
    accent: "#00d084",
    text: "#ffffff",
    textSecondary: "#888888",
    shadow: "shadow-[0_8px_30px_rgb(0,0,0,0.5)]",
    inputBg: "#121212"
  },
  light: {
    bg: "#fafafa",
    card: "#ffffff",
    border: "#e4e4e4",
    accent: "#2563eb",
    text: "#111111",
    textSecondary: "#666666",
    shadow: "shadow-[0_8px_30px_rgb(0,0,0,0.05)]",
    inputBg: "#f5f5f5"
  },
  pink: {
    bg: "#fff4f8",
    card: "#ffffff",
    border: "#ffd4e1",
    accent: "#ff4f87",
    text: "#333333",
    textSecondary: "#aa7788",
    shadow: "shadow-[0_8px_30px_rgb(255,212,225,0.3)]",
    inputBg: "#fff9fb"
  },
  cat: {
    bg: "#FFF8F2",
    card: "#FFFFFF",
    border: "#F5D7A1",
    accent: "#F59E0B",
    text: "#2B2B2B",
    textSecondary: "#8B7E74",
    shadow: "shadow-[0_8px_30px_rgba(245,215,161,0.25)]",
    inputBg: "#FFFBF7"
  }
};
