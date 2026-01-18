import type { AudioItem } from './AudioItem';
import type { SpatialAudio } from './SpatialAudio';
import type { AudioManager } from './AudioManager';
import type { OneShotOptions, OneShotInitConfig, OneShotVoice } from './common';

export declare class OneShotAudio {
  static manager: AudioManager | null;
  static context: AudioContext | null;
  static global: import('./common').OneShotGlobalConfig;
  static trackPolicies: Record<string, import('./common').OneShotPolicy>;
  static active: Set<OneShotVoice>;
  static activeByTrack: Map<string, Set<OneShotVoice>>;
  static lastStartAt: Map<string, number>;

  static init(config: OneShotInitConfig): void;
  static getPolicy(name: string): import('./common').OneShotPolicy;
  static getActiveCount(name?: string): number;
  static play(name: string, options?: OneShotOptions): OneShotVoice | null;
  private static _ensureCapacity(policy: import('./common').OneShotPolicy, trackSet: Set<OneShotVoice>, newPriority: number): boolean;
}
