import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip, Hint, Screen, SectionTitle, colors } from '../../components/ui';
import { useNow } from '../../hooks/use-now';
import { formatDuration } from '../../logic/dates.js';
import { useApp } from '../../state/app-store';

const PRESETS = [
  ['1 min', 60],
  ['3 min', 180],
  ['5 min', 300],
  ['10 min', 600],
  ['15 min', 900],
  ['30 min', 1800],
  ['1 hr', 3600],
];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'];

// Keypad entry works like a microwave: "1030" means 10 min 30 s.
function digitsToMs(digits) {
  const p = digits.padStart(6, '0');
  return ((Number(p.slice(0, 2)) * 60 + Number(p.slice(2, 4))) * 60 + Number(p.slice(4, 6))) * 1000;
}

function RunningTimer({ timer, now }) {
  const { pauseTimer, resumeTimer, addMinute, resetTimer, restartTimer, removeTimer } = useApp();
  const running = timer.endAt != null;
  const left = running ? timer.endAt - now : timer.remainingMs;
  const done = running && left <= 0;
  const progress = Math.min(1, Math.max(0, 1 - left / timer.durationMs));

  return (
    <Card>
      <View style={styles.timerHeader}>
        <Text style={styles.timerLabel}>{timer.label}</Text>
        <Pressable onPress={() => removeTimer(timer.id)} hitSlop={12} accessibilityLabel="Delete timer">
          <MaterialCommunityIcons name="close" size={22} color={colors.muted} />
        </Pressable>
      </View>
      <Text style={[styles.remaining, done && { color: colors.accent }]}>{done ? 'Time’s up' : formatDuration(left)}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.timerButtons}>
        {done ? (
          <Button title="Restart" small onPress={() => restartTimer(timer.id)} />
        ) : running ? (
          <Button title="Pause" small onPress={() => pauseTimer(timer.id)} />
        ) : (
          <Button title="Resume" small onPress={() => resumeTimer(timer.id)} />
        )}
        {!done && <Button title="+1:00" variant="ghost" small style={{ marginLeft: 8 }} onPress={() => addMinute(timer.id)} />}
        {!running && timer.remainingMs !== timer.durationMs && (
          <Button title="Reset" variant="ghost" small style={{ marginLeft: 8 }} onPress={() => resetTimer(timer.id)} />
        )}
      </View>
    </Card>
  );
}

export default function TimerScreen() {
  const { state, startTimer } = useApp();
  const now = useNow(250);
  const [digits, setDigits] = useState('');
  const [label, setLabel] = useState('');
  if (!state) return null;

  const ms = digitsToMs(digits);
  const p = digits.padStart(6, '0');
  const press = (key) => {
    if (key === 'del') return setDigits((d) => d.slice(0, -1));
    setDigits((d) => (d + key).replace(/^0+/, '').slice(0, 6));
  };
  const start = (durationMs) => {
    startTimer(durationMs, label);
    setDigits('');
    setLabel('');
  };

  return (
    <Screen>
      {state.timers.map((t) => (
        <RunningTimer key={t.id} timer={t} now={now} />
      ))}

      <SectionTitle>{state.timers.length ? 'Another timer' : 'New timer'}</SectionTitle>
      <Card>
        <View style={styles.display}>
          {[
            [p.slice(0, 2), 'h'],
            [p.slice(2, 4), 'm'],
            [p.slice(4, 6), 's'],
          ].map(([value, unit]) => (
            <Text key={unit} style={[styles.digits, !digits && { color: colors.muted }]}>
              {value}
              <Text style={styles.unit}>{unit} </Text>
            </Text>
          ))}
        </View>

        <View style={styles.keypad}>
          {KEYS.map((k) => (
            <Pressable
              key={k}
              onPress={() => press(k)}
              style={({ pressed }) => [styles.key, pressed && { backgroundColor: colors.border }]}
              accessibilityLabel={k === 'del' ? 'Delete digit' : k}
            >
              {k === 'del' ? (
                <MaterialCommunityIcons name="backspace-outline" size={24} color={colors.text} />
              ) : (
                <Text style={styles.keyText}>{k}</Text>
              )}
            </Pressable>
          ))}
        </View>

        <View style={styles.presets}>
          {PRESETS.map(([text, seconds]) => (
            <Chip key={text} label={text} onPress={() => start(seconds * 1000)} />
          ))}
        </View>
        <Hint style={{ marginBottom: 8 }}>Tap a preset to start it straight away.</Hint>

        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder="Label (optional)"
          placeholderTextColor={colors.muted}
        />
        <Button title="Start" disabled={ms === 0} onPress={() => start(ms)} style={{ marginTop: 12 }} />
      </Card>
      <Hint style={{ marginTop: 8 }}>
        Timers keep running with the app closed. How they turn off is set in Sounds &amp; wake-up.
      </Hint>
    </Screen>
  );
}

const styles = StyleSheet.create({
  timerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timerLabel: { color: colors.muted, fontSize: 15, flex: 1 },
  remaining: { color: colors.text, fontSize: 52, fontWeight: '800', fontVariant: ['tabular-nums'], marginVertical: 4 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.accent },
  timerButtons: { flexDirection: 'row', marginTop: 12 },
  display: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12 },
  digits: { color: colors.text, fontSize: 44, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 18, color: colors.muted },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  key: {
    width: '31%',
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  keyText: { color: colors.text, fontSize: 24, fontWeight: '600' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
});
