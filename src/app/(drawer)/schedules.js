import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Button, Card, Hint, RowTitle, Screen, colors } from '../../components/ui';
import { CUSTOM_TYPES, describeRule } from '../../logic/schedule.js';
import { useApp } from '../../state/app-store';

export default function SchedulesScreen() {
  const { state, setRuleEnabled: setEnabled } = useApp();
  if (!state) return null;
  const schedules = state.rules.filter((r) => !CUSTOM_TYPES.includes(r.type));

  return (
    <Screen>
      {schedules.length === 0 && (
        <Hint style={{ marginBottom: 12 }}>
          A schedule decides which days your alarm rings. Make one from your calendar, or from a repeating pattern like
          2-2-3.
        </Hint>
      )}
      {schedules.map((rule) => (
        <Pressable key={rule.id} onPress={() => router.push(`/schedule/${rule.id}`)}>
          <Card style={styles.ruleCard}>
            <View style={{ flex: 1 }}>
              <RowTitle style={!rule.enabled && { color: colors.muted }}>{rule.name}</RowTitle>
              <Hint>{describeRule(rule)}</Hint>
            </View>
            <Switch
              value={rule.enabled}
              onValueChange={(v) => setEnabled(rule.id, v)}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.text}
            />
          </Card>
        </Pressable>
      ))}
      <Button title="+ From my calendar" onPress={() => router.push('/schedule/new?type=calendar')} />
      <Button
        title="+ Repeating pattern"
        variant="ghost"
        style={{ marginTop: 8 }}
        onPress={() => router.push('/schedule/new?type=rotation')}
      />
      <Hint style={{ marginTop: 16 }}>Turn a schedule off to pause its alarms without losing it.</Hint>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ruleCard: { flexDirection: 'row', alignItems: 'center' },
});
