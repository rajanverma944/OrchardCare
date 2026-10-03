import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

/**
 * Fluid layout: everything scales relative to screen width so the UI feels
 * right on phones and on BlueStacks' large tablet-like windows alike.
 */
export function fluid(width: number, compact: number, regular: number, max = 1.35): number {
  const base = 390; // design reference width (dp)
  return Math.min(compact + (regular - compact) * (width / base), regular * max);
}

export function useUi() {
  const { width, height } = useWindowDimensions();
  const s = fluid(width, 0.82, 1.12);
  return {
    width,
    compact: height < 640,
    pad: 16 * s,
    gap: 12 * s,
    card: 14 * s,
    font: {
      h1: fluid(width, 24, 30),
      h2: fluid(width, 18, 22),
      body: fluid(width, 14, 16),
      small: fluid(width, 12, 13),
      button: fluid(width, 15, 16),
    },
  };
}

export const palette = {
  green900: '#123d27',
  green700: '#1d5c38',
  green500: '#2e7d4f',
  green100: '#e3f2e9',
  leaf: '#7bb661',
  amber: '#d9a441',
  red: '#c0392b',
  bg: '#f6f8f6',
  card: '#ffffff',
  text: '#1c2b22',
  textDim: '#5d6f64',
  line: '#dfe7e1',
};

export const cardStyle = (radius = 14): StyleSheet.NamedStyles<any> => ({
  card: {
    backgroundColor: palette.card,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    shadowColor: '#0a1f12',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
});

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const ui = useUi();
  return <Text style={{ fontSize: ui.font.h2, fontWeight: '700', color: palette.text }}>{children}</Text>;
}

export function Chip({ label, tone = 'green' }: { label: string; tone?: 'green' | 'amber' | 'red' | 'grey' }) {
  const ui = useUi();
  const tones: Record<string, { bg: string; fg: string }> = {
    green: { bg: palette.green100, fg: palette.green700 },
    amber: { bg: '#fbf1dc', fg: '#8a6414' },
    red: { bg: '#fbe4e0', fg: palette.red },
    grey: { bg: '#eceff0', fg: palette.textDim },
  };
  const t = tones[tone]!;
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: 999, paddingHorizontal: 10 * ui.gap * 0.7, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: t.fg, fontSize: ui.font.small, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
