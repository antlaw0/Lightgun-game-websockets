const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('Usage: node analyze_glb_materials.js <file.glb>'); process.exit(2); }
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
const mats = gltf.materials || [];
console.log('materials count:', mats.length);
let anySuspicious=false;
mats.forEach((m, i) => {
  const name = m.name || `(mat_${i})`;
  const alphaMode = m.alphaMode || 'OPAQUE';
  const base = m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorFactor;
  const alpha = Array.isArray(base) && base.length>=4 ? base[3] : undefined;
  const hasBaseTex = !!(m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture);
  const doubleSided = !!m.doubleSided;
  const unlit = !!(m.extensions && m.extensions.KHR_materials_unlit);
  const note = [];
  if (alpha === 0) note.push('baseColor alpha == 0');
  if (alpha !== undefined && alpha < 0.01 && alpha > 0) note.push(`very low alpha=${alpha}`);
  if (alphaMode === 'BLEND' && (alpha === 0 || alpha < 0.01)) note.push('BLEND mode with near-zero alpha');
  if (!hasBaseTex) note.push('no baseColorTexture');
  if (unlit) note.push('UNLIT');
  if (!doubleSided) note.push('singleSided');
  console.log(` material[${i}] '${name}': alphaMode=${alphaMode} baseTex=${hasBaseTex} alpha=${alpha} doubleSided=${doubleSided} unlit=${unlit} ${note.length?(' NOTES:'+note.join(', ')) : ''}`);
  if (note.length) anySuspicious=true;
});
if (!mats.length) console.log('No materials found.');
if (!anySuspicious) console.log('No obvious alpha/unlit issues detected in materials.');
