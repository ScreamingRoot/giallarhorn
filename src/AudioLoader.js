import { AudioContextProvider } from './AudioContextProvider.js';

/**
 * AudioLoader - loader for loading and decoding audio files.
 * 
 * This class handles the low-level process of loading audio files from network
 * and decoding them into AudioBuffer objects that can be used by Web Audio API.
 * 
 * Why it's needed:
 * Web Audio API requires audio data to be decoded into AudioBuffer before use.
 * This class abstracts the process of:
 * 1. Loading audio file via XMLHttpRequest
 * 2. Receiving binary data as ArrayBuffer
 * 3. Decoding ArrayBuffer into AudioBuffer using AudioContext
 * 
 * Why it's structured this way:
 * - Uses callback-based API (onLoad, onProgress, onError) for flexibility
 * - Uses XMLHttpRequest instead of fetch() for progress tracking support
 * - Creates a copy of response buffer before decoding (slice(0)) to avoid
 *   potential issues with reused buffers
 * - Uses AudioContextProvider to get shared context for decoding
 * - Handles both network errors and decoding errors
 * 
 * Note: This loader doesn't check HTTP status codes. A 404 response will still
 * trigger onload, but decodeAudioData will fail. Consider adding status check
 * if you need better error handling.
 * 
 * @example
 * const loader = new AudioLoader();
 * loader.load('music.mp3', 
 *   (buffer) => console.log('Loaded:', buffer),
 *   (event) => console.log('Progress:', event.loaded / event.total),
 *   (error) => console.error('Error:', error)
 * );
 */
export class AudioLoader {
  /**
   * Loads an audio file from URL and decodes it into AudioBuffer.
   * 
   * Uses XMLHttpRequest to load the file as ArrayBuffer, then decodes it
   * using AudioContext.decodeAudioData(). Supports progress tracking and
   * error handling via callbacks.
   * 
   * @param {string} url - URL of the audio file to load
   * @param {Function} onLoad - Callback called when audio is successfully decoded. Receives AudioBuffer as argument
   * @param {Function} [onProgress] - Optional callback for progress updates. Receives ProgressEvent
   * @param {Function} [onError] - Optional callback for errors. Receives error object. If not provided, errors are logged to console
   * 
   * @example
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
   */
  load(url, onLoad, onProgress, onError) {
    const request = new XMLHttpRequest();

    request.open('GET', url, true);
    request.responseType = 'arraybuffer';

    request.onprogress = (event) => {
      if (onProgress) onProgress(event);
    };

    const handleError = (e) => {
      if (onError) onError(e);
      else console.error(e);
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
