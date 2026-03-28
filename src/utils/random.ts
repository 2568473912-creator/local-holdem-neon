export function createRandomSeed(): number {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] >>> 0;
  }

  return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
}
