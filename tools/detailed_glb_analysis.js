const fs = require('fs');
const path = process.argv[2];

if (!path) {
  console.error('Usage: node detailed_glb_analysis.js <file.glb>');
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

console.log('=== DETAILED GLB ANALYSIS ===\n');
console.log(`Meshes: ${(gltf.meshes || []).length}`);
(gltf.meshes || []).forEach((mesh, mi) => {
  console.log(`  mesh[${mi}] name='${mesh.name || ''}'`);
  (mesh.primitives || []).forEach((p, pi) => {
    console.log(`    prim[${pi}] mode=${p.mode || 0} material=${p.material}`);
  });
});

console.log(`\nNodes: ${(gltf.nodes || []).length}`);
function printNode(ni, depth = 0) {
  const n = (gltf.nodes || [])[ni];
  if (!n) return;
  const indent = '  '.repeat(depth);
  const hasMesh = typeof n.mesh === 'number';
  const meshInfo = hasMesh ? ` mesh=${n.mesh}` : '';
  const childrenInfo = Array.isArray(n.children) && n.children.length > 0 ? ` children=${n.children.length}` : '';
  
  console.log(`${indent}node[${ni}] name='${n.name || ''}'${meshInfo}${childrenInfo}`);
  
  // Recursively print children
  if (Array.isArray(n.children)) {
    n.children.forEach(childIdx => printNode(childIdx, depth + 1));
  }
}

// Print all roots (nodes not referenced as children)
const allChildIndices = new Set();
(gltf.nodes || []).forEach(n => {
  if (Array.isArray(n.children)) {
    n.children.forEach(ci => allChildIndices.add(ci));
  }
});

const roots = [];
(gltf.nodes || []).forEach((n, ni) => {
  if (!allChildIndices.has(ni)) {
    roots.push(ni);
  }
});

roots.forEach(rootIdx => printNode(rootIdx));

console.log('\n=== CHECKING FOR SPHERE GEOMETRY ===');
let sphereCount = 0;
(gltf.meshes || []).forEach((mesh, mi) => {
  // Check if mesh name suggests it's a sphere
  if (mesh.name && mesh.name.toLowerCase().includes('sphere')) {
    console.log(`Found potential sphere mesh: mesh[${mi}] name='${mesh.name}'`);
    sphereCount++;
  }
});

// Check for meshes with very few primitives (often spheres are simple)
const simpleMeshes = (gltf.meshes || []).filter(m => (m.primitives || []).length === 1);
console.log(`\nSimple meshes (1 primitive): ${simpleMeshes.length}`);
simpleMeshes.forEach((mesh, idx) => {
  const meshIndex = (gltf.meshes || []).indexOf(mesh);
  console.log(`  mesh[${meshIndex}] name='${mesh.name || ''}'`);
});

if (sphereCount === 0) {
  console.log('No obvious sphere meshes found by name.');
}
