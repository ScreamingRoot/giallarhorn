import type { AudioItem } from './AudioItem';
import type { AudioListenerController } from './AudioListenerController';
import type { Position, Orientation, DistanceModelType } from './common';

export declare class SpatialAudio extends AudioItem {
  panner: PannerNode;

  constructor(listener: AudioListenerController);

  get output(): PannerNode;
  get refDistance(): number;
  set refDistance(value: number);
  get rolloffFactor(): number;
  set rolloffFactor(value: number);
  get distanceModel(): DistanceModelType;
  set distanceModel(value: DistanceModelType);
  get maxDistance(): number;
  set maxDistance(value: number);

  setDirectionalCone(coneInnerAngle: number, coneOuterAngle: number, coneOuterGain: number): this;
  setPosition(position: Position): this;
  setOrientation(orientation: Orientation): this;
  connect(): this;
  disconnect(): this;
}
