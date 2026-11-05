import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, Hint, RowTitle, Screen, SectionTitle, ToggleRow } from '../../components/ui';
import { describeDay, displayTime } from '../../logic/dates.js';
import { planDays } from '../../logic/schedule.js';
import { useApp } from '../../state/app-store';

const LOOK_AHEAD_DAYS = 180;

export default function HolidaysScreen() {
  const { state, events, updateSettings, decideHoliday } = useApp();
  const holidays = useMemo(
    () =>
      state
        ? planDays({
            rules: state.rules,
            events,
            settings: state.settings,
            holidayDecisions: state.holidayDecisions,
            days: LOOK_AHEAD_DAYS,
          }).filter((d) => d.holiday)
        : [],
    [state, events],
  );
  if (!state) return null;
  const sources = state.settings.holidays;
  const setSource = (patch) => updateSettings({ holidays: { ...sources, ...patch } });

  return (
    <Screen>
      <Hint>
        When an alarm lands on a holiday, we’ll ask whether you’re working. If you don’t answer, the alarm still rings,
        because being early beats being late.
      </Hint>

      <SectionTitle>Where holidays come from</SectionTitle>
      <Card>
        <ToggleRow
          title="US federal holidays"
          hint="Built in: Thanksgiving, Christmas, Memorial Day and the rest."
          value={sources.us}
          onValueChange={(us) => setSource({ us })}
        />
        <ToggleRow
          title="Holiday calendars on my phone"
          hint={'Any synced calendar with "holiday" in its name, like "Holidays in United States" from Google Calendar.'}
          value={sources.phoneCalendars}
          onValueChange={(phoneCalendars) => setSource({ phoneCalendars })}
        />
      </Card>

      <SectionTitle>Next 6 months</SectionTitle>
      {holidays.length === 0 && <Hint>No holidays found.</Hint>}
      {holidays.map((day) => {
        const alarm = day.alarms.find((a) => a.status !== 'past');
        return (
          <Card key={day.dateKey}>
            <RowTitle>{day.holiday}</RowTitle>
            <Hint>
              {describeDay(day.dateKey)} · {alarm ? `alarm at ${displayTime(alarm.time)}` : 'no alarm that day'}
            </Hint>
            <View style={styles.chips}>
              <ChoiceChips
                value={day.holidayDecision}
                onChange={(d) => decideHoliday(day.dateKey, d)}
                options={[
                  { label: 'Ask me', value: null },
                  { label: 'Working', value: 'work' },
                  { label: 'Day off', value: 'off' },
                ]}
              />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { marginTop: 10, marginBottom: -8 },
});
