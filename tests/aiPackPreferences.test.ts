import { describe, expect, it } from 'vitest';
import { createDefaultAIPackPreferences, purchaseAIPack, selectAIPack } from '../src/state/aiPackPreferences';

describe('aiPackPreferences', () => {
  it('starts with the club core pack equipped', () => {
    const preferences = createDefaultAIPackPreferences();
    expect(preferences.aiPackKey).toBe('club-core');
    expect(preferences.ownedAiPackKeys).toContain('club-core');
  });

  it('purchases and equips a new ai pack', () => {
    const result = purchaseAIPack(createDefaultAIPackPreferences(), 240, 'midnight-syndicate', 220);
    expect(result.ok).toBe(true);
    expect(result.purchased).toBe(true);
    expect(result.preferences.aiPackKey).toBe('midnight-syndicate');
    expect(result.preferences.ownedAiPackKeys).toContain('midnight-syndicate');
    expect(result.preferences.tournamentPointsSpent).toBe(220);
  });

  it('does not switch to a locked ai pack via select', () => {
    const preferences = selectAIPack(createDefaultAIPackPreferences(), 'sunset-raiders');
    expect(preferences.aiPackKey).toBe('club-core');
  });
});
