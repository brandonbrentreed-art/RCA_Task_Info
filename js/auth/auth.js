// auth.js - Entra ID authentication via MSAL.js
// Users authenticate with BT SSO. The access token is sent to the backend API
// which validates it and runs BigQuery queries as the service account.

const msalConfig = {
  auth: {
    clientId: window.__AUTH_CONFIG__.entraClientId,
    authority: "https://login.microsoftonline.com/" + window.__AUTH_CONFIG__.entraTenantId,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

const apiScopes = [`api://${window.__AUTH_CONFIG__.entraClientId}/access_as_user`];

let msalInstance = null;

async function getMsalInstance() {
  if (!msalInstance) {
    msalInstance = new msal.PublicClientApplication(msalConfig);
    await msalInstance.initialize();
  }
  return msalInstance;
}

// Main entry point - call on every page load
async function initAuth() {
  const instance = await getMsalInstance();
  const redirectResponse = await instance.handleRedirectPromise();

  if (redirectResponse) {
    sessionStorage.setItem("entra_token", redirectResponse.accessToken);
    window.dispatchEvent(new Event("authenticated"));
    return true;
  }

  const accounts = instance.getAllAccounts();
  if (accounts.length > 0) {
    instance.setActiveAccount(accounts[0]);
    try {
      const response = await instance.acquireTokenSilent({ scopes: apiScopes });
      sessionStorage.setItem("entra_token", response.accessToken);
      window.dispatchEvent(new Event("authenticated"));
      return true;
    } catch (e) {
      // Silent failed, force interactive
    }
  }

  // Not logged in — redirect to Entra ID
  await instance.loginRedirect({ scopes: apiScopes });
  return false;
}

// Helper to call the backend API with auth
async function apiCall(queryName, params = {}) {
  const token = sessionStorage.getItem("entra_token");
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${window.__AUTH_CONFIG__.apiBaseUrl}/api/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query_name: queryName, params }),
  });

  if (response.status === 401 || response.status === 403) {
    sessionStorage.clear();
    window.location.reload();
    return;
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}

window.initAuth = initAuth;
window.apiCall = apiCall;
