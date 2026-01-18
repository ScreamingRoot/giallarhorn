/**
 * AudioItem - base class for audio playback with full control.
 * 
 * This class provides a high-level interface for playing audio in Web Audio API.
 * It supports multiple source types (buffer, audio node, media element, media stream)
 * and provides playback control (play, pause, stop) with volume, pitch, and filtering.
 * 
 * Why it's needed:
 * Web Audio API is low-level and requires manual management of audio nodes, connections,
 * and timing. AudioItem wraps this complexity and provides a simple, intuitive API
 * similar to HTMLAudioElement but with more control and flexibility.
 * 
 * Why it's structured this way:
 * - Supports multiple source types via setBuffer/setNodeSource/setMediaElementSource/setMediaStreamSource
 * - Tracks playback state (isPlaying, _progress) for pause/resume functionality
 * - Uses hasPlaybackControl flag to distinguish between controllable sources (buffer)
 *   and non-controllable sources (media element, stream)
 * - Maintains filter chain between source and output for audio effects
 * - Tracks connection state (_connected) to avoid double-connecting/disconnecting
 * - Uses getter/setter for volume to provide smooth transitions via setTargetAtTime
 * 
 * @example
 * const listener = new AudioListenerController();
 * const audio = new AudioItem(listener);
 * audio.setBuffer(audioBuffer);
 * audio.volume = 0.5;
 * audio.loop = true;
 * audio.play();
 */
export class AudioItem {
  /**
   * Creates a new AudioItem.
   * 
   * Initializes audio node chain: creates gain node and connects it to listener.
   * Sets up default values for all playback properties.
   * 
   * @param {AudioListenerController} listener - AudioListenerController instance to connect to
   */
  constructor(listener) {
    this.listener = listener;
    this.context = listener.context;
    this.gain = this.context.createGain();
    this.gain.connect(listener.getInput());

    this.autoplay = false;
    this.buffer = null;
    this.detune = 0;
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.offset = 0;
    this.duration = undefined;
    this.playbackRate = 1;
    this.isPlaying = false;
    this.hasPlaybackControl = true;
    this.source = null;
    this.sourceType = 'empty';
    this.filters = [];

    this._startedAt = 0;
    this._progress = 0;
    this._connected = false;
  }

  /**
   * Returns the output node of this audio item.
   * 
   * This is the node that should be connected to other audio nodes or effects.
   * For AudioItem, this is the gain node. Subclasses (like SpatialAudio) may
   * override this to return a different node (e.g., PannerNode).
   * 
   * @returns {GainNode} The output audio node
   */
  get output() {
    return this.gain;
  }

  /**
   * Sets an AudioNode as the audio source.
   * 
   * Connects an existing AudioNode (e.g., OscillatorNode, MediaStreamAudioSourceNode)
   * as the source. This disables playback control (play/pause/stop) since the source
   * is managed externally.
   * 
   * @param {AudioNode} audioNode - AudioNode to use as source
   * @returns {AudioItem} this for method chaining
   */
  setNodeSource(audioNode) {
    this.hasPlaybackControl = false;
    this.sourceType = 'audioNode';
    this.source = audioNode;
    this.connect();
    return this;
  }

  /**
   * Sets an HTMLMediaElement (audio/video) as the audio source.
   * 
   * Creates a MediaElementAudioSourceNode from the provided element.
   * Playback is controlled via the media element's play/pause methods, not
   * through AudioItem's play/pause methods.
   * 
   * @param {HTMLMediaElement} mediaElement - Audio or video element to use as source
   * @returns {AudioItem} this for method chaining
   */
  setMediaElementSource(mediaElement) {
    this.hasPlaybackControl = false;
    this.sourceType = 'mediaNode';
    this.source = this.context.createMediaElementSource(mediaElement);
    this.connect();
    return this;
  }

  /**
   * Sets a MediaStream as the audio source.
   * 
   * Creates a MediaStreamAudioSourceNode from the provided stream (e.g., from
   * getUserMedia). Playback is controlled by the stream itself, not through
   * AudioItem's play/pause methods.
   * 
   * @param {MediaStream} mediaStream - MediaStream to use as source
   * @returns {AudioItem} this for method chaining
   */
  setMediaStreamSource(mediaStream) {
    this.hasPlaybackControl = false;
    this.sourceType = 'mediaStreamNode';
    this.source = this.context.createMediaStreamSource(mediaStream);
    this.connect();
    return this;
  }

  /**
   * Sets an AudioBuffer as the audio source.
   * 
   * This enables full playback control (play/pause/stop). If autoplay is enabled,
   * playback starts immediately after setting the buffer.
   * 
   * @param {AudioBuffer} audioBuffer - AudioBuffer to use as source
   * @returns {AudioItem} this for method chaining
   */
  setBuffer(audioBuffer) {
    this.buffer = audioBuffer;
    this.sourceType = 'buffer';
    if (this.autoplay) this.play();
    return this;
  }

  /**
   * Starts playback of the audio.
   * 
   * Creates a new AudioBufferSourceNode and starts playback. If already playing,
   * does nothing. Resumes from the last pause position if paused, or from offset
   * if starting fresh.
   * 
   * @param {number} [delay=0] - Delay in seconds before starting playback
   * @returns {AudioItem} this for method chaining
   */
  play(delay = 0) {
    if (this.isPlaying === true) {
      console.warn('Audio is already playing.');
      return;
    }

    if (this.hasPlaybackControl === false) {
      console.warn('This Audio has no playback control.');
      return;
    }

    this._startedAt = this.context.currentTime + delay;

    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.loop = this.loop;
    source.loopStart = this.loopStart;
    source.loopEnd = this.loopEnd;
    source.onended = this.onEnded.bind(this);
    source.start(this._startedAt, this._progress + this.offset, this.duration);

    this.isPlaying = true;
    this.source = source;

    this.setDetune(this.detune);
    this.setPlaybackRate(this.playbackRate);

    return this.connect();
  }

  /**
   * Pauses playback of the audio.
   * 
   * Stops the current playback but preserves the playback position. Calling play()
   * again will resume from this position. Calculates progress based on elapsed
   * time and playback rate.
   * 
   * @returns {AudioItem} this for method chaining
   */
  pause() {
    if (this.hasPlaybackControl === false) {
      console.warn('This Audio has no playback control.');
      return;
    }

    if (this.isPlaying === true) {
      this._progress += Math.max(this.context.currentTime - this._startedAt, 0) * this.playbackRate;

      if (this.loop === true) {
        this._progress = this._progress % (this.duration || this.buffer.duration);
      }

      this.source.stop();
      this.source.onended = null;
      this.isPlaying = false;
    }

    return this;
  }

  /**
   * Stops playback and resets position to the beginning.
   * 
   * Stops playback and resets progress to 0. Unlike pause(), this doesn't preserve
   * playback position - next play() will start from the beginning (or offset).
   * 
   * @param {number} [delay=0] - Delay in seconds before stopping
   * @returns {AudioItem} this for method chaining
   */
  stop(delay = 0) {
    if (this.hasPlaybackControl === false) {
      console.warn('This Audio has no playback control.');
      return;
    }

    this._progress = 0;

    if (this.source !== null) {
      this.source.stop(this.context.currentTime + delay);
      this.source.onended = null;
    }

    this.isPlaying = false;
    return this;
  }

  /**
   * Connects the audio source to the output through the filter chain.
   * 
   * Establishes the audio graph: source -> filters -> output. If filters are set,
   * connects them in sequence. Otherwise, connects source directly to output.
   * 
   * @returns {AudioItem} this for method chaining
   */
  connect() {
    if (this.filters.length > 0) {
      this.source.connect(this.filters[0]);

      for (let i = 1, l = this.filters.length; i < l; i++) {
        this.filters[i - 1].connect(this.filters[i]);
      }

      this.filters[this.filters.length - 1].connect(this.output);
    } else {
      this.source.connect(this.output);
    }

    this._connected = true;
    return this;
  }

  /**
   * Disconnects the audio source from the output.
   * 
   * Removes all connections in the audio graph. If filters are set, disconnects
   * them in sequence. Does nothing if already disconnected.
   * 
   * @returns {AudioItem} this for method chaining
   */
  disconnect() {
    if (this._connected === false) {
      return;
    }

    if (this.filters.length > 0) {
      this.source.disconnect(this.filters[0]);

      for (let i = 1, l = this.filters.length; i < l; i++) {
        this.filters[i - 1].disconnect(this.filters[i]);
      }

      this.filters[this.filters.length - 1].disconnect(this.output);
    } else {
      this.source.disconnect(this.output);
    }

    this._connected = false;
    return this;
  }

  /**
   * Gets the list of audio filters.
   * 
   * @returns {AudioNode[]} Array of filter nodes
   */
  get filtersList() {
    return this.filters;
  }

  /**
   * Sets the list of audio filters.
   * 
   * Replaces all filters with the new list. If audio is connected, disconnects
   * and reconnects with the new filter chain.
   * 
   * @param {AudioNode[]} value - Array of filter nodes to apply
   */
  set filtersList(value) {
    const next = value ? value.slice() : [];
    if (this._connected === true) {
      this.disconnect();
      this.filters = next;
      this.connect();
    } else {
      this.filters = next;
    }
  }

  /**
   * Sets the detune value (pitch adjustment) in cents.
   * 
   * Positive values increase pitch, negative values decrease pitch.
   * 100 cents = 1 semitone. Applied smoothly if audio is currently playing.
   * 
   * @param {number} value - Detune value in cents (-1200 to 1200)
   * @returns {AudioItem} this for method chaining
   */
  setDetune(value) {
    this.detune = value;

    if (this.isPlaying === true && this.source.detune !== undefined) {
      this.source.detune.setTargetAtTime(this.detune, this.context.currentTime, 0.01);
    }

    return this;
  }

  /**
   * Gets the current detune value.
   * 
   * @returns {number} Current detune value in cents
   */
  getDetune() {
    return this.detune;
  }

  /**
   * Gets the first filter in the filter chain.
   * 
   * Convenience method for accessing a single filter. Returns undefined if no filters.
   * 
   * @returns {AudioNode|undefined} First filter node or undefined
   */
  getFilter() {
    return this.filters[0];
  }

  /**
   * Sets a single filter (replaces all existing filters).
   * 
   * Convenience method for setting a single filter. Pass null to remove all filters.
   * 
   * @param {AudioNode|null} filter - Filter node to set, or null to remove all filters
   * @returns {AudioItem} this for method chaining
   */
  setFilter(filter) {
    return this.setFilters(filter ? [filter] : []);
  }

  /**
   * Sets multiple filters in sequence.
   * 
   * Replaces all existing filters. Filters are applied in order: source -> filter[0] -> filter[1] -> ... -> output
   * 
   * @param {AudioNode[]} value - Array of filter nodes to apply in sequence
   * @returns {AudioItem} this for method chaining
   */
  setFilters(value) {
    if (!value) value = [];

    if (this._connected === true) {
      this.disconnect();
      this.filters = value.slice();
      this.connect();
    } else {
      this.filters = value.slice();
    }

    return this;
  }

  /**
   * Sets the playback rate (speed multiplier).
   * 
   * 1.0 = normal speed, 2.0 = double speed, 0.5 = half speed.
   * Applied smoothly if audio is currently playing.
   * 
   * @param {number} value - Playback rate multiplier (typically 0.25 to 4.0)
   * @returns {AudioItem} this for method chaining
   */
  setPlaybackRate(value) {
    if (this.hasPlaybackControl === false) {
      console.warn('This Audio has no playback control.');
      return;
    }

    this.playbackRate = value;

    if (this.isPlaying === true) {
      this.source.playbackRate.setTargetAtTime(this.playbackRate, this.context.currentTime, 0.01);
    }

    return this;
  }

  /**
   * Gets the current playback rate.
   * 
   * @returns {number} Current playback rate
   */
  getPlaybackRate() {
    return this.playbackRate;
  }

  /**
   * Called when audio playback ends naturally.
   * 
   * Internal callback for AudioBufferSourceNode.onended event.
   * Resets playback state.
   */
  onEnded() {
    this.isPlaying = false;
    this._progress = 0;
  }

  /**
   * Gets the loop state.
   * 
   * @returns {boolean} true if looping is enabled, false otherwise
   */
  getLoop() {
    if (this.hasPlaybackControl === false) {
      console.warn('This Audio has no playback control.');
      return false;
    }
    return this.loop;
  }

  /**
   * Sets whether audio should loop.
   * 
   * When enabled, audio restarts from loopStart when it reaches loopEnd.
   * Applied immediately if audio is currently playing.
   * 
   * @param {boolean} value - true to enable looping, false to disable
   * @returns {AudioItem} this for method chaining
   */
  setLoop(value) {
    if (this.hasPlaybackControl === false) {
      console.warn('This Audio has no playback control.');
      return;
    }

    this.loop = value;

    if (this.isPlaying === true) {
      this.source.loop = this.loop;
    }

    return this;
  }

  /**
   * Sets the start position of the loop in seconds.
   * 
   * When looping, playback restarts from this position.
   * 
   * @param {number} value - Loop start time in seconds
   * @returns {AudioItem} this for method chaining
   */
  setLoopStart(value) {
    this.loopStart = value;
    return this;
  }

  /**
   * Sets the end position of the loop in seconds.
   * 
   * When looping, playback restarts from loopStart when reaching this position.
   * 
   * @param {number} value - Loop end time in seconds
   * @returns {AudioItem} this for method chaining
   */
  setLoopEnd(value) {
    this.loopEnd = value;
    return this;
  }

  /**
   * Gets the current volume.
   * 
   * @returns {number} Current volume (0.0 - 1.0)
   */
  get volume() {
    return this.gain.gain.value;
  }

  /**
   * Sets the volume.
   * 
   * Changes volume smoothly using setTargetAtTime to avoid clicks.
   * 
   * @param {number} value - Volume level (0.0 - 1.0, where 1.0 = 100%)
   */
  set volume(value) {
    this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
  }
}
