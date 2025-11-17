// Frontend configuration for backends (local testing)
// Base points to local backend per request
// Note: these are available on window.* and also exported for module tests
window.BACKEND_BASE = "https://attendance-backend-rsok.onrender.com";
window.BACKEND_TEMPLATE = `${window.BACKEND_BASE}/api/generate-dashboard/test`;
window.BACKEND_EXPORT = `${window.BACKEND_BASE}/api/generate-dashboard`;

// Optional CommonJS export for unit tests (ignored by browsers)
try {
  if (typeof module !== 'undefined') {
    module.exports = {
      BACKEND_BASE: window.BACKEND_BASE,
      BACKEND_TEMPLATE: window.BACKEND_TEMPLATE,
      BACKEND_EXPORT: window.BACKEND_EXPORT,
    };
  }
} catch {}
