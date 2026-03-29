import type { SourceLoader } from '../common';

/**
 * URL loader that uses XMLHttpRequest.
 *
 * Import from `giallarhorn/loaders/xhr` and register on AudioLoader/AudioManager
 * only when you need to load audio by URL. If this import is absent from your
 * code, the bundler will exclude XMLHttpRequest from the build entirely.
 */
export declare class XhrLoader implements SourceLoader {
  load(
    url: string,
    onLoad: (buffer: AudioBuffer) => void,
    onProgress: ((event: ProgressEvent<XMLHttpRequestEventTarget>) => void) | null,
    onError: (error: Error | Event) => void
  ): void;
}