import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform } from 'react-native';

/**
 * Opens the system date/time picker. Android shows its native dialog
 * imperatively; other platforms get an inline picker element to render.
 * Returns [open(mode, initialDate, onPick), elementToRender].
 */
export function useNativePicker() {
  const [inline, setInline] = useState(null);
  const open = (mode, value, onPick) => {
    const onChange = (event, date) => {
      setInline(null);
      if (event.type === 'set' && date) onPick(date);
    };
    if (Platform.OS === 'android') DateTimePickerAndroid.open({ mode, value, onChange });
    else setInline({ mode, value, onChange });
  };
  const element = inline && <DateTimePicker {...inline} />;
  return [open, element];
}
