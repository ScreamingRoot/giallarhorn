import { AudioItem } from './AudioItem.js';

/**
 * SpatialAudio - audio source with 3D spatial positioning.
 * 
 * Extends AudioItem to add 3D positional audio capabilities using PannerNode.
 * Sounds can be positioned in 3D space relative to the listener, with distance-based
 * attenuation and directional cones for realistic spatial audio.
 * 
 * Why it's needed:
 * For immersive audio experiences (games, VR, 3D applications), sounds need to be
 * positioned in 3D space. SpatialAudio provides this functionality by wrapping
 * Web Audio API's PannerNode with a convenient interface.
 * 
 * Why it's structured this way:
 * - Extends AudioItem to inherit all playback control functionality
 * - Uses PannerNode with HRTF (Head-Related Transfer Function) for realistic 3D audio
 * - Overrides output getter to return panner instead of gain (panner is connected to gain)
 * - Supports both old API (setPosition/setOrientation) and new API (positionX/orientationX)
 * - Uses listener.getEndTime() for synchronized position/orientation changes
 * - Special logic in setPosition: skips update if not playing and has playback control
 *   (allows setting position before play, but updates during playback)
 * 
 * @example
 * const listener = new AudioListenerController();
 * const spatial = new SpatialAudio(listener);
 * spatial.setBuffer(audioBuffer);
 * spatial.refDistance = 20;
 * spatial.rolloffFactor = 1;
 * spatial.setPosition({ x: 10, y: 0, z: -5 });
 * spatial.play();
 */
export class SpatialAudio extends AudioItem {
  /**
   * Creates a new SpatialAudio instance.
   * 
   * Initializes PannerNode with HRTF panning model for realistic 3D audio.
   * 
   * @param {AudioListenerController} listener - AudioListenerController instance
   */
  constructor(listener) {
    super(listener);

    this.panner = this.context.createPanner();
    this.panner.panningModel = 'HRTF';
  }

  /**
   * Returns the PannerNode as the output node.
   * 
   * Overrides AudioItem's output getter. The audio chain is:
   * source -> filters -> gain -> panner -> listener
   * 
   * @returns {PannerNode} The PannerNode instance
   */
  get output() {
    return this.panner;
  }

  /**
   * Gets the reference distance for distance-based attenuation.
   * 
   * At this distance, volume is at maximum (1.0). Closer sounds are louder,
   * farther sounds are quieter based on rolloffFactor and distanceModel.
   * 
   * @returns {number} Reference distance in meters
   */
  get refDistance() {
    return this.panner.refDistance;
  }

  /**
   * Sets the reference distance for distance-based attenuation.
   * 
   * @param {number} value - Reference distance in meters
   */
  set refDistance(value) {
    this.panner.refDistance = value;
  }

  /**
   * Gets the rolloff factor for distance-based attenuation.
   * 
   * Higher values mean sound attenuates faster with distance.
   * 
   * @returns {number} Rolloff factor
   */
  get rolloffFactor() {
    return this.panner.rolloffFactor;
  }

  /**
   * Sets the rolloff factor for distance-based attenuation.
   * 
   * @param {number} value - Rolloff factor (typically 0 to 10)
   */
  set rolloffFactor(value) {
    this.panner.rolloffFactor = value;
  }

  /**
   * Gets the distance model for attenuation calculation.
   * 
   * @returns {string} Distance model ('linear', 'inverse', or 'exponential')
   */
  get distanceModel() {
    return this.panner.distanceModel;
  }

  /**
   * Sets the distance model for attenuation calculation.
   * 
   * - 'linear': Linear attenuation
   * - 'inverse': Inverse distance attenuation (realistic)
   * - 'exponential': Exponential attenuation
   * 
   * @param {string} value - Distance model type
   */
  set distanceModel(value) {
    this.panner.distanceModel = value;
  }

  /**
   * Gets the maximum distance for distance-based attenuation.
   * 
   * Beyond this distance, sound volume is clamped to minimum.
   * 
   * @returns {number} Maximum distance in meters
   */
  get maxDistance() {
    return this.panner.maxDistance;
  }

  /**
   * Sets the maximum distance for distance-based attenuation.
   * 
   * @param {number} value - Maximum distance in meters
   */
  set maxDistance(value) {
    this.panner.maxDistance = value;
  }

  /**
   * Sets a directional cone for the sound source.
   * 
   * Creates a directional sound source with inner and outer cones.
   * Sound is full volume inside inner cone, attenuated in outer cone,
   * and at minimum volume outside outer cone.
   * 
   * @param {number} coneInnerAngle - Inner cone angle in degrees (0-360)
   * @param {number} coneOuterAngle - Outer cone angle in degrees (0-360)
   * @param {number} coneOuterGain - Gain outside outer cone (0.0-1.0)
   * @returns {SpatialAudio} this for method chaining
   */
  setDirectionalCone(coneInnerAngle, coneOuterAngle, coneOuterGain) {
    this.panner.coneInnerAngle = coneInnerAngle;
    this.panner.coneOuterAngle = coneOuterAngle;
    this.panner.coneOuterGain = coneOuterGain;
    return this;
  }

  /**
   * Sets the 3D position of the sound source.
   * 
   * Position is relative to the listener's position. Uses smooth ramping
   * for position changes to avoid clicks. If audio has playback control and
   * is not playing, skips the update (allows setting position before play).
   * 
   * Supports both old API (setPosition) and new API (positionX/positionY/positionZ).
   * 
   * @param {Object} position - Position coordinates
   * @param {number} position.x - X coordinate
   * @param {number} position.y - Y coordinate
   * @param {number} position.z - Z coordinate
   * @returns {SpatialAudio} this for method chaining
   */
  setPosition(position) {
    if (this.hasPlaybackControl === true && this.isPlaying === false) return this;

    const panner = this.panner;
    const { x, y, z } = position;

    if (panner.positionX) {
      const endTime = this.listener.getEndTime();
      panner.positionX.linearRampToValueAtTime(x, endTime);
      panner.positionY.linearRampToValueAtTime(y, endTime);
      panner.positionZ.linearRampToValueAtTime(z, endTime);
    } else {
      panner.setPosition(x, y, z);
    }

    return this;
  }

  /**
   * Sets the 3D orientation (direction) of the sound source.
   * 
   * Orientation determines the direction the sound is "facing". Used with
   * directional cones to create directional sound sources. Uses smooth ramping
   * for orientation changes.
   * 
   * Supports both old API (setOrientation) and new API (orientationX/orientationY/orientationZ).
   * 
   * @param {Object} orientation - Orientation vector
   * @param {number} orientation.x - X component of orientation vector
   * @param {number} orientation.y - Y component of orientation vector
   * @param {number} orientation.z - Z component of orientation vector
   * @returns {SpatialAudio} this for method chaining
   */
  setOrientation(orientation) {
    const panner = this.panner;
    const { x, y, z } = orientation;

    if (panner.orientationX) {
      const endTime = this.listener.getEndTime();
      panner.orientationX.linearRampToValueAtTime(x, endTime);
      panner.orientationY.linearRampToValueAtTime(y, endTime);
      panner.orientationZ.linearRampToValueAtTime(z, endTime);
    } else {
      panner.setOrientation(x, y, z);
    }

    return this;
  }

  /**
   * Connects the audio chain with panner node.
   * 
   * Overrides AudioItem.connect() to ensure panner is connected to gain.
   * Audio chain: source -> filters -> gain -> panner -> listener
   * 
   * @returns {SpatialAudio} this for method chaining
   */
  connect() {
    if (!this._connected) {
      this.panner.connect(this.gain);
    }
    return super.connect();
  }

  /**
   * Disconnects the audio chain including panner node.
   * 
   * Overrides AudioItem.disconnect() to also disconnect panner from gain.
   * 
   * @returns {SpatialAudio} this for method chaining
   */
  disconnect() {
    const wasConnected = this._connected;
    super.disconnect();
    if (wasConnected) {
      this.panner.disconnect(this.gain);
    }
    return this;
  }
}
