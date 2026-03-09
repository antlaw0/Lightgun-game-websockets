// materials.js
const materials = {};

// Bricks material
materials.bricks01 = {
  horizontalRepeat: 25,
  verticalRepeat: 16,
  baseColorMap: "assets/textures/bricks01/basecolor.ktx2",
  normalMap: "assets/textures/bricks01/normal.ktx2",
  ormMap: "assets/textures/bricks01/orm.ktx2",
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
  baseColorMap: "assets/textures/rock01/basecolor.ktx2",
  normalMap: "assets/textures/rock01/normal.ktx2",
  ormMap: "assets/textures/rock01/orm.ktx2",
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
  baseColorMap: "assets/textures/concrete01/basecolor.ktx2",
  normalMap: "assets/textures/concrete01/normal.ktx2",
  ormMap: "assets/textures/concrete01/orm.ktx2",
  roughness: 0.75,
  metalness: 0.0,
  color: 0xffffff,
  transparent: false,
  opacity: 1.0,
  emissive: 0x000000
}; // closes ceiling





export { materials }; // ES6 module export