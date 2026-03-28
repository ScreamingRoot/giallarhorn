import { AudioContextProvider } from './AudioContextProvider.js';

/**
 * AudioLoader - loader for loading and decoding audio files.
 *
 * Supports two source types:
 * - **URL strings** — loaded via XMLHttpRequest (with progress tracking).
 *   The XHR code lives in a separate module (`XhrLoader.js`) and is pulled in
 *   through a dynamic `import()` only when actually needed, so projects that
 *   exclusively use base64 data URIs will never have `XMLHttpRequest` in their
 *   bundle.
 * - **Base64 data URIs** (`data:audio/...;base64,...`) — decoded directly in
 *   memory without any network request.
 *
 * @example
 * const loader = new AudioLoader();
 *
 * // From URL (XhrLoader is loaded on demand)
 * loader.load('music.mp3',
 *   (buf) => console.log('Loaded:', buf),
 *   (evt) => console.log('Progress:', evt.loaded / evt.total),
 *   (err) => console.error(err)
 * );
 *
 * // From base64 (no XMLHttpRequest involved at all)
 * loader.load('data:audio/mp3;base64,SUQzBAAAAAAA...',
 *   (buf) => console.log('Decoded:', buf)
 * );
 */
export class AudioLoader {

  /**
   * Returns `true` if `source` is a base64 data URI.
   *
   * @param {string} source
   * @returns {boolean}
   */
  static isBase64(source) {
    return typeof source === 'string' && source.startsWith('data:');
  }

  /**
   * Converts a base64 data URI into an ArrayBuffer.
   *
   * @param {string} dataUri - e.g. `"data:audio/mp3;base64,SUQzBAAA..."`
   * @returns {ArrayBuffer}
   * @throws {Error} If the data URI has no base64 payload after the comma.
   */
  static decodeBase64ToArrayBuffer(dataUri) {
    const base64 = dataUri.split(',')[1];
    if (!base64) {
      throw new Error('Invalid data URI: missing base64 payload');
    }
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Loads audio from a URL **or** a base64 data URI and decodes it into an
   * `AudioBuffer`.
   *
   * For data URIs the decoding happens synchronously in-process (no XHR).
   * For regular URLs the XHR module is loaded lazily via dynamic `import()`.
   *
   * @param {string}   source      - URL or data URI
   * @param {Function} onLoad      - `(buffer: AudioBuffer) => void`
   * @param {Function} [onProgress] - `(event: ProgressEvent) => void` (URL only)
   * @param {Function} [onError]   - `(error: Error | Event) => void`
   */
  load(source, onLoad, onProgress, onError) {
    const handleError = (e) => {
      if (onError) onError(e);
      else console.error(e);
    };

    if (AudioLoader.isBase64(source)) {
      this._loadBase64(source, onLoad, handleError);
    } else {
      this._loadUrl(source, onLoad, onProgress, handleError);
    }
  }

  /**
   * Decodes a base64 data URI into an AudioBuffer.
   * No network request is made; `XMLHttpRequest` is never referenced.
   *
   * @private
   */
  _loadBase64(dataUri, onLoad, handleError) {
    try {
      const arrayBuffer = AudioLoader.decodeBase64ToArrayBuffer(dataUri);
      const context = AudioContextProvider.context;
      context
        .decodeAudioData(arrayBuffer, (audioBuffer) => {
          onLoad(audioBuffer);
        })
        .catch(handleError);
    } catch (e) {
      handleError(e);
    }
  }

  /**
   * Loads audio from a URL via the dynamically-imported `XhrLoader` module.
   *
   * Because `XhrLoader.js` is imported with `import()`, bundlers treat it as
   * a separate chunk / side-effect-free module. If this code path is never
   * reached (i.e. only base64 is used), the chunk containing
   * `XMLHttpRequest` is never requested and can be excluded from the build.
   *
   * @private
   */
  _loadUrl(url, onLoad, onProgress, handleError) {
    import('./XhrLoader.js')
      .then(({ xhrLoad }) => {
        xhrLoad(url, onLoad, onProgress, handleError);
      })
      .catch(handleError);
  }
}