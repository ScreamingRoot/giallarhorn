export declare class AudioLoader {
  static isBase64(source: string): boolean;
  static decodeBase64ToArrayBuffer(dataUri: string): ArrayBuffer;

  load(
    source: string,
    onLoad?: (buffer: AudioBuffer) => void,
    onProgress?: (event: ProgressEvent<XMLHttpRequestEventTarget>) => void,
    onError?: (error: Error | Event) => void
  ): void;
}