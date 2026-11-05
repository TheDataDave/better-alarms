import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ChoiceChips, Hint, RowTitle, Screen, colors } from '../../components/ui';
import { describeDay, displayTime, fromKey, toKey } from '../../logic/dates.js';
import { planDays } from '../../logic/schedule.js';
import { useApp } from '../../state/app-store';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const STATUS_TEXT = {
  active: 'Will ring',
  skipped: 'Skipped',
  past: 'Done',
  'day-off': 'Off (days-off event)',
  'holiday-off': 'Off (holiday)',
};

// What a day looks like in the grid, from its alarms.
function dayKind(day) {
  const statuses = day.alarms.map((a) => a.status);
  if (statuses.includes('active')) return 'active';
  if (statuses.includes('past')) return 'past';
  if (statuses.includes('skipped')) return 'skipped';
  if (statuses.length) return 'off';
  return 'none';
}

export default function MonthScreen() {
  const { state, events, toggleSkip, decideHoliday } = useApp();
  const today = toKey(new Date());
  const [month, setMonth] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [selected, setSelected] = useState(today);

  const firstKey = toKey(new Date(month.y, month.m, 1));
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const plan = useMemo(
    () =>
      state
        ? planDays({
            rules: state.rules,
            events,
            settings: state.settings,
            skipped: state.skipped,
            holidayDecisions: state.holidayDecisions,
            fromKey: firstKey,
            days: daysInMonth,
          })
        : [],
    [state, events, firstKey, daysInMonth],
  );
  if (!state) return null;

  const shift = (delta) => {
    const d = new Date(month.y, month.m + delta, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };
  const leading = new Date(month.y, month.m, 1).getDay();
  const cells = [...Array(leading).fill(null), ...plan];
  const selectedDay = plan.find((d) => d.dateKey === selected);
  const workDays = plan.filter((d) => ['active', 'past', 'skipped'].includes(dayKind(d))).length;

  return (
    <Screen>
      <View style={styles.monthHeader}>
        <Pressable onPress={() => shift(-1)} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-left" size={32} color={colors.text} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.monthTitle}>
            {MONTHS[month.m]} {month.y}
          </Text>
          <Hint>{workDays} work days</Hint>
        </View>
        <Pressable onPress={() => shift(1)} hitSlop={12}>
          <MaterialCommunityIcons name="chevron-right" size={32} color={colors.text} />
        </Pressable>
      </View>

      <Card style={{ paddingHorizontal: 8 }}>
        <View style={styles.grid}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={styles.weekday}>
              {w}
            </Text>
          ))}
          {cells.map((day, i) => {
            if (!day) return <View key={`blank${i}`} style={styles.cell} />;
            const kind = dayKind(day);
            const first = day.alarms[0];
            return (
              <Pressable
                key={day.dateKey}
                onPress={() => setSelected(day.dateKey)}
                style={[
                  styles.cell,
                  styles[`cell_${kind}`],
                  day.dateKey === today && styles.today,
                  day.dateKey === selected && styles.selected,
                ]}
              >
                <Text style={[styles.dayNum, (kind === 'active' || kind === 'past') && styles.onText]}>
                  {fromKey(day.dateKey).getDate()}
                </Text>
                {first && kind !== 'off' && (
                  <Text
                    style={[
                      styles.cellTime,
                      (kind === 'active' || kind === 'past') && styles.onText,
                      kind === 'skipped' && styles.strike,
                      first.fromPattern && { fontStyle: 'italic' },
                    ]}
                  >
                    {displayTime(first.time).replace(' AM', 'a').replace(' PM', 'p')}
                  </Text>
                )}
                {kind === 'off' && <Text style={styles.cellTime}>off</Text>}
                {day.holiday && <View style={styles.holidayDot} />}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View style={styles.legend}>
        <Legend color={colors.on} label="Alarm" />
        <Legend color="#1F6B48" label="Past" />
        <Legend color="#2E4A6B" label="Off" />
        <Legend color={colors.accent} label="Holiday" dot />
      </View>
      <Hint style={{ marginBottom: 12 }}>Italic times continue the pattern found in your calendar.</Hint>

      {selectedDay && (
        <Card>
          <RowTitle>{describeDay(selectedDay.dateKey)}</RowTitle>
          {selectedDay.holiday && (
            <>
              <Hint style={{ marginTop: 4 }}>{selectedDay.holiday}: are you working?</Hint>
              <View style={{ marginTop: 8 }}>
                <ChoiceChips
                  value={selectedDay.holidayDecision}
                  onChange={(d) => decideHoliday(selectedDay.dateKey, d)}
                  options={[
                    { label: 'Ask me', value: null },
                    { label: 'Working', value: 'work' },
                    { label: 'Day off', value: 'off' },
                  ]}
                />
              </View>
            </>
          )}
          {selectedDay.offEvent && <Hint style={{ marginTop: 4 }}>Day off: {selectedDay.offEvent}</Hint>}
          {selectedDay.alarms.length === 0 && <Hint style={{ marginTop: 4 }}>No alarm this day.</Hint>}
          {selectedDay.alarms.map((a) => (
            <View key={a.id} style={styles.alarmRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.alarmTime, a.status !== 'active' && { color: colors.muted }]}>
                  {displayTime(a.time)}
                </Text>
                <Hint>
                  {a.label} · {STATUS_TEXT[a.status]}
                  {a.fromPattern ? ' · from your pattern' : ''}
                </Hint>
              </View>
              {(a.status === 'active' || a.status === 'skipped') && (
                <Button
                  title={a.status === 'skipped' ? 'Undo skip' : 'Skip'}
                  variant="ghost"
                  small
                  onPress={() => toggleSkip(a.id)}
                />
              )}
            </View>
          ))}
          {selectedDay.dateKey >= today && (
            <Button
              title="+ Add alarm this day"
              variant="ghost"
              small
              style={{ alignSelf: 'flex-start', marginTop: 8 }}
              onPress={() => router.push(`/alarm/new?date=${selectedDay.dateKey}`)}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}

function Legend({ color, label, dot }) {
  return (
    <View style={styles.legendItem}>
      <View style={[dot ? styles.legendDot : styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cell_active: { backgroundColor: colors.on },
  cell_past: { backgroundColor: '#1F6B48' },
  cell_skipped: { backgroundColor: colors.cardAlt },
  cell_off: { backgroundColor: '#2E4A6B' },
  cell_none: {},
  today: { borderColor: colors.text },
  selected: { borderColor: colors.accent },
  dayNum: { color: colors.text, fontSize: 15, fontWeight: '700' },
  onText: { color: '#06281A' },
  cellTime: { color: colors.muted, fontSize: 10, marginTop: 2 },
  strike: { textDecorationLine: 'line-through' },
  holidayDot: { position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 6 },
  legendSwatch: { width: 14, height: 14, borderRadius: 4, marginRight: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { color: colors.muted, fontSize: 13 },
  alarmRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  alarmTime: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
