/** @type {import('tailwindcss').Config} */
/*
 * 🎨 COMMUNITY TIME SHEETS - SLATE-FOCUSED COLOR SYSTEM
 * 
 * This color system prioritizes slate colors for an easy-on-the-eyes experience:
 * 
 * 💡 USAGE GUIDELINES:
 * - Use `neutral` (slate) for 90% of your UI - backgrounds, text, borders
 * - Use `primary` only for client branding - headers, main buttons, logos
 * - Use `secondary` for accents - focus states, outlines, section headers
 * - Use `success/warning/error` for status indicators
 * 
 * 🔄 REBRANDING: Change only primary/secondary colors for new clients
 * 
 * 👁️ ACCESSIBILITY: Slate colors provide better contrast and less eye strain
 */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 🎨 CLIENT-SPECIFIC COLORS (change per client for rebranding)
        primary: {
          50: '#f8fafc',   // Very light slate-blue blend
          100: '#f1f5f9',  // Light slate-blue blend
          200: '#e2e8f0',  // Lighter slate with blue hint
          300: '#cbd5e1',  // Light slate
          400: '#94a3b8',  // Medium slate
          500: '#0e3456',  // Client's main brand color (dark blue)
          600: '#0c2d4a',  // Darker brand
          700: '#0a263e',  // Even darker
          800: '#091A34',  // Very dark brand
          900: '#071526',  // Deepest brand
        },
        secondary: {
          50: '#fffbf0',   // Very light warm
          100: '#fef3e2',  // Light warm
          200: '#fde68a',  // Lighter gold
          300: '#fbbf24',  // Light gold
          400: '#f59e0b',  // Medium gold
          500: '#cb9034',  // Client's accent color (warm gold)
          600: '#b8832f',  // Darker gold
          700: '#a5762a',  // Even darker
          800: '#926925',  // Very dark gold
          900: '#7f5c20',  // Deepest gold
        },
        
        // 🎯 UNIVERSAL COLORS (slate palette - easy on the eyes)
        // Use these for 90% of your UI - backgrounds, text, borders
        neutral: {
          50: '#f8fafc',   // Lightest slate - main backgrounds
          100: '#f1f5f9',  // Very light slate - card backgrounds
          200: '#e2e8f0',  // Light slate - borders, dividers
          300: '#cbd5e1',  // Medium-light slate - disabled states
          400: '#94a3b8',  // Medium slate - placeholders, icons
          500: '#64748b',  // Base slate - secondary text
          600: '#475569',  // Dark slate - primary text
          700: '#334155',  // Darker slate - headings, emphasis
          800: '#1e293b',  // Very dark slate - dark mode backgrounds
          900: '#0f172a',  // Deepest slate - dark mode text
        },
        
        // 🚨 FUNCTIONAL COLORS (universal status colors)
        success: {
          50: '#f0fdf4',   // Light green background
          500: '#10b981',  // Success green (more muted)
          600: '#059669',  // Darker success
          700: '#047857',  // Dark success
        },
        warning: {
          50: '#fffbeb',   // Light amber background
          500: '#f59e0b',  // Warning amber
          600: '#d97706',  // Darker warning
          700: '#b45309',  // Dark warning
        },
        error: {
          50: '#fef2f2',   // Light red background
          500: '#ef4444',  // Error red
          600: '#dc2626',  // Darker error
          700: '#b91c1c',  // Dark error
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
