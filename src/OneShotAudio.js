import { AudioItem } from './AudioItem.js';
import { SpatialAudio } from './SpatialAudio.js';

/**
 * @typedef {Object} OneShotSpatialOptions
 * @property {{x: number, y: number, z: number}} [position] - 3D position
 * @property {number} [refDistance] - Reference distance
 * @property {number} [maxDistance] - Maximum distance
 * @property {number} [rolloffFactor] - Rolloff factor
 * @property {number} [coneInnerAngle] - Inner cone angle
 * @property {number} [coneOuterAngle] - Outer cone angle
 * @property {number} [coneOuterGain] - Outer cone gain
 */

/**
 * @typedef {Object} OneShotPolicy
 * @property {number} [maxVoices] - Maximum voices per track
 * @property {number} [minInterval] - Minimum interval between same sound (seconds)
 * @property {number} [priority] - Priority (higher = more important)
 * @property {string} [stealStrategy] - Steal strategy ('ignore' | 'stealOldest' | 'stealQuietest')
 * @property {number} [stealFadeMs] - Fade-out duration when stealing (milliseconds)
 * @property {OneShotSpatialOptions} [spatialDefaults] - Default spatial audio settings
 */

/**
 * OneShotAudio - system for managing short, one-time sound effects with voice limiting.
 * 
 * This class provides a high-level system for playing sound effects (like footsteps,
 * gunshots, UI clicks) with automatic voice management. It prevents audio overload by
 * limiting the number of simultaneous sounds and provides strategies for handling
 * overflow (ignore, steal oldest, steal quietest).
 * 
 * Why it's needed:
 * In games and interactive applications, many sound effects can be triggered rapidly.
 * Without voice limiting, this can cause audio overload and performance issues.
 * OneShotAudio manages this by:
 * 1. Limiting total simultaneous sounds (global limit)
 * 2. Limiting sounds per track (per-sound-type limit)
 * 3. Enforcing minimum intervals between same sound
 * 4. Providing steal strategies when limits are reached
 * 
 * Why it's structured this way:
 * - Uses static methods (no instance needed) for global state management
 * - Tracks active voices in Sets/Maps for efficient lookup
 * - Supports per-track policies (different limits for different sounds)
 * - Supports global defaults with per-track overrides
 * - Implements priority system for voice stealing
 * - Uses fade-out when stealing voices to avoid clicks
 * - Supports both global and spatial audio
 * 
 * @example
 * // Initialize
 * OneShotAudio.init({
 *   audioManager: manager,
 *   global: {
 *     maxGlobalVoices: 16,
 *     defaultPolicy: {
 *       maxVoices: 8,
 *       minInterval: 0.02,
 *       stealStrategy: 'stealQuietest'
 *     }
 *   },
 *   tracks: {
 *     footstep: { maxVoices: 3, minInterval: 0.1 },
 *     jump: { maxVoices: 2, minInterval: 0.05 }
 *   }
 * });
 * 
 * // Play sounds
 * OneShotAudio.play('footstep', { volume: 0.8 });
 * OneShotAudio.play('jump', { 
 *   spatial: { position: { x: 5, y: 0, z: -3 } }
 * });
 */
export class OneShotAudio {
  /** @type {AudioContext|null} */
  static context = null;
  /** @type {import('./AudioManager.js').AudioManager|null} */
  static manager = null;

  /**
   * Initializes the OneShotAudio system.
   * 
   * Sets up global configuration and per-track policies. Must be called before
   * using play(). Creates internal data structures for tracking active voices.
   * 
   * @param {Object} config - Configuration object
   * @param {AudioManager} config.audioManager - AudioManager instance to use for loading buffers
   * @param {Object} [config.global={}] - Global configuration
   * @param {number} [config.global.maxGlobalVoices=32] - Maximum total simultaneous sounds
   * @param {Object} [config.global.defaultPolicy={}] - Default policy for all tracks
   * @param {number} [config.global.defaultPolicy.maxVoices=8] - Default max voices per track
   * @param {number} [config.global.defaultPolicy.minInterval=0.02] - Default minimum interval between same sound (seconds)
   * @param {number} [config.global.defaultPolicy.priority=0] - Default priority (higher = more important)
   * @param {string} [config.global.defaultPolicy.stealStrategy='ignore'] - Default steal strategy ('ignore' | 'stealOldest' | 'stealQuietest')
   * @param {number} [config.global.defaultPolicy.stealFadeMs=120] - Default fade-out duration when stealing (milliseconds)
   * @param {Object} [config.tracks={}] - Per-track policies (overrides defaultPolicy)
   */
  static init({ audioManager, global = {}, tracks = {} } = {}) {
    /** @type {import('./AudioManager.js').AudioManager} */
    this.manager = audioManager;
    /** @type {AudioContext} */
    this.context = audioManager.listener.context;
    this.global = {
      maxGlobalVoices: global.maxGlobalVoices ?? 32,
      defaultPolicy: {
        maxVoices: 8,
        minInterval: 0.02,
        priority: 0,
        stealStrategy: 'ignore',
        stealFadeMs: 120,
        ...global.defaultPolicy,
      },
    };
    this.trackPolicies = { ...tracks };
    this.active = new Set();
    this.activeByTrack = new Map();
    this.lastStartAt = new Map();
  }

  /**
   * Gets the effective policy for a track name.
   * 
   * Merges track-specific policy with global default policy, with track policy
   * taking precedence. Used internally to determine limits and behavior.
   * 
   * @param {string} name - Track name
   * @returns {OneShotPolicy} Merged policy object
   */
  static getPolicy(name) {
    const p = this.trackPolicies[name] ?? {};
    const d = this.global.defaultPolicy;
    return {
      maxVoices: p.maxVoices ?? d.maxVoices,
      minInterval: p.minInterval ?? d.minInterval,
      priority: p.priority ?? d.priority,
      stealStrategy: p.stealStrategy ?? d.stealStrategy,
      stealFadeMs: p.stealFadeMs ?? d.stealFadeMs ?? 120,
      spatialDefaults: p.spatialDefaults ?? undefined,
    };
  }

  /**
   * Gets the count of currently active voices.
   * 
   * @param {string} [name] - Optional track name. If provided, returns count for that track only
   * @returns {number} Number of active voices (global or per-track)
   */
  static getActiveCount(name) {
    if (!name) return this.active.size;
    return (this.activeByTrack.get(name) || new Set()).size;
  }

  /**
   * Plays a one-shot sound effect.
   * 
   * Attempts to play a sound with voice limiting and steal strategies applied.
   * Returns null if sound cannot be played (not loaded, interval too short, or
   * limits reached with 'ignore' strategy).
   * 
   * Creates a new AudioItem or SpatialAudio instance, configures it, starts playback,
   * and tracks it until it ends. Automatically cleans up when playback completes.
   * 
   * @param {string} name - Name of the audio file (as loaded in AudioManager)
   * @param {Object} [options={}] - Playback options
   * @param {number} [options.volume] - Volume (0.0 - 1.0)
   * @param {number} [options.playbackRate] - Playback rate multiplier
   * @param {number} [options.detune] - Detune in cents
   * @param {number} [options.priority] - Priority for voice stealing (higher = more important)
   * @param {number} [options.minIntervalOverride] - Override minimum interval for this play
   * @param {number} [options.duration] - Maximum duration to play (stops after this time)
   * @param {Object} [options.spatial] - Spatial audio configuration (enables SpatialAudio)
   * @param {Object} [options.spatial.position] - 3D position {x, y, z}
   * @param {number} [options.spatial.refDistance] - Reference distance
   * @param {number} [options.spatial.maxDistance] - Maximum distance
   * @param {number} [options.spatial.rolloffFactor] - Rolloff factor
   * @param {number} [options.spatial.coneInnerAngle] - Inner cone angle
   * @param {number} [options.spatial.coneOuterAngle] - Outer cone angle
   * @param {number} [options.spatial.coneOuterGain] - Outer cone gain
   * @returns {Object|null} Voice object {name, node, priority} or null if cannot play
   */
  static play(name, options = {}) {
    const buffer = this.manager.buffers[name];
    if (!buffer) return null;

    /** @type {OneShotPolicy} */
    const policy = this.getPolicy(name);
    const now = this.context.currentTime;
    const last = this.lastStartAt.get(name) ?? -Infinity;
    const minInt = options.minIntervalOverride ?? policy.minInterval;
    if (now - last < minInt) return null;

    const trackSet = this.activeByTrack.get(name) || new Set();
    if (!this._ensureCapacity(policy, trackSet, options.priority ?? policy.priority)) return null;

    const isSpatial = !!options.spatial;
    const node = isSpatial ? new SpatialAudio(this.manager.listener) : new AudioItem(this.manager.listener);
    node.setBuffer(buffer);

    if (options.volume !== undefined) node.volume = options.volume;
    if (options.playbackRate !== undefined) node.setPlaybackRate(options.playbackRate);
    if (options.detune !== undefined) node.setDetune(options.detune);

    let desiredPosition = null;
    if (isSpatial) {
      /** @type {SpatialAudio} */
      const spatialNode = node;
      /** @type {OneShotSpatialOptions} */
      const sd = policy.spatialDefaults || {};
      /** @type {OneShotSpatialOptions} */
      const sp = options.spatial || {};
      if (sd.refDistance !== undefined) spatialNode.refDistance = sd.refDistance;
      if (sd.maxDistance !== undefined) spatialNode.maxDistance = sd.maxDistance;
      if (sd.rolloffFactor !== undefined) spatialNode.rolloffFactor = sd.rolloffFactor;
      if (sd.coneInnerAngle !== undefined || sd.coneOuterAngle !== undefined || sd.coneOuterGain !== undefined) {
        spatialNode.setDirectionalCone(sd.coneInnerAngle ?? 360, sd.coneOuterAngle ?? 360, sd.coneOuterGain ?? 0);
      }
      if (sp.refDistance !== undefined) spatialNode.refDistance = sp.refDistance;
      if (sp.maxDistance !== undefined) spatialNode.maxDistance = sp.maxDistance;
      if (sp.rolloffFactor !== undefined) spatialNode.rolloffFactor = sp.rolloffFactor;
      if (sp.coneInnerAngle !== undefined || sp.coneOuterAngle !== undefined || sp.coneOuterGain !== undefined) {
        spatialNode.setDirectionalCone(sp.coneInnerAngle ?? 360, sp.coneOuterAngle ?? 360, sp.coneOuterGain ?? 0);
      }
      if (sp.position) desiredPosition = { x: sp.position.x, y: sp.position.y, z: sp.position.z };
    }

    const voice = { name, node, priority: options.priority ?? policy.priority };
    const handleEnd = () => {
      try { node.disconnect(); } catch (_) {}
      this.active.delete(voice);
      trackSet.delete(voice);
      if (trackSet.size === 0) this.activeByTrack.delete(name);
      if (node.source) node.source.onended = null;
    };

    // Start playback, AudioItem will correctly connect its chain in play()
    node.play();
    // Apply position after start, so SpatialAudio doesn't filter out the call
    if (desiredPosition && isSpatial) {
      /** @type {SpatialAudio} */
      const spatialNode = node;
      spatialNode.setPosition(desiredPosition);
    }
    this.lastStartAt.set(name, now);

    this.active.add(voice);
    trackSet.add(voice);
    this.activeByTrack.set(name, trackSet);

    if (node.source) node.source.onended = handleEnd;

    if (options.duration !== undefined && node.source) {
      const stopAt = this.context.currentTime + Math.max(0, options.duration);
      node.source.stop(stopAt);
    }

    return voice;
  }

  /**
   * Ensures there's capacity to play a new sound.
   * 
   * Checks if global and track limits are reached. If so, attempts to steal a voice
   * based on the steal strategy. Returns false if no capacity can be made available.
   * 
   * Steal strategies:
   * - 'ignore': Don't steal, return false if full
   * - 'stealOldest': Steal the oldest voice (first in track, or first globally)
   * - 'stealQuietest': Steal the voice with lowest priority/volume score
   * 
   * When stealing, applies fade-out to avoid clicks, then stops and cleans up the victim.
   * 
   * @param {Object} policy - Policy object for this track
   * @param {Set} trackSet - Set of active voices for this track
   * @param {number} newPriority - Priority of the new sound
   * @returns {boolean} true if capacity is available, false otherwise
   * @private
   */
  static _ensureCapacity(policy, trackSet, newPriority) {
    const globalFull = this.active.size >= this.global.maxGlobalVoices;
    const trackFull = trackSet.size >= policy.maxVoices;
    if (!globalFull && !trackFull) return true;

    const strategy = policy.stealStrategy;
    if (strategy === 'ignore') return false;

    const pickVictim = () => {
      let victim = null;
      if (strategy === 'stealOldest') {
        victim = trackSet.values().next().value || this.active.values().next().value;
      } else if (strategy === 'stealQuietest') {
        let minScore = Infinity;
        for (const v of this.active) {
          const vol = v.node.volume ?? 1;
          const pr = v.priority ?? 0;
          const score = pr * -1000 + vol;
          if (score < minScore) { minScore = score; victim = v; }
        }
      }
      return victim;
    };

    const victim = pickVictim();
    if (!victim) return false;
    if ((victim.priority ?? 0) > (newPriority ?? 0)) return false;

    // Smooth fade-out before stopping
    const fadeMs = Math.max(0, policy.stealFadeMs || 0);
    const t = this.context.currentTime;
    const stopAt = t + fadeMs / 1000;

    try {
      const g = victim.node.gain?.gain;
      if (g) {
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(0, stopAt);
      }
    } catch (_) {}

    // Free slot immediately so new sound can start
    this.active.delete(victim);
    const vs = this.activeByTrack.get(victim.name);
    if (vs) {
      vs.delete(victim);
      if (vs.size === 0) this.activeByTrack.delete(victim.name);
    }

    // Correct stop and cleanup after fade
    const cleanup = () => {
      try { victim.node.disconnect(); } catch (_) {}
      if (victim.node.source) victim.node.source.onended = null;
    };
    try {
      if (victim.node.source) victim.node.source.onended = cleanup;
      victim.node.stop(stopAt - t > 0 ? stopAt - t : 0);
    } catch (_) {
      cleanup();
    }
    return true;
  }
}
