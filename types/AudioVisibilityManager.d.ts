export declare class AudioVisibilityManager {
  audioContext: AudioContext;
  emptyAudio: HTMLAudioElement;

  constructor(audioContext: AudioContext);

  private createEmptyAudio(): HTMLAudioElement;
  private bindHandlers(): void;
  private attachEnsurePlayingListeners(): void;
  private onUserInteraction(): void;
  private onVisibilityEnsure(): void;
  private createEmptySrc(seconds?: number): string;
  private wireAutoResume(): void;
  private onPagehide(): void;
  private onPageshow(): void;
  private onVisibilityAuto(): void;
}
