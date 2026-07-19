// Plain hex values for contexts that can't use NativeWind className (react-native-svg
// stroke/fill props, inline style objects). Keep in sync with tailwind.config.js colors -
// that file is the source of truth for anything reachable via className.
export const colors = {
  bg: "#0B0F17",
  surface: "#131826",
  surface2: "#1B2333",
  border: "#26304A",
  ink: "#EDEFF5",
  inkMuted: "#A8AFC2",
  inkFaint: "#646C80",
  // Compatibility alias for existing moderate-risk components. It intentionally uses
  // blue now so amber/orange is not a primary ZivaDzidzo interaction colour.
  gold: "#38BDF8",
  teal: "#2FBF9F",
  blue: "#38BDF8",
  red: "#E5484D",
  indigo: "#6C7CFF",
  violet: "#A881FF",
  cyan: "#2DC5DB",
};
