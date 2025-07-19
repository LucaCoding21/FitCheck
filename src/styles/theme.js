// Modern Dark Theme with Red/Gold Accents (User's Preferred Style)
export const theme = {
  colors: {
    // Dark backgrounds
    background: "#1a1a1a",
    surface: "#2A2A2A",
    card: "#121212",

    // Primary colors (user's preferred)
    primary: "#B5483D", // Red/burgundy
    secondary: "#CD9F3E", // Golden star
    accent: "#B5483D", // Red accent

    // Gradients (minimal use as user prefers)
    primaryGradient: ["#B5483D", "#A03A30"],
    accentGradient: ["#CD9F3E", "#B89030"],
    cardGradient: ["#2A2A2A", "#1a1a1a"],
    surfaceGradient: ["#2A2A2A", "#1a1a1a"],
    dangerGradient: ["#EF4444", "#DC2626"],

    // Text
    text: "#FFFFFF",
    textSecondary: "#CCCCCC",
    textMuted: "#71717A",

    // Status colors
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",

    // Rating colors
    fire: "#FF6B6B",
    mid: "#FFD93D",
    trash: "#6B7280",

    // Overlays
    overlay: "rgba(0, 0, 0, 0.7)",
    cardOverlay: "rgba(42, 42, 42, 0.8)",
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },

  shadows: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: "#B5483D",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: "#B5483D",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
    glow: {
      shadowColor: "#CD9F3E",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
  },

  typography: {
    h1: {
      fontSize: 32,
      fontWeight: "800",
      lineHeight: 40,
    },
    h2: {
      fontSize: 24,
      fontWeight: "700",
      lineHeight: 32,
    },
    h3: {
      fontSize: 20,
      fontWeight: "600",
      lineHeight: 28,
    },
    body: {
      fontSize: 16,
      fontWeight: "400",
      lineHeight: 24,
    },
    caption: {
      fontSize: 14,
      fontWeight: "500",
      lineHeight: 20,
    },
    small: {
      fontSize: 12,
      fontWeight: "400",
      lineHeight: 16,
    },
  },
};
