import type { AppLanguage } from '../i18n';

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

function shuffle<T>(list: T[], seed: string): T[] {
  const result = [...list];
  const rng = createRng(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = Math.floor(rng() * (index + 1));
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}

function buildCompositeNames(prefixes: string[], suffixes: string[], count: number, seed: string): string[] {
  const shuffledPrefixes = shuffle(prefixes, `${seed}:p`);
  const shuffledSuffixes = shuffle(suffixes, `${seed}:s`);
  const names: string[] = [];
  let prefixIndex = 0;
  let suffixIndex = 0;

  while (names.length < count) {
    const name = `${shuffledPrefixes[prefixIndex % shuffledPrefixes.length]}${shuffledSuffixes[suffixIndex % shuffledSuffixes.length]}`;
    if (!names.includes(name)) {
      names.push(name);
    }
    prefixIndex += 1;
    if (prefixIndex % shuffledPrefixes.length === 0) {
      suffixIndex += 1;
    }
  }

  return names;
}

export function buildHoldemAiNames(pool: string[], count: number, seed: string): string[] {
  const shuffled = shuffle(pool, `${seed}:holdem`);
  if (shuffled.length >= count) {
    return shuffled.slice(0, count);
  }
  return shuffled;
}

function isZh(language?: AppLanguage): boolean {
  return language === 'zh-CN' || !language;
}

export function buildDoudizhuAiNames(count: number, seed: string, language?: AppLanguage): string[] {
  if (!isZh(language)) {
    return buildCompositeNames(
      ['Silver', 'Night', 'River', 'Storm', 'Echo', 'Neon', 'Frost', 'Harbor'],
      ['Rider', 'Caller', 'Tracker', 'Player', 'Pilot', 'Shadow', 'Hunter', 'Dealer'],
      count,
      `${seed}:ddz-en`,
    );
  }
  return buildCompositeNames(
    ['雾港', '星焰', '镜潮', '松弦', '夜桥', '银岚', '冷弧', '青隼'],
    ['牌手', '猎手', '算师', '执事', '提督', '读手', '快手', '行者'],
    count,
    `${seed}:ddz`,
  );
}

export function buildGuandanAiNames(count: number, seed: string, language?: AppLanguage): string[] {
  if (!isZh(language)) {
    return buildCompositeNames(
      ['Bridge', 'Slate', 'Frost', 'Silver', 'Blaze', 'Chord', 'Mist', 'Drift'],
      ['Partner', 'Lead', 'Scout', 'Caller', 'Runner', 'Wing', 'Dealer', 'Rover'],
      count,
      `${seed}:guandan-en`,
    );
  }
  return buildCompositeNames(
    ['桥雾', '深桌', '霜翼', '银塔', '流焰', '苍弦', '岚影', '寒幕'],
    ['对家', '搭档', '领手', '统筹', '牌客', '压手', '副手', '游侠'],
    count,
    `${seed}:guandan`,
  );
}
