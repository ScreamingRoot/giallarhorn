/**
 * Loads an audio file from a URL using XMLHttpRequest and decodes it
 * into an AudioBuffer.
 *
 * This function is isolated in its own module so that bundlers can
 * exclude it (and `XMLHttpRequest`) from builds that only use base64.
 */
export declare function xhrLoad(
  url: string,
  onLoad: (buffer: AudioBuffer) => void,
  onProgress: ((event: ProgressEvent<XMLHttpRequestEventTarget>) => void) | null,
  onError: (error: Error | Event) => void
): void;