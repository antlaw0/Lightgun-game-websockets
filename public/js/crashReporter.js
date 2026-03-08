function serializeError(err) {
  if (!err) return null;
  return {
    name: err.name || 'Error',
    message: err.message || String(err),
    stack: err.stack || null
  };
}

function getPerformanceMemory() {
  try {
    const mem = performance && performance.memory;
    if (!mem) return null;
    return {
      jsHeapSizeLimit: mem.jsHeapSizeLimit,
      totalJSHeapSize: mem.totalJSHeapSize,
      usedJSHeapSize: mem.usedJSHeapSize
    };
  } catch (err) {
    return null;
  }
}

function getBrowserSnapshot() {
  return {
    url: window.location.href,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    deviceMemoryGb: navigator.deviceMemory || null,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    screen: { width: window.screen.width, height: window.screen.height },
    devicePixelRatio: window.devicePixelRatio || 1
  };
}

export function createCrashReporter(options = {}) {
  const endpoint = options.endpoint || '/api/crash-report';
  const maxFrameSamples = Number.isFinite(options.maxFrameSamples) ? options.maxFrameSamples : 180;
  const maxBreadcrumbs = Number.isFinite(options.maxBreadcrumbs) ? options.maxBreadcrumbs : 80;

  let hasReported = false;
  let contextProvider = options.contextProvider || null;
  let webglProvider = options.webglProvider || null;

  const frames = [];
  const breadcrumbs = [];

  function addBreadcrumb(type, data) {
    const entry = {
      t: new Date().toISOString(),
      type,
      data: data || null
    };
    breadcrumbs.push(entry);
    if (breadcrumbs.length > maxBreadcrumbs) breadcrumbs.shift();
  }

  function noteFrame(frameData) {
    frames.push(frameData);
    if (frames.length > maxFrameSamples) frames.shift();
  }

  function setContextProvider(fn) {
    contextProvider = fn;
  }

  function setWebglProvider(fn) {
    webglProvider = fn;
  }

  async function reportCrash(eventType, error, extra = null) {
    if (hasReported) return { skipped: true, reason: 'already-reported' };
    hasReported = true;

    const payload = {
      reportVersion: 1,
      createdAt: new Date().toISOString(),
      eventType,
      error: serializeError(error),
      browser: getBrowserSnapshot(),
      performance: {
        nowMs: performance.now(),
        timeOrigin: performance.timeOrigin || null,
        memory: getPerformanceMemory()
      },
      context: null,
      webgl: null,
      renderer: null,
      frames: frames.slice(),
      breadcrumbs: breadcrumbs.slice(),
      extra: extra || null
    };

    try {
      payload.context = contextProvider ? contextProvider() : null;
      if (payload.context && payload.context.renderer) payload.renderer = payload.context.renderer;
    } catch (err) {
      payload.context = { contextProviderError: serializeError(err) };
    }

    try {
      payload.webgl = webglProvider ? webglProvider() : null;
    } catch (err) {
      payload.webgl = { webglProviderError: serializeError(err) };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, body };
    } catch (err) {
      return { ok: false, status: 0, error: err?.message || String(err) };
    }
  }

  function installGlobalHandlers(onFatal) {
    const errorHandler = (ev) => {
      const err = ev.error || new Error(ev.message || 'window-error');
      addBreadcrumb('window.error', {
        message: ev.message || null,
        source: ev.filename || null,
        line: ev.lineno || null,
        column: ev.colno || null
      });
      if (typeof onFatal === 'function') {
        onFatal('window_error', err, {
          source: ev.filename || null,
          line: ev.lineno || null,
          column: ev.colno || null
        });
      }
    };

    const rejectionHandler = (ev) => {
      const reason = ev.reason;
      const err = reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : 'unhandledrejection');
      addBreadcrumb('window.unhandledrejection', {
        reason: typeof reason === 'string' ? reason : null
      });
      if (typeof onFatal === 'function') onFatal('unhandled_rejection', err, { reason: reason || null });
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }

  return {
    addBreadcrumb,
    noteFrame,
    setContextProvider,
    setWebglProvider,
    reportCrash,
    installGlobalHandlers
  };
}
