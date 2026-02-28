// src/audio/audioManifest.js

export const AUDIO_MANIFEST = {

  pistolFire: {
    category: "sfx",
    type: "2D",
    poolSize: 5,
    files: [
      "/assets/sfx/weapons/pistol_fire.ogg"
      //"/assets/sfx/pistol2.ogg"
    ]
  },
shotgunFire: {
    category: "sfx",
    type: "2D",
    poolSize: 5,
    files: [
      "/assets/sfx/weapons/shotgun_fire.ogg"
      //"/assets/sfx/pistol2.ogg"
    ]
  },
  
  assaultFire: {
    category: "sfx",
    type: "2D",
    poolSize: 10,
    files: [
      "/assets/sfx/weapons/assault_fire.ogg"
      //"/assets/sfx/pistol2.ogg"
    ]
  },
  
  rocketFire: {
    category: "sfx",
    type: "2D",
    poolSize: 5,
    files: [
      "/assets/sfx/weapons/rocket_fire.ogg"
      //"/assets/sfx/pistol2.ogg"
    ]
  },
  sniperFire: {
    category: "sfx",
    type: "2D",
    poolSize: 3,
    files: [
      "/assets/sfx/weapons/sniper_fire.ogg"
    ]
  },

  metalImpact: {
    category: "sfx",
    type: "3D",
    poolSize: 10,
    files: [
      "/assets/sfx/ricMetal1.ogg",
      "/assets/sfx/ricMetal2.ogg",
      "/assets/sfx/ricMetal3.ogg"
    ]
  },

  //fleshImpact: {
//    category: "sfx",
    //type: "3D",
    //poolSize: 6,
    //files: [
//      "/assets/sfx/flesh1.ogg",
      //"/assets/sfx/flesh2.ogg"
    //]
//  },

//  explosion: {
    //category: "sfx",
    //type: "3D",
    //poolSize: 4,
    //files: [
//      "/assets/sfx/explosion1.ogg"
    //]
  //},

  uiClick: {
    category: "ui",
    type: "2D",
    poolSize: 2,
    files: [
      "/assets/sfx/click.ogg"
    ]
  }

}; // end AUDIO_MANIFEST