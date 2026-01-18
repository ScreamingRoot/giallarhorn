import type { Position, Orientation } from './common';

export declare class AudioListenerController {
  context: AudioContext;
  gain: GainNode;
  filter: AudioNode | null;
  timeDelta: number;
  private _lastTime: number;

  constructor();

  getInput(): GainNode;
  updateTimeDelta(deltaTime?: number): number;
  getTimeDelta(): number;
  getEndTime(): number;
  removeFilter(): this;
  getFilter(): AudioNode | null;
  setFilter(value: AudioNode): this;
  getMasterVolume(): number;
  setMasterVolume(value: number): this;
  setPosition(position: Position): this;
  setOrientation(forward: Orientation, up: Orientation): this;
}
