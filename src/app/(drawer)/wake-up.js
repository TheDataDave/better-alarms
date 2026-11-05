import * as AlarmEngine from '../../../modules/alarm-engine';
import SoundPicker from '../../components/sound-picker';
import { Button, Card, ChoiceChips, Hint, Label, Screen, SectionTitle, ToggleRow } from '../../components/ui';
import { useApp } from '../../state/app-store';

const CHALLENGES = [
  { label: 'Nothing', value: 'none' },
  { label: 'Math problem', value: 'math' },
  { label: 'Type a code', value: 'code' },
  { label: 'Trace a pattern', value: 'pattern' },
];

const CHALLENGE_HINTS = {
  none: 'One tap turns it off.',
  math: 'Solve a quick sum like 47 + 38 to turn it off.',
  code: 'Type a random 6-letter code shown on screen.',
  pattern: 'Trace a random dot pattern with your finger.',
};

function ChallengePicker({ value, onChange }) {
  return (
    <>
      <Label>To turn it off</Label>
      <ChoiceChips value={value} onChange={onChange} options={CHALLENGES} />
      <Hint>{CHALLENGE_HINTS[value]} Snoozing never needs a challenge.</Hint>
    </>
  );
}

export default function WakeUpScreen() {
  const { state, updateAlarmSettings, updateTimerSettings, updateSettings } = useApp();
  if (!state) return null;
  const alarm = state.settings.alarm;
  const timer = state.settings.timer;

  return (
    <Screen>
      <SectionTitle>Alarms</SectionTitle>
      <Card>
        <SoundPicker value={alarm} onChange={updateAlarmSettings} />
        <ToggleRow
          style={{ marginTop: 8 }}
          title="Gradually get louder"
          hint="Starts quiet and reaches full volume over 30 seconds."
          value={alarm.rampUp}
          onValueChange={(rampUp) => updateAlarmSettings({ rampUp })}
        />
        <ToggleRow title="Vibrate" value={alarm.vibrate} onValueChange={(vibrate) => updateAlarmSettings({ vibrate })} />

        <Label>Snooze length</Label>
        <ChoiceChips
          value={state.settings.snoozeMinutes}
          onChange={(snoozeMinutes) => updateSettings({ snoozeMinutes })}
          options={[5, 10, 15, 20].map((m) => ({ label: `${m} min`, value: m }))}
        />

        <ChallengePicker value={alarm.challenge} onChange={(challenge) => updateAlarmSettings({ challenge })} />

        <Label>Backup alarm</Label>
        <ChoiceChips
          value={alarm.backupMinutes}
          onChange={(backupMinutes) => updateAlarmSettings({ backupMinutes })}
          options={[
            { label: 'Off', value: 0 },
            ...[3, 5, 10, 15].map((m) => ({ label: `${m} min later`, value: m })),
          ]}
        />
        <Hint>
          Rings once more after you turn the alarm off, in case you did it in your sleep. Tap “I’m up” on the
          notification to cancel it.
        </Hint>
        <Button
          title="Test alarm in 10 seconds"
          variant="ghost"
          style={{ marginTop: 16 }}
          onPress={() => AlarmEngine.ringIn(10, state.settings)}
        />
      </Card>

      <SectionTitle>Timers</SectionTitle>
      <Card>
        <SoundPicker value={timer} onChange={updateTimerSettings} />
        <ToggleRow
          style={{ marginTop: 8 }}
          title="Vibrate"
          value={timer.vibrate}
          onValueChange={(vibrate) => updateTimerSettings({ vibrate })}
        />
        <ChallengePicker value={timer.challenge} onChange={(challenge) => updateTimerSettings({ challenge })} />
        <Button
          title="Test timer (5 seconds)"
          variant="ghost"
          style={{ marginTop: 16 }}
          onPress={() => AlarmEngine.startTimer({ id: 'test', endAt: Date.now() + 5000, label: 'Test timer' }, state.settings)}
        />
      </Card>
      <Hint style={{ marginTop: 8 }}>Lock your phone after starting a test to see what it looks like.</Hint>
    </Screen>
  );
}
