import type { AudioListenerController } from './AudioListenerController';
import type { SourceType } from './common';

export declare class AudioItem {
  listener: AudioListenerController;
  context: AudioContext;
  gain: GainNode;
  autoplay: boolean;
  buffer: AudioBuffer | null;
  detune: number;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  offset: number;
  duration: number | undefined;
  playbackRate: number;
  isPlaying: boolean;
  hasPlaybackControl: boolean;
  source: AudioBufferSourceNode | AudioNode | null;
  sourceType: SourceType;
  filters: AudioNode[];
  protected _startedAt: number;
  protected _progress: number;
  protected _connected: boolean;

  constructor(listener: AudioListenerController);

  get output(): GainNode;

  setNodeSource(audioNode: AudioNode): this;
  setMediaElementSource(mediaElement: HTMLMediaElement): this;
  setMediaStreamSource(mediaStream: MediaStream): this;
  setBuffer(audioBuffer: AudioBuffer): this;
  play(delay?: number): this;
  pause(): this;
  stop(delay?: number): this;
  connect(): this;
  disconnect(): this;
  get filtersList(): AudioNode[];
  set filtersList(value: AudioNode[]);
  setDetune(value: number): this;
  getDetune(): number;
  getFilter(): AudioNode | undefined;
  setFilter(filter: AudioNode | null): this;
  setFilters(value: AudioNode[] | null): this;
  setPlaybackRate(value: number): this;
  getPlaybackRate(): number;
  onEnded(): void;
  getLoop(): boolean;
  setLoop(value: boolean): this;
  setLoopStart(value: number): this;
  setLoopEnd(value: number): this;
  get volume(): number;
  set volume(value: number);
}
