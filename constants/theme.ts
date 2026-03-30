/**
 * MediFind Design System
 * Modern medical-grade palette with deep teal, vibrant accents, soft grays.
 */

import { Platform, StyleSheet } from 'react-native';

// ── Core palette ──────────────────────────────────────────────────────────────
export const Palette = {
  // Primary brand
  primary: '#0EA5E9',       // Sky blue
  primaryDark: '#0369A1',   // Deep ocean
  primaryLight: '#E0F2FE',  // Ice blue
  primaryGradient: ['#0EA5E9', '#0369A1'] as const,

  // Accent / action
  accent: '#06B6D4',        // Cyan teal
  accentLight: '#CFFAFE',

  // Success / Open
  success: '#10B981',
  successLight: '#D1FAE5',
  successText: '#065F46',

  // Danger / Closed
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  dangerText: '#991B1B',

  // Warning
  warning: '#F59E0B',
  warningLight: '#FEF3C7',

  // Neutrals
  background: '#F0F9FF',     // Subtle sky-tinted white
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E0F2FE',
  borderStrong: '#BAE6FD',

  // Text
  textPrimary: '#0C1B33',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textOnPrimary: '#FFFFFF',

  // Tab bar
  tabBar: '#FFFFFF',
  tabBarBorder: '#E0F2FE',
};

// ── Typography ─────────────────────────────────────────────────────────────────
export const Typography = {
  h1: { fontSize: 30, fontWeight: '800' as const, color: Palette.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '800' as const, color: Palette.textPrimary, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '700' as const, color: Palette.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, color: Palette.textSecondary, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, color: Palette.textMuted },
  label: { fontSize: 13, fontWeight: '600' as const, color: Palette.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  button: { fontSize: 16, fontWeight: '700' as const, color: Palette.textOnPrimary },
};

// ── Spacing ────────────────────────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 36,
};

// ── Radius ─────────────────────────────────────────────────────────────────────
export const Radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  full: 999,
};

// ── Shadows ────────────────────────────────────────────────────────────────────
export const Shadow = {
  sm: {
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  lg: {
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
};

// ── Reusable component styles ──────────────────────────────────────────────────
export const UI = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  cardElevated: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadow.md,
  },
  btnPrimary: {
    backgroundColor: Palette.primary,
    paddingVertical: 15,
    borderRadius: Radius.full,
    alignItems: 'center' as const,
    ...Shadow.md,
  },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: Palette.primary,
    paddingVertical: 13,
    borderRadius: Radius.full,
    alignItems: 'center' as const,
  },
  btnDanger: {
    borderWidth: 1.5,
    borderColor: Palette.danger,
    paddingVertical: 11,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center' as const,
  },
  input: {
    backgroundColor: Palette.surface,
    borderWidth: 1.5,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    fontSize: 16,
    color: Palette.textPrimary,
    ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Palette.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  separator: {
    height: 10,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyStateText: {
    fontSize: 16,
    color: Palette.textMuted,
    textAlign: 'center' as const,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    alignSelf: 'flex-start' as const,
  },
  centered: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
});

// ── Legacy Colors export (for backward-compatibility) ─────────────────────────
export const Colors = {
  light: {
    text: Palette.textPrimary,
    background: Palette.background,
    tint: Palette.primary,
    icon: Palette.textMuted,
    tabIconDefault: Palette.textMuted,
    tabIconSelected: Palette.primary,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#fff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#fff',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
