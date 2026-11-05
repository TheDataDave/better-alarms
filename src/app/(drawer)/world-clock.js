import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Hint, Screen, colors } from '../../components/ui';
import { displayTime } from '../../logic/dates.js';
import { CITIES, cityTime, describeOffset } from '../../logic/world-clock.js';
import { useApp } from '../../state/app-store';

const DATE_FORMAT = { weekday: 'long', month: 'long', day: 'numeric' };

export default function WorldClockScreen() {
  const { state, addWorldClock, removeWorldClock } = useApp();
  const [now, setNow] = useState(() => Date.now());
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CITIES.filter(
      (c) =>
        !state?.worldClocks.includes(c.id) &&
        (!q || c.city.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)),
    );
  }, [query, state?.worldClocks]);

  if (!state) return null;
  const saved = state.worldClocks.map((id) => CITIES.find((c) => c.id === id)).filter(Boolean);

  return (
    <Screen>
      <View style={styles.local}>
        <Text style={styles.localTime}>{displayTime(now)}</Text>
        <Hint>{new Date(now).toLocaleDateString(undefined, DATE_FORMAT)}</Hint>
      </View>

      {saved.map((c) => {
        const t = cityTime(c.tz, now);
        return (
          <Card key={c.id} style={styles.cityCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.city}>{c.city}</Text>
              <Hint>{describeOffset(t)}</Hint>
            </View>
            <Text style={styles.cityTime}>{t.time}</Text>
            <Pressable
              onPress={() => removeWorldClock(c.id)}
              hitSlop={12}
              style={{ marginLeft: 12 }}
              accessibilityLabel={`Remove ${c.city}`}
            >
              <MaterialCommunityIcons name="close" size={20} color={colors.muted} />
            </Pressable>
          </Card>
        );
      })}

      {adding ? (
        <Card>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search cities or countries"
            placeholderTextColor={colors.muted}
            autoFocus
          />
          {matches.slice(0, 30).map((c) => (
            <Pressable
              key={c.id}
              style={styles.result}
              onPress={() => {
                addWorldClock(c.id);
                setAdding(false);
                setQuery('');
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.resultCity}>{c.city}</Text>
                <Hint>{c.country}</Hint>
              </View>
              <Text style={styles.resultTime}>{cityTime(c.tz, now).time}</Text>
            </Pressable>
          ))}
          {matches.length === 0 && <Hint style={{ marginTop: 12 }}>No matching cities.</Hint>}
          <Button title="Done" variant="ghost" style={{ marginTop: 8 }} onPress={() => setAdding(false)} />
        </Card>
      ) : (
        <Button title="+ Add city" onPress={() => setAdding(true)} style={{ marginTop: 8 }} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  local: { alignItems: 'center', paddingVertical: 24 },
  localTime: { color: colors.text, fontSize: 56, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cityCard: { flexDirection: 'row', alignItems: 'center' },
  city: { color: colors.text, fontSize: 18, fontWeight: '600' },
  cityTime: { color: colors.text, fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 8,
  },
  result: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  resultCity: { color: colors.text, fontSize: 16 },
  resultTime: { color: colors.muted, fontSize: 15, fontVariant: ['tabular-nums'] },
});
