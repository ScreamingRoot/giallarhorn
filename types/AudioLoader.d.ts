export declare class AudioLoader {
  load(
    url: string,
    onLoad?: (buffer: AudioBuffer) => void,
    onProgress?: (event: ProgressEvent<XMLHttpRequestEventTarget>) => void,
    onError?: (error: Error | Event) => void
  ): void;
}
