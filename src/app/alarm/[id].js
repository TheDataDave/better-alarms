import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Hint, Label, Screen, ToggleRow, colors } from '../../components/ui';
import { useNativePicker } from '../../hooks/use-native-picker';
import { useNow } from '../../hooks/use-now';
import { atTime, describeDay, displayHHMM, formatTime, fromKey, nextDateFor, parseTime, toKey } from '../../logic/dates.js';
import { computeAlarms } from '../../logic/schedule.js';
import { newId } from '../../services/storage';
import { useApp } from '../../state/app-store';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// A one-time alarm whose moment has passed moves to the next time it comes around.
function withFreshDate(rule) {
  if (rule.type !== 'single' || atTime(rule.date, rule.time) > Date.now()) return rule;
  return { ...rule, date: nextDateFor(rule.time) };
}

function untilText(ms) {
  const mins = Math.max(1, Math.round(ms / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  return ['Rings in', d && `${d} d`, h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ');
}

export default function AlarmEditorScreen() {
  const params = useLocalSearchParams();
  const { state, saveRule, deleteRule } = useApp();
  const isNew = params.id === 'new';
  const now = useNow(30000);
  const [openPicker, pickerElement] = useNativePicker();

  const [draft, setDraft] = useState(() => {
    const existing = state?.rules.find((r) => r.id === params.id);
    if (existing) return withFreshDate({ days: Array(7).fill(false), ...existing });
    const time = '07:00';
    return {
      id: newId(),
      name: '',
      enabled: true,
      type: 'single',
      date: params.date ?? nextDateFor(time),
      days: Array(7).fill(false),
      time,
      followDaysOff: false,
    };
  });
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const pickTime = () => {
    const t = parseTime(draft.time) ?? { h: 7, m: 0 };
    openPicker('time', new Date(2000, 0, 1, t.h, t.m), (d) => {
      const time = formatTime(d.getHours(), d.getMinutes());
      // A new one-time alarm with no chosen date goes to the next time it comes around.
      setDraft((cur) =>
        isNew && !params.date && cur.type === 'single'
          ? { ...cur, time, date: nextDateFor(time) }
          : withFreshDate({ ...cur, time }),
      );
    });
  };

  // Like a stock clock, a new alarm starts by asking for the time.
  useEffect(() => {
    if (isNew) pickTime();
    // Only on first open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) return null;

  const toggleDay = (i) => {
    const days = draft.days.map((v, j) => (j === i ? !v : v));
    set({ days, type: days.some(Boolean) ? 'weekly' : 'single', date: draft.date ?? nextDateFor(draft.time) });
  };

  const [next] = computeAlarms({ rules: [{ ...draft, enabled: true }], settings: state.settings, days: 400, now });

  const save = () => {
    if (draft.type === 'single' && !next) {
      return Alert.alert('That time has already passed', 'Pick a later time or another day.');
    }
    saveRule({ ...draft, enabled: true, name: draft.name.trim() });
    router.back();
  };

  const remove = () =>
    Alert.alert('Delete alarm?', `${displayHHMM(draft.time)}${draft.name ? ` · ${draft.name}` : ''}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteRule(draft.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'New alarm' : 'Edit alarm' }} />

      <Pressable onPress={pickTime} style={styles.timeBox} accessibilityRole="button" accessibilityLabel="Change time">
        <Text style={styles.time}>{displayHHMM(draft.time)}</Text>
        <Hint>{next ? untilText(next.time - now) : 'Not scheduled'}</Hint>
      </Pressable>

      <Card>
        <Label>Repeat</Label>
        <View style={styles.days}>
          {DAY_LETTERS.map((letter, i) => (
            <Pressable
              key={i}
              onPress={() => toggleDay(i)}
              style={[styles.day, draft.days[i] && styles.dayOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: draft.days[i] }}
            >
              <Text style={[styles.dayText, draft.days[i] && styles.dayTextOn]}>{letter}</Text>
            </Pressable>
          ))}
        </View>
        {draft.type === 'single' ? (
          <View style={styles.onceRow}>
            <Hint style={{ flex: 1 }}>Rings once · {describeDay(draft.date)}</Hint>
            <Button
              title="Change date"
              variant="ghost"
              small
              onPress={() => openPicker('date', fromKey(draft.date), (d) => set({ date: toKey(d) }))}
            />
          </View>
        ) : (
          <Hint style={{ marginTop: 8 }}>Tap days to repeat on. Clear them all to ring just once.</Hint>
        )}

        <Label>Label</Label>
        <TextInput
          style={styles.input}
          value={draft.name}
          onChangeText={(name) => set({ name })}
          placeholder="e.g. Gym, Meds, Pick up kids"
          placeholderTextColor={colors.muted}
        />

        <ToggleRow
          style={{ marginTop: 12 }}
          title="Skip on days off and holidays"
          hint="Stay quiet on vacation days and holidays you’ve marked as off."
          value={!!draft.followDaysOff}
          onValueChange={(followDaysOff) => set({ followDaysOff })}
        />
      </Card>

      <Button title="Save" onPress={save} style={{ marginTop: 8 }} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} style={{ marginTop: 8 }} />
      {!isNew && <Button title="Delete alarm" variant="danger" onPress={remove} style={{ marginTop: 24 }} />}
      {pickerElement}
    </Screen>
  );
}

const styles = StyleSheet.create({
  timeBox: { alignItems: 'center', paddingVertical: 20 },
  time: { color: colors.text, fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'] },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOn: { backgroundColor: colors.accent },
  dayText: { color: colors.text, fontWeight: '700' },
  dayTextOn: { color: colors.accentText },
  onceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
});
