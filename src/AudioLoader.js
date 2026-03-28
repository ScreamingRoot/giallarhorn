import { AudioContextProvider } from './AudioContextProvider.js';

/**
 * AudioLoader - loader for loading and decoding audio files.
 * 
 * This class handles the low-level process of loading audio files from network
 * or from base64 data URIs and decoding them into AudioBuffer objects that can
 * be used by Web Audio API.
 * 
 * Why it's needed:
 * Web Audio API requires audio data to be decoded into AudioBuffer before use.
 * This class abstracts the process of:
 * 1. Loading audio file via XMLHttpRequest (for URLs) or decoding base64 inline (for data URIs)
 * 2. Receiving binary data as ArrayBuffer
 * 3. Decoding ArrayBuffer into AudioBuffer using AudioContext
 * 
 * Why it's structured this way:
 * - Uses callback-based API (onLoad, onProgress, onError) for flexibility
 * - Uses XMLHttpRequest for URL loading (progress tracking support)
 * - Supports base64 data URIs (data:audio/...;base64,...) without using XMLHttpRequest,
 *   so projects that only use base64 audio never trigger an XMLHttpRequest call
 * - Creates a copy of response buffer before decoding (slice(0)) to avoid
 *   potential issues with reused buffers
 * - Uses AudioContextProvider to get shared context for decoding
 * - Handles both network errors and decoding errors
 * 
 * Note: For URL loading, this loader doesn't check HTTP status codes. A 404
 * response will still trigger onload, but decodeAudioData will fail. Consider
 * adding status check if you need better error handling.
 * 
 * @example
 * const loader = new AudioLoader();
 * 
 * // Load from URL
 * loader.load('music.mp3', 
 *   (buffer) => console.log('Loaded:', buffer),
 *   (event) => console.log('Progress:', event.loaded / event.total),
 *   (error) => console.error('Error:', error)
 * );
 * 
 * // Load from base64 data URI (no XMLHttpRequest used)
 * loader.load('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAA...', 
 *   (buffer) => console.log('Loaded from base64:', buffer),
 *   null,
 *   (error) => console.error('Error:', error)
 * );
 */
export class AudioLoader {

  /**
   * Checks whether the given source string is a base64 data URI.
   * 
   * @param {string} source - URL or data URI string
   * @returns {boolean} true if the source is a data URI
   */
  static isBase64(source) {
    return typeof source === 'string' && source.startsWith('data:');
  }

  /**
   * Decodes a base64 data URI string into an ArrayBuffer.
   * 
   * Strips the data URI prefix (e.g. "data:audio/mp3;base64,") and converts
   * the remaining base64 payload into binary data.
   * 
   * @param {string} dataUri - A base64-encoded data URI
   * @returns {ArrayBuffer} The decoded binary data
   * @throws {Error} If the data URI format is invalid or base64 decoding fails
   */
  static decodeBase64ToArrayBuffer(dataUri) {
    const base64 = dataUri.split(',')[1];
    if (!base64) {
      throw new Error('Invalid data URI: missing base64 payload');
    }
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Loads an audio file from URL or base64 data URI and decodes it into AudioBuffer.
   * 
   * - For regular URLs: uses XMLHttpRequest to load the file as ArrayBuffer,
   *   then decodes it using AudioContext.decodeAudioData(). Supports progress tracking.
   * - For base64 data URIs (starting with "data:"): decodes the base64 payload
   *   directly into an ArrayBuffer without any network request. XMLHttpRequest
   *   is never instantiated in this path.
   * 
   * @param {string} source - URL of the audio file or a base64 data URI (e.g. "data:audio/mp3;base64,...")
   * @param {Function} onLoad - Callback called when audio is successfully decoded. Receives AudioBuffer as argument
   * @param {Function} [onProgress] - Optional callback for progress updates. Receives ProgressEvent (only used for URL loading)
   * @param {Function} [onError] - Optional callback for errors. Receives error object. If not provided, errors are logged to console
   * 
   * @example
   * // From URL
   * loader.load('sound.mp3', 
   *   (buffer) => {
   *     console.log('Audio loaded:', buffer.duration, 'seconds');
   *   },
   *   (event) => {
   *     const percent = (event.loaded / event.total) * 100;
   *     console.log(`Loading: ${percent.toFixed(1)}%`);
   *   },
   *   (error) => {
   *     console.error('Failed to load audio:', error);
   *   }
   * );
   * 
   * @example
   * // From base64 (no XMLHttpRequest)
   * loader.load('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAA...', 
   *   (buffer) => console.log('Decoded:', buffer.duration, 'seconds')
   * );
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
   * Internal: decodes a base64 data URI into an AudioBuffer.
   * No XMLHttpRequest is used.
   * 
   * @param {string} dataUri - base64 data URI
   * @param {Function} onLoad - success callback
   * @param {Function} handleError - error handler
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
   * Internal: loads an audio file from URL via XMLHttpRequest.
   * 
   * @param {string} url - URL to load
   * @param {Function} onLoad - success callback
   * @param {Function} [onProgress] - progress callback
   * @param {Function} handleError - error handler
   * @private
   */
  _loadUrl(url, onLoad, onProgress, handleError) {
    const request = new XMLHttpRequest();

    request.open('GET', url, true);
    request.responseType = 'arraybuffer';

    request.onprogress = (event) => {
      if (onProgress) onProgress(event);
    };


    request.onload = () => {
      try {
        const bufferCopy = request.response.slice(0);
        const context = AudioContextProvider.context;
        context
          .decodeAudioData(bufferCopy, (audioBuffer) => {
            onLoad(audioBuffer);
          })
          .catch(handleError);
      } catch (e) {
        handleError(e);
      }
    };

    request.onerror = handleError;
    request.send();
  }
}