// src/audio/AudioManager.js

import * as THREE from "three";

export class AudioManager {

  constructor(camera, scene) {

    this.scene = scene;

    this.listener = new THREE.AudioListener();
    camera.add(this.listener); // attach listener to camera

    this.loader = new THREE.AudioLoader();

    this.buffers = {};
    this.pools2D = {};
    this.pools3D = {};
    this.poolIndex = {};

    this.categoryVolumes = {
      sfx: 1,
      ui: 1,
      music: 1
    };

  } // end constructor



  async loadFromManifest(manifest) {

    for (const name in manifest) {

      const config = manifest[name];

      this.buffers[name] = [];
      this.poolIndex[name] = 0;

      // Load all buffers
      for (const file of config.files) {

        const buffer = await this.loader.loadAsync(file);
        this.buffers[name].push(buffer);

      } // end for files



      // Create pools
      if (config.type === "2D") {

        this.pools2D[name] = [];

        for (let i = 0; i < config.poolSize; i++) {

          const audio = new THREE.Audio(this.listener);
          this.pools2D[name].push(audio);

        } // end for poolSize

      } // end if 2D



      if (config.type === "3D") {

        this.pools3D[name] = [];

        for (let i = 0; i < config.poolSize; i++) {

          const audio = new THREE.PositionalAudio(this.listener);
          this.pools3D[name].push(audio);

        } // end for poolSize

      } // end if 3D

    } // end for manifest

  } // end loadFromManifest



  play2D(name, options = {}) {

    if (!this.pools2D[name]) return;

    const pool = this.pools2D[name];
    const index = this.poolIndex[name];

    this.poolIndex[name] = (index + 1) % pool.length;

    const audio = pool[index];

    const buffers = this.buffers[name];
    const randomBuffer = buffers[Math.floor(Math.random() * buffers.length)];

    audio.setBuffer(randomBuffer);

    const categoryVolume = this.categoryVolumes[options.category || "sfx"] ?? 1;
    const finalVolume = (options.volume ?? 1) * categoryVolume;

    audio.setVolume(finalVolume);

    const randomPitch = 0.95 + Math.random() * 0.1;
    audio.setPlaybackRate(randomPitch);

    audio.play();

  } // end play2D



  play3D(name, parentObject, options = {}) {

    if (!this.pools3D[name]) return;
    if (!parentObject) return;

    const pool = this.pools3D[name];
    const index = this.poolIndex[name];

    this.poolIndex[name] = (index + 1) % pool.length;

    const audio = pool[index];

    if (!audio.parent) {
      parentObject.add(audio);
    } // end if attach

    const buffers = this.buffers[name];
    const randomBuffer = buffers[Math.floor(Math.random() * buffers.length)];

    audio.setBuffer(randomBuffer);

    audio.setRefDistance(options.refDistance ?? 5);
    audio.setMaxDistance(options.maxDistance ?? 50);
    audio.setRolloffFactor(options.rolloffFactor ?? 1);

    const categoryVolume = this.categoryVolumes[options.category || "sfx"] ?? 1;
    const finalVolume = (options.volume ?? 1) * categoryVolume;

    audio.setVolume(finalVolume);

    audio.play();

  } // end play3D

} // end class AudioManager