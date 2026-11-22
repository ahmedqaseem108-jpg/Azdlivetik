import type { AudioSettings, SoundPresetId } from '../shared/types';

export interface CustomAudioTrack {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  buffer: AudioBuffer;
  createdAt: number;
}

class SoundEffectsEngine {
  private ctx: AudioContext | null = null;
  private activeVoices = 0;
  private lastPlayedByKey = new Map<string, number>();
  private customTracks = new Map<string, CustomAudioTrack>();
  private settings: AudioSettings = {
    masterVolume: 0.78,
    muted: false,
    maxConcurrentSounds: 3,
    preventOverlap: true,
  };

  updateSettings(next: AudioSettings): void {
    this.settings = { ...next };
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  getCustomTracks(): CustomAudioTrack[] {
    return Array.from(this.customTracks.values());
  }

  async addCustomAudioFile(file: File): Promise<CustomAudioTrack> {
    const ctx = this.ensureContext();
    if (!ctx) throw new Error('Web Audio API unavailable in this browser.');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const track: CustomAudioTrack = {
      id,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'audio/mpeg',
      buffer,
      createdAt: Date.now(),
    };
    this.customTracks.set(id, track);
    return track;
  }

  removeCustomTrack(id: string): void {
    this.customTracks.delete(id);
  }

  play(soundId: SoundPresetId | string, priority = 1): void {
    if (this.settings.muted || soundId === 'none' || this.settings.masterVolume <= 0.01) {
      return;
    }

    const now = Date.now();
    // Smart overlap prevention: avoid harsh machine-gun overlapping on rapid streaks
    if (this.settings.preventOverlap) {
      const last = this.lastPlayedByKey.get(soundId) || 0;
      const minGap = priority >= 4 ? 700 : priority >= 3 ? 450 : 220;
      if (now - last < minGap) return;
      if (this.activeVoices >= this.settings.maxConcurrentSounds && priority < 4) return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    this.lastPlayedByKey.set(soundId, now);

    // Custom uploaded MP3 / WAV track
    const custom = this.customTracks.get(soundId);
    if (custom) {
      this.playBuffer(ctx, custom.buffer);
      return;
    }

    // Built-in procedural Web Audio synthesis
    this.playSynthPreset(ctx, soundId as SoundPresetId);
  }

  private playBuffer(ctx: AudioContext, buffer: AudioBuffer): void {
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = this.settings.masterVolume;
    source.connect(gain);
    gain.connect(ctx.destination);
    this.activeVoices += 1;
    source.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    };
    source.start(0);
  }

  private playSynthPreset(ctx: AudioContext, preset: SoundPresetId): void {
    const t0 = ctx.currentTime;
    const vol = this.settings.masterVolume;
    const master = ctx.createGain();
    master.gain.setValueAtTime(vol, t0);
    master.connect(ctx.destination);

    let duration = 0.8;

    const addTone = (
      type: OscillatorType,
      freqStart: number,
      freqEnd: number,
      startOffset: number,
      len: number,
      gainPeak: number
    ) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, t0 + startOffset);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + startOffset + len);
      }
      g.gain.setValueAtTime(0.0001, t0 + startOffset);
      g.gain.linearRampToValueAtTime(gainPeak, t0 + startOffset + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + startOffset + len);
      osc.connect(g);
      g.connect(master);
      osc.start(t0 + startOffset);
      osc.stop(t0 + startOffset + len + 0.03);
      duration = Math.max(duration, startOffset + len + 0.05);
    };

    const addNoise = (startOffset: number, len: number, filterFreq: number, gainPeak: number, filterType: BiquadFilterType = 'lowpass') => {
      const sampleCount = Math.floor(ctx.sampleRate * len);
      const buf = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < sampleCount; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq, t0 + startOffset);
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, filterFreq * 0.18), t0 + startOffset + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t0 + startOffset);
      g.gain.linearRampToValueAtTime(gainPeak, t0 + startOffset + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + startOffset + len);
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(t0 + startOffset);
      duration = Math.max(duration, startOffset + len + 0.05);
    };

    switch (preset) {
      case 'gift_chime':
        addTone('sine', 587.33, 587.33, 0, 0.35, 0.25);
        addTone('triangle', 880, 880, 0.08, 0.42, 0.24);
        addTone('sine', 1174.66, 1174.66, 0.16, 0.55, 0.22);
        addTone('sine', 1760, 1760, 0.22, 0.5, 0.12);
        break;

      case 'coins_cascade':
        [1318, 1568, 1975, 2093, 2637, 2349].forEach((freq, i) => {
          addTone('sine', freq, freq * 1.04, i * 0.055, 0.26, 0.18);
          addTone('triangle', freq * 2, freq * 2, i * 0.055, 0.12, 0.06);
        });
        break;

      case 'laser_neon':
        addTone('sawtooth', 1400, 180, 0, 0.35, 0.22);
        addTone('sine', 920, 1650, 0.06, 0.28, 0.18);
        addTone('triangle', 330, 660, 0.18, 0.35, 0.16);
        break;

      case 'explosion_boom':
        addTone('sine', 135, 28, 0, 0.9, 0.48);
        addTone('triangle', 85, 24, 0.02, 0.75, 0.3);
        addNoise(0, 0.95, 1100, 0.35, 'lowpass');
        break;

      case 'fire_whoosh':
        addNoise(0, 1.15, 2200, 0.34, 'bandpass');
        addTone('sawtooth', 110, 52, 0.05, 0.85, 0.2);
        addNoise(0.25, 0.8, 900, 0.24, 'lowpass');
        break;

      case 'supporter_fanfare':
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          addTone('triangle', freq, freq, i * 0.09, 0.55, 0.22);
          addTone('sine', freq * 0.5, freq * 0.5, i * 0.09, 0.55, 0.12);
        });
        break;

      case 'alert_ping':
        addTone('sine', 740, 740, 0, 0.22, 0.2);
        addTone('sine', 1108.73, 1108.73, 0.09, 0.32, 0.18);
        break;

      case 'legendary_roar':
        addTone('sawtooth', 98, 42, 0, 1.4, 0.34);
        addTone('sine', 146.83, 36, 0, 1.5, 0.45);
        addNoise(0.02, 1.2, 1500, 0.34, 'lowpass');
        [293.66, 440, 587.33, 880, 1174.66].forEach((freq, i) => {
          addTone('triangle', freq, freq, 0.18 + i * 0.08, 0.95, 0.18);
        });
        break;

      case 'cosmic_drop':
        addTone('sine', 220, 48, 0, 1.35, 0.42);
        addTone('triangle', 440, 880, 0.12, 0.9, 0.18);
        addTone('sine', 659.25, 1318.5, 0.25, 1.1, 0.16);
        addNoise(0.05, 1.1, 2600, 0.2, 'bandpass');
        break;

      default:
        addTone('sine', 660, 880, 0, 0.3, 0.2);
    }

    this.activeVoices += 1;
    window.setTimeout(() => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      master.disconnect();
    }, Math.ceil(duration * 1000) + 120);
  }
}

export const audioEngine = new SoundEffectsEngine();
