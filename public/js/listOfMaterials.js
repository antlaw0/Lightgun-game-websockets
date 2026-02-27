// materials.js
const materials = {};

// Bricks material
materials.bricks01 = {
  horizontalRepeat: 25,
  verticalRepeat: 16,
  map: "assets/textures/bricks01/bricks01Color.png",
  normalMap: "assets/textures/bricks01/bricks01Normal.png",
  roughnessMap: "assets/textures/bricks01/bricks01Roughness.png",
  aoMap: "assets/textures/bricks01/bricks01AO.png",
  roughness: 0.75,
  metalness: 0.0,
  color: 0xffffff,
  transparent: false,
  opacity: 1.0,
  emissive: 0x000000
};
materials.rock01 = {
  horizontalRepeat: 10,
  verticalRepeat: 15,
  map: "assets/textures/rock01/rock01Color.png",
  normalMap: "assets/textures/rock01/rock01Normal.png",
  roughnessMap: "assets/textures/rock01/rock01Roughness.png",
  aoMap: "assets/textures/rock01/rock01AO.png",
  roughness: 0.75,
  metalness: 0.0,
  color: 0xffffff,
  transparent: false,
  opacity: 1.0,
  emissive: 0x000000
}; // closes ceiling

materials.concrete01 = {
  horizontalRepeat: 10,
  verticalRepeat: 15,
  map: "assets/textures/concrete01/concrete01Color.png",
  normalMap: "assets/textures/concrete01/concrete01Normal.png",
  roughnessMap: "assets/textures/concrete01/concrete01Roughness.png",
  aoMap: "assets/textures/concrete01/concrete01AO.png",
  roughness: 0.75,
  metalness: 0.0,
  color: 0xffffff,
  transparent: false,
  opacity: 1.0,
  emissive: 0x000000
}; // closes ceiling





export { materials }; // ES6 module export