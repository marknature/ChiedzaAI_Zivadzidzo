/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scans App.js and everything under src/ (screens, navigation, lib).
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0B1528",     // Deep tech blue
        accent: "#3B82F6",      // Dzidzo vibrant blue
        warning: "#F59E0B",     // Automation risk yellow
        success: "#10B981"      // AI readiness green
      }
    },
  },
  plugins: [],
}