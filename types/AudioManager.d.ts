import type { AudioListenerController } from './AudioListenerController';
import type { AudioItem } from './AudioItem';
import type { SpatialAudio } from './SpatialAudio';
import type { AudioConfig, AudioBufferMap, SourceLoader } from './common';
import type { AudioLoader } from './AudioLoader';

export declare class AudioManager {
  listener: AudioListenerController;
  loader: AudioLoader;
  buffers: AudioBufferMap;

  constructor(listener: AudioListenerController);

  registerLoader(scheme: string, loader: SourceLoader): void;
  loadAll(files: Array<string | { name: string; data: string }>): Promise<{ audios: AudioBufferMap }>;
  loadBase64(name: string, dataUri: string): Promise<AudioBuffer>;
  has(name: string): boolean;
  get(name: string, config?: AudioConfig, spatial?: boolean): AudioItem | SpatialAudio | null;
}