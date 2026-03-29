import type { SourceLoader } from './common';

export declare class AudioLoader {
  constructor();

  static isBase64(source: string): boolean;
  static decodeBase64ToArrayBuffer(dataUri: string): ArrayBuffer;

  registerLoader(scheme: string, loader: SourceLoader): void;
  getLoader(scheme: string): SourceLoader | undefined;

  load(
    source: string,
    onLoad: (buffer: AudioBuffer) => void,
    onProgress?: ((event: ProgressEvent) => void) | null,
    onError?: ((error: Error | Event) => void) | null
  ): void;
}