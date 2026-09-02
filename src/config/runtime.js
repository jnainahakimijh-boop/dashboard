const external = typeof window !== 'undefined' ? (window.VEOLIA_SSO_CONFIG || {}) : {};
const apiBaseUrl = '';
const explicitAgentEndpoint = '';
const authMode = 'prototype-sso';
const oidcAuthorizeUrl = external.authorizeUrl || '';
const oidcTokenUrl = external.tokenUrl || '';
const oidcClientId = external.clientId || '';
const oidcRedirectUri = external.redirectUri || (typeof window !== 'undefined' ? `${window.location.origin}/` : '');
const oidcScope = external.scope || 'openid profile email';
const oidcLogoutUrl = external.logoutUrl || '';
const allowInsecureLocalLogin = true;
export const runtimeConfig = {
    apiBaseUrl,
    authMode,
    allowInsecureLocalLogin,
    aiAgentEndpoint: explicitAgentEndpoint,
    secureAuth: {
        loginUrl: '/.netlify/functions/auth-login',
        sessionUrl: '/.netlify/functions/auth-session',
        logoutUrl: '/.netlify/functions/auth-logout',
    },
    oidc: {
        authorizeUrl: oidcAuthorizeUrl,
        tokenUrl: oidcTokenUrl,
        clientId: oidcClientId,
        redirectUri: oidcRedirectUri,
        scope: oidcScope,
        logoutUrl: oidcLogoutUrl,
    },
};
export const hasLiveApi = false;
export const hasLiveAgent = false;
export const hasOidcConfig = Boolean(oidcAuthorizeUrl && oidcTokenUrl && oidcClientId && oidcRedirectUri);
export const usesSecureDemoAuth = false;
export const usesDropDemoAuth = true;
