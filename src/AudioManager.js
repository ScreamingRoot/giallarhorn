import { AudioLoader } from './AudioLoader.js';
import { AudioItem } from './AudioItem.js';
import { SpatialAudio } from './SpatialAudio.js';

/**
 * AudioManager — high-level manager for loading and playing audio.
 *
 * Works with both base64 data URIs (out of the box) and regular URLs
 * (when a URL loader plugin is registered).
 *
 * @example
 * // ── Base64 only (Playable Ad) ──
 * const manager = new AudioManager(listener);
 * await manager.loadAll([
 *   { name: 'click', data: 'data:audio/mp3;base64,…' },
 * ]);
 *
 * @example
 * // ── URLs (regular project) ──
 * import { XhrLoader } from 'giallarhorn/loaders/xhr';
 *
 * const manager = new AudioManager(listener);
 * manager.registerLoader('url', new XhrLoader());
 * await manager.loadAll(['music.mp3', 'sound.mp3']);
 */
export class AudioManager {

  /**
   * @param {AudioListenerController} listener
   */
  constructor(listener) {
    this.listener = listener;
    this.loader = new AudioLoader();
    this.buffers = {};
  }

  // ── loader plugin delegation ─────────────────────────────────────────

  /**
   * Registers a loader plugin on the internal `AudioLoader`.
   *
   * @param {string} scheme - e.g. `'url'`
   * @param {{ load: Function }} loaderInstance - e.g. `new XhrLoader()`
   *
   * @example
   * import { XhrLoader } from 'giallarhorn/loaders/xhr';
   * manager.registerLoader('url', new XhrLoader());
   */
  registerLoader(scheme, loaderInstance) {
    this.loader.registerLoader(scheme, loaderInstance);
  }

  // ── loading ──────────────────────────────────────────────────────────

  /**
   * Loads an array of audio sources and decodes them into AudioBuffers.
   *
   * Each entry can be:
   * - A URL string (`"music.mp3"`) — requires a registered `'url'` loader
   * - A data URI string (`"data:audio/…;base64,…"`) — auto-named `"audio_0"`, …
   * - An object `{ name, data }` — data URI stored under the given name
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
   * Loads a single base64 data URI and stores it under `name`.
   * Does NOT touch XMLHttpRequest.
   *
   * @param {string} name
   * @param {string} dataUri
   * @returns {Promise<AudioBuffer>}
   */
  async loadBase64(name, dataUri) {
    const buffer = await this._promisifyLoad(dataUri);
    this.buffers[name] = buffer;
    return buffer;
  }

  // ── private helpers ──────────────────────────────────────────────────

  /** @private */
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

  // ── public query / factory ───────────────────────────────────────────

  /**
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return !!this.buffers[name];
  }

  /**
   * @param {string}  name
   * @param {Object}  [config={}]
   * @param {boolean} [spatial=false]
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