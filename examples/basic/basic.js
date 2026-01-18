import * as HORN from '../../src/index.js';

class ExampleApp {
  constructor() {
    this.listener = new HORN.AudioListenerController();
    this.visibilityManager = new HORN.AudioVisibilityManager(this.listener.context);
    this.manager = new HORN.AudioManager(this.listener);
    this.globalAudio = null;
    this.spatialAudio = null;

    this.attachUI();
    this.listener.setPosition({ x: 0, y: 0, z: 0 });
    this.listener.setOrientation({ x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 });
  }

  loadAll = async (files) => this.manager.loadAll(files);

  createAudio = (name, config = {}) => this.manager.get(name, config, config.type === 'spatial');

  init = () => {
    if (this.manager.has('music')) {
      this.globalAudio = this.createAudio('music', { loop: true, volume: 0.5 });
    }
    if (this.manager.has('walk')) {
      this.spatialAudio = this.createAudio('walk', { type: 'spatial', loop: true, volume: 1.0, refDistance: 20, rolloffFactor: 1, distanceModel: 'inverse', position: { x: 0, y: 0, z: -10 } });
    }

    HORN.OneShotAudio.init({
      audioManager: this.manager,
      global: { maxGlobalVoices: 16, defaultPolicy: { maxVoices: 8, minInterval: 0.02, priority: 0, stealStrategy: 'ignore', stealFadeMs: 120 } },
      tracks: {
        chicken: { maxVoices: 3, minInterval: 0.05, stealStrategy: 'stealQuietest' },
        jump: { maxVoices: 3, minInterval: 0.05, stealStrategy: 'stealQuietest' },
      }
    });
  };

  attachUI = () => {
    if (!document.getElementById('playMusic')) {
      document.addEventListener('DOMContentLoaded', () => this.attachUI(), { once: true });
      return;
    }
    document.getElementById('playMusic').addEventListener('click', () => {
      if (this.globalAudio && !this.globalAudio.isPlaying) this.globalAudio.play();
    });
    document.getElementById('pauseMusic').addEventListener('click', () => {
      if (this.globalAudio && this.globalAudio.isPlaying) this.globalAudio.pause();
    });
    document.getElementById('stopMusic').addEventListener('click', () => {
      if (this.globalAudio) this.globalAudio.stop();
    });
    document.getElementById('musicVolume').addEventListener('input', (e) => {
      if (this.globalAudio) this.globalAudio.volume = e.target.value / 100;
    });
    document.getElementById('playPositional').addEventListener('click', () => {
      if (this.spatialAudio && !this.spatialAudio.isPlaying) this.spatialAudio.play();
    });
    document.getElementById('stopPositional').addEventListener('click', () => {
      if (this.spatialAudio) this.spatialAudio.stop();
    });
    document.getElementById('oneShotChicken').addEventListener('click', () => {
      if (!HORN.OneShotAudio.manager) return;
      if (this.manager.has('chicken')) {
        HORN.OneShotAudio.play('chicken', { spatial: { position: {
          x: (Math.random() - .5) * 10,
          y: (Math.random() - .5) * 10,
          z: (Math.random() - .5) * 10
        } } });
      }
    });
    document.getElementById('oneShotJump').addEventListener('click', () => {
      if (!HORN.OneShotAudio.manager) return;
      if (this.manager.has('jump')) {
        HORN.OneShotAudio.play('jump', { spatial: { position: {
          x: (Math.random() - .5) * 10,
          y: (Math.random() - .5) * 10,
          z: (Math.random() - .5) * 10
        } } });
      }
    });
    const updatePosition = () => {
      const x = parseFloat(document.getElementById('posX').value);
      const y = parseFloat(document.getElementById('posY').value);
      const z = parseFloat(document.getElementById('posZ').value);
      if (this.spatialAudio) this.spatialAudio.setPosition({ x, y, z });
      document.getElementById('xValue').textContent = x;
      document.getElementById('yValue').textContent = y;
      document.getElementById('zValue').textContent = z;
    };
    document.getElementById('posX').addEventListener('input', updatePosition);
    document.getElementById('posY').addEventListener('input', updatePosition);
    document.getElementById('posZ').addEventListener('input', updatePosition);
    document.getElementById('masterVolume').addEventListener('input', (e) => {
      const value = e.target.value / 100;
      this.listener.setMasterVolume(value);
      document.getElementById('masterValue').textContent = e.target.value;
    });
  };
}

const app = new ExampleApp();
app.attachUI();
app.loadAll(['music.mp3', 'chicken.mp3', 'jump.mp3', 'walk.mp3']).then(() => app.init());
