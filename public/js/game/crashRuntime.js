import { createCrashReporter } from '../crashReporter.js';

export function setupCrashRuntime({
  canvas,
  renderer,
  camera,
  scene,
  vec3Snapshot,
  getPlayer,
  getIsFPSMode,
  getEnemyCount,
  getPlayerProjectilesCount,
  getEnemyProjectilesCount,
  getDisplayedRet,
  logDebug
}) {
  function collectRendererInfo() {
    try {
      const info = renderer.info || {};
      const caps = renderer.capabilities || {};
      return {
        render: {
          calls: info.render?.calls ?? null,
          triangles: info.render?.triangles ?? null,
          points: info.render?.points ?? null,
          lines: info.render?.lines ?? null,
          frame: info.render?.frame ?? null
        },
        memory: {
          geometries: info.memory?.geometries ?? null,
          textures: info.memory?.textures ?? null
        },
        capabilities: {
          isWebGL2: caps.isWebGL2 ?? null,
          maxTextures: caps.maxTextures ?? null,
          maxTextureSize: caps.maxTextureSize ?? null,
          maxCubemapSize: caps.maxCubemapSize ?? null,
          maxVertexTextures: caps.maxVertexTextures ?? null,
          maxAnisotropy: typeof renderer.getMaxAnisotropy === 'function' ? renderer.getMaxAnisotropy() : null,
          precision: caps.precision ?? null,
          logarithmicDepthBuffer: caps.logarithmicDepthBuffer ?? null
        }
      };
    } catch (err) {
      return { collectRendererInfoError: err?.message || String(err) };
    }
  }

  function collectWebGLDiagnostics() {
    try {
      const gl = renderer.getContext();
      if (!gl) return { available: false, reason: 'no-context' };
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      const rendererName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      return {
        available: true,
        vendor,
        renderer: rendererName,
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
        maxCombinedTextureImageUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
        maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
        maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)
      };
    } catch (err) {
      return { available: false, error: err?.message || String(err) };
    }
  }

  function collectPlayerSnapshot() {
    try {
      const player = getPlayer();
      if (!player) return null;
      const w = player.currentWeapon || null;
      return {
        hp: player.hp ?? null,
        maxHp: player.maxHp ?? null,
        isReloading: w ? !!w.isReloading : null,
        currentWeapon: w
          ? {
              id: w.id ?? null,
              name: w.name ?? null,
              ammoInClip: w.ammoInClip ?? null,
              clipSize: w.clipSize ?? null,
              totalAmmo: w.totalAmmo ?? null,
              fireMode: w.fireMode ?? null,
              accuracy: w.accuracy ?? null
            }
          : null
      };
    } catch (err) {
      return { collectPlayerSnapshotError: err?.message || String(err) };
    }
  }

  function collectEditorGridSnapshot() {
    try {
      const g = window.engine?.editorGrid;
      if (!g) return null;
      const size = Number(g.size || 0);
      const world = Number(g.worldSize || 200);
      const divisions = size > 0 ? Math.max(2, Math.round(world / size)) : 0;
      const helperCount = Array.isArray(g.helpers) ? g.helpers.length : 0;
      const estimatedLinesPerHelper = divisions > 0 ? (divisions + 1) * 4 : 0;
      return {
        isEditorMode: !!window.engine?.isEditorMode,
        size,
        world,
        divisions,
        helperCount,
        estimatedLinesPerHelper,
        estimatedLinesTotal: estimatedLinesPerHelper * helperCount
      };
    } catch (err) {
      return { collectEditorGridSnapshotError: err?.message || String(err) };
    }
  }

  const crashReporter = createCrashReporter({
    endpoint: '/api/crash-report',
    maxFrameSamples: 240,
    contextProvider: () => {
      const displayedRet = getDisplayedRet();
      return {
        renderer: collectRendererInfo(),
        camera: {
          position: vec3Snapshot(camera.position),
          rotation: {
            x: Number(camera.rotation.x.toFixed(4)),
            y: Number(camera.rotation.y.toFixed(4)),
            z: Number(camera.rotation.z.toFixed(4))
          },
          fov: camera.fov
        },
        player: collectPlayerSnapshot(),
        gameplay: {
          isFPSMode: getIsFPSMode(),
          enemyCount: getEnemyCount(),
          sceneChildren: scene.children.length,
          playerProjectiles: getPlayerProjectilesCount(),
          enemyProjectiles: getEnemyProjectilesCount(),
          reticle: {
            x: Number(displayedRet.x.toFixed(2)),
            y: Number(displayedRet.y.toFixed(2))
          },
          editorGrid: collectEditorGridSnapshot()
        }
      };
    },
    webglProvider: collectWebGLDiagnostics
  });

  const runtimeCrashState = {
    stopped: false,
    reason: null
  };

  async function stopLoopAndReport(reason, error, extra = null) {
    if (runtimeCrashState.stopped) return;
    runtimeCrashState.stopped = true;
    runtimeCrashState.reason = reason;

    const err = error instanceof Error ? error : new Error(String(error || reason));
    console.error('[CRASH][STOP LOOP]', reason, err, extra || '');
    try {
      logDebug(`[CRASH] Loop stopped: ${reason}`);
    } catch (_) {}

    const result = await crashReporter.reportCrash(reason, err, extra);
    if (result?.ok && result?.body?.relativePath) {
      console.error(`[CRASH][REPORT SAVED] ${result.body.relativePath}`);
      try {
        logDebug(`[CRASH] Report saved: ${result.body.relativePath}`);
      } catch (_) {}
    } else {
      console.error('[CRASH][REPORT FAILED]', result);
    }
  }

  window.forceCrashReport = (reason = 'manual_test') => {
    stopLoopAndReport(reason, new Error('Manual crash report trigger'), { manual: true });
  };

  crashReporter.installGlobalHandlers((kind, error, extra) => {
    stopLoopAndReport(kind, error, extra);
  });

  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      const statusMessage = event?.statusMessage || null;
      stopLoopAndReport('webgl_context_lost', new Error('webglcontextlost'), { statusMessage });
    },
    { passive: false }
  );

  canvas.addEventListener('webglcontextrestored', () => {
    crashReporter.addBreadcrumb('webglcontextrestored', { at: Date.now() });
    console.warn('[CRASH][WEBGL] context restored (manual reload recommended)');
  });

  return {
    crashReporter,
    runtimeCrashState,
    stopLoopAndReport
  };
}
