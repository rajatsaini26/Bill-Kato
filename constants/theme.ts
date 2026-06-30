export const Colors = {
  // Brand
  primary: '#1d4ed8',       // deep blue — professional, trustworthy
  primaryLight: '#eff6ff',
  primaryMid: '#3b82f6',    // medium blue for gradients
  accent: '#6366f1',        // indigo accent

  // Semantic
  success: '#059669',
  successLight: '#ecfdf5',
  danger: '#dc2626',
  dangerLight: '#fef2f2',
  warning: '#d97706',
  warningLight: '#fffbeb',

  // Backgrounds
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',

  // Borders & Shadows
  border: '#e2e8f0',
  borderFocus: '#3b82f6',
  shadow: 'rgba(15, 23, 42, 0.08)',

  // Text
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  textInverse: '#ffffff',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 100,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 36,
};

export const FontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
};

export const Shadow = {
  sm: {
    elevation: 2,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  md: {
    elevation: 4,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  lg: {
    elevation: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
};
