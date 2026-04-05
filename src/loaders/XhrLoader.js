import { AudioContextProvider } from '../AudioContextProvider.js';

/**
 * XhrLoader - URL loader that uses XMLHttpRequest.
 *
 * Shipped as a separate entry-point (giallarhorn/loaders/xhr) so that projects
 * which only use base64 data URIs can skip this import entirely, keeping
 * XMLHttpRequest out of their bundle.
 *
 * @example
 * import { AudioLoader } from 'giallarhorn';
 * import { XhrLoader } from 'giallarhorn/loaders/xhr';
 *
 * const loader = new AudioLoader();
 * loader.registerLoader('url', new XhrLoader());
 * loader.load('music.mp3', (buf) => console.log(buf));
 */
export class XhrLoader {
  /**
   * Loads an audio file from a URL via XMLHttpRequest and decodes it
   * into an AudioBuffer through AudioContext.decodeAudioData().
   *
   * @param {string} url - URL to fetch
   * @param {Function} onLoad - Called with the decoded AudioBuffer on success
   * @param {Function} [onProgress] - Called with ProgressEvent during download
   * @param {Function} onError - Called on network or decoding errors
   */
  load(url, onLoad, onProgress, onError) {
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
}