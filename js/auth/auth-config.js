// auth-config.js
// DEV: pointing at local Flask API — no real Entra token needed
window.__AUTH_CONFIG__ = {
  entraClientId: "dev",
  entraTenantId: "dev",
  apiBaseUrl: "http://localhost:8080",
  devMode: true   // skips MSAL, injects a dummy token
};
