/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scans App.js and any files inside components or screens folders
  content: ["./App.{js,jsx,ts,tsx}", "./screens/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
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