import { PentatonicScaleName, ScalePreset, AudioConfig } from '../types';

export const SCALE_PRESETS: Record<PentatonicScaleName, ScalePreset> = {
  c_major_pentatonic: {
    id: 'c_major_pentatonic',
    name: 'C Major Pentatonic (Original)',
    notes: [36, 38, 40, 43, 45, 48, 50, 52, 55, 57, 60, 62, 64, 67, 69],
    description: 'Bright, harmonious 3-octave scale used in the original installation.'
  },
  a_minor_pentatonic: {
    id: 'a_minor_pentatonic',
    name: 'A Minor Pentatonic',
    notes: [33, 36, 38, 40, 43, 45, 48, 50, 52, 55, 57, 60, 62, 64, 67],
    description: 'Deep, reflective melancholic tones.'
  },
  hirajoshi: {
    id: 'hirajoshi',
    name: 'Japanese Hirajoshi',
    notes: [36, 38, 39, 43, 44, 48, 50, 51, 55, 56, 60, 62, 63, 67, 68],
    description: 'Traditional Japanese tranquil meditative scale.'
  },
  lydian_ambient: {
    id: 'lydian_ambient',
    name: 'Lydian Ambient Space',
    notes: [36, 40, 42, 43, 47, 48, 52, 54, 55, 59, 60, 64, 66, 67, 71],
    description: 'Ethereal, floating cinematic harmonic space.'
  },
  akebono: {
    id: 'akebono',
    name: 'Akebono Zen',
    notes: [36, 38, 39, 43, 45, 48, 50, 51, 55, 57, 60, 62, 63, 67, 69],
    description: 'Serene, hypnotic balance for continuous bouncing.'
  },
  cosmic_drift: {
    id: 'cosmic_drift',
    name: 'Cosmic Drift Synth',
    notes: [38, 43, 45, 50, 52, 55, 57, 62, 64, 67, 69, 74, 76, 79, 81],
    description: 'High-octave sparkling resonance for dynamic collisions.'
  }
};

class AudioSynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbConvolver: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  
  // Ambience nodes
  private ambienceGain: GainNode | null = null;
  private brownNoiseNode: AudioBufferSourceNode | null = null;
  private isAmbienceRunning = false;

  // Voice Pool
  private numVoices = 12;
  private voiceIndex = 0;
  private config: AudioConfig = {
    masterVolume: 0.7,
    ambienceVolume: 0.35,
    ambienceEnabled: true,
    reverbSize: 0.85,
    selectedScale: 'c_major_pentatonic',
    attack: 0.08,
    decay: 0.4,
    sustain: 0.1,
    release: 3.0
  };

  private isStarted = false;

  public async init(): Promise<void> {
    if (this.ctx) return;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.config.masterVolume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Reverb Impulse Response
    this.setupReverb();

    // Ambience Setup
    if (this.config.ambienceEnabled) {
      this.startAmbience();
    }

    this.isStarted = true;
  }

  public async ensureAudioContext(): Promise<void> {
    if (!this.ctx) {
      await this.init();
    } else if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  private setupReverb(): void {
    if (!this.ctx || !this.masterGain) return;

    this.reverbConvolver = this.ctx.createConvolver();
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.setValueAtTime(this.config.reverbSize, this.ctx.currentTime);

    // Generate procedural cavernous reverb impulse response
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 3.5; // 3.5 second decay
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (sampleRate * 0.8));
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }

    this.reverbConvolver.buffer = impulse;
    this.reverbConvolver.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);
  }

  public startAmbience(): void {
    if (!this.ctx || !this.masterGain || this.isAmbienceRunning) return;

    // Create Brown Noise buffer (10 seconds looped)
    const bufferSize = this.ctx.sampleRate * 10;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Brown noise integration filter
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // Gain boost
    }

    this.brownNoiseNode = this.ctx.createBufferSource();
    this.brownNoiseNode.buffer = noiseBuffer;
    this.brownNoiseNode.loop = true;

    // Ambience Gain
    this.ambienceGain = this.ctx.createGain();
    this.ambienceGain.gain.setValueAtTime(this.config.ambienceVolume * 0.08, this.ctx.currentTime);

    // Filter network replicating pyo_utils (Tone 120Hz, Reson 60Hz, 170Hz, 310Hz)
    const floorFilter = this.ctx.createBiquadFilter();
    floorFilter.type = 'lowpass';
    floorFilter.frequency.setValueAtTime(120, this.ctx.currentTime);

    const band0 = this.ctx.createBiquadFilter();
    band0.type = 'peaking';
    band0.frequency.setValueAtTime(60, this.ctx.currentTime);
    band0.Q.setValueAtTime(8, this.ctx.currentTime);
    band0.gain.setValueAtTime(12, this.ctx.currentTime);

    const band1 = this.ctx.createBiquadFilter();
    band1.type = 'peaking';
    band1.frequency.setValueAtTime(170, this.ctx.currentTime);
    band1.Q.setValueAtTime(8, this.ctx.currentTime);
    band1.gain.setValueAtTime(8, this.ctx.currentTime);

    const band2 = this.ctx.createBiquadFilter();
    band2.type = 'peaking';
    band2.frequency.setValueAtTime(310, this.ctx.currentTime);
    band2.Q.setValueAtTime(8, this.ctx.currentTime);
    band2.gain.setValueAtTime(5, this.ctx.currentTime);

    // Route brown noise through filters
    this.brownNoiseNode.connect(floorFilter);
    floorFilter.connect(band0);
    band0.connect(band1);
    band1.connect(band2);
    band2.connect(this.ambienceGain);

    this.ambienceGain.connect(this.masterGain);
    if (this.reverbConvolver) {
      this.ambienceGain.connect(this.reverbConvolver);
    }

    this.brownNoiseNode.start();
    this.isAmbienceRunning = true;
  }

  public stopAmbience(): void {
    if (this.brownNoiseNode) {
      try {
        this.brownNoiseNode.stop();
        this.brownNoiseNode.disconnect();
      } catch {
        // ignore if already stopped
      }
      this.brownNoiseNode = null;
    }
    this.isAmbienceRunning = false;
  }

  public playBounceSound(intensity = 1.0, midiOverride?: number): void {
    if (!this.ctx || !this.masterGain) {
      this.ensureAudioContext();
      return;
    }

    const scale = SCALE_PRESETS[this.config.selectedScale] || SCALE_PRESETS.c_major_pentatonic;
    const notes = scale.notes;
    
    const midiNote = midiOverride ?? notes[Math.floor(Math.random() * notes.length)];
    // Convert MIDI note to Frequency (Hz): 440 * 2^((note - 69)/12)
    const freq = 440.0 * Math.pow(2.0, (midiNote - 69.0) / 12.0);

    const now = this.ctx.currentTime;

    // Create Sine Synth Voice with ADSR envelope
    const osc = this.ctx.createOscillator();
    const voiceGain = this.ctx.createGain();

    // Pure sine with subtle warm second harmonic
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    // Envelope Parameters
    const attack = this.config.attack;
    const decay = this.config.decay;
    const sustain = this.config.sustain;
    const release = this.config.release;

    // Velocity / intensity scaling
    const peakGain = Math.min(0.35, Math.max(0.05, 0.2 * intensity));
    const sustainGain = peakGain * sustain;

    // ADSR Automation curve
    voiceGain.gain.setValueAtTime(0, now);
    // Attack
    voiceGain.gain.linearRampToValueAtTime(peakGain, now + attack);
    // Decay
    voiceGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustainGain), now + attack + decay);
    // Release
    voiceGain.gain.exponentialRampToValueAtTime(0.00001, now + attack + decay + release);

    // Connect to Master & Reverb
    osc.connect(voiceGain);
    voiceGain.connect(this.masterGain);
    if (this.reverbConvolver) {
      voiceGain.connect(this.reverbConvolver);
    }

    osc.start(now);
    osc.stop(now + attack + decay + release + 0.1);

    this.voiceIndex = (this.voiceIndex + 1) % this.numVoices;
  }

  public playCombatHit(isCrit = false, isLethal = false): void {
    if (!this.ctx || !this.masterGain) {
      this.ensureAudioContext();
      return;
    }

    const now = this.ctx.currentTime;

    // 1. Meaty punch / slash frequency sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isCrit ? 'triangle' : 'sawtooth';
    const startFreq = isLethal ? 420 : (isCrit ? 360 : 280);
    const endFreq = isLethal ? 35 : (isCrit ? 55 : 70);

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + (isLethal ? 0.35 : 0.18));

    const peakGain = isLethal ? 0.45 : (isCrit ? 0.35 : 0.22) * this.config.masterVolume;
    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (isLethal ? 0.35 : 0.18));

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + (isLethal ? 0.36 : 0.2));

    // 2. Critical Hit Metallic / High Chime Layer
    if (isCrit) {
      const critOsc = this.ctx.createOscillator();
      const critGain = this.ctx.createGain();

      critOsc.type = 'sine';
      critOsc.frequency.setValueAtTime(1174.66, now); // D6
      critOsc.frequency.exponentialRampToValueAtTime(1760.0, now + 0.1); // A6

      critGain.gain.setValueAtTime(0.25 * this.config.masterVolume, now);
      critGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

      critOsc.connect(critGain);
      critGain.connect(this.masterGain);
      if (this.reverbConvolver) critGain.connect(this.reverbConvolver);

      critOsc.start(now);
      critOsc.stop(now + 0.32);
    }

    // 3. Lethal K.O. Sub-bass Boom
    if (isLethal) {
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(80, now);
      subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.5);

      subGain.gain.setValueAtTime(0.5 * this.config.masterVolume, now);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

      subOsc.connect(subGain);
      subGain.connect(this.masterGain);
      if (this.reverbConvolver) subGain.connect(this.reverbConvolver);

      subOsc.start(now);
      subOsc.stop(now + 0.52);
    }
  }

  public updateConfig(newConfig: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (this.masterGain && this.ctx && newConfig.masterVolume !== undefined) {
      this.masterGain.gain.setValueAtTime(this.config.masterVolume, this.ctx.currentTime);
    }

    if (this.reverbGain && this.ctx && newConfig.reverbSize !== undefined) {
      this.reverbGain.gain.setValueAtTime(this.config.reverbSize, this.ctx.currentTime);
    }

    if (this.ambienceGain && this.ctx && newConfig.ambienceVolume !== undefined) {
      this.ambienceGain.gain.setValueAtTime(this.config.ambienceVolume * 0.08, this.ctx.currentTime);
    }

    if (newConfig.ambienceEnabled !== undefined) {
      if (newConfig.ambienceEnabled) {
        if (!this.isAmbienceRunning) this.startAmbience();
      } else {
        this.stopAmbience();
      }
    }
  }

  public getConfig(): AudioConfig {
    return { ...this.config };
  }

  public isRunning(): boolean {
    return this.isStarted;
  }
}

export const audioSynth = new AudioSynthEngine();
