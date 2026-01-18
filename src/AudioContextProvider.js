/**
 * AudioContextProvider - singleton provider for AudioContext instance.
 * 
 * This class provides a single AudioContext instance for the entire library.
 * It implements the singleton pattern to ensure all audio operations use the
 * same AudioContext, which is required for proper audio graph connections.
 * 
 * Why it's needed:
 * Web Audio API requires all audio nodes to belong to the same AudioContext.
 * Without a shared context, nodes cannot be connected to each other. This class
 * ensures that a single context is created and reused throughout the library.
 * 
 * Why it's structured this way:
 * - Uses static properties/methods for singleton pattern (no instance needed)
 * - Lazy initialization - context is created only when first accessed
 * - Supports both standard AudioContext and webkit-prefixed version for compatibility
 * - Allows manual context injection via setter (useful for testing or custom contexts)
 * 
 * @example
 * // Get the shared context
 * const context = AudioContextProvider.context;
 * 
 * // Or inject a custom context (e.g., for testing)
 * AudioContextProvider.context = myCustomContext;
 */
export class AudioContextProvider {

  static _context;

  /**
   * Gets the shared AudioContext instance.
   * 
   * Creates a new AudioContext on first access if one doesn't exist.
   * Supports both standard AudioContext and webkit-prefixed version.
   * 
   * @returns {AudioContext} The shared AudioContext instance
   */
  static get context() {
    if (this._context === undefined) {
      this._context = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this._context;
  }

  /**
   * Sets a custom AudioContext instance.
   * 
   * Allows injecting a custom AudioContext, useful for testing or when
   * you need to use a specific context configuration.
   * 
   * @param {AudioContext} value - Custom AudioContext instance to use
   */
  static set context(value) {
    this._context = value;
  }
}
