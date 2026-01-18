import { AudioContextProvider } from './AudioContextProvider.js';

/**
 * AudioListenerController - central controller for managing the audio system.
 * 
 * This class is the foundation of the entire audio system library. It manages:
 * - AudioContext (via AudioContextProvider)
 * - Master gain node for global volume control
 * - Listener position and orientation in 3D space
 * - Optional filter for all audio sources
 * - Timestamps for smooth transitions
 * 
 * Why it's needed:
 * In Web Audio API, all audio sources must be connected to AudioContext.destination.
 * This class creates an intermediate GainNode that allows:
 * 1. Controlling the overall volume of all sounds with a single parameter
 * 2. Applying filters to the entire audio stream
 * 3. Managing listener position for 3D audio
 * 
 * Why it's structured this way:
 * - Uses AudioContextProvider to get a single context (singleton pattern)
 * - All AudioItem and SpatialAudio connect to getInput(), not directly to destination
 * - Supports both old API (setPosition/setOrientation) and new API (positionX/forwardX)
 * - Uses getEndTime() for smooth transitions when changing position/orientation
 * 
 * @example
 * const listener = new AudioListenerController();
 * listener.setPosition({ x: 0, y: 0, z: 0 });
 * listener.setOrientation({ x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 });
 * listener.setMasterVolume(0.8);
 */
export class AudioListenerController {
  /**
   * Creates a new AudioListenerController.
   * 
   * Initializes AudioContext, creates master gain node and connects it to destination.
   * Also initializes internal variables for time tracking.
   */
  constructor() {
    this.context = AudioContextProvider.context;
    this.gain = this.context.createGain();
    this.gain.connect(this.context.destination);
    this.filter = null;
    this.timeDelta = 0;
    this._lastTime = this.context.currentTime;
  }

  /**
   * Returns the input node (GainNode) that all audio sources should connect to.
   * 
   * All AudioItem and SpatialAudio should connect to this node, not directly to destination.
   * This allows controlling overall volume and applying filters to the entire audio stream.
   * 
   * @returns {GainNode} Master gain node that all audio sources connect to
   */
  getInput() {
    return this.gain;
  }

  /**
   * Updates the internal timeDelta variable.
   * 
   * Used for synchronizing timestamps when changing listener position/orientation.
   * If deltaTime is not specified, it's calculated automatically via getTimeDelta().
   * 
   * @param {number} [deltaTime] - Time delta in seconds. If not specified, calculated automatically
   * @returns {number} Updated timeDelta value
   */
  updateTimeDelta(deltaTime = this.getTimeDelta()) {
    this.timeDelta = deltaTime;
    return this.timeDelta;
  }

  /**
   * Calculates time delta since the last call.
   * 
   * Used for smooth transitions when changing position/orientation.
   * Limits maximum delta to 0.1 seconds to prevent jumps.
   * 
   * @returns {number} Time delta in seconds (maximum 0.1)
   */
  getTimeDelta() {
    const delta = Math.min(this.context.currentTime - this._lastTime, 0.1);
    this._lastTime = this.context.currentTime;
    return delta;
  }

  /**
   * Calculates the end time of the current frame for smooth transitions.
   * 
   * Used when changing listener position/orientation to synchronize all audio parameters
   * to a single point in time. This prevents desynchronization during rapid position changes.
   * 
   * @returns {number} End time of current frame (currentTime + timeDelta)
   */
  getEndTime() {
    this.timeDelta = this.getTimeDelta();
    return this.context.currentTime + this.timeDelta;
  }

  /**
   * Removes the current filter from the audio chain.
   * 
   * Disconnects the filter and restores direct connection gain -> destination.
   * If no filter is set, does nothing.
   * 
   * @returns {AudioListenerController} this for method chaining
   */
  removeFilter() {
    if (this.filter !== null) {
      this.gain.disconnect(this.filter);
      this.filter.disconnect(this.context.destination);
      this.gain.connect(this.context.destination);
      this.filter = null;
    }
    return this;
  }

  /**
   * Returns the current filter if set.
   * 
   * @returns {AudioNode|null} Current filter or null if no filter is set
   */
  getFilter() {
    return this.filter;
  }

  /**
   * Sets a filter in the audio chain.
   * 
   * The filter is inserted between master gain and destination, allowing effects
   * (e.g., reverb, equalizer) to be applied to the entire audio stream.
   * 
   * If a filter is already set, it's first disconnected and replaced with the new one.
   * 
   * @param {AudioNode} value - Filter AudioNode (e.g., BiquadFilterNode, ConvolverNode)
   * @returns {AudioListenerController} this for method chaining
   */
  setFilter(value) {
    if (this.filter !== null) {
      this.gain.disconnect(this.filter);
      this.filter.disconnect(this.context.destination);
    } else {
      this.gain.disconnect(this.context.destination);
    }

    this.filter = value;
    this.gain.connect(this.filter);
    this.filter.connect(this.context.destination);

    return this;
  }

  /**
   * Returns the current master gain volume.
   * 
   * @returns {number} Current volume value (0.0 - 1.0)
   */
  getMasterVolume() {
    return this.gain.gain.value;
  }

  /**
   * Sets master volume for the entire audio system.
   * 
   * Changes volume of all audio sources simultaneously. Uses setTargetAtTime
   * for smooth volume changes without clicks.
   * 
   * @param {number} value - New volume value (0.0 - 1.0, where 1.0 = 100%)
   * @returns {AudioListenerController} this for method chaining
   */
  setMasterVolume(value) {
    this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
    return this;
  }

  /**
   * Sets listener position in 3D space.
   * 
   * Listener position determines where the user "hears" from. Used for calculating
   * 3D positional audio (SpatialAudio). All sounds are calculated relative to this position.
   * 
   * Automatically detects which API to use (old setPosition or new positionX),
   * and uses getEndTime() to synchronize all parameters.
   * 
   * @param {Object} position - Object with position coordinates
   * @param {number} position.x - X coordinate
   * @param {number} position.y - Y coordinate
   * @param {number} position.z - Z coordinate
   * @returns {AudioListenerController} this for method chaining
   */
  setPosition(position) {
    const listener = this.context.listener;
    const { x, y, z } = position;

    if (listener.positionX) {
      const endTime = this.getEndTime();
      listener.positionX.linearRampToValueAtTime(x, endTime);
      listener.positionY.linearRampToValueAtTime(y, endTime);
      listener.positionZ.linearRampToValueAtTime(z, endTime);
    } else {
      listener.setPosition(x, y, z);
    }

    return this;
  }

  /**
   * Sets listener orientation in 3D space.
   * 
   * Orientation determines the listener's "view" direction. Consists of two vectors:
   * - forward: forward direction (where the listener is "looking")
   * - up: upward direction (for determining head rotation)
   * 
   * These vectors should be perpendicular to each other. Orientation affects how
   * sounds are positioned relative to the listener (e.g., a sound on the left will
   * be heard in the left channel).
   * 
   * Automatically detects which API to use (old setOrientation or new forwardX/upX),
   * and uses getEndTime() to synchronize all parameters.
   * 
   * @param {Object} forward - Forward direction vector
   * @param {number} forward.x - X component of forward vector
   * @param {number} forward.y - Y component of forward vector
   * @param {number} forward.z - Z component of forward vector
   * @param {Object} up - Upward direction vector
   * @param {number} up.x - X component of up vector
   * @param {number} up.y - Y component of up vector
   * @param {number} up.z - Z component of up vector
   * @returns {AudioListenerController} this for method chaining
   */
  setOrientation(forward, up) {
    const listener = this.context.listener;
    const { x: forwardX, y: forwardY, z: forwardZ } = forward;
    const { x: upX, y: upY, z: upZ } = up;

    if (listener.forwardX) {
      const endTime = this.getEndTime();
      listener.forwardX.linearRampToValueAtTime(forwardX, endTime);
      listener.forwardY.linearRampToValueAtTime(forwardY, endTime);
      listener.forwardZ.linearRampToValueAtTime(forwardZ, endTime);
      listener.upX.linearRampToValueAtTime(upX, endTime);
      listener.upY.linearRampToValueAtTime(upY, endTime);
      listener.upZ.linearRampToValueAtTime(upZ, endTime);
    } else {
      listener.setOrientation(forwardX, forwardY, forwardZ, upX, upY, upZ);
    }

    return this;
  }
}
