import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import * as AlarmEngine from '../../../modules/alarm-engine';
import { Button, Card, Hint, RowTitle, Screen, SectionTitle, colors } from '../../components/ui';
import { describeDay, displayHHMM, displayTime } from '../../logic/dates.js';
import { CUSTOM_TYPES, describeRepeat } from '../../logic/schedule.js';
import { missingPermissions } from '../../hooks/usePermissions';
import { useApp } from '../../state/app-store';

function HolidayQuestion({ alarm, onDecide }) {
  return (
    <Card style={styles.questionCard}>
      <RowTitle>Working on {alarm.holiday}?</RowTitle>
      <Hint>
        {describeDay(alarm.dateKey)} · you have a {displayTime(alarm.time)} alarm. If you don’t answer, it will still
        ring.
      </Hint>
      <View style={styles.row}>
        <Button title="I’m working" small onPress={() => onDecide('work')} />
        <Button title="Day off" variant="ghost" small style={{ marginLeft: 8 }} onPress={() => onDecide('off')} />
      </View>
    </Card>
  );
}

function WorkQuickStart() {
  return (
    <Card>
      <RowTitle>Set up your work alarms</RowTitle>
      <Hint style={{ marginBottom: 12 }}>How do you know when you’re working?</Hint>
      <Button title="My shifts are in my calendar" onPress={() => router.push('/schedule/new?type=calendar')} />
      <Button
        title="I work a repeating pattern"
        variant="ghost"
        style={{ marginTop: 8 }}
        onPress={() => router.push('/schedule/new?type=rotation')}
      />
    </Card>
  );
}

function CustomAlarmRow({ rule, onToggle }) {
  return (
    <Pressable onPress={() => router.push(`/alarm/${rule.id}`)}>
      <Card style={styles.alarmCard}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.customTime, !rule.enabled && { color: colors.muted }]}>{displayHHMM(rule.time)}</Text>
          <Hint>{[rule.name, describeRepeat(rule)].filter(Boolean).join(' · ')}</Hint>
        </View>
        <Switch
          value={rule.enabled}
          onValueChange={onToggle}
          trackColor={{ true: colors.accent, false: colors.border }}
          thumbColor={colors.text}
        />
      </Card>
    </Pressable>
  );
}

export default function AlarmsScreen() {
  const { state, upcoming, pending, warnings, permissions, toggleSkip, decideHoliday, cancelPending, setRuleEnabled } =
    useApp();
  if (!state) return null;

  const missing = missingPermissions(permissions.status, state);
  const next = upcoming.find((a) => !a.skipped);
  const questions = upcoming.filter(
    (a, i, all) => a.needsHolidayDecision && all.findIndex((b) => b.dateKey === a.dateKey) === i,
  );
  const ruleById = Object.fromEntries(state.rules.map((r) => [r.id, r]));
  const customAlarms = state.rules
    .filter((r) => CUSTOM_TYPES.includes(r.type))
    .sort((a, b) => a.time.localeCompare(b.time));
  const hasWorkSchedule = state.rules.some((r) => !CUSTOM_TYPES.includes(r.type));
  const workUpcoming = upcoming.filter((a) => !CUSTOM_TYPES.includes(ruleById[a.ruleId]?.type));

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {!AlarmEngine.isAvailable && (
          <Card style={styles.warnCard}>
            <Text style={styles.warnText}>
              Preview mode: the native alarm engine isn’t in this build (e.g. Expo Go), so alarms won’t ring.
            </Text>
          </Card>
        )}

        {missing.length > 0 && (
          <Card style={styles.warnCard}>
            <Text style={[styles.warnText, { fontWeight: '700' }]}>Finish setup</Text>
            <Text style={styles.warnText}>
              {missing.length === 1 ? 'One permission is' : `${missing.length} permissions are`} still needed for
              alarms to work reliably.
            </Text>
            <Button
              title="Fix it"
              small
              style={{ alignSelf: 'flex-start', marginTop: 8 }}
              onPress={() => router.push('/settings')}
            />
          </Card>
        )}

        {warnings.map((w) => (
          <Card key={w} style={styles.warnCard}>
            <Text style={styles.warnText}>{w}</Text>
          </Card>
        ))}

        {questions.map((a) => (
          <HolidayQuestion key={a.dateKey} alarm={a} onDecide={(d) => decideHoliday(a.dateKey, d)} />
        ))}

        {pending.map((p) => (
          <Card key={p.id} style={styles.alarmCard}>
            <View style={{ flex: 1 }}>
              <RowTitle>{p.id === 'snooze' ? 'Snoozed' : 'Backup alarm'}</RowTitle>
              <Hint>Rings again at {displayTime(p.time)}</Hint>
            </View>
            <Button
              title={p.id === 'backup' ? 'I’m up' : 'Cancel'}
              variant="ghost"
              small
              onPress={() => cancelPending(p.id)}
            />
          </Card>
        ))}

        <Card style={styles.hero}>
          {next ? (
            <>
              <Hint>Next alarm</Hint>
              <Text style={styles.heroTime}>{displayTime(next.time)}</Text>
              <Text style={styles.heroDay}>
                {describeDay(next.dateKey)} · {next.label}
              </Text>
            </>
          ) : (
            <Text style={styles.heroDay}>No alarms in the next {state.settings.lookaheadDays} days</Text>
          )}
        </Card>

        <SectionTitle>My alarms</SectionTitle>
        {customAlarms.length === 0 && <Hint>Tap + to add a one-time or repeating alarm.</Hint>}
        {customAlarms.map((rule) => (
          <CustomAlarmRow key={rule.id} rule={rule} onToggle={(v) => setRuleEnabled(rule.id, v)} />
        ))}

        <SectionTitle>Work alarms</SectionTitle>
        {!hasWorkSchedule && <WorkQuickStart />}
        {hasWorkSchedule && workUpcoming.length === 0 && (
          <Hint>No work alarms in the next {state.settings.lookaheadDays} days.</Hint>
        )}
        {workUpcoming.length > 0 && (
          <Card style={{ paddingVertical: 4 }}>
            {workUpcoming.map((a, i) => (
              <View key={a.id} style={[styles.upcomingRow, i > 0 && styles.divider]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.upcomingTime, a.skipped && styles.skipped]}>{displayTime(a.time)}</Text>
                  <Hint style={a.skipped && styles.skipped}>
                    {describeDay(a.dateKey)} · {ruleById[a.ruleId]?.name ?? a.label}
                  </Hint>
                  {(a.holiday || a.fromPattern) && (
                    <Text style={styles.tag}>
                      {[a.holiday, a.fromPattern && 'continues your pattern'].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </View>
                <Button
                  title={a.skipped ? 'Undo skip' : 'Skip'}
                  variant="ghost"
                  small
                  onPress={() => toggleSkip(a.id)}
                />
              </View>
            ))}
          </Card>
        )}
        <View style={{ height: 72 }} />
      </Screen>

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/alarm/new')}
        accessibilityLabel="Add alarm"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons name="plus" size={32} color={colors.accentText} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  warnCard: { backgroundColor: '#3A2E12' },
  warnText: { color: colors.warn, fontSize: 14, lineHeight: 20 },
  questionCard: { borderWidth: 1, borderColor: colors.accent },
  alarmCard: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', marginTop: 12 },
  hero: { paddingVertical: 24, alignItems: 'center' },
  heroTime: { color: colors.text, fontSize: 56, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroDay: { color: colors.text, fontSize: 16, textAlign: 'center' },
  customTime: { color: colors.text, fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  upcomingTime: { color: colors.text, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  skipped: { color: colors.muted, textDecorationLine: 'line-through' },
  tag: { color: colors.accent, fontSize: 12, marginTop: 2 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
});
