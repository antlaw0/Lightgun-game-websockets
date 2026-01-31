// listOfSounds.js

const basePath = "assets/sfx/";

const sounds = {
  // Projectile impact (ricochet) sounds
  ric: [
    basePath + "ric1.ogg",
    basePath + "ric2.ogg",
    basePath + "ric3.ogg",
    basePath + "ric4.ogg",
    basePath + "ric5.ogg"
  ],

  // Example: flesh impact sounds
  flesh: [
    basePath + "flesh1.ogg",
    basePath + "flesh2.ogg",
    basePath + "flesh3.ogg"
  ],

  // Example: environment impacts
  metal: [
    basePath + "metal1.ogg",
    basePath + "metal2.ogg"
  ]
}; // closes sounds object

export default sounds;
