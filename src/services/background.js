import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { syncAlarms } from './sync';

const SYNC_TASK = 'better-alarms-calendar-sync';

// Must be defined at module scope (imported from index.js) so Android can run
// it without the UI being open.
TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    await syncAlarms();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSync() {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  if (!(await TaskManager.isTaskRegisteredAsync(SYNC_TASK))) {
    // Android treats this as a minimum and may run it less often to save battery.
    await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: 30 });
  }
  return true;
}
