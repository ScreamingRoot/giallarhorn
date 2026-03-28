export declare class AudioLoader {
  /**
   * Checks whether the given source string is a base64 data URI.
   */
  static isBase64(source: string): boolean;

  /**
   * Decodes a base64 data URI string into an ArrayBuffer.
   */
  static decodeBase64ToArrayBuffer(dataUri: string): ArrayBuffer;

  /**
   * Loads an audio file from URL or base64 data URI and decodes it into AudioBuffer.
   * For base64 data URIs (starting with "data:"), XMLHttpRequest is never used.
   */
  load(
    source: string,
    onLoad?: (buffer: AudioBuffer) => void,
    onProgress?: (event: ProgressEvent<XMLHttpRequestEventTarget>) => void,
    onError?: (error: Error | Event) => void
  ): void;
}