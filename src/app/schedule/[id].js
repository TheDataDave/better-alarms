import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import RuleEditor, { newRule } from '../../components/rule-editor';
import { frequentTitles } from '../../logic/patterns.js';
import { newId } from '../../services/storage';
import { useApp } from '../../state/app-store';

export default function ScheduleScreen() {
  const { id, type } = useLocalSearchParams();
  const { state, events, update } = useApp();
  const isNew = id === 'new';

  // Build a new rule once; for calendar schedules, guess the keyword from the
  // most frequent repeating event title (e.g. "Work").
  const [initial] = useState(() => {
    if (!isNew) return state?.rules.find((r) => r.id === id);
    const rule = newRule(newId(), type === 'calendar' ? 'calendar' : 'rotation');
    const guess = frequentTitles(events)[0];
    if (rule.type === 'calendar' && guess) rule.keywords = guess.toLowerCase();
    return rule;
  });
  if (!state || !initial) return null;

  const save = (rule) => {
    update((s) => {
      const exists = s.rules.some((r) => r.id === rule.id);
      return { ...s, rules: exists ? s.rules.map((r) => (r.id === rule.id ? rule : r)) : [...s.rules, rule] };
    });
    router.back();
  };

  const remove = (ruleId) => {
    update((s) => ({ ...s, rules: s.rules.filter((r) => r.id !== ruleId) }));
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'New schedule' : 'Edit schedule' }} />
      <RuleEditor rule={initial} isNew={isNew} onSave={save} onDelete={remove} onCancel={() => router.back()} />
    </>
  );
}
