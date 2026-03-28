import { describe, expect, it } from 'vitest';
import { getHumanPortraitOptions, resolvePlayerPortrait, resolvePlayerPortraitMood } from '../src/ui/playerPortraits';

describe('player portraits', () => {
  it('returns a dedicated portrait for the human player', () => {
    const portrait = resolvePlayerPortrait({
      id: 'P0',
      name: '你',
      style: 'balanced',
      isHuman: true,
    });

    expect(portrait.key).toBe('human-host');
    expect(portrait.title).toBe('牌桌主理人');
    expect(portrait.sigil).toBe('你');
    expect(portrait.art.accessory).toBe('dealer');
  });

  it('supports selecting a non-default human portrait theme', () => {
    const portrait = resolvePlayerPortrait({
      id: 'P0',
      name: '你',
      style: 'balanced',
      isHuman: true,
      portraitKey: 'human-noir',
    });

    expect(portrait.key).toBe('human-noir');
    expect(portrait.title).toBe('夜幕策展');
    expect(portrait.sigil).toBe('夜');
    expect(portrait.art.hairStyle).toBe('wave');
  });

  it('exposes an expanded set of human portrait skins', () => {
    const options = getHumanPortraitOptions();
    expect(options).toHaveLength(12);
    expect(options.some((item) => item.key === 'human-summit' && item.title === '峰值破局')).toBe(true);
    expect(options.find((item) => item.key === 'human-host')).toMatchObject({ starter: true, unlockCost: 0 });
    expect(options.find((item) => item.key === 'human-summit')).toMatchObject({ starter: false, unlockCost: 440 });
  });

  it('maps known AI names to stable persona presets', () => {
    const portrait = resolvePlayerPortrait({
      id: 'P3',
      name: '边池工程师',
      style: 'aggressive',
      isHuman: false,
    });

    expect(portrait.key).toBe('sidepot-engineer');
    expect(portrait.title).toBe('边池算师');
    expect(portrait.sigil).toBe('工');
    expect(portrait.art.accessory).toBe('visor');
  });

  it('resolves portrait mood with winner priority', () => {
    expect(resolvePlayerPortraitMood({ allIn: true, folded: false, eliminated: false, lastAction: '全下 5000' }, { active: true, winner: false })).toBe('all-in');
    expect(resolvePlayerPortraitMood({ allIn: false, folded: true, eliminated: false, lastAction: '弃牌' }, { active: true, winner: false })).toBe('folded');
    expect(resolvePlayerPortraitMood({ allIn: true, folded: false, eliminated: false, lastAction: '全下 5000' }, { active: true, winner: true })).toBe('winner');
    expect(resolvePlayerPortraitMood({ allIn: false, folded: false, eliminated: true, lastAction: '淘汰' }, { active: true, winner: false })).toBe('busted');
    expect(resolvePlayerPortraitMood({ allIn: false, folded: false, eliminated: false, lastAction: '等待' }, { active: true, winner: false })).toBe('thinking');
    expect(resolvePlayerPortraitMood({ allIn: false, folded: false, eliminated: false, lastAction: '过牌' }, { active: false, winner: false })).toBe('checking');
    expect(resolvePlayerPortraitMood({ allIn: false, folded: false, eliminated: false, lastAction: '跟注 80' }, { active: false, winner: false })).toBe('calling');
    expect(resolvePlayerPortraitMood({ allIn: false, folded: false, eliminated: false, lastAction: '加注到 320' }, { active: false, winner: false })).toBe('raising');
  });
});
