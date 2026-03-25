// js/props/listOfProps.js
// Centralized reusable prop base definitions
// Scene instances should reference these via { def: "name", ...overrides }
import sounds from "./listOfSounds.js";
import { materials } from "./listOfMaterials.js";



export const PROP_DEFS = {
wall:  {
indestructible:  true,
hp:  9999,
maxHp: 9999,
hitSounds:  sounds.ric	,
texture:  "assets/textures/blue.png"
},
tile: {
hp:  9999,
maxHp:  9999,
indestructible:  true,
hitSounds:  sounds.ric	
},
  // -------------------------------------------------
  // Wooden crate (low cover, destructible)
  // -------------------------------------------------
  crate_wood: {
    type: "crate",

    size: { x: 1, y: 1, z: 1 },

    hp: 8,
    maxHp: 8,

    coverType: "low",
material:  materials.planks01,

    hitSounds: [
      "assets/sfx/props/crate_hit1.ogg"
    ],

    deathSounds: [
      "assets/sfx/props/crate_break.ogg"
    ],

    deathAction: "break"

  }, // end crate_wood



  // -------------------------------------------------
  // Explosive metal barrel (prefab-based)
  // -------------------------------------------------
  barrel_explosive: {
    type: "prefab",
    prefab: "metal_barrel",

    hp: 12,
    maxHp: 12,

    coverType: "low",

    explosion: {
      blastRadius: 5,
      maxDamage: 40,
      explosionSounds: [
        "/assets/sfx/explosions/explosion_2a.ogg",
        "/assets/sfx/explosions/explosion_2a.ogg"
      ]
    }, // end explosion

    material: {
      side: "assets/props/explosive_barrel_side.png",
      top: "assets/props/test.png",
      bottom: "assets/props/explosive_barrel_side.png",
      roughness: 0.75,
      metalness: 0.2
    }, // end material

    hitSounds: [
      "assets/sfx/props/metalHit1.ogg",
      "assets/sfx/props/metalHit2.ogg"
    ],

    deathSounds: [
      "assets/sfx/props/metal_break.ogg"
    ],

    deathAction: "break"

  } // end barrel_explosive

}; // end PROP_DEFS
