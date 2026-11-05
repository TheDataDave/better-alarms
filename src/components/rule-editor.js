import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useNativePicker } from '../hooks/use-native-picker';
import { listCalendars } from '../services/calendar';
import { useApp } from '../state/app-store';
import { addDays, describeDay, displayHHMM, displayTime, formatTime, fromKey, parseTime, toKey } from '../logic/dates.js';
import { frequentTitles } from '../logic/patterns.js';
import { computeAlarms, describePattern, parseKeywords, patternContinuation, PRESETS } from '../logic/schedule.js';
import { Button, Card, Chip, Hint, Label, Screen, ToggleRow, colors } from './ui';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const PREVIEW_DAYS = 28;

export function newRule(id, type = 'rotation') {
  return {
    id,
    name: type === 'calendar' ? 'Work' : 'Work alarm',
    enabled: true,
    type,
    pattern: [true, true, false, false],
    anchorDate: toKey(new Date()),
    time: '06:00',
    keywords: 'work',
    calendarIds: [],
    leadMinutes: 90,
    allDayTime: '06:00',
    continuePattern: true,
  };
}

export default function RuleEditor({ rule, isNew, onSave, onDelete, onCancel }) {
  const { state, events, permissions } = useApp();
  const [draft, setDraft] = useState(rule);
  const [calendars, setCalendars] = useState(null);
  const [openPicker, pickerElement] = useNativePicker();
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const hasCalendar = permissions.status.calendar;

  const suggestions = useMemo(() => frequentTitles(events), [events]);
  const detected = useMemo(
    () => (draft.type === 'calendar' ? patternContinuation(draft, events) : null),
    [draft, events],
  );

  const preview = useMemo(() => {
    const alarms = computeAlarms({
      rules: [{ ...draft, enabled: true }],
      events,
      settings: state.settings,
      holidayDecisions: state.holidayDecisions,
      days: PREVIEW_DAYS,
    });
    const byDay = new Map(alarms.map((a) => [a.dateKey, a]));
    const today = toKey(new Date());
    return Array.from({ length: PREVIEW_DAYS }, (_, i) => {
      const key = addDays(today, i);
      return { key, alarm: byDay.get(key) };
    });
  }, [draft, events, state.settings, state.holidayDecisions]);

  const loadCalendars = async () => {
    setCalendars((await listCalendars()).filter((c) => !c.holiday));
  };

  const pickTime = (field) => {
    const t = parseTime(draft[field]) ?? { h: 6, m: 0 };
    openPicker('time', new Date(2000, 0, 1, t.h, t.m), (d) => set({ [field]: formatTime(d.getHours(), d.getMinutes()) }));
  };

  const save = () => {
    if (!draft.name.trim()) return Alert.alert('Give this schedule a name.');
    if (draft.type === 'rotation' && !draft.pattern.some(Boolean)) {
      return Alert.alert('Turn on at least one day in the cycle.');
    }
    if (draft.type === 'calendar' && !parseKeywords(draft.keywords).length) {
      return Alert.alert('Add at least one word to look for in event titles.');
    }
    onSave({ ...draft, name: draft.name.trim(), leadMinutes: Number(draft.leadMinutes) || 0 });
  };

  const confirmDelete = () =>
    Alert.alert('Delete schedule?', draft.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(draft.id) },
    ]);

  return (
    <Screen>
      <Label>Name</Label>
      <TextInput
        style={styles.input}
        value={draft.name}
        onChangeText={(name) => set({ name })}
        placeholderTextColor={colors.muted}
      />

      <Label>Ring on</Label>
      <View style={styles.wrap}>
        <Chip label="A repeating pattern" selected={draft.type === 'rotation'} onPress={() => set({ type: 'rotation' })} />
        <Chip label="My calendar" selected={draft.type === 'calendar'} onPress={() => set({ type: 'calendar' })} />
      </View>

      {draft.type === 'rotation' ? (
        <Card>
          <Label>Quick patterns</Label>
          <View style={styles.wrap}>
            {PRESETS.map((p) => (
              <Chip key={p.label} label={p.label} onPress={() => set({ pattern: p.pattern })} />
            ))}
          </View>

          <Label>Cycle ({draft.pattern.length} days) · tap a day to switch it on/off</Label>
          <View style={styles.wrap}>
            {draft.pattern.map((on, i) => (
              <Pressable
                key={i}
                onPress={() => set({ pattern: draft.pattern.map((v, j) => (j === i ? !v : v)) })}
                style={[styles.dayCell, on && styles.dayCellOn]}
              >
                <Text style={[styles.dayNum, on && styles.dayTextOn]}>{i + 1}</Text>
                <Text style={[styles.dayState, on && styles.dayTextOn]}>{on ? 'ON' : 'off'}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.row}>
            <Button
              title="− Day"
              variant="ghost"
              small
              disabled={draft.pattern.length <= 1}
              onPress={() => set({ pattern: draft.pattern.slice(0, -1) })}
            />
            <Button
              title="+ Day"
              variant="ghost"
              small
              style={{ marginLeft: 8 }}
              disabled={draft.pattern.length >= 56}
              onPress={() => set({ pattern: [...draft.pattern, false] })}
            />
          </View>
          <Hint style={{ marginTop: 8 }}>The cycle repeats forever until you turn this schedule off.</Hint>

          <Label>Day 1 of the cycle</Label>
          <Button
            title={fromKey(draft.anchorDate).toDateString()}
            variant="ghost"
            onPress={() => openPicker('date', fromKey(draft.anchorDate), (d) => set({ anchorDate: toKey(d) }))}
          />
          <Hint style={{ marginTop: 6 }}>Pick any date that was (or will be) day 1, e.g. the first day of a work block.</Hint>

          <Label>Alarm time</Label>
          <Button title={displayHHMM(draft.time)} variant="ghost" onPress={() => pickTime('time')} />
        </Card>
      ) : (
        <Card>
          {!hasCalendar && (
            <View style={{ marginBottom: 8 }}>
              <Hint>This reads the calendars already synced to your phone, including Google Calendar.</Hint>
              <Button title="Allow calendar access" style={{ marginTop: 8 }} onPress={permissions.fix.calendar} />
            </View>
          )}

          <Label>Event title contains</Label>
          <TextInput
            style={styles.input}
            value={draft.keywords}
            onChangeText={(keywords) => set({ keywords })}
            placeholder="work, shift"
            placeholderTextColor={colors.muted}
          />
          {suggestions.length > 0 && (
            <View style={[styles.wrap, { marginTop: 8 }]}>
              {suggestions.map((s) => (
                <Chip key={s} label={s} onPress={() => set({ keywords: s.toLowerCase() })} />
              ))}
            </View>
          )}
          <Hint style={{ marginTop: 6 }}>
            Comma-separated, not case-sensitive. Events lasting several days (e.g. Fri 6:30 AM – Sun 6:45 PM) count as a
            shift on each day.
          </Hint>

          <Label>Wake me this long before the shift starts</Label>
          <View style={styles.wrap}>
            {[30, 60, 90, 120].map((m) => (
              <Chip
                key={m}
                label={m < 60 ? `${m} min` : `${m / 60} h`}
                selected={Number(draft.leadMinutes) === m}
                onPress={() => set({ leadMinutes: m })}
              />
            ))}
          </View>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { width: 90 }]}
              value={String(draft.leadMinutes)}
              onChangeText={(v) => set({ leadMinutes: v.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
            />
            <Hint style={{ marginLeft: 8 }}>minutes</Hint>
          </View>

          <Label>For all-day work events, ring at</Label>
          <Button title={displayHHMM(draft.allDayTime)} variant="ghost" onPress={() => pickTime('allDayTime')} />

          <ToggleRow
            style={{ marginTop: 12 }}
            title="Keep my pattern going"
            hint={
              detected
                ? `Found ${describePattern(detected.pattern)} (${detected.period}-day cycle). Your calendar's last shift is ${describeDay(detected.lastWorkDay)}; after that, alarms follow this cycle at ${displayHHMM(detected.time)}.`
                : 'When your calendar runs out of shifts, keep ringing on the same cycle. Needs a few weeks of shifts in your calendar to spot the pattern.'
            }
            value={draft.continuePattern !== false}
            onValueChange={(continuePattern) => set({ continuePattern })}
          />

          <Label>Calendars to check</Label>
          {calendars ? (
            <View style={styles.wrap}>
              <Chip label="All" selected={!draft.calendarIds.length} onPress={() => set({ calendarIds: [] })} />
              {calendars.map((c) => {
                const selected = draft.calendarIds.includes(c.id);
                return (
                  <Chip
                    key={c.id}
                    label={c.title}
                    selected={selected}
                    onPress={() =>
                      set({
                        calendarIds: selected
                          ? draft.calendarIds.filter((x) => x !== c.id)
                          : [...draft.calendarIds, c.id],
                      })
                    }
                  />
                );
              })}
            </View>
          ) : (
            <Button
              title={draft.calendarIds.length ? `${draft.calendarIds.length} selected · change` : 'All calendars · change'}
              variant="ghost"
              small
              style={{ alignSelf: 'flex-start' }}
              disabled={!hasCalendar}
              onPress={loadCalendars}
            />
          )}
        </Card>
      )}

      <Label>Next 4 weeks</Label>
      <Card>
        <View style={styles.grid}>
          {preview.map(({ key, alarm }) => {
            const d = fromKey(key);
            return (
              <View key={key} style={[styles.previewCell, alarm && styles.previewOn]}>
                <Text style={[styles.previewDay, alarm && styles.dayTextOn]}>
                  {WEEKDAY_LETTERS[d.getDay()]} {d.getDate()}
                </Text>
                <Text style={[styles.previewTime, alarm && styles.dayTextOn, alarm?.fromPattern && { fontStyle: 'italic' }]}>
                  {alarm ? displayTime(alarm.time).replace(' ', '\n') : '—'}
                </Text>
              </View>
            );
          })}
        </View>
        <Hint style={{ marginTop: 8 }}>Includes days off and holidays you’ve marked off. The Month view shows further ahead.</Hint>
      </Card>

      <Button title="Save" onPress={save} style={{ marginTop: 8 }} />
      <Button title="Cancel" variant="ghost" onPress={onCancel} style={{ marginTop: 8 }} />
      {!isNew && <Button title="Delete schedule" variant="danger" onPress={confirmDelete} style={{ marginTop: 24 }} />}
      {pickerElement}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  dayCell: {
    width: 48,
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    marginBottom: 6,
  },
  dayCellOn: { backgroundColor: colors.on },
  dayNum: { color: colors.text, fontSize: 16, fontWeight: '700' },
  dayState: { color: colors.muted, fontSize: 11 },
  dayTextOn: { color: '#06281A' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  previewCell: {
    width: '13.5%',
    minHeight: 64,
    borderRadius: 8,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    paddingVertical: 4,
  },
  previewOn: { backgroundColor: colors.on },
  previewDay: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  previewTime: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 2 },
});
