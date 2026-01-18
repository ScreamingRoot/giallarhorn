import type { AudioListenerController } from './AudioListenerController';
import type { AudioItem } from './AudioItem';
import type { SpatialAudio } from './SpatialAudio';
import type { AudioConfig, AudioBufferMap } from './common';

export declare class AudioManager {
  listener: AudioListenerController;
  loader: import('../src/AudioLoader.js').AudioLoader;
  buffers: AudioBufferMap;

  constructor(listener: AudioListenerController);

  loadAll(files: string[]): Promise<{ audios: AudioBufferMap }>;
  has(name: string): boolean;
  get(name: string, config?: AudioConfig, spatial?: boolean): AudioItem | SpatialAudio | null;
}
