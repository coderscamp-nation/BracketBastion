// ─────────────────────────────────────────────────────────────
//  BRACKET BASTION — tiny WebAudio synth (no assets)
// ─────────────────────────────────────────────────────────────

interface ToneOpts {
  to?: number;
  delay?: number;
  attack?: number;
}

const MUTE_KEY = 'bracket-bastion.muted';

/** Minimum seconds between two plays of the same sound. */
const GAPS: Record<string, number> = {
  laser: 0.075,
  zap: 0.06,
  exempt: 0.045,
  absorb: 0.08,
  heal: 0.06,
  leak: 0.12,
  shield: 0.1,
  pop: 0.12,
  boom: 0.15,
  deny: 0.08,
};

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

class Sfx {
  muted = false;
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  private last: Record<string, number> = {};
  private combo = 0;
  private comboAt = -10;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* storage unavailable */
    }
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock() {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.ratio.value = 6;
        const master = ctx.createGain();
        master.gain.value = this.muted ? 0 : 0.55;
        master.connect(comp);
        comp.connect(ctx.destination);
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.ctx = ctx;
        this.master = master;
        this.noiseBuf = buf;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02);
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, o: ToneOpts = {}) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (o.attack ?? 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  private noise(dur: number, vol: number, freq: number, q = 1, delay = 0) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master!);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  private arp(notes: number[], step: number, dur: number, type: OscillatorType, vol: number) {
    notes.forEach((f, i) => this.tone(f, dur, type, vol, { delay: i * step }));
  }

  play = (name: string) => {
    const ctx = this.ctx;
    if (!ctx || this.muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gap = GAPS[name] ?? 0.02;
    if (now - (this.last[name] ?? -1) < gap) return;
    this.last[name] = now;

    switch (name) {
      case 'laser':
        this.tone(1500 + Math.random() * 400, 0.05, 'square', 0.03, { to: 900 });
        break;
      case 'zap':
        this.tone(1900, 0.17, 'sawtooth', 0.08, { to: 170 });
        this.noise(0.12, 0.09, 3200, 1.5);
        break;
      case 'absorb':
        this.tone(170, 0.3, 'sine', 0.5, { to: 46 });
        this.tone(1320, 0.1, 'triangle', 0.12, { delay: 0.06 });
        this.tone(1760, 0.16, 'triangle', 0.1, { delay: 0.12 });
        break;
      case 'heal':
        this.tone(660, 0.1, 'sine', 0.2);
        this.tone(990, 0.18, 'sine', 0.18, { delay: 0.07 });
        break;
      case 'divert':
        this.tone(280, 0.38, 'sine', 0.18, { to: 1150 });
        this.noise(0.32, 0.07, 900, 2);
        break;
      case 'exempt': {
        this.combo = now - this.comboAt < 0.7 ? Math.min(SCALE.length - 1, this.combo + 1) : 0;
        this.comboAt = now;
        const f = 660 * Math.pow(2, SCALE[this.combo] / 12);
        this.tone(f, 0.1, 'triangle', 0.17);
        this.tone(f * 1.5, 0.14, 'triangle', 0.1, { delay: 0.05 });
        break;
      }
      case 'pop':
        this.noise(0.18, 0.12, 1800 + Math.random() * 2000, 0.8);
        this.tone(900 + Math.random() * 900, 0.12, 'triangle', 0.08);
        break;
      case 'boom':
        this.tone(130, 0.55, 'sine', 0.6, { to: 30 });
        this.noise(0.5, 0.3, 380, 0.7);
        break;
      case 'leak':
        this.tone(150, 0.42, 'sawtooth', 0.26, { to: 52 });
        this.tone(157, 0.42, 'square', 0.12, { to: 48 });
        this.noise(0.28, 0.22, 240, 0.8);
        break;
      case 'shield':
        this.tone(560, 0.2, 'triangle', 0.2, { to: 250 });
        break;
      case 'build':
        this.noise(0.05, 0.12, 2200, 1);
        this.tone(330, 0.07, 'square', 0.09);
        this.tone(660, 0.11, 'square', 0.08, { delay: 0.06 });
        break;
      case 'upgrade':
        this.arp([440, 554, 659, 880], 0.06, 0.11, 'square', 0.08);
        break;
      case 'sell':
        this.tone(660, 0.08, 'triangle', 0.15);
        this.tone(440, 0.13, 'triangle', 0.15, { delay: 0.07 });
        break;
      case 'deny':
        this.tone(140, 0.13, 'square', 0.11);
        break;
      case 'select':
        this.tone(880, 0.045, 'triangle', 0.1);
        break;
      case 'tick':
        this.tone(1000, 0.05, 'square', 0.06);
        break;
      case 'pause':
        this.tone(520, 0.08, 'triangle', 0.12, { to: 390 });
        break;
      case 'wave':
        this.tone(196, 0.5, 'sawtooth', 0.11, { attack: 0.04 });
        this.tone(294, 0.5, 'sawtooth', 0.08, { attack: 0.04 });
        this.tone(392, 0.45, 'sawtooth', 0.07, { delay: 0.22, attack: 0.03 });
        break;
      case 'clear':
        this.arp([523, 659, 784], 0.08, 0.16, 'triangle', 0.15);
        break;
      case 'perfect':
        this.arp([523, 659, 784, 1047, 1319], 0.07, 0.2, 'triangle', 0.17);
        this.noise(0.4, 0.06, 6000, 0.6, 0.3);
        break;
      case 'start':
        this.arp([392, 523, 784], 0.07, 0.16, 'square', 0.08);
        break;
      case 'win':
        this.arp([523, 659, 784, 1047, 784, 1047, 1319, 1568], 0.11, 0.3, 'triangle', 0.18);
        this.arp([262, 330, 392, 523], 0.22, 0.5, 'sawtooth', 0.05);
        this.tone(110, 0.8, 'sine', 0.5, { to: 36 });
        break;
      case 'lose':
        this.arp([392, 370, 330, 247], 0.2, 0.45, 'sawtooth', 0.11);
        this.tone(120, 0.9, 'sine', 0.55, { to: 30 });
        this.noise(0.7, 0.25, 300, 0.6);
        break;
    }
  };
}

export const sfx = new Sfx();

// ─────────────────────────────────────────────────────────────
//  Stage theme music — a tiny step sequencer, one tune per stage.
//  Calm during build phases (bass, pad, arp); drums and lead join
//  when a wave is on the board.
// ─────────────────────────────────────────────────────────────
const MUSIC_KEY = 'bracket-bastion.music';
const MUSIC_VOL = 0.5;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const _ = null;

interface Tune {
  bpm: number;
  swing: number;
  /** one chord per bar (MIDI notes, root first) */
  chords: number[][];
  /** 16 steps: semitones above the bar's root (played an octave down) */
  bass: (number | null)[];
  /** 16 steps: index into the chord tones; indices past the chord wrap up an octave */
  arp: (number | null)[];
  arpOct: number;
  /** per bar, 16 steps of MIDI notes */
  lead: (number | null)[][];
  kick: string;
  snare: string;
  hat: string;
  bassWave: OscillatorType;
  arpWave: OscillatorType;
  leadWave: OscillatorType;
  bassVol: number;
  arpVol: number;
  leadVol: number;
}

const BASE_TUNES: Tune[] = [
  // 1 · W-2 FLATS — bright chiptune march in A minor
  {
    bpm: 112,
    swing: 0,
    chords: [
      [57, 60, 64],
      [53, 57, 60],
      [60, 64, 67],
      [55, 59, 62],
    ],
    bass: [0, _, 0, _, 12, _, 0, _, 0, _, 0, _, 12, _, 7, _],
    arp: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1],
    arpOct: 12,
    lead: [
      [76, _, _, _, 74, _, 72, _, 69, _, _, _, 72, _, 76, _],
      [77, _, _, _, 76, _, 72, _, 69, _, _, _, 72, _, 69, _],
      [79, _, _, _, 76, _, 72, _, 76, _, _, _, 79, _, 76, _],
      [74, _, _, _, 71, _, 74, _, 79, _, _, _, 74, _, 71, _],
    ],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    bassWave: 'triangle',
    arpWave: 'square',
    leadWave: 'square',
    bassVol: 0.3,
    arpVol: 0.035,
    leadVol: 0.06,
  },
  // 2 · LOOPHOLE LOOP — swung, sly groove in D dorian
  {
    bpm: 96,
    swing: 0.16,
    chords: [
      [50, 53, 57, 60],
      [55, 59, 62],
      [50, 53, 57],
      [48, 52, 55],
    ],
    bass: [0, _, _, 0, _, _, 7, _, 0, _, 10, _, _, 12, _, 7],
    arp: [_, _, 2, _, _, 1, _, _, 2, _, _, 1, _, 0, _, _],
    arpOct: 12,
    lead: [
      [74, _, _, 77, _, _, 79, _, 77, _, 74, _, _, _, 72, _],
      [71, _, _, 74, _, _, 79, _, 74, _, 71, _, _, _, 74, _],
      [81, _, _, 79, _, _, 77, _, 74, _, 77, _, _, _, 74, _],
      [72, _, _, 76, _, _, 79, _, 76, _, 72, _, _, _, 69, _],
    ],
    kick: 'x.....x...x.....',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.xx',
    bassWave: 'triangle',
    arpWave: 'triangle',
    leadWave: 'sawtooth',
    bassVol: 0.32,
    arpVol: 0.09,
    leadVol: 0.045,
  },
  // 3 · CAPITAL GAINS GULCH — driving synthwave arpeggios in E minor
  {
    bpm: 126,
    swing: 0,
    chords: [
      [52, 55, 59],
      [48, 52, 55],
      [55, 59, 62],
      [50, 54, 57],
    ],
    bass: [0, _, 0, _, 0, _, 0, _, 0, _, 0, _, 0, _, 12, _],
    arp: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 0, 1],
    arpOct: 12,
    lead: [
      [83, _, _, _, _, _, 79, _, 76, _, _, _, _, _, 79, _],
      [84, _, _, _, _, _, 79, _, 76, _, _, _, _, _, 72, _],
      [86, _, _, _, _, _, 83, _, 79, _, _, _, _, _, 83, _],
      [81, _, _, _, _, _, 78, _, 74, _, _, _, 78, _, 81, _],
    ],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.x.',
    bassWave: 'sawtooth',
    arpWave: 'sawtooth',
    leadWave: 'triangle',
    bassVol: 0.16,
    arpVol: 0.03,
    leadVol: 0.1,
  },
  // 4 · AUDIT JUNCTION — tense gallop in F♯ minor
  {
    bpm: 138,
    swing: 0,
    chords: [
      [54, 57, 61],
      [50, 54, 57],
      [52, 56, 59],
      [49, 52, 56],
    ],
    bass: [0, _, 0, 0, _, 0, 0, _, 0, _, 0, 0, _, 0, 12, _],
    arp: [0, _, _, 1, _, _, 2, _, 0, _, _, 1, _, _, 2, _],
    arpOct: 12,
    lead: [
      [73, _, _, _, _, _, _, _, 69, _, _, _, 68, _, 69, _],
      [74, _, _, _, _, _, _, _, 69, _, _, _, 66, _, 69, _],
      [76, _, _, _, _, _, _, _, 71, _, _, _, 68, _, 71, _],
      [73, _, _, _, 76, _, _, _, 80, _, _, _, 76, _, 73, _],
    ],
    kick: 'x..x..x.x..x..x.',
    snare: '....x.......x..x',
    hat: 'x.x.x.x.x.x.x.x.',
    bassWave: 'sawtooth',
    arpWave: 'square',
    leadWave: 'square',
    bassVol: 0.17,
    arpVol: 0.04,
    leadVol: 0.055,
  },
  // 5 · DEPRECIATION DUNES — caravan groove in E Phrygian dominant
  {
    bpm: 104,
    swing: 0,
    chords: [
      [52, 56, 59],
      [53, 57, 60],
      [52, 56, 59],
      [50, 53, 57],
    ],
    bass: [0, _, _, 0, _, _, 0, _, 0, _, _, 0, _, _, 7, _],
    arp: [0, _, 1, _, 2, _, 1, _, 0, _, 1, _, 2, _, 3, _],
    arpOct: 12,
    lead: [
      [76, _, 77, _, 80, _, _, _, 77, _, 76, _, _, _, 74, _],
      [77, _, _, _, 81, _, _, _, 84, _, 81, _, 77, _, _, _],
      [76, _, 77, _, 80, _, _, _, 83, _, 80, _, 77, _, 76, _],
      [74, _, _, _, 77, _, _, _, 81, _, 77, _, 74, _, 72, _],
    ],
    kick: 'x.....x...x.....',
    snare: '....x.......x...',
    hat: 'x.xxx.x.x.xxx.x.',
    bassWave: 'triangle',
    arpWave: 'triangle',
    leadWave: 'sawtooth',
    bassVol: 0.3,
    arpVol: 0.08,
    leadVol: 0.045,
  },
  // 6 · ITEMIZER'S FORK — lilting, hopeful stroll in G major
  {
    bpm: 100,
    swing: 0.12,
    chords: [
      [55, 59, 62],
      [52, 55, 59],
      [48, 52, 55],
      [50, 54, 57],
    ],
    bass: [0, _, _, _, 7, _, _, _, 0, _, _, _, 7, _, 12, _],
    arp: [0, _, 2, 1, _, 2, 0, _, 2, 1, _, 2, 0, _, 2, 1],
    arpOct: 12,
    lead: [
      [79, _, _, 81, 83, _, _, _, 86, _, 83, _, 81, _, _, _],
      [83, _, _, 81, 79, _, _, _, 76, _, 79, _, 83, _, _, _],
      [84, _, _, 83, 79, _, _, _, 76, _, 79, _, 84, _, _, _],
      [86, _, _, 81, 78, _, _, _, 81, _, 86, _, 81, _, 78, _],
    ],
    kick: 'x.......x.......',
    snare: '....x.......x...',
    hat: 'x...x...x...x.x.',
    bassWave: 'triangle',
    arpWave: 'triangle',
    leadWave: 'triangle',
    bassVol: 0.3,
    arpVol: 0.08,
    leadVol: 0.1,
  },
  // 7 · QUARTERLY SQUEEZE — syncopated funk in C minor
  {
    bpm: 118,
    swing: 0,
    chords: [
      [48, 51, 55],
      [56, 60, 63],
      [58, 62, 65],
      [55, 59, 62],
    ],
    bass: [0, _, _, 0, _, 0, _, _, 12, _, 0, _, _, 7, _, 12],
    arp: [_, 0, _, 1, _, 2, _, 1, _, 0, _, 1, _, 2, _, 3],
    arpOct: 12,
    lead: [
      [75, _, _, 72, _, _, 79, _, _, _, 77, _, 75, _, _, _],
      [75, _, _, 72, _, _, 80, _, _, _, 79, _, 75, _, _, _],
      [77, _, _, 74, _, _, 82, _, _, _, 80, _, 77, _, _, _],
      [79, _, _, 74, _, _, 83, _, _, _, 79, _, 77, _, 74, _],
    ],
    kick: 'x..x....x.x.....',
    snare: '....x.......x...',
    hat: 'x.x.x.xxx.x.x.xx',
    bassWave: 'sawtooth',
    arpWave: 'square',
    leadWave: 'square',
    bassVol: 0.16,
    arpVol: 0.035,
    leadVol: 0.05,
  },
  // 8 · STEPPED-UP BASIS — climbing staircase melody in A major
  {
    bpm: 110,
    swing: 0,
    chords: [
      [57, 61, 64],
      [59, 62, 66],
      [61, 64, 68],
      [62, 66, 69],
    ],
    bass: [0, _, _, _, 7, _, _, _, 12, _, _, _, 7, _, _, _],
    arp: [0, _, 1, _, 2, _, 3, _, 0, _, 1, _, 2, _, 3, _],
    arpOct: 12,
    lead: [
      [69, _, 71, _, 73, _, _, _, 76, _, _, _, 73, _, _, _],
      [71, _, 73, _, 74, _, _, _, 78, _, _, _, 74, _, _, _],
      [73, _, 76, _, 80, _, _, _, 81, _, _, _, 80, _, 76, _],
      [74, _, 78, _, 81, _, _, _, 86, _, _, _, 85, _, 83, _],
    ],
    kick: 'x.......x.......',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.x.',
    bassWave: 'triangle',
    arpWave: 'square',
    leadWave: 'triangle',
    bassVol: 0.3,
    arpVol: 0.03,
    leadVol: 0.1,
  },
  // 9 · BACKDOOR ROTH — tiptoeing sneak in B♭ minor
  {
    bpm: 92,
    swing: 0.14,
    chords: [
      [58, 61, 65],
      [54, 58, 61],
      [51, 54, 58],
      [53, 57, 60],
    ],
    bass: [0, _, _, _, _, _, 7, _, 0, _, _, _, _, _, _, _],
    arp: [_, _, 0, _, _, _, 1, _, _, _, 2, _, _, _, 1, _],
    arpOct: 12,
    lead: [
      [70, _, _, 72, 73, _, _, _, 70, _, _, 68, 70, _, _, _],
      [66, _, _, 68, 70, _, _, _, 73, _, _, 70, 66, _, _, _],
      [75, _, _, 73, 70, _, _, _, 66, _, _, 68, 70, _, _, _],
      [69, _, _, 72, 77, _, _, _, 76, _, _, 72, 69, _, _, _],
    ],
    kick: 'x.........x.....',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    bassWave: 'triangle',
    arpWave: 'triangle',
    leadWave: 'square',
    bassVol: 0.32,
    arpVol: 0.09,
    leadVol: 0.045,
  },
  // 10 · DOUBLE TAXATION — call-and-response duet in F minor
  {
    bpm: 122,
    swing: 0,
    chords: [
      [53, 56, 60],
      [49, 53, 56],
      [56, 60, 63],
      [51, 55, 58],
    ],
    bass: [0, _, 0, _, _, _, 0, _, 7, _, _, 0, _, _, 12, _],
    arp: [_, _, _, _, _, _, _, _, 2, _, 1, _, 0, _, 1, 2],
    arpOct: 12,
    lead: [
      [77, _, 75, _, 72, _, _, _, _, _, _, _, _, _, _, _],
      [77, _, 73, _, 68, _, _, _, _, _, _, _, _, _, _, _],
      [80, _, 75, _, 72, _, _, _, _, _, _, _, _, _, _, _],
      [79, _, 75, _, 70, _, _, _, 79, _, 77, _, 75, _, 74, _],
    ],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.x.',
    bassWave: 'sawtooth',
    arpWave: 'square',
    leadWave: 'sawtooth',
    bassVol: 0.16,
    arpVol: 0.05,
    leadVol: 0.045,
  },
  // 11 · TRIPLE NET — three-against-four drive in B minor
  {
    bpm: 132,
    swing: 0,
    chords: [
      [59, 62, 66],
      [55, 59, 62],
      [57, 61, 64],
      [54, 58, 61],
    ],
    bass: [0, _, _, 0, _, _, 0, _, _, 0, _, _, 7, _, 12, _],
    arp: [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 3],
    arpOct: 12,
    lead: [
      [78, _, _, 74, _, _, 71, _, _, 74, _, _, 78, _, 81, _],
      [79, _, _, 74, _, _, 71, _, _, 74, _, _, 79, _, 83, _],
      [81, _, _, 76, _, _, 73, _, _, 76, _, _, 81, _, 85, _],
      [82, _, _, 78, _, _, 73, _, _, 78, _, _, 82, _, 85, _],
    ],
    kick: 'x..x..x..x..x.x.',
    snare: '......x.....x...',
    hat: 'x.xx.xx.xx.xx.x.',
    bassWave: 'sawtooth',
    arpWave: 'square',
    leadWave: 'triangle',
    bassVol: 0.16,
    arpVol: 0.032,
    leadVol: 0.1,
  },
  // 12 · FINAL NOTICE — full-tilt finale in D minor
  {
    bpm: 144,
    swing: 0,
    chords: [
      [50, 53, 57],
      [58, 62, 65],
      [48, 52, 55],
      [57, 61, 64],
    ],
    bass: [0, _, 12, _, 0, _, 12, _, 0, _, 12, _, 0, _, 12, _],
    arp: [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2],
    arpOct: 12,
    lead: [
      [86, _, _, _, 81, _, _, _, 77, _, 81, _, 86, _, _, _],
      [86, _, _, _, 82, _, _, _, 77, _, 82, _, 86, _, _, _],
      [88, _, _, _, 84, _, _, _, 79, _, 84, _, 88, _, _, _],
      [88, _, _, _, 85, _, _, _, 81, _, 85, _, 88, _, 85, _],
    ],
    kick: 'x...x...x...x...',
    snare: '....x.......x.xx',
    hat: 'x.xxx.xxx.xxx.xx',
    bassWave: 'sawtooth',
    arpWave: 'sawtooth',
    leadWave: 'square',
    bassVol: 0.16,
    arpVol: 0.026,
    leadVol: 0.045,
  },
];

/** Same warmth as the original twelve — new key and pattern, not hotter levels. */
function variantTune(base: Tune, semitones: number, bpmDelta = 0): Tune {
  const shift = (n: number | null) => (n === null ? null : n + semitones);
  return {
    ...base,
    bpm: base.bpm + bpmDelta,
    chords: base.chords.map((ch) => ch.map((n) => n + semitones)),
    bass: [...base.bass],
    arp: [...base.arp],
    lead: base.lead.map((row) => row.map(shift)),
  };
}

/** Acts 13–20: transposed variants of existing mellow sheets (one unique tune per stage). */
const EXTRA_TUNES: Tune[] = [
  variantTune(BASE_TUNES[5], 2, 2),
  variantTune(BASE_TUNES[8], -3, 0),
  variantTune(BASE_TUNES[0], 5, 4),
  variantTune(BASE_TUNES[6], -2, 2),
  variantTune(BASE_TUNES[1], 7, 0),
  variantTune(BASE_TUNES[9], -5, 3),
  variantTune(BASE_TUNES[2], 3, 2),
  variantTune(BASE_TUNES[11], -7, 0),
];

const TUNES: Tune[] = [...BASE_TUNES, ...EXTRA_TUNES];

class Music {
  enabled = true;
  private bus: GainNode | null = null;
  private tune: Tune | null = null;
  private step = 0;
  private next = 0;
  private timer = 0;
  private held = false;
  private intensity = 0;

  constructor() {
    try {
      this.enabled = localStorage.getItem(MUSIC_KEY) !== '0';
    } catch {
      /* storage unavailable */
    }
  }

  private ready(): AudioContext | null {
    const ctx = sfx.ctx;
    if (!ctx || !sfx.master) return null;
    if (!this.bus) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5200;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(lp);
      lp.connect(sfx.master);
      this.bus = g;
    }
    return ctx;
  }

  private level() {
    const ctx = sfx.ctx;
    if (!ctx || !this.bus) return;
    const on = this.enabled && !this.held && !!this.tune;
    this.bus.gain.cancelScheduledValues(ctx.currentTime);
    this.bus.gain.setTargetAtTime(on ? MUSIC_VOL : 0, ctx.currentTime, on ? 0.12 : 0.05);
    if (on) this.next = Math.max(this.next, ctx.currentTime + 0.06);
  }

  /** Start the tune for a stage (0-based). Call after sfx.unlock() inside a user gesture. */
  play(stage: number) {
    const idx = Math.max(0, Math.min(stage, TUNES.length - 1));
    this.tune = TUNES[idx];
    this.step = 0;
    this.held = false;
    const ctx = this.ready();
    if (!ctx) return;
    this.next = ctx.currentTime + 0.15;
    this.level();
    if (!this.timer) this.timer = window.setInterval(this.tick, 25);
  }

  stop() {
    this.tune = null;
    this.level();
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = 0;
    }
  }

  /** Silence while the game is paused; resumes in time when released. */
  hold(v: boolean) {
    this.held = v;
    this.level();
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    try {
      localStorage.setItem(MUSIC_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
    this.ready();
    this.level();
  }

  /** 0 = build phase (calm), 1 = wave in progress (full band) */
  setIntensity(n: number) {
    this.intensity = n;
  }

  private tick = () => {
    const ctx = sfx.ctx;
    const t = this.tune;
    if (!ctx || !t || !this.bus || !this.enabled || this.held || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (this.next < now - 0.2) this.next = now + 0.05; // tab was throttled: skip ahead instead of bursting
    const sd = 60 / t.bpm / 4;
    let guard = 0;
    while (this.next < now + 0.16 && guard++ < 8) {
      this.schedule(t, this.step, this.next, sd);
      this.next += sd * (this.step % 2 === 0 ? 1 + t.swing : 1 - t.swing);
      this.step = (this.step + 1) % (t.chords.length * 16);
    }
  };

  private schedule(t: Tune, step: number, at: number, sd: number) {
    const bar = (step >> 4) % t.chords.length;
    const s = step & 15;
    const chord = t.chords[bar];
    const hot = this.intensity > 0;

    if (s === 0) for (const n of chord) this.voice(mtof(n), at, sd * 15.5, 'triangle', 0.035, sd * 3);

    const b = t.bass[s];
    if (b !== null) this.voice(mtof(chord[0] - 12 + b), at, sd * 1.9, t.bassWave, t.bassVol, 0.006);

    const a = t.arp[s];
    if (a !== null) {
      const n = chord[a % chord.length] + 12 * Math.floor(a / chord.length) + t.arpOct;
      this.voice(mtof(n), at, sd * 1.5, t.arpWave, hot ? t.arpVol : t.arpVol * 0.7, 0.004);
    }

    if (hot) {
      const row = t.lead[bar];
      const l = row[s];
      if (l !== null) {
        let gap = 1;
        while (gap < 6 && s + gap < 16 && row[s + gap] === null) gap++;
        this.voice(mtof(l), at, sd * gap * 0.95, t.leadWave, t.leadVol, 0.012);
      }
      if (t.kick[s] === 'x') this.kick(at, 0.5);
      if (t.snare[s] === 'x') this.snare(at);
    } else if (s === 0 || s === 8) {
      this.kick(at, 0.22);
    }
    if (t.hat[s] === 'x') this.hat(at, hot ? 0.05 : 0.025);
  }

  private voice(freq: number, at: number, dur: number, type: OscillatorType, vol: number, attack: number) {
    const ctx = sfx.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(this.bus!);
    o.start(at);
    o.stop(at + dur + 0.03);
  }

  private kick(at: number, vol: number) {
    const ctx = sfx.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, at);
    o.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    o.connect(g);
    g.connect(this.bus!);
    o.start(at);
    o.stop(at + 0.2);
  }

  private burst(at: number, dur: number, vol: number, type: BiquadFilterType, freq: number) {
    const ctx = sfx.ctx!;
    if (!sfx.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = sfx.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.bus!);
    src.start(at, Math.random() * 0.3);
    src.stop(at + dur + 0.02);
  }

  private snare(at: number) {
    this.burst(at, 0.13, 0.16, 'bandpass', 1900);
    this.voice(190, at, 0.08, 'triangle', 0.1, 0.002);
  }

  private hat(at: number, vol: number) {
    this.burst(at, 0.035, vol, 'highpass', 7000);
  }
}

export const music = new Music();
