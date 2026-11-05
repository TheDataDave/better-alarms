import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Hint, Screen, colors } from '../../components/ui';

const KEY = 'better-alarms/stopwatch/v1';
const IDLE = { startedAt: null, accumulated: 0, laps: [] };

const pad = (n, w = 2) => String(n).padStart(w, '0');

function format(ms) {
  const cs = Math.floor(ms / 10) % 100;
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000);
  return `${h ? `${h}:${pad(m)}` : m}:${pad(s)}.${pad(cs)}`;
}

export default function StopwatchScreen() {
  // Saved so a running stopwatch survives the app being closed.
  const [sw, setSw] = useState(IDLE);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setSw(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (sw.startedAt == null) return undefined;
    const id = setInterval(() => setNow(Date.now()), 47);
    return () => clearInterval(id);
  }, [sw.startedAt]);

  const change = (next) => {
    setSw(next);
    setNow(Date.now());
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  };

  const running = sw.startedAt != null;
  const elapsed = sw.accumulated + (running ? now - sw.startedAt : 0);
  const lapTotal = sw.laps.reduce((sum, l) => sum + l, 0);

  const start = () => change({ ...sw, startedAt: Date.now() });
  const pause = () => change({ ...sw, startedAt: null, accumulated: elapsed });
  const lap = () => change({ ...sw, laps: [elapsed - lapTotal, ...sw.laps] });
  const reset = () => change(IDLE);

  return (
    <Screen>
      <Text style={styles.elapsed}>{format(elapsed)}</Text>
      {sw.laps.length > 0 && <Hint style={styles.currentLap}>Lap {sw.laps.length + 1}: {format(elapsed - lapTotal)}</Hint>}

      <View style={styles.buttons}>
        {running ? (
          <>
            <Button title="Lap" variant="ghost" style={styles.button} onPress={lap} />
            <Button title="Pause" style={styles.button} onPress={pause} />
          </>
        ) : (
          <>
            <Button title="Reset" variant="ghost" style={styles.button} disabled={elapsed === 0} onPress={reset} />
            <Button title={elapsed ? 'Resume' : 'Start'} style={styles.button} onPress={start} />
          </>
        )}
      </View>

      {sw.laps.length > 0 && (
        <Card style={{ paddingVertical: 4 }}>
          {sw.laps.map((ms, i) => {
            const n = sw.laps.length - i;
            const total = sw.laps.slice(i).reduce((sum, l) => sum + l, 0);
            return (
              <View key={n} style={[styles.lapRow, i > 0 && styles.divider]}>
                <Text style={styles.lapNum}>Lap {n}</Text>
                <Text style={styles.lapTime}>{format(ms)}</Text>
                <Text style={styles.lapTotal}>{format(total)}</Text>
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  elapsed: {
    color: colors.text,
    fontSize: 64,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginTop: 32,
  },
  currentLap: { textAlign: 'center', marginTop: 4 },
  buttons: { flexDirection: 'row', marginVertical: 28 },
  button: { flex: 1, marginHorizontal: 6 },
  lapRow: { flexDirection: 'row', paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  lapNum: { color: colors.muted, flex: 1, fontSize: 15 },
  lapTime: { color: colors.text, flex: 1, fontSize: 15, textAlign: 'center', fontVariant: ['tabular-nums'] },
  lapTotal: { color: colors.muted, flex: 1, fontSize: 15, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
