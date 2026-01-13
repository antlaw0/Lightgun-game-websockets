import { NodeIO } from '@gltf-transform/core';

async function main() {
    const io = new NodeIO();
    const inputPath = './male_base_mesh.glb';
    const outputPath = './male_vertexcolored.glb';

    // Load the GLB
    const doc = await io.read(inputPath);
    const root = doc.getRoot();
    const scene = root.getDefaultScene();

    // Fix disconnected meshes by attaching to a dummy node
    for (const mesh of root.listMeshes()) {
        if (mesh.listParents().length === 0) {
            const node = doc.createNode(mesh.getName() + '_node').setMesh(mesh);
            scene.addChild(node);
        }
    }

    // Apply vertex colors
    for (const mesh of root.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
            const pos = prim.getAttribute('POSITION');
            const count = pos.getCount();

            // Create a COLOR_0 attribute
            const colors = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                colors[i * 3 + 0] = Math.random(); // R
                colors[i * 3 + 1] = Math.random(); // G
                colors[i * 3 + 2] = Math.random(); // B
            }

            prim.setAttribute('COLOR_0', doc.createAccessor().setArray(colors).setType('VEC3'));
        }
    }

    // Save new GLB
    await io.write(outputPath, doc);
    console.log(`Vertex-colored GLB saved as: ${outputPath}`);
}

main().catch(console.error);
