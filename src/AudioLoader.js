import { AudioContextProvider } from './AudioContextProvider.js';

/**
 * AudioLoader — loads and decodes audio from base64 data URIs (built-in)
 * or from URLs (requires an explicitly registered loader plugin).
 *
 * Base64 data URIs are decoded directly in-memory — no network request,
 * no `XMLHttpRequest`, nothing extra to import.
 *
 * For URL-based loading you must register a loader that knows how to fetch
 * binary data. The library ships `XhrLoader` as a separate entry-point
 * (`giallarhorn/loaders/xhr`). Because it lives in its own module, bundlers
 * will only include `XMLHttpRequest` when that module is actually imported.
 *
 * @example
 * // ── Playable Ad (base64 only, no XHR in the bundle) ──
 * import { AudioLoader } from 'giallarhorn';
 *
 * const loader = new AudioLoader();
 * loader.load('data:audio/mp3;base64,SUQzBAAA…', (buf) => { … });
 *
 * @example
 * // ── Regular project (needs URL loading) ──
 * import { AudioLoader } from 'giallarhorn';
 * import { XhrLoader }   from 'giallarhorn/loaders/xhr';
 *
 * const loader = new AudioLoader();
 * loader.registerLoader('url', new XhrLoader());
 * loader.load('music.mp3', (buf) => { … });
 */
export class AudioLoader {

  constructor() {
    /** @type {Object<string, { load: Function }>} */
    this._loaders = {};
  }

  // ── static helpers ───────────────────────────────────────────────────

  /**
   * Returns `true` if `source` is a base64 data URI.
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

  // ── plugin registry ──────────────────────────────────────────────────

  /**
   * Registers an external loader plugin for a given scheme.
   *
   * The loader must expose a `load(url, onLoad, onProgress, onError)` method
   * with the same callback signature used by `AudioLoader.load()`.
   *
   * @param {string} scheme - Key that identifies the loader (e.g. `'url'`)
   * @param {{ load: Function }} loader - Loader instance (e.g. `new XhrLoader()`)
   *
   * @example
   * import { XhrLoader } from 'giallarhorn/loaders/xhr';
   * audioLoader.registerLoader('url', new XhrLoader());
   */
  registerLoader(scheme, loader) {
    this._loaders[scheme] = loader;
  }

  /**
   * Returns the loader registered under `scheme`, or `undefined`.
   * @param {string} scheme
   * @returns {{ load: Function } | undefined}
   */
  getLoader(scheme) {
    return this._loaders[scheme];
  }

  // ── main API ─────────────────────────────────────────────────────────

  /**
   * Loads audio from a URL **or** base64 data URI and decodes it into an
   * `AudioBuffer`.
   *
   * - Data URIs → decoded in-memory (always works, no plugins needed).
   * - URLs → delegated to the `'url'` loader registered via
   *   `registerLoader()`. If no loader is registered a descriptive error
   *   is thrown so the developer knows what to import.
   *
   * @param {string}   source
   * @param {Function} onLoad
   * @param {Function} [onProgress]
   * @param {Function} [onError]
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
        handleError(
          new Error(
            'No loader registered for URL sources. ' +
            'Import and register XhrLoader:\n\n' +
            "  import { XhrLoader } from 'giallarhorn/loaders/xhr';\n" +
            "  audioLoader.registerLoader('url', new XhrLoader());\n"
          )
        );
        return;
      }
      urlLoader.load(source, onLoad, onProgress, handleError);
    }
  }

  // ── private ──────────────────────────────────────────────────────────

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