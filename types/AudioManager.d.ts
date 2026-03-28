import type { AudioListenerController } from './AudioListenerController';
import type { AudioItem } from './AudioItem';
import type { SpatialAudio } from './SpatialAudio';
import type { AudioConfig, AudioBufferMap } from './common';

export declare class AudioManager {
  listener: AudioListenerController;
  loader: import('../src/AudioLoader.js').AudioLoader;
  buffers: AudioBufferMap;

  constructor(listener: AudioListenerController);

  loadAll(files: Array<string | { name: string; data: string }>): Promise<{ audios: AudioBufferMap }>;
  loadBase64(name: string, dataUri: string): Promise<AudioBuffer>;
  has(name: string): boolean;
  get(name: string, config?: AudioConfig, spatial?: boolean): AudioItem | SpatialAudio | null;
}