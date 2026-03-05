const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('Usage: node inspect_glb.js <file.glb>'); process.exit(2); }
const buf = fs.readFileSync(path);
if (buf.readUInt32LE(0) !== 0x46546C67) { console.error('Not a GLB file'); process.exit(2); }
const version = buf.readUInt32LE(4);
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
const jsonText = jsonChunk.chunkData.toString('utf8');
let gltf = null;
try { gltf = JSON.parse(jsonText); } catch (e) { console.error('Invalid JSON chunk', e); process.exit(2); }
console.log('glTF version:', version);
console.log('Top-level keys:', Object.keys(gltf));
console.log('materials:', (gltf.materials||[]).length);
console.log('meshes:', (gltf.meshes||[]).length);
console.log('skins:', (gltf.skins||[]).length);
console.log('animations:', (gltf.animations||[]).length);
console.log('images:', (gltf.images||[]).length);
if (gltf.images && gltf.images.length) {
  gltf.images.forEach((img, i) => {
    console.log(` image[${i}]: uri='${img.uri||''}' mimeType='${img.mimeType||''}' bufferView=${img.bufferView}`);
  });
}
console.log('textures:', (gltf.textures||[]).length);
if (gltf.textures && gltf.textures.length) {
  gltf.textures.forEach((t,i)=> console.log(` texture[${i}]: source=${t.source} sampler=${t.sampler}`));
}
console.log('materials detail:');
(gltf.materials||[]).forEach((m,i)=>{
  console.log(` material[${i}]: name='${m.name||''}' pbrMetallicRoughness=${!!m.pbrMetallicRoughness} baseColorTexture=${m.pbrMetallicRoughness?.baseColorTexture?.index}`);
});

// check for bufferViews count and binary chunk size
console.log('bufferViews:', (gltf.bufferViews||[]).length);
if (chunks.length>1) {
  const bin = chunks.find(c => c.chunkType === 0x004E4942);
  if (bin) console.log('Binary chunk size:', bin.chunkLength);
}
