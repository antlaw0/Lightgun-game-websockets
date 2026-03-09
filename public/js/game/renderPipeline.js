import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/postprocessing/SSAOPass.js';
import { FXAAShader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/shaders/FXAAShader.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/postprocessing/ShaderPass.js';

export function createRenderPipeline({ THREE, canvas, scene, camera, width, height }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.physicallyCorrectLights = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  renderer.setClearColor(0x000000, 1);
  scene.background = new THREE.Color(0x000000);

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.3, 0.4, 0.85);
  composer.addPass(bloomPass);

  const ssaoPass = new SSAOPass(scene, camera, width, height);
  ssaoPass.kernelRadius = 16;
  composer.addPass(ssaoPass);

  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.material.uniforms.resolution.value.set(1 / width, 1 / height);
  composer.addPass(fxaaPass);

  const RENDER_QUALITY_PRESETS = {
    low: {
      pixelRatioCap: 0.9,
      bloomEnabled: false,
      ssaoEnabled: false,
      fxaaEnabled: true,
      ssaoKernelRadius: 8,
      ssaoScale: 0.5
    },
    medium: {
      pixelRatioCap: 1.1,
      bloomEnabled: true,
      ssaoEnabled: false,
      fxaaEnabled: true,
      ssaoKernelRadius: 10,
      ssaoScale: 0.6
    },
    high: {
      pixelRatioCap: 1.25,
      bloomEnabled: true,
      ssaoEnabled: true,
      fxaaEnabled: true,
      ssaoKernelRadius: 12,
      ssaoScale: 0.75
    }
  };

  const renderQualityState = {
    current: 'medium',
    previousBeforeEditor: 'medium',
    ssaoScale: 1
  };

  function getSafePixelRatio(cap) {
    const dpr = window.devicePixelRatio || 1;
    return Math.min(dpr, cap);
  }

  function applyRenderQualityProfile(profileName, nextWidth = width, nextHeight = height) {
    const preset = RENDER_QUALITY_PRESETS[profileName] || RENDER_QUALITY_PRESETS.medium;
    renderQualityState.current = RENDER_QUALITY_PRESETS[profileName] ? profileName : 'medium';
    renderQualityState.ssaoScale = preset.ssaoScale;

    width = nextWidth;
    height = nextHeight;

    const pixelRatio = getSafePixelRatio(preset.pixelRatioCap);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    composer.setSize(width, height);

    bloomPass.enabled = !!preset.bloomEnabled;
    ssaoPass.enabled = !!preset.ssaoEnabled;
    fxaaPass.enabled = !!preset.fxaaEnabled;
    ssaoPass.kernelRadius = preset.ssaoKernelRadius;

    const ssaoWidth = Math.max(1, Math.floor(width * renderQualityState.ssaoScale));
    const ssaoHeight = Math.max(1, Math.floor(height * renderQualityState.ssaoScale));
    ssaoPass.setSize(ssaoWidth, ssaoHeight);

    const pr = renderer.getPixelRatio ? renderer.getPixelRatio() : pixelRatio;
    fxaaPass.material.uniforms.resolution.value.set(1 / (width * pr), 1 / (height * pr));
  }

  function handleResize(nextWidth, nextHeight) {
    applyRenderQualityProfile(renderQualityState.current, nextWidth, nextHeight);
  }

  // Start at medium quality for stable FPS/VRAM on a wide range of GPUs.
  applyRenderQualityProfile('medium', width, height);

  return {
    renderer,
    composer,
    renderQualityState,
    applyRenderQualityProfile,
    handleResize
  };
}
