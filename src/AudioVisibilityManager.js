/**
 * AudioVisibilityManager - manager for automatic AudioContext management based on page visibility.
 * 
 * This class solves two main problems of Web Audio API in browsers:
 * 1. Browser autoplay policy - requires user interaction to unlock AudioContext
 * 2. Resource saving - suspends AudioContext when page is hidden
 * 
 * Why it's needed:
 * Modern browsers block autoplay audio without user interaction.
 * AudioVisibilityManager:
 * - Creates invisible empty audio element to unlock context
 * - Automatically suspends AudioContext when page is hidden (saves battery/CPU)
 * - Resumes AudioContext when visibility returns or on user interaction
 * 
 * Why it's structured this way:
 * - Uses HTMLAudioElement (not Web Audio API) to bypass autoplay policy
 * - Creates empty WAV file programmatically (data URI) to avoid additional requests
 * - Two separate visibilitychange handlers:
 *   * onVisibilityEnsure - for unlocking context when visibility returns
 *   * onVisibilityAuto - for managing suspend/resume of context
 * - Handles pagehide/pageshow events for correct browser cache behavior
 * - Handles click/touchend for quick unlock on first interaction
 * 
 * Important: This class is optional. If you manage AudioContext manually or work
 * in an environment without browser restrictions (e.g., Node.js), you may not use it.
 * 
 * @example
 * const listener = new AudioListenerController();
 * const visibilityManager = new AudioVisibilityManager(listener.context);
 * // Now AudioContext will be automatically managed based on page visibility
 */
export class AudioVisibilityManager {
  /**
   * Creates a new AudioVisibilityManager.
   * 
   * Initializes empty audio element, binds event handlers and starts tracking
   * page visibility and user interactions.
   * 
   * @param {AudioContext} audioContext - AudioContext to manage
   */
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.emptyAudio = this.createEmptyAudio();
    this.bindHandlers();
    this.attachEnsurePlayingListeners();
    this.wireAutoResume();
  }

  /**
   * Creates invisible empty HTMLAudioElement to unlock AudioContext.
   * 
   * Creates audio element with programmatically generated empty WAV file.
   * This element is used to bypass browser autoplay policy - when user interacts
   * with the page, this element starts playing, which unlocks AudioContext for
   * all subsequent operations.
   * 
   * Element is configured for autoplay and looping, but doesn't actually play
   * sound (empty file). Playback errors are ignored, as the element is only
   * needed to unlock the context.
   * 
   * @returns {HTMLAudioElement} Invisible empty audio element
   */
  createEmptyAudio() {
    const a = new Audio();
    a.src = this.createEmptySrc(1);
    a.loop = true;
    a.preload = "auto";
    a.autoplay = true;
    a.play().catch(() => {});
    return a;
  }

  /**
   * Binds event handlers to this context.
   * 
   * All handlers must be bound via bind(), as they are used as callbacks for
   * addEventListener and lose the this context.
   */
  bindHandlers() {
    this.onUserInteraction = this.onUserInteraction.bind(this);
    this.onVisibilityEnsure = this.onVisibilityEnsure.bind(this);
    this.onPageshow = this.onPageshow.bind(this);
    this.onVisibilityAuto = this.onVisibilityAuto.bind(this);
    this.onPagehide = this.onPagehide.bind(this);
  }

  /**
   * Attaches event listeners for unlocking AudioContext.
   * 
   * Tracks user interactions (clicks, key presses) and page visibility changes.
   * On detecting interaction, attempts to play empty audio element to unlock context.
   */
  attachEnsurePlayingListeners() {
    window.addEventListener("pointerdown", this.onUserInteraction);
    window.addEventListener("keydown", this.onUserInteraction);
    document.addEventListener("visibilitychange", this.onVisibilityEnsure);
  }

  /**
   * User interaction handler.
   * 
   * Called on click or key press. Attempts to play empty audio element if it's paused.
   * This unlocks AudioContext for all subsequent operations.
   * 
   * Errors are ignored, as the element is only needed for unlocking, not for
   * actual sound playback.
   */
  onUserInteraction() {
    if (this.emptyAudio.paused) this.emptyAudio.play().catch(() => {});
  }

  /**
   * Page visibility change handler for context unlocking.
   * 
   * Called when page visibility changes. If page becomes visible, calls
   * onUserInteraction to attempt context unlocking.
   * 
   * This is a separate handler from onVisibilityAuto, as it solves a different
   * task - context unlocking, not managing suspend/resume state.
   */
  onVisibilityEnsure() {
    if (!document.hidden) this.onUserInteraction();
  }

  /**
   * Creates data URI for empty WAV file.
   * 
   * Programmatically generates a valid WAV file that contains only silence.
   * File is created in PCM 16-bit mono format with specified duration.
   * 
   * Used as src for empty audio element. Data URI avoids additional HTTP requests
   * and works offline.
   * 
   * @param {number} [seconds=1] - File duration in seconds
   * @returns {string} Data URI string with base64-encoded WAV file
   */
  createEmptySrc(seconds = 1) {
    const sampleRate = 44100;
    const numSamples = sampleRate * seconds;
    const view = new DataView(new ArrayBuffer(44 + numSamples * 2));
    let o = 0;
    const wStr = s => { for (let i = 0; i < s.length; i++) view.setUint8(o++, s.charCodeAt(i)); };
    const w16 = v => { view.setUint16(o, v, true); o += 2; };
    const w32 = v => { view.setUint32(o, v, true); o += 4; };
    wStr("RIFF"); w32(36 + numSamples * 2); wStr("WAVE");
    wStr("fmt "); w32(16); w16(1); w16(1); w32(sampleRate);
    w32(sampleRate * 2); w16(2); w16(16); wStr("data"); w32(numSamples * 2);
    const bytes = new Uint8Array(view.buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return "data:audio/wav;base64," + btoa(binary);
  }

  /**
   * Attaches event listeners for automatic AudioContext state management.
   * 
   * Tracks pagehide/pageshow events (for browser cache handling) and
   * visibilitychange (for tab visibility tracking). Also handles
   * click/touchend for quick context resume on first interaction.
   */
  wireAutoResume() {
    window.addEventListener("pagehide", this.onPagehide);
    window.addEventListener("pageshow", this.onPageshow);
    document.addEventListener("visibilitychange", this.onVisibilityAuto);
    document.addEventListener("click", this.onPageshow);
    document.addEventListener("touchend", this.onPageshow);
  }

  /**
   * Pagehide event handler (page is hidden/unloaded).
   * 
   * Called when page is unloaded or goes to browser cache.
   * Suspends AudioContext to save resources.
   */
  onPagehide() {
    this.audioContext?.suspend();
  }

  /**
   * Pageshow event handler (page is shown/loaded).
   * 
   * Called when page is shown or loaded from browser cache.
   * Also called on click/tap for quick context resume.
   * Resumes AudioContext if it was suspended.
   */
  onPageshow() {
    if (!this.audioContext) return;
    this.audioContext.resume().then(() => {});
  }

  /**
   * Page visibility change handler for context state management.
   * 
   * Called when tab visibility changes (hidden/shown). Automatically
   * suspends AudioContext when hidden and resumes when shown.
   * 
   * This is a separate handler from onVisibilityEnsure, as it solves a different
   * task - managing suspend/resume state, not context unlocking.
   */
  onVisibilityAuto() {
    if (document.visibilityState === "visible") {
      this.onPageshow();
    } else {
      this.audioContext?.suspend();
    }
  }
}
