import { AudioLoader } from './AudioLoader.js';
import { AudioItem } from './AudioItem.js';
import { SpatialAudio } from './SpatialAudio.js';

/**
 * AudioManager - manager for loading and managing audio resources.
 * 
 * This class provides a high-level API for working with audio:
 * - Loading audio files from network
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
 * - get() method creates a new instance each time (not singleton), allowing
 *   the same sound to be played multiple times simultaneously
 * 
 * @example
 * const listener = new AudioListenerController();
 * const manager = new AudioManager(listener);
 * 
 * // Loading files
 * await manager.loadAll(['music.mp3', 'sound.mp3']);
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
   * Loads an array of audio files and decodes them into AudioBuffer.
   * 
   * Loads all files in parallel via Promise.all. For each file:
   * 1. Loads via AudioLoader
   * 2. Extracts filename from URL (removes extension)
   * 3. Saves buffer in this.buffers under that name
   * 
   * Filename is automatically determined from URL:
   * - "music.mp3" -> "music"
   * - "/sounds/jump.mp3" -> "jump"
   * - "https://example.com/audio.wav?version=1" -> "audio"
   * 
   * Supports both absolute URLs (via URL constructor) and relative URLs
   * (via string parsing). On URL parsing error, uses fallback parsing.
   * 
   * @param {string[]} files - Array of audio file URLs to load
   * @returns {Promise<{audios: Object}>} Promise that resolves with object containing loaded buffers
   * @throws {Error} If loading any file fails (Promise.all will reject)
   * 
   * @example
   * const { audios } = await manager.loadAll(['music.mp3', 'sound.mp3']);
   * // audios = { music: AudioBuffer, sound: AudioBuffer }
   */
  async loadAll(files) {
    const load = (url) => new Promise((resolve) => this.loader.load(url, (buffer) => resolve({ url, buffer })));
    const results = await Promise.all(files.map(load));
    results.forEach(({ url, buffer }) => {
      try {
        const u = new URL(url, window.location.href);
        const file = u.pathname.split('/').pop();
        const name = file.replace(/\.[^.]+$/, '');
        this.buffers[name] = buffer;
      } catch {
        const file = url.split('?')[0].split('#')[0].split('/').pop();
        const name = file.replace(/\.[^.]+$/, '');
        this.buffers[name] = buffer;
      }
    });
    return { audios: { ...this.buffers } };
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
