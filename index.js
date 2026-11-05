// Defines the background calendar-sync task. It must load before the router so
// Android can run it headless, without any screen being rendered.
import './src/services/background';
import 'expo-router/entry';
