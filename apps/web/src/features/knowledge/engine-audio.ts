import type { EnginePreset } from "./engine-catalog";
import type { EngineAudioFrame } from "./engine-simulation";

const exhaustProfiles = [
  {
    open: 0.1,
    damp: 0.82,
    vol: 0.68,
    length: 1.12,
    bright: 0.78,
    punch: 0.88,
    refl: 0.58,
  },
  {
    open: 0.38,
    damp: 0.44,
    vol: 0.92,
    length: 1,
    bright: 1,
    punch: 1,
    refl: 0.54,
  },
  {
    open: 0.63,
    damp: 0.28,
    vol: 0.98,
    length: 0.55,
    bright: 1.28,
    punch: 1.05,
    refl: 0.4,
  },
  {
    open: 0.32,
    damp: 0.36,
    vol: 0.93,
    length: 1.7,
    bright: 0.85,
    punch: 1.13,
    refl: 0.7,
  },
  {
    open: 0.87,
    damp: 0.13,
    vol: 1.02,
    length: 0.85,
    bright: 1.12,
    punch: 1.18,
    refl: 0.35,
  },
  {
    open: 0.94,
    damp: 0.09,
    vol: 1.05,
    length: 0.68,
    bright: 1.33,
    punch: 1.1,
    refl: 0.46,
  },
] as const;

export function buildAudioConfig(
  engine: EnginePreset,
  exhaust: number,
  forcedInduction: boolean,
  volume: number,
) {
  const pipe = exhaustProfiles[exhaust] ?? exhaustProfiles[1];
  const sound = engine.snd;
  return {
    n: engine.n,
    fire: engine.fire,
    bank: engine.bank,
    runner: engine.runner ?? Array(engine.n).fill(1),
    cylVar: Array.from(
      { length: 12 },
      (_, index) => 0.94 + ((index * 7) % 9) * 0.015,
    ),
    pipe: sound.pipe * pipe.length,
    open: pipe.open,
    damp: sound.damp * 0.35 + pipe.damp * 0.65,
    refl: pipe.refl,
    evo: sound.evo,
    bright: Math.min(1, sound.bright * pipe.bright),
    mech: sound.mech,
    punch: sound.punch * pipe.punch,
    turbo: engine.turbo && forcedInduction ? 1 : 0,
    sc: engine.sc && forcedInduction ? 1 : 0,
    vol: pipe.vol * Math.min(1, Math.max(0, volume)),
  };
}

export class EngineAudio {
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private starting: Promise<void> | null = null;
  private disposed = false;

  async start(): Promise<void> {
    if (this.disposed) throw new Error("Audio controller is disposed");
    if (this.context && this.node) {
      await this.context.resume();
      return;
    }
    if (this.starting) return this.starting;
    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextConstructor)
      throw new Error("AudioContext is unavailable");
    // Create the context while the user's click is still on the stack.
    const context = new AudioContextConstructor();
    this.context = context;
    this.starting = (async () => {
      try {
        if (!context.audioWorklet)
          throw new Error("AudioWorklet is unavailable");
        await context.audioWorklet.addModule("/knowledge/engine-processor.js");
        if (this.disposed || this.context !== context) return;
        const node = new AudioWorkletNode(context, "engine-processor", {
          outputChannelCount: [2],
        });
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -14;
        compressor.ratio.value = 3.5;
        compressor.attack.value = 0.004;
        compressor.release.value = 0.12;
        node.connect(compressor).connect(context.destination);
        this.node = node;
        await context.resume();
      } catch (error) {
        if (this.context === context) this.context = null;
        await context.close().catch(() => {});
        throw error;
      } finally {
        this.starting = null;
      }
    })();
    return this.starting;
  }

  configure(
    engine: EnginePreset,
    exhaust: number,
    forcedInduction: boolean,
    volume: number,
  ): void {
    this.node?.port.postMessage(
      buildAudioConfig(engine, exhaust, forcedInduction, volume),
    );
  }

  keyTurn(): void {
    this.node?.port.postMessage({ keyEvent: 1 });
  }

  update(frame: EngineAudioFrame): void {
    if (frame.bov) this.node?.port.postMessage({ bov: 1 });
    this.node?.port.postMessage(frame);
  }

  async suspend(): Promise<void> {
    if (this.context?.state === "running") await this.context.suspend();
  }

  async resume(): Promise<void> {
    if (this.context?.state === "suspended") await this.context.resume();
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.node?.port.postMessage({ master: 0, on: 0, vol: 0 });
    this.node?.disconnect();
    this.node = null;
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed")
      await context.close().catch(() => {});
  }
}
