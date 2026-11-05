import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

export const colors = {
  bg: '#0F1720',
  card: '#18232F',
  cardAlt: '#203040',
  border: '#2B3A4A',
  text: '#F2F5F8',
  muted: '#8FA1B3',
  accent: '#FF8A3D',
  accentText: '#1A0E05',
  on: '#3DD68C',
  danger: '#FF6B6B',
  warn: '#FFC857',
};

export function Card({ style, children }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', disabled, style, small }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        styles[`button_${variant}`],
        (pressed || disabled) && { opacity: 0.6 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, small && styles.buttonTextSmall, styles[`buttonText_${variant}`]]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, style }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected, style]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Label({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Hint({ children, style }) {
  return <Text style={[styles.hint, style]}>{children}</Text>;
}

export function Screen({ children }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function ToggleRow({ title, hint, value, onValueChange, style }) {
  return (
    <View style={[styles.toggleRow, style]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {hint ? <Hint>{hint}</Hint> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor={colors.text}
      />
    </View>
  );
}

// A row of chips where exactly one is selected. options: [{ label, value }]
export function ChoiceChips({ options, value, onChange }) {
  return (
    <View style={styles.wrap}>
      {options.map((o) => (
        <Chip key={String(o.value)} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

export function RowTitle({ children, style }) {
  return <Text style={[styles.rowTitle, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  button_primary: { backgroundColor: colors.accent },
  button_ghost: { backgroundColor: colors.cardAlt },
  button_danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  buttonText: { fontSize: 16, fontWeight: '700' },
  buttonTextSmall: { fontSize: 14 },
  buttonText_primary: { color: colors.accentText },
  buttonText_ghost: { color: colors.text },
  buttonText_danger: { color: colors.danger },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextSelected: { color: colors.accentText, fontWeight: '700' },
  label: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 8, marginTop: 14 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: 16, paddingBottom: 48 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
