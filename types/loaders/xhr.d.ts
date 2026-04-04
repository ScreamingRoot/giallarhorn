import type { SourceLoader } from '../common';

/**
 * URL loader that uses XMLHttpRequest.
 * Import from 'giallarhorn/loaders/xhr' and register via registerLoader().
 */
export declare class XhrLoader implements SourceLoader {
  load(
    url: string,
    onLoad: (buffer: AudioBuffer) => void,
    onProgress: ((event: ProgressEvent<XMLHttpRequestEventTarget>) => void) | null,
    onError: (error: Error | Event) => void
  ): void;
}