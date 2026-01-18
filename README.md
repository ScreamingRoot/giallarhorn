# Giallarhorn

Modern JavaScript library for Web Audio API. Based on Three.js audio system.

## Features

- 3D spatial audio
- Global audio
- OneShot sounds with voice management
- Automatic page visibility management
- TypeScript support
- Modern ES2020+ code without transpilation

## Installation

```bash
npm install giallarhorn
```

## Usage

```javascript
import * as HORN from 'giallarhorn';

// Create listener
const listener = new HORN.AudioListenerController();
const visibilityManager = new HORN.AudioVisibilityManager(listener.context);

// Create audio manager
const manager = new HORN.AudioManager(listener);

// Load audio files
await manager.loadAll(['music.mp3', 'sound.mp3']);

// Global audio
const music = manager.get('music', { loop: true, volume: 0.5 });
music.play();

// Spatial audio
const spatial = manager.get('sound', {
  loop: true,
  volume: 1.0,
  refDistance: 20,
  rolloffFactor: 1,
  distanceModel: 'inverse',
  position: [0, 0, -10]
}, true);
spatial.play();
spatial.setPosition({ x: 10, y: 0, z: -5 });

// OneShot audio
HORN.OneShotAudio.init({
  audioManager: manager,
  global: {
    maxGlobalVoices: 16,
    defaultPolicy: {
      maxVoices: 8,
      minInterval: 0.02,
      priority: 0,
      stealStrategy: 'ignore',
      stealFadeMs: 120
    }
  },
  tracks: {
    sound: {
      maxVoices: 3,
      minInterval: 0.05,
      stealStrategy: 'stealQuietest'
    }
  }
});

HORN.OneShotAudio.play('sound', {
  volume: 1.0,
  spatial: {
    position: { x: 5, y: 0, z: -5 }
  }
});
```

## Examples

See `examples/` folder for usage examples.

## API

### AudioListenerController

Audio listener controller.

- `setPosition(position)` - set listener position
- `setOrientation(forward, up)` - set listener orientation
- `setMasterVolume(value)` - set master volume

### AudioManager

Manager for loading and managing audio resources.

- `loadAll(files)` - load array of audio files
- `has(name)` - check if file is loaded
- `get(name, config, spatial)` - get audio instance

### AudioItem

Base class for audio elements.

- `play(delay)` - play
- `pause()` - pause
- `stop(delay)` - stop
- `volume` - volume

### SpatialAudio

Spatial audio (extends AudioItem).

- `setPosition(position)` - set position in 3D space
- `setOrientation(orientation)` - set orientation
- `refDistance` - reference distance
- `rolloffFactor` - rolloff factor
- `distanceModel` - distance model ('linear', 'inverse', 'exponential')

### OneShotAudio

Static class for one-shot sound playback.

- `init(config)` - initialize
- `play(name, options)` - play sound
- `getActiveCount(name)` - get active voice count

## TypeScript

Library is fully typed. Types are located in `types/` folder.

## License

MIT
