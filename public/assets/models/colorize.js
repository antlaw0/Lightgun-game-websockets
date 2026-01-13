import fs from 'fs';

const gltf = JSON.parse(fs.readFileSync('mannequin_colored.gltf', 'utf8'));

const buffers = gltf.buffers;
const accessors = gltf.accessors;
const bufferViews = gltf.bufferViews;

// Utility: read Float32 accessor
function readFloat32Accessor(accessorIndex) {
  const accessor = accessors[accessorIndex];
  const view = bufferViews[accessor.bufferView];
  const buffer = fs.readFileSync(buffers[0].uri);

  const byteOffset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const length = accessor.count * accessor.type.length;
  return new Float32Array(buffer.buffer, byteOffset, length);
}

// Utility: write Float32 accessor
function writeFloat32Accessor(data) {
  const buffer = Buffer.from(data.buffer);

  const bufferViewIndex = bufferViews.length;
  bufferViews.push({
    buffer: 0,
    byteOffset: fs.statSync(buffers[0].uri).size,
    byteLength: buffer.byteLength,
  });

  fs.appendFileSync(buffers[0].uri, buffer);

  const accessorIndex = accessors.length;
  accessors.push({
    bufferView: bufferViewIndex,
    componentType: 5126, // FLOAT
    count: data.length / 4,
    type: 'VEC4',
    normalized: false,
  });

  return accessorIndex;
}

// Colors
const COLORS = {
  torso: [0.25, 0.25, 0.25, 1], // dark gray
  legs:  [0.15, 0.35, 0.9, 1],  // blue
  feet:  [0.4, 0.25, 0.1, 1],   // brown
};

for (const mesh of gltf.meshes) {
  for (const prim of mesh.primitives) {
    if (!prim.attributes.POSITION) continue;

    const positions = readFloat32Accessor(prim.attributes.POSITION);
    const vertexCount = positions.length / 3;

    const colors = new Float32Array(vertexCount * 4);

    for (let i = 0; i < vertexCount; i++) {
      const y = positions[i * 3 + 1];

      let color;
      if (y < -0.6) color = COLORS.feet;
      else if (y < 0.2) color = COLORS.legs;
      else color = COLORS.torso;

      colors.set(color, i * 4);
    }

    prim.attributes.COLOR_0 = writeFloat32Accessor(colors);
  }
}

fs.writeFileSync('mannequin_colored.gltf', JSON.stringify(gltf, null, 2));
console.log('✅ Vertex colors applied');
