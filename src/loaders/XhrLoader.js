import { AudioContextProvider } from '../AudioContextProvider.js';

/**
 * XhrLoader — URL loader that uses XMLHttpRequest.
 *
 * This class is shipped as a **separate entry-point** (`giallarhorn/loaders/xhr`)
 * so that projects which only work with base64 data URIs can simply NOT import
 * it, and the bundler will never include `XMLHttpRequest` in the output.
 *
 * @example
 * import { AudioLoader } from 'giallarhorn';
 * import { XhrLoader } from 'giallarhorn/loaders/xhr';
 *
 * const loader = new AudioLoader();
 * loader.registerLoader('url', new XhrLoader());
 *
 * loader.load('music.mp3', (buf) => console.log(buf));
 */
export class XhrLoader {

  /**
   * Loads an audio file from a URL via XMLHttpRequest and decodes it
   * into an AudioBuffer through `AudioContext.decodeAudioData()`.
   *
   * @param {string}   url         - URL to fetch
   * @param {Function} onLoad      - `(buffer: AudioBuffer) => void`
   * @param {Function} [onProgress] - `(event: ProgressEvent) => void`
   * @param {Function} onError     - `(error: Error | Event) => void`
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