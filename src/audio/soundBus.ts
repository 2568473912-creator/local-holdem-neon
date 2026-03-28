import { audioLevelGain, type AudioLevel } from '../state/audioPreferences';

export type SoundCue =
  | 'handStart'
  | 'chipCommit'
  | 'boardReveal'
  | 'heroTurn'
  | 'panelOpen'
  | 'heroWin'
  | 'heroLose'
  | 'showdown'
  | 'allIn'
  | 'elimination'
  | 'ddzBomb'
  | 'ddzRocket'
  | 'ddzSpring';

export interface SoundBus {
  prime: () => void;
  setLevel: (level: AudioLevel) => void;
  play: (cue: SoundCue) => void;
}

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

type ToneStep = {
  at: number;
  duration: number;
  frequency: number;
  gain: number;
  type?: OscillatorType;
};

const SOUND_PATTERNS: Record<SoundCue, ToneStep[]> = {
  handStart: [
    { at: 0, duration: 0.08, frequency: 320, gain: 0.2, type: 'triangle' },
    { at: 0.07, duration: 0.09, frequency: 400, gain: 0.15, type: 'sine' },
  ],
  chipCommit: [
    { at: 0, duration: 0.04, frequency: 520, gain: 0.14, type: 'square' },
    { at: 0.03, duration: 0.05, frequency: 660, gain: 0.1, type: 'triangle' },
  ],
  boardReveal: [
    { at: 0, duration: 0.07, frequency: 420, gain: 0.18, type: 'triangle' },
    { at: 0.05, duration: 0.08, frequency: 540, gain: 0.16, type: 'triangle' },
    { at: 0.11, duration: 0.09, frequency: 660, gain: 0.14, type: 'triangle' },
  ],
  heroTurn: [
    { at: 0, duration: 0.09, frequency: 760, gain: 0.16, type: 'sine' },
    { at: 0.11, duration: 0.1, frequency: 920, gain: 0.12, type: 'triangle' },
  ],
  panelOpen: [
    { at: 0, duration: 0.05, frequency: 480, gain: 0.1, type: 'triangle' },
    { at: 0.05, duration: 0.07, frequency: 620, gain: 0.08, type: 'triangle' },
  ],
  heroWin: [
    { at: 0, duration: 0.1, frequency: 523.25, gain: 0.16, type: 'triangle' },
    { at: 0.09, duration: 0.12, frequency: 659.25, gain: 0.15, type: 'triangle' },
    { at: 0.18, duration: 0.16, frequency: 783.99, gain: 0.14, type: 'triangle' },
  ],
  heroLose: [
    { at: 0, duration: 0.1, frequency: 330, gain: 0.14, type: 'sawtooth' },
    { at: 0.1, duration: 0.13, frequency: 247, gain: 0.12, type: 'triangle' },
  ],
  showdown: [
    { at: 0, duration: 0.07, frequency: 392, gain: 0.14, type: 'triangle' },
    { at: 0.06, duration: 0.08, frequency: 523.25, gain: 0.12, type: 'triangle' },
    { at: 0.12, duration: 0.1, frequency: 659.25, gain: 0.11, type: 'sine' },
  ],
  allIn: [
    { at: 0, duration: 0.05, frequency: 880, gain: 0.15, type: 'square' },
    { at: 0.04, duration: 0.08, frequency: 660, gain: 0.14, type: 'sawtooth' },
    { at: 0.11, duration: 0.11, frequency: 988, gain: 0.12, type: 'triangle' },
  ],
  elimination: [
    { at: 0, duration: 0.06, frequency: 300, gain: 0.12, type: 'triangle' },
    { at: 0.05, duration: 0.08, frequency: 220, gain: 0.1, type: 'sawtooth' },
    { at: 0.12, duration: 0.09, frequency: 174.61, gain: 0.08, type: 'triangle' },
  ],
  ddzBomb: [
    { at: 0, duration: 0.05, frequency: 170, gain: 0.16, type: 'sawtooth' },
    { at: 0.04, duration: 0.07, frequency: 250, gain: 0.13, type: 'square' },
    { at: 0.11, duration: 0.09, frequency: 330, gain: 0.11, type: 'triangle' },
  ],
  ddzRocket: [
    { at: 0, duration: 0.04, frequency: 620, gain: 0.16, type: 'square' },
    { at: 0.03, duration: 0.07, frequency: 900, gain: 0.14, type: 'triangle' },
    { at: 0.09, duration: 0.11, frequency: 1240, gain: 0.12, type: 'sine' },
  ],
  ddzSpring: [
    { at: 0, duration: 0.08, frequency: 392, gain: 0.14, type: 'triangle' },
    { at: 0.06, duration: 0.1, frequency: 523.25, gain: 0.13, type: 'triangle' },
    { at: 0.14, duration: 0.14, frequency: 698.46, gain: 0.12, type: 'sine' },
  ],
};

export function createSoundBus(initialLevel: AudioLevel): SoundBus {
  let level = initialLevel;
  let context: AudioContext | null = null;

  const getContext = (): AudioContext | null => {
    if (typeof window === 'undefined') {
      return null;
    }

    if (context) {
      return context;
    }

    const SoundContext = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!SoundContext) {
      return null;
    }

    context = new SoundContext();
    return context;
  };

  const prime = () => {
    const audioContext = getContext();
    if (!audioContext) {
      return;
    }

    if (audioContext.state === 'suspended') {
      void audioContext.resume().catch(() => {
        // ignore user-gesture resume failures; later interactions can retry
      });
    }
  };

  const setLevel = (nextLevel: AudioLevel) => {
    level = nextLevel;
  };

  const play = (cue: SoundCue) => {
    if (level === 'off') {
      return;
    }

    const audioContext = getContext();
    if (!audioContext) {
      return;
    }

    if (audioContext.state === 'suspended') {
      void audioContext.resume().catch(() => {
        // ignore blocked playback attempts
      });
    }

    const gainScale = audioLevelGain(level);
    const now = audioContext.currentTime;

    for (const step of SOUND_PATTERNS[cue]) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = step.type ?? 'triangle';
      oscillator.frequency.setValueAtTime(step.frequency, now + step.at);

      gain.gain.setValueAtTime(0.0001, now + step.at);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, step.gain * gainScale), now + step.at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + step.at + step.duration);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(now + step.at);
      oscillator.stop(now + step.at + step.duration + 0.03);
    }
  };

  return {
    prime,
    setLevel,
    play,
  };
}
