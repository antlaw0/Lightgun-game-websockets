// materials.js
const materials = {};

// Bricks material
materials.bricks01 = {
  horizontalRepeat: 25,
  verticalRepeat: 16,
  baseColorMap: "assets/textures/bricks01/basecolor.png",
  normalMap: "assets/textures/bricks01/normal.png",
  ormMap: "assets/textures/bricks01/orm.png",
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
  baseColorMap: "assets/textures/rock01/basecolor.png",
  normalMap: "assets/textures/rock01/normal.png",
  ormMap: "assets/textures/rock01/orm.png",
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
  baseColorMap: "assets/textures/concrete01/basecolor.png",
  normalMap: "assets/textures/concrete01/normal.png",
  ormMap: "assets/textures/concrete01/orm.png",
  roughness: 0.75,
  metalness: 0.0,
  color: 0xffffff,
  transparent: false,
  opacity: 1.0,
  emissive: 0x000000
}; // closes ceiling





export { materials }; // ES6 module export