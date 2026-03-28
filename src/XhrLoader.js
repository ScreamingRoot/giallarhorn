import { AudioContextProvider } from './AudioContextProvider.js';

/**
 * XhrLoader — isolated module that loads audio via XMLHttpRequest.
 *
 * This module is intentionally separated from AudioLoader so that projects
 * which only use base64 data URIs never pull XMLHttpRequest into their bundle.
 * AudioLoader imports this module dynamically (via `import()`) only when a
 * regular URL needs to be fetched.
 *
 * @module XhrLoader
 */

/**
 * Loads an audio file from a URL using XMLHttpRequest and decodes it
 * into an AudioBuffer via AudioContext.decodeAudioData().
 *
 * @param {string}   url        - URL of the audio file to load
 * @param {Function} onLoad     - Called with the decoded AudioBuffer on success
 * @param {Function} [onProgress] - Called with ProgressEvent during download
 * @param {Function} onError    - Called on network or decoding errors
 */
export function xhrLoad(url, onLoad, onProgress, onError) {
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
        .catch(onError);
    } catch (e) {
      onError(e);
    }
  };

  request.onerror = onError;
  request.send();
}