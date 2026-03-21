const fs = require('fs');
const path = process.argv[2];

if (!path) {
  console.error('Usage: node deep_glb_analysis.js <file.glb>');
  process.exit(2);
}

const buf = fs.readFileSync(path);
if (buf.readUInt32LE(0) !== 0x46546C67) {
  console.error('Not a GLB file');
  process.exit(2);
}

const length = buf.readUInt32LE(8);
let offset = 12;
const chunks = [];

while (offset < length) {
  const chunkLength = buf.readUInt32LE(offset);
  offset += 4;
  const chunkType = buf.readUInt32LE(offset);
  offset += 4;
  const chunkData = buf.slice(offset, offset + chunkLength);
  offset += chunkLength;
  chunks.push({ chunkType, chunkLength, chunkData });
}

const jsonChunk = chunks.find(c => c.chunkType === 0x4E4F534A);
if (!jsonChunk) {
  console.error('No JSON chunk');
  process.exit(2);
}

let gltf = null;
try {
  gltf = JSON.parse(jsonChunk.chunkData.toString('utf8'));
} catch (e) {
  console.error('Invalid JSON chunk', e);
  process.exit(2);
}

console.log('=== DEEP GLB ANALYSIS ===\n');

// Find all reference nodes
console.log('=== REFERENCE NODES ===');
(gltf.nodes || []).forEach((n, idx) => {
  if (n.name && (n.name.includes('node_marker') || n.name.includes('__node_marker__'))) {
    console.log(`\nnode[${idx}] name='${n.name}'`);
    console.log(`  has mesh property: ${typeof n.mesh === 'number' ? n.mesh : 'NO'}`);
    console.log(`  has children: ${Array.isArray(n.children) && n.children.length > 0 ? n.children.join(',') : 'NO'}`);
    console.log(`  translation: ${n.translation ? JSON.stringify(n.translation) : 'none'}`);
    console.log(`  scale: ${n.scale ? JSON.stringify(n.scale) : 'none'}`);
    console.log(`  rotation: ${n.rotation ? JSON.stringify(n.rotation) : 'none'}`);
    
    // If has children, check what they contain
    if (Array.isArray(n.children) && n.children.length > 0) {
      n.children.forEach(childIdx => {
        const child = (gltf.nodes || [])[childIdx];
        const hasMesh = typeof child.mesh === 'number';
        console.log(`    child[${childIdx}] name='${child?.name || ''}' isMesh=${hasMesh}`);
      });
    }
  }
});

// Now check for any mesh with extreme scale or that might be invisible
console.log('\n=== MESHES WITH SUSPISCIOUS PROPERTIES ===');
(gltf.meshes || []).forEach((mesh, midx) => {
  console.log(`\nmesh[${midx}] name='${mesh.name || ''}'`);
  (mesh.primitives || []).forEach((prim, pidx) => {
    const mode = prim.mode || 4;
    const modeNames = {0: 'POINTS', 1: 'LINES', 2: 'LINE_LOOP', 3: 'LINE_STRIP', 4: 'TRIANGLES', 5: 'TRIANGLE_STRIP', 6: 'TRIANGLE_FAN'};
    console.log(`  prim[${pidx}] mode=${modeNames[mode]} (${mode})`);
  });
});

// Find nodes with zero scale that might be hidden geometry
console.log('\n=== NODES WITH ZERO/NEAR-ZERO SCALE ===');
let zeroScaleFound = false;
(gltf.nodes || []).forEach((n, idx) => {
  if (n.scale) {
    const isZero = n.scale.every(v => Math.abs(v) < 1e-8);
    const anyZero = n.scale.some(v => Math.abs(v) < 1e-8);
    if (isZero || anyZero) {
      console.log(`node[${idx}] name='${n.name || ''}' scale=${JSON.stringify(n.scale)}`);
      if (typeof n.mesh === 'number') console.log(`  HAS MESH: mesh[${n.mesh}]`);
      zeroScaleFound = true;
    }
  }
});
if (!zeroScaleFound) console.log('None found');

console.log('\n=== ALL MATERIALS ===');
(gltf.materials || []).forEach((m, idx) => {
  console.log(`material[${idx}] name='${m.name || ''}'`);
  if (m.transparency === false) console.log(`  NOT transparent`);
  if (m.alphaMode === 'OPAQUE') console.log(`  alphaMode: OPAQUE`);
});

console.log('\n=== FILE STATISTICS ===');
console.log(`Total nodes: ${(gltf.nodes || []).length}`);
console.log(`Total meshes: ${(gltf.meshes || []).length}`);
console.log(`Total materials: ${(gltf.materials || []).length}`);
const totalPrims = (gltf.meshes || []).reduce((sum, m) => sum + ((m.primitives || []).length), 0);
console.log(`Total primitives: ${totalPrims}`);
