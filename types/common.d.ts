export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Orientation {
  x: number;
  y: number;
  z: number;
}

export interface AudioConfig {
  loop?: boolean;
  volume?: number;
  playbackRate?: number;
  position?: Position;
  refDistance?: number;
  rolloffFactor?: number;
  distanceModel?: DistanceModelType;
}

export interface SpatialConfig {
  refDistance?: number;
  rolloffFactor?: number;
  distanceModel?: DistanceModelType;
  maxDistance?: number;
  coneInnerAngle?: number;
  coneOuterAngle?: number;
  coneOuterGain?: number;
  position?: Position;
  orientation?: Orientation;
}

export interface OneShotSpatialOptions {
  position?: Position;
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
  coneInnerAngle?: number;
  coneOuterAngle?: number;
  coneOuterGain?: number;
}

export interface OneShotOptions {
  volume?: number;
  playbackRate?: number;
  detune?: number;
  spatial?: OneShotSpatialOptions;
  priority?: number;
  minIntervalOverride?: number;
  duration?: number;
}

export interface OneShotPolicy {
  maxVoices?: number;
  minInterval?: number;
  priority?: number;
  stealStrategy?: StealStrategy;
  stealFadeMs?: number;
  spatialDefaults?: OneShotSpatialOptions;
}

export interface OneShotGlobalConfig {
  maxGlobalVoices?: number;
  defaultPolicy?: OneShotPolicy;
}

export interface OneShotInitConfig {
  audioManager: AudioManager;
  global?: OneShotGlobalConfig;
  tracks?: Record<string, OneShotPolicy>;
}

export interface OneShotVoice {
  name: string;
  node: AudioItem | SpatialAudio;
  priority: number;
}

export type AudioBufferMap = Record<string, AudioBuffer>;

export type SourceType = 'empty' | 'buffer' | 'audioNode' | 'mediaNode' | 'mediaStreamNode';

export type DistanceModelType = 'linear' | 'inverse' | 'exponential';

export type StealStrategy = 'ignore' | 'stealOldest' | 'stealQuietest';
