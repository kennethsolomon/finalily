export type ThemeId =
  | "pixel-pastel"
  | "dark"
  | "dracula"
  | "nord"
  | "solarized"
  | "catppuccin"
  | "retro-game";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  preview: {
    bg: string;
    card: string;
    primary: string;
    accent: string;
    text: string;
  };
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "pixel-pastel",
    name: "Pixel Pastel",
    description: "Lil' Bit's garden",
    preview: { bg: "#fff5f5", card: "#ffffff", primary: "#e88ca5", accent: "#7ec8a4", text: "#3d2b3d" },
  },
  {
    id: "dark",
    name: "Dark Mode",
    description: "Easy on the eyes",
    preview: { bg: "#1a1a2e", card: "#25253e", primary: "#e2e2e2", accent: "#4a4a6a", text: "#e2e2e2" },
  },
  {
    id: "dracula",
    name: "Dracula",
    description: "A dark theme for vampires",
    preview: { bg: "#282a36", card: "#343746", primary: "#bd93f9", accent: "#ff79c6", text: "#f8f8f2" },
  },
  {
    id: "nord",
    name: "Nord",
    description: "Arctic, north-bluish",
    preview: { bg: "#2e3440", card: "#3b4252", primary: "#88c0d0", accent: "#81a1c1", text: "#eceff4" },
  },
  {
    id: "solarized",
    name: "Solarized",
    description: "Precision colors for machines and people",
    preview: { bg: "#fdf6e3", card: "#eee8d5", primary: "#268bd2", accent: "#2aa198", text: "#586e75" },
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    description: "Soothing pastel theme",
    preview: { bg: "#1e1e2e", card: "#313244", primary: "#cba6f7", accent: "#f5c2e7", text: "#cdd6f4" },
  },
  {
    id: "retro-game",
    name: "Retro Game",
    description: "Insert coin to continue",
    preview: { bg: "#0f1a0f", card: "#1a2e1a", primary: "#33ff33", accent: "#ffcc00", text: "#33ff33" },
  },
];

export const DEFAULT_THEME: ThemeId = "pixel-pastel";
