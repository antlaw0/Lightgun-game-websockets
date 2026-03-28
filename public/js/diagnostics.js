// diagnostics.js
// Defines window.appendDiagnostic and ensures it is available globally before any other modules use it.

window._diagnosticRecorder = window._diagnosticRecorder || {
  log: function(event, details, self) {
    // Fallback: just log to console if not replaced by sceneLoader.js
    console.log('[DIAGNOSTIC][fallback]', event, details, self);
  }
};

window.appendDiagnostic = function(event, details, self) {
  // This will be replaced by the real implementation in sceneLoader.js
  window._diagnosticRecorder.log(event, details, self);
};
