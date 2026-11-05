import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import * as AlarmEngine from '../../modules/alarm-engine';
import { Button, Hint, RowTitle, colors } from './ui';

/**
 * Shows the chosen sound and lets the user pick another from the phone's
 * alarm sounds, previewing each as it's tapped.
 * value: { soundUri, soundTitle }; onChange receives the same shape.
 */
export default function SoundPicker({ value, onChange }) {
  const [sounds, setSounds] = useState(null);
  const [playing, setPlaying] = useState(false);

  // Never leave a preview playing when leaving the screen.
  useEffect(() => () => AlarmEngine.stopPreview(), []);

  const pick = (sound) => {
    onChange({ soundUri: sound.uri, soundTitle: sound.title });
    AlarmEngine.previewSound(sound.uri);
    setPlaying(true);
  };
  const stop = () => {
    AlarmEngine.stopPreview();
    setPlaying(false);
  };

  return (
    <View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <RowTitle>{value.soundTitle}</RowTitle>
          <Hint>Plays at your phone’s alarm volume, even on silent.</Hint>
        </View>
        {playing ? (
          <Button title="Stop" variant="ghost" small onPress={stop} />
        ) : (
          <Button
            title={sounds ? 'Hide' : 'Change'}
            variant="ghost"
            small
            onPress={() => setSounds(sounds ? null : AlarmEngine.listAlarmSounds())}
          />
        )}
      </View>
      {sounds && (
        <View style={{ marginTop: 8 }}>
          {[{ title: 'Phone default', uri: null }, ...sounds].map((s) => {
            const selected = s.uri === value.soundUri;
            return (
              <Pressable
                key={s.uri ?? 'default'}
                onPress={() => pick(s)}
                style={styles.soundRow}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
              >
                <MaterialCommunityIcons
                  name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                  size={22}
                  color={selected ? colors.accent : colors.muted}
                />
                <Text style={styles.soundTitle}>{s.title}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  soundRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  soundTitle: { color: colors.text, fontSize: 15, marginLeft: 12 },
});
