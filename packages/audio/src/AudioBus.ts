/**
 * A tiny, dependency-free Web Audio bus. The engine note is synthesized (a filtered
 * sawtooth) and driven by the sim's speed each frame — no audio assets required. All
 * calls are guarded so a missing/locked AudioContext never throws.
 */
export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private muted = false;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  /** Resume the context — must be called from a user gesture (e.g. race start). */
  resume(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.7;
  }

  engineOn(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.engineOsc) return;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 900;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
  }

  /** speedFrac in [0,1] — maps to pitch + volume so the kart "revs" with the sim. */
  setEngine(speedFrac: number): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.engineFilter) return;
    const f = Math.max(0, Math.min(1, speedFrac));
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + f * 230, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(500 + f * 1800, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.015 + f * 0.06, t, 0.08);
  }

  engineOff(): void {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    }
    const osc = this.engineOsc;
    if (osc && this.ctx) {
      try {
        osc.stop(this.ctx.currentTime + 0.4);
      } catch {
        /* already stopped */
      }
    }
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
  }

  /** Short tone — used for countdown ticks and the GO! */
  blip(freq: number, dur = 0.12, type: OscillatorType = 'square'): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = 0.0001;
    osc.connect(g).connect(this.master);
    const t = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** A small rising chord at the finish. */
  finishChord(): void {
    [523.25, 659.25, 783.99].forEach((f, i) =>
      setTimeout(() => this.blip(f, 0.35, 'triangle'), i * 90),
    );
  }
}

let singleton: AudioBus | null = null;
export function getAudio(): AudioBus {
  if (!singleton) singleton = new AudioBus();
  return singleton;
}
