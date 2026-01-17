const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('Usage: node analyze_glb_meshes_and_nodes.js <file.glb>'); process.exit(2); }
const buf = fs.readFileSync(path);
if (buf.readUInt32LE(0) !== 0x46546C67) { console.error('Not a GLB file'); process.exit(2); }
const length = buf.readUInt32LE(8);
let offset = 12;
const chunks = [];
while (offset < length) {
  const chunkLength = buf.readUInt32LE(offset); offset += 4;
  const chunkType = buf.readUInt32LE(offset); offset += 4;
  const chunkData = buf.slice(offset, offset + chunkLength);
  offset += chunkLength;
  chunks.push({ chunkType, chunkLength, chunkData });
}
const jsonChunk = chunks.find(c => c.chunkType === 0x4E4F534A);
if (!jsonChunk) { console.error('No JSON chunk'); process.exit(2); }
let gltf = null;
try { gltf = JSON.parse(jsonChunk.chunkData.toString('utf8')); } catch (e) { console.error('Invalid JSON chunk', e); process.exit(2); }

console.log('meshes:', (gltf.meshes||[]).length);
(gltf.meshes||[]).forEach((mesh, mi)=>{
  console.log(` mesh[${mi}] name='${mesh.name||''}' primitives=${(mesh.primitives||[]).length}`);
  (mesh.primitives||[]).forEach((p,pi)=>{
    const attrs = Object.keys(p.attributes||{}).join(',') || '(none)';
    console.log(`  prim[${pi}] mode=${p.mode||0} material=${p.material} attributes=${attrs}`);
    if (!p.attributes || !p.attributes.POSITION) console.log('   >>> MISSING POSITION attribute');
    if (!p.attributes || !p.attributes.NORMAL) console.log('   >>> MISSING NORMAL attribute');
  });
});

console.log('nodes:', (gltf.nodes||[]).length);
(gltf.nodes||[]).forEach((n, ni)=>{
  const hasMesh = typeof n.mesh === 'number';
  const s = n.scale ? `scale=${JSON.stringify(n.scale)}` : '';
  const t = n.translation ? `translation=${JSON.stringify(n.translation)}` : '';
  const r = n.rotation ? `rotation=${JSON.stringify(n.rotation)}` : '';
  if (hasMesh) console.log(` node[${ni}] name='${n.name||''}' mesh=${n.mesh} ${t} ${s} ${r}`);
  else if (n.name) console.log(` node[${ni}] name='${n.name}'`);
  if (n.scale) {
    const zs = n.scale.every(v=>Math.abs(v) < 1e-8);
    if (zs) console.log('   >>> node scale is effectively zero');
    const anyZero = n.scale.some(v=>Math.abs(v) < 1e-8);
    if (anyZero && !zs) console.log('   >>> node has a zero scale component');
  }
});
