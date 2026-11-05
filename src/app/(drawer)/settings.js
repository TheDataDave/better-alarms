import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Constants from 'expo-constants';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, ChoiceChips, Hint, Label, RowTitle, Screen, SectionTitle, colors } from '../../components/ui';
import { PERMISSION_TEXT } from '../../hooks/usePermissions';
import { useApp } from '../../state/app-store';

function timeAgo(ms) {
  if (!ms) return 'never';
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} h ago`;
}

export default function SettingsScreen() {
  const { state, permissions, updateSettings, resync, syncing } = useApp();
  if (!state) return null;

  return (
    <Screen>
      <SectionTitle>Setup</SectionTitle>
      <Card>
        {Object.entries(PERMISSION_TEXT).map(([key, [title, hint]]) => (
          <View key={key} style={styles.permRow}>
            <View style={{ flex: 1 }}>
              <RowTitle>{title}</RowTitle>
              <Hint>{hint}</Hint>
            </View>
            {permissions.status[key] ? (
              <MaterialCommunityIcons name="check-circle" size={26} color={colors.on} />
            ) : (
              <Button title="Allow" small onPress={permissions.fix[key]} />
            )}
          </View>
        ))}
      </Card>

      <SectionTitle>Days off</SectionTitle>
      <Card>
        <Hint>No alarm rings on a day with a calendar event containing any of these words (comma-separated).</Hint>
        <TextInput
          style={styles.input}
          defaultValue={state.settings.offKeywords}
          onEndEditing={(e) => updateSettings({ offKeywords: e.nativeEvent.text })}
          placeholder="vacation, pto, day off"
          placeholderTextColor={colors.muted}
        />
      </Card>

      <SectionTitle>Planning</SectionTitle>
      <Card>
        <Label>Set alarms this far ahead</Label>
        <ChoiceChips
          value={state.settings.lookaheadDays}
          onChange={(lookaheadDays) => updateSettings({ lookaheadDays })}
          options={[7, 14, 30].map((d) => ({ label: `${d} days`, value: d }))}
        />
        <Hint>
          Alarms are handed to Android ahead of time so they ring even if the app is closed. The app refreshes them
          from your calendar automatically.
        </Hint>
        <View style={[styles.permRow, { marginTop: 12 }]}>
          <Hint style={{ flex: 1 }}>Last synced {timeAgo(state.lastSync)}</Hint>
          <Button title={syncing ? 'Syncing…' : 'Sync now'} variant="ghost" small disabled={syncing} onPress={resync} />
        </View>
      </Card>

      <Hint style={{ marginTop: 24, textAlign: 'center' }}>Better Alarms {Constants.expoConfig?.version}</Hint>
    </Screen>
  );
}

const styles = StyleSheet.create({
  permRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    fontSize: 15,
  },
});
