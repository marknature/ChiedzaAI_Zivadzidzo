/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scans App.js and everything under src/ (screens, navigation, lib).
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // Ported from ZivaBasa's design tokens (frontend/src/index.css / tailwind.config.js in
      // ZivaBasa-MVP) - the "ChiedzaAI family" palette. Dark-only for now: this app has no
      // theme toggle yet, so the light-mode override values aren't ported.
      colors: {
        bg: "#0B0F17",
        surface: "#131826",
        surface2: "#1B2333",
        border: "#26304A",
        ink: "#EDEFF5",
        "ink-muted": "#A8AFC2",
        "ink-faint": "#646C80",
        // Legacy token name kept so existing moderate-risk cards do not break. The
        // actual value is blue; orange is reserved for ChiedzaAI-only brand moments.
        gold: "#38BDF8",
        teal: "#2FBF9F",
        blue: "#38BDF8",
        red: "#E5484D",
        indigo: "#6C7CFF",
        violet: "#A881FF",
        cyan: "#2DC5DB",
      },
      // RN needs one font-family name per weight (no CSS font-weight cascading), loaded via
      // @expo-google-fonts/* in App.js. See src/theme/typography.js for the canonical map.
      fontFamily: {
        display: ["SpaceGrotesk_700Bold"],
        "display-semibold": ["SpaceGrotesk_600SemiBold"],
        body: ["Inter_500Medium"],
        "body-semibold": ["Inter_600SemiBold"],
        "body-bold": ["Inter_700Bold"],
        mono: ["IBMPlexMono_400Regular"],
        "mono-medium": ["IBMPlexMono_500Medium"],
        "mono-semibold": ["IBMPlexMono_600SemiBold"],
      },
    },
  },
  plugins: [],
}
