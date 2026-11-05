import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Drawer, DrawerContentScrollView, DrawerItem } from 'expo-router/drawer';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../components/ui';
import { useClockIntents } from '../../hooks/use-clock-intents';
import { describeDay, displayTime } from '../../logic/dates.js';
import { useApp } from '../../state/app-store';

const SECTIONS = [
  ['Clock', ['index', 'timer', 'stopwatch', 'world-clock']],
  ['Planning', ['month', 'schedules', 'holidays']],
  ['Settings', ['wake-up', 'settings']],
];

function icon(name) {
  return function DrawerIcon({ color, size }) {
    return <MaterialCommunityIcons name={name} color={color} size={size} />;
  };
}

function DrawerContent({ state, descriptors, navigation }) {
  const { upcoming } = useApp();
  const next = upcoming.find((a) => !a.skipped);
  const focused = state.routes[state.index].name;
  return (
    <DrawerContentScrollView>
      <View style={styles.header}>
        <Text style={styles.title}>Better Alarms</Text>
        <Text style={styles.subtitle}>
          {next ? `Next: ${describeDay(next.dateKey)}, ${displayTime(next.time)}` : 'No alarms coming up'}
        </Text>
      </View>
      {SECTIONS.map(([title, names]) => (
        <View key={title} style={{ marginBottom: 8 }}>
          <Text style={styles.section}>{title}</Text>
          {names.map((name) => {
            const route = state.routes.find((r) => r.name === name);
            const { options } = descriptors[route.key];
            return (
              <DrawerItem
                key={route.key}
                label={options.title}
                icon={options.drawerIcon}
                focused={focused === name}
                activeTintColor={colors.accent}
                activeBackgroundColor={colors.cardAlt}
                inactiveTintColor={colors.text}
                onPress={() => navigation.navigate(name)}
              />
            );
          })}
        </View>
      ))}
    </DrawerContentScrollView>
  );
}

function SyncButton() {
  const { resync, syncing } = useApp();
  return (
    <Pressable onPress={resync} disabled={syncing} hitSlop={12} style={{ marginRight: 16, opacity: syncing ? 0.4 : 1 }}>
      <MaterialCommunityIcons name="sync" size={24} color={colors.text} />
    </Pressable>
  );
}

export default function DrawerLayout() {
  useClockIntents();
  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
        drawerStyle: { backgroundColor: colors.card },
      }}
    >
      <Drawer.Screen
        name="index"
        options={{ title: 'Alarms', drawerIcon: icon('alarm'), headerRight: () => <SyncButton /> }}
      />
      <Drawer.Screen name="timer" options={{ title: 'Timer', drawerIcon: icon('timer-outline') }} />
      <Drawer.Screen name="stopwatch" options={{ title: 'Stopwatch', drawerIcon: icon('timer-play-outline') }} />
      <Drawer.Screen name="world-clock" options={{ title: 'World clock', drawerIcon: icon('earth') }} />
      <Drawer.Screen name="month" options={{ title: 'Month view', drawerIcon: icon('calendar-month') }} />
      <Drawer.Screen name="schedules" options={{ title: 'Work schedules', drawerIcon: icon('calendar-sync') }} />
      <Drawer.Screen name="holidays" options={{ title: 'Holidays', drawerIcon: icon('party-popper') }} />
      <Drawer.Screen name="wake-up" options={{ title: 'Sounds & wake-up', drawerIcon: icon('bell-ring') }} />
      <Drawer.Screen name="settings" options={{ title: 'Settings', drawerIcon: icon('cog') }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 4 },
  section: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginLeft: 20,
    marginTop: 12,
    marginBottom: 4,
  },
});
