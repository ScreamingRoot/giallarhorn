export declare class AudioContextProvider {
  private static _context: AudioContext | undefined;
  static get context(): AudioContext;
  static set context(value: AudioContext);
}
