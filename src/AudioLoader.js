import { AudioContextProvider } from './AudioContextProvider.js';

/**
 * AudioLoader - loader for loading and decoding audio files.
 *
 * This class handles the low-level process of loading audio files
 * and decoding them into AudioBuffer objects that can be used by Web Audio API.
 *
 * Why it's needed:
 * Web Audio API requires audio data to be decoded into AudioBuffer before use.
 * This class abstracts the process of:
 * 1. Loading audio file via a registered loader plugin (e.g. XhrLoader for URLs)
 * 2. Decoding base64 data URIs directly in-memory (built-in, no plugin needed)
 * 3. Decoding ArrayBuffer into AudioBuffer using AudioContext
 *
 * Why it's structured this way:
 * - Uses callback-based API (onLoad, onProgress, onError) for flexibility
 * - URL loading is handled by external loader plugins registered via registerLoader()
 * - XhrLoader (giallarhorn/loaders/xhr) is shipped separately so projects that
 *   only use base64 never include XMLHttpRequest in their bundle
 * - Base64 data URIs are decoded in-memory without any network request
 * - Uses AudioContextProvider to get shared context for decoding
 * - Handles both network errors and decoding errors
 *
 * @example
 * const loader = new AudioLoader();
 *
 * // Base64 (works out of the box, no plugins)
 * loader.load('data:audio/mp3;base64,SUQzBAAA...',
 *   (buffer) => console.log('Loaded:', buffer)
 * );
 *
 * // URL (requires registered loader)
 * import { XhrLoader } from 'giallarhorn/loaders/xhr';
 * loader.registerLoader('url', new XhrLoader());
 * loader.load('music.mp3',
 *   (buffer) => console.log('Loaded:', buffer),
 *   (event) => console.log('Progress:', event.loaded / event.total),
 *   (error) => console.error('Error:', error)
 * );
 */
export class AudioLoader {

  constructor() {
    /** @type {Object<string, { load: Function }>} */
    this._loaders = {};
  }

  /**
   * Returns true if source is a base64 data URI.
   * @param {string} source
   * @returns {boolean}
   */
  static isBase64(source) {
    return typeof source === 'string' && source.startsWith('data:');
  }

  /**
   * Converts a base64 data URI into an ArrayBuffer.
   * @param {string} dataUri
   * @returns {ArrayBuffer}
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
   * Registers an external loader plugin for a given scheme.
   * The loader must expose a load(url, onLoad, onProgress, onError) method.
   *
   * @param {string} scheme - Key that identifies the loader (e.g. 'url')
   * @param {{ load: Function }} loader - Loader instance (e.g. new XhrLoader())
   */
  registerLoader(scheme, loader) {
    this._loaders[scheme] = loader;
  }

  /**
   * Loads an audio file from URL or base64 data URI and decodes it into AudioBuffer.
   *
   * - Base64 data URIs are decoded directly in-memory (no plugins needed).
   * - URLs are delegated to the 'url' loader registered via registerLoader().
   *   If no loader is registered, a descriptive error is emitted.
   *
   * @param {string} source - URL of the audio file or a base64 data URI
   * @param {Function} onLoad - Callback called when audio is successfully decoded. Receives AudioBuffer as argument
   * @param {Function} [onProgress] - Optional callback for progress updates. Receives ProgressEvent (URL only)
   * @param {Function} [onError] - Optional callback for errors. Receives error object. If not provided, errors are logged to console
   */
  load(source, onLoad, onProgress, onError) {
    const handleError = (e) => {
      if (onError) onError(e);
      else console.error(e);
    };

    if (AudioLoader.isBase64(source)) {
      this._loadBase64(source, onLoad, handleError);
    } else {
      const urlLoader = this._loaders['url'];
      if (!urlLoader) {
        handleError(new Error(
          'No loader registered for URL sources. ' +
          "Import and register XhrLoader: audioLoader.registerLoader('url', new XhrLoader())"
        ));
        return;
      }
      urlLoader.load(source, onLoad, onProgress, handleError);
    }
  }

  /** @private */
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
}