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
 * - Stores buffers in an object for fast access by name
 * - Automatically determines filename from URL (removes extension)
 * - Supports both relative and absolute URLs
 * - Supports base64 data URIs (no XMLHttpRequest involved)
 * - get() method creates a new instance each time (not singleton), allowing
 *   the same sound to be played multiple times simultaneously
 *
 * @example
 * const listener = new AudioListenerController();
 * const manager = new AudioManager(listener);
 *
 * // Loading from URLs
 * await manager.loadAll(['music.mp3', 'sound.mp3']);
 *
 * // Loading from base64
 * await manager.loadAll([
 *   { name: 'click', data: 'data:audio/mp3;base64,SUQzBAAA...' },
 * ]);
 *
 * // Single base64
 * await manager.loadBase64('beep', 'data:audio/wav;base64,UklGRiQA...');
 *
 * // Creating and playing
 * const music = manager.get('music', { loop: true, volume: 0.5 });
 * music.play();
 */
export class AudioManager {
  /**
   * Creates a new AudioManager.
   *
   * @param {AudioListenerController} listener - AudioListenerController instance for creating audio sources
   */
  constructor(listener) {
    this.listener = listener;
    this.loader = new AudioLoader();
    this.buffers = {};
  }

  /**
   * Loads an array of audio sources and decodes them into AudioBuffers.
   *
   * Each entry can be:
   * - A URL string (`"music.mp3"`) — loaded via network, name extracted from URL
   * - A data URI string (`"data:audio/mp3;base64,..."`) — decoded inline, auto-named `"audio_0"`, `"audio_1"`, …
   * - An object `{ name, data }` — data URI decoded inline under the given name
   *
   * @param {Array<string | { name: string, data: string }>} files
   * @returns {Promise<{ audios: Object }>}
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
   * Does NOT use XMLHttpRequest.
   *
   * @param {string} name    - Key for the decoded buffer
   * @param {string} dataUri - `"data:audio/...;base64,..."`
   * @returns {Promise<AudioBuffer>}
   */
  async loadBase64(name, dataUri) {
    const buffer = await this._promisifyLoad(dataUri);
    this.buffers[name] = buffer;
    return buffer;
  }

  // ── private helpers ──────────────────────────────────────────────────

  /**
   * Resolves a single `loadAll` entry into `{ name, buffer }`.
   * @private
   */
  async _loadEntry(entry, index) {
    if (typeof entry === 'object' && entry !== null && entry.name && entry.data) {
      const buffer = await this._promisifyLoad(entry.data);
      return { name: entry.name, buffer };
    }

    const source = /** @type {string} */ (entry);

    if (AudioLoader.isBase64(source)) {
      const buffer = await this._promisifyLoad(source);
      return { name: 'audio_' + index, buffer };
    }

    const buffer = await this._promisifyLoad(source);
    return { name: this._extractNameFromUrl(source), buffer };
  }

  /**
   * Wraps callback-based `loader.load()` into a Promise.
   * @private
   */
  _promisifyLoad(source) {
    return new Promise((resolve, reject) => {
      this.loader.load(source, resolve, null, reject);
    });
  }

  /**
   * Extracts a short name (without extension) from a URL.
   *
   * - `"music.mp3"` → `"music"`
   * - `"/sounds/jump.mp3"` → `"jump"`
   * - `"https://example.com/audio.wav?v=1"` → `"audio"`
   *
   * @private
   */
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

  // ── public query / factory ───────────────────────────────────────────

  /**
   * Checks if an audio file with the specified name is loaded.
   *
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return !!this.buffers[name];
  }

  /**
   * Creates and returns a ready-to-use AudioItem or SpatialAudio instance.
   *
   * @param {string}  name              - Name of loaded audio
   * @param {Object}  [config={}]       - Configuration
   * @param {boolean} [spatial=false]   - Create SpatialAudio instead of AudioItem
   * @returns {AudioItem|SpatialAudio|null}
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