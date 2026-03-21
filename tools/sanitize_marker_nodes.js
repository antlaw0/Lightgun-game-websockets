const fs = require('fs');
const path = require('path');
const { NodeIO } = require('@gltf-transform/core');
const { prune } = require('@gltf-transform/functions');

const MARKER_NAME_PATTERNS = [
  'node_marker',
  '__node_marker__',
  'muzzleflash',
  'turretbase',
  'turretmount'
];

const HELPER_MESH_PATTERNS = [
  'sphere',
  'marker',
  'helper',
  'gizmo'
];

function isLikelyMarkerName(name) {
  const n = String(name || '').toLowerCase();
  if (!n) return false;
  return MARKER_NAME_PATTERNS.some((p) => n.includes(p));
}

function isLikelyHelperMeshName(name) {
  const n = String(name || '').toLowerCase();
  if (!n) return false;
  return HELPER_MESH_PATTERNS.some((p) => n.includes(p));
}

function listGlbFiles(inputPath) {
  const results = [];
  const stat = fs.statSync(inputPath);

  if (stat.isFile()) {
    if (inputPath.toLowerCase().endsWith('.glb')) results.push(inputPath);
    return results;
  }

  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && full.toLowerCase().endsWith('.glb')) {
        results.push(full);
      }
    }
  };

  walk(inputPath);
  return results;
}

function createOutputPath(inputFile, inPlace) {
  if (inPlace) return inputFile;
  const ext = path.extname(inputFile);
  const base = inputFile.slice(0, -ext.length);
  return `${base}.sanitized${ext}`;
}

function sanitizeDocument(document) {
  const root = document.getRoot();
  let removedMeshBindings = 0;
  let touchedMarkerNodes = 0;

  const visitNode = (node, inMarkerBranch) => {
    const nodeName = node.getName();
    const thisIsMarker = isLikelyMarkerName(nodeName);
    const markerBranch = inMarkerBranch || thisIsMarker;

    if (thisIsMarker) touchedMarkerNodes += 1;

    const mesh = node.getMesh();
    if (mesh) {
      const meshName = mesh.getName();
      const removeMesh = markerBranch || isLikelyHelperMeshName(meshName);
      if (removeMesh) {
        node.setMesh(null);
        removedMeshBindings += 1;
      }
    }

    for (const child of node.listChildren()) {
      visitNode(child, markerBranch);
    }
  };

  for (const scene of root.listScenes()) {
    for (const child of scene.listChildren()) {
      visitNode(child, false);
    }
  }

  return { removedMeshBindings, touchedMarkerNodes };
}

async function sanitizeFile(inputFile, outputFile) {
  const io = new NodeIO();
  const document = await io.read(inputFile);

  const stats = sanitizeDocument(document);

  await document.transform(prune());
  await io.write(outputFile, document);

  return stats;
}

function printUsage() {
  console.log('Usage: node tools/sanitize_marker_nodes.js <input.glb|directory> [output.glb] [--in-place]');
  console.log('Examples:');
  console.log('  node tools/sanitize_marker_nodes.js public/assets/models/turret.glb');
  console.log('  node tools/sanitize_marker_nodes.js public/assets/models/turret.glb public/assets/models/turret.clean.glb');
  console.log('  node tools/sanitize_marker_nodes.js public/assets/models --in-place');
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    printUsage();
    process.exit(2);
  }

  const inPlace = args.includes('--in-place');
  const positional = args.filter((a) => a !== '--in-place');

  const inputPath = positional[0];
  const explicitOutput = positional[1] || null;

  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error(`Input path does not exist: ${inputPath || '(missing)'}`);
    process.exit(2);
  }

  const files = listGlbFiles(inputPath);
  if (!files.length) {
    console.log('No .glb files found to sanitize.');
    return;
  }

  let totalRemoved = 0;
  let totalMarkers = 0;

  for (const file of files) {
    const output = explicitOutput && files.length === 1 ? explicitOutput : createOutputPath(file, inPlace);
    const { removedMeshBindings, touchedMarkerNodes } = await sanitizeFile(file, output);
    totalRemoved += removedMeshBindings;
    totalMarkers += touchedMarkerNodes;

    console.log(`[sanitize] ${file}`);
    console.log(`  output: ${output}`);
    console.log(`  marker nodes visited: ${touchedMarkerNodes}`);
    console.log(`  mesh bindings removed: ${removedMeshBindings}`);
  }

  console.log(`\nDone. Files processed: ${files.length}`);
  console.log(`Total marker nodes visited: ${totalMarkers}`);
  console.log(`Total mesh bindings removed: ${totalRemoved}`);
}

main().catch((err) => {
  console.error('Sanitizer failed:', err);
  process.exit(1);
});
