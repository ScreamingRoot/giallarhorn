import { AudioLoader } from './AudioLoader.js';
import { AudioItem } from './AudioItem.js';
import { SpatialAudio } from './SpatialAudio.js';

/**
 * AudioManager - manager for loading and managing audio resources.
 *
 * This class provides a high-level API for working with audio:
 * - Loading audio files from network or base64 data URIs
 * - Storing decoded AudioBuffers in memory
 * - Creating ready-to-use AudioItem and SpatialAudio instances
 *
 * Why it's needed:
 * Web Audio API requires decoding audio files into AudioBuffer before use.
 * AudioManager simplifies this process:
 * 1. Loads files asynchronously via AudioLoader
 * 2. Automatically extracts filename from URL and uses it as a key
 * 3. Stores buffers in memory for reuse
 * 4. Creates ready instances of AudioItem/SpatialAudio with settings
 *
 * Why it's structured this way:
 * - Uses AudioLoader for loading abstraction (can be replaced with another loader)
 * - URL loading requires a registered plugin (e.g. XhrLoader from 'giallarhorn/loaders/xhr')
 * - Stores buffers in an object for fast access by name
 * - Automatically determines filename from URL (removes extension)
 * - Supports both relative and absolute URLs
 * - Supports base64 data URIs without XMLHttpRequest
 * - get() method creates a new instance each time (not singleton), allowing
 *   the same sound to be played multiple times simultaneously
 *
 * @example
 * const listener = new AudioListenerController();
 * const manager = new AudioManager(listener);
 *
 * // Loading files (requires registered URL loader)
 * import { XhrLoader } from 'giallarhorn/loaders/xhr';
 * manager.registerLoader('url', new XhrLoader());
 * await manager.loadAll(['music.mp3', 'sound.mp3']);
 *
 * // Loading from base64 (no plugins needed)
 * await manager.loadAll([
 *   { name: 'click', data: 'data:audio/mp3;base64,SUQzBAAA...' },
 * ]);
 *
 * // Creating and playing global audio
 * const music = manager.get('music', { loop: true, volume: 0.5 });
 * music.play();
 *
 * // Creating 3D positional audio
 * const spatial = manager.get('sound', {
 *   refDistance: 20,
 *   rolloffFactor: 1,
 *   position: [0, 0, -10]
 * }, true);
 * spatial.play();
 */
export class AudioManager {
  /**
   * Creates a new AudioManager.
   *
   * Initializes internal AudioLoader and empty object for storing buffers.
   *
   * @param {AudioListenerController} listener - AudioListenerController instance for creating audio sources
   */
  constructor(listener) {
    this.listener = listener;
    this.loader = new AudioLoader();
    this.buffers = {};
  }

  /**
   * Registers a loader plugin on the internal AudioLoader.
   *
   * @param {string} scheme - e.g. 'url'
   * @param {{ load: Function }} loaderInstance - e.g. new XhrLoader()
   */
  registerLoader(scheme, loaderInstance) {
    this.loader.registerLoader(scheme, loaderInstance);
  }

  /**
   * Loads an array of audio files and decodes them into AudioBuffer.
   *
   * Loads all files in parallel via Promise.all. Each entry can be:
   * - A URL string ("music.mp3") — loaded via registered 'url' loader, name extracted from URL
   * - A data URI string ("data:audio/mp3;base64,...") — decoded inline, auto-named "audio_0", ...
   * - An object { name, data } — data URI stored under the given name
   *
   * For URL strings, filename is automatically determined:
   * - "music.mp3" -> "music"
   * - "/sounds/jump.mp3" -> "jump"
   * - "https://example.com/audio.wav?version=1" -> "audio"
   *
   * Supports both absolute URLs (via URL constructor) and relative URLs
   * (via string parsing). On URL parsing error, uses fallback parsing.
   *
   * @param {Array<string | { name: string, data: string }>} files - Array of audio sources to load
   * @returns {Promise<{audios: Object}>} Promise that resolves with object containing loaded buffers
   * @throws {Error} If loading any file fails (Promise.all will reject)
   *
   * @example
   * const { audios } = await manager.loadAll(['music.mp3', 'sound.mp3']);
   * // audios = { music: AudioBuffer, sound: AudioBuffer }
   *
   * @example
   * const { audios } = await manager.loadAll([
   *   { name: 'click', data: 'data:audio/mp3;base64,...' },
   * ]);
   */
  async loadAll(files) {
    const results = await Promise.all(
      files.map((entry, index) => this._loadEntry(entry, index))
    );
    results.forEach(({ name, buffer }) => {
      this.buffers[name] = buffer;
    });
    return { audios: { ...this.buffers } };
  }

  /**
   * Loads a single audio from a base64 data URI and stores it under the given name.
   *
   * @param {string} name - Key under which the decoded AudioBuffer will be stored
   * @param {string} dataUri - Base64-encoded data URI (e.g. "data:audio/mp3;base64,...")
   * @returns {Promise<AudioBuffer>} The decoded AudioBuffer
   */
  async loadBase64(name, dataUri) {
    const buffer = await this._promisifyLoad(dataUri);
    this.buffers[name] = buffer;
    return buffer;
  }

  /** @private */
  async _loadEntry(entry, index) {
    if (typeof entry === 'object' && entry !== null && entry.name && entry.data) {
      const buffer = await this._promisifyLoad(entry.data);
      return { name: entry.name, buffer };
    }
    const source = /** @type {string} */ (entry);
    const buffer = await this._promisifyLoad(source);
    const name = AudioLoader.isBase64(source) ? 'audio_' + index : this._extractNameFromUrl(source);
    return { name, buffer };
  }

  /** @private */
  _promisifyLoad(source) {
    return new Promise((resolve, reject) => {
      this.loader.load(source, resolve, null, reject);
    });
  }

  /** @private */
  _extractNameFromUrl(url) {
    try {
      const u = new URL(url, window.location.href);
      const file = u.pathname.split('/').pop();
      return file.replace(/\.[^.]+$/, '');
    } catch {
      const file = url.split('?')[0].split('#')[0].split('/').pop();
      return file.replace(/\.[^.]+$/, '');
    }
  }

  /**
   * Checks if an audio file with the specified name is loaded.
   *
   * @param {string} name - Audio file name (without extension)
   * @returns {boolean} true if buffer with this name exists, otherwise false
   *
   * @example
   * if (manager.has('music')) {
   *   const audio = manager.get('music');
   * }
   */
  has(name) {
    return !!this.buffers[name];
  }

  /**
   * Creates and returns a ready-to-use instance of AudioItem or SpatialAudio.
   *
   * Creates a new instance each time (not singleton), allowing the same sound
   * to be played multiple times simultaneously. Configures all parameters from
   * config before returning.
   *
   * For SpatialAudio, additionally configures 3D audio parameters:
   * - refDistance: distance at which volume = 1.0
   * - rolloffFactor: sound attenuation coefficient with distance
   * - distanceModel: attenuation calculation model ('linear', 'inverse', 'exponential')
   * - position: initial sound position in 3D space
   *
   * @param {string} name - Name of loaded audio file (without extension)
   * @param {Object} [config={}] - Audio source configuration
   * @param {boolean} [config.loop] - Whether to loop the sound
   * @param {number} [config.volume] - Volume (0.0 - 1.0)
   * @param {number} [config.playbackRate] - Playback rate (1.0 = normal speed)
   * @param {number} [config.refDistance] - Reference distance for SpatialAudio
   * @param {number} [config.rolloffFactor] - Attenuation coefficient for SpatialAudio
   * @param {string} [config.distanceModel] - Attenuation model for SpatialAudio ('linear' | 'inverse' | 'exponential')
   * @param {Object} [config.position] - Initial position {x, y, z} for SpatialAudio
   * @param {boolean} [spatial=false] - Create SpatialAudio instead of AudioItem
   * @returns {AudioItem|SpatialAudio|null} Audio source instance or null if file not found
   *
   * @example
   * // Global audio
   * const music = manager.get('music', { loop: true, volume: 0.5 });
   * music.play();
   *
   * // 3D positional audio
   * const spatial = manager.get('sound', {
   *   refDistance: 20,
   *   rolloffFactor: 1,
   *   distanceModel: 'inverse',
   *   position: { x: 0, y: 0, z: -10 }
   * }, true);
   * spatial.play();
   */
  get(name, config = {}, spatial = false) {
    const buffer = this.buffers[name];
    if (!buffer) return null;
    const audio = spatial ? new SpatialAudio(this.listener) : new AudioItem(this.listener);
    audio.setBuffer(buffer);
    if (config.loop !== undefined) audio.loop = config.loop;
    if (config.volume !== undefined) audio.volume = config.volume;
    if (config.playbackRate !== undefined) audio.playbackRate = config.playbackRate;
    if (spatial) {
      /** @type {SpatialAudio} */
      const spatialAudio = audio;
      if (config.refDistance !== undefined) spatialAudio.refDistance = config.refDistance;
      if (config.rolloffFactor !== undefined) spatialAudio.rolloffFactor = config.rolloffFactor;
      if (config.distanceModel !== undefined) spatialAudio.distanceModel = config.distanceModel;
      if (config.position) spatialAudio.setPosition(config.position);
    }
    return audio;
  }
}