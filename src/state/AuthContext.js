import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { hasOidcConfig, runtimeConfig } from '/src/config/runtime.js';

const DEMO_USERNAME = 'veolia-demo';
const DEMO_PASSWORD = 'VeoliaDemo#2026';
const SESSION_KEY = 'veolia.dp.prototype.user.v2';
const OIDC_VERIFIER = 'veolia.dp.oidc.verifier';
const OIDC_STATE = 'veolia.dp.oidc.state';

const PASSWORD_USER = { name: 'Veolia Digital User', email: 'digital.user@veolia.example', role: 'Digital Performance User', provider: 'prototype-login' };
const SSO_USER = { name: 'Veolia SSO User', email: 'sso.user@veolia.example', role: 'Veolia Digital User', provider: 'prototype-sso' };
const Ctx = createContext(null);

function loadUser() {
  try { const raw = sessionStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function storeUser(user) {
  try { if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); else sessionStorage.removeItem(SESSION_KEY); }
  catch { /* storage unavailable */ }
}
function randomUrlSafe(bytes = 32) {
  const arr = new Uint8Array(bytes); crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function challenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeJwtPayload(token) {
  if (!token) return {};
  try {
    const part = token.split('.')[1]; if (!part) return {};
    const normal = part.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normal.padEnd(Math.ceil(normal.length / 4) * 4, '=')));
  } catch { return {}; }
}
function cleanOidcQuery() {
  try {
    const url = new URL(window.location.href);
    ['code','state','session_state','error','error_description'].forEach((k)=>url.searchParams.delete(k));
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  } catch { /* no-op */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [ssoBusy, setSsoBusy] = useState(false);
  const [ssoError, setSsoError] = useState('');

  // Stamp the sign-in time so Settings can show real session information.
  const establish = useCallback((next) => {
    const stamped = next ? { ...next, signedInAt: next.signedInAt ?? new Date().toISOString() } : next;
    setUser(stamped); storeUser(stamped); setAuthError(''); setSsoError('');
  }, []);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const callbackState = params.get('state');
      const oidcError = params.get('error');
      if (oidcError) {
        if (!cancelled) setSsoError(params.get('error_description') || oidcError);
        cleanOidcQuery(); if (!cancelled) setAuthReady(true); return;
      }
      if (code && hasOidcConfig) {
        setSsoBusy(true);
        try {
          const expectedState = sessionStorage.getItem(OIDC_STATE);
          const verifier = sessionStorage.getItem(OIDC_VERIFIER);
          if (!expectedState || !verifier || callbackState !== expectedState) throw new Error('The SSO response could not be verified. Please try again.');
          const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: runtimeConfig.oidc.clientId, code, redirect_uri: runtimeConfig.oidc.redirectUri, code_verifier: verifier });
          const res = await fetch(runtimeConfig.oidc.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
          if (!res.ok) throw new Error(`SSO token exchange failed (${res.status}).`);
          const token = await res.json();
          const claims = decodeJwtPayload(token.id_token);
          const email = String(claims.preferred_username ?? claims.email ?? claims.upn ?? 'veolia.user@veolia.com');
          const name = String(claims.name ?? email.split('@')[0]);
          if (!cancelled) establish({ name, email, role: 'Veolia user', provider: 'oidc' });
        } catch (error) {
          if (!cancelled) setSsoError(error instanceof Error ? error.message : 'SSO sign-in failed.');
        } finally {
          try { sessionStorage.removeItem(OIDC_STATE); sessionStorage.removeItem(OIDC_VERIFIER); } catch { /* no-op */ }
          cleanOidcQuery(); if (!cancelled) { setSsoBusy(false); setAuthReady(true); }
        }
        return;
      }
      if (!cancelled) { setUser(loadUser()); setAuthReady(true); }
    };
    void boot(); return () => { cancelled = true; };
  }, [establish]);

  const signIn = useCallback(async (username, password) => {
    if (username !== DEMO_USERNAME || password !== DEMO_PASSWORD) { setAuthError('Incorrect username or password.'); return false; }
    establish(PASSWORD_USER); return true;
  }, [establish]);

  const signInWithSso = useCallback(async () => {
    setSsoBusy(true); setSsoError('');
    try {
      if (hasOidcConfig) {
        const verifier = randomUrlSafe(48), state = randomUrlSafe(24), codeChallenge = await challenge(verifier);
        try { sessionStorage.setItem(OIDC_VERIFIER, verifier); sessionStorage.setItem(OIDC_STATE, state); } catch { /* no-op */ }
        const url = new URL(runtimeConfig.oidc.authorizeUrl);
        url.searchParams.set('response_type', 'code'); url.searchParams.set('client_id', runtimeConfig.oidc.clientId);
        url.searchParams.set('redirect_uri', runtimeConfig.oidc.redirectUri); url.searchParams.set('scope', runtimeConfig.oidc.scope);
        url.searchParams.set('state', state); url.searchParams.set('code_challenge', codeChallenge); url.searchParams.set('code_challenge_method', 'S256');
        window.location.assign(url.toString()); return true;
      }
      await new Promise((resolve)=>window.setTimeout(resolve,650)); establish(SSO_USER); return true;
    } catch (error) {
      setSsoError(error instanceof Error ? error.message : 'SSO sign-in failed.'); return false;
    } finally { if (!hasOidcConfig) setSsoBusy(false); }
  }, [establish]);

  const signOut = useCallback(() => {
    const previous = user; setUser(null); storeUser(null); setAuthError(''); setSsoError('');
    if (previous?.provider === 'oidc' && runtimeConfig.oidc.logoutUrl) window.location.assign(runtimeConfig.oidc.logoutUrl);
  }, [user]);

  const value = useMemo(() => ({ authenticated: Boolean(user), authReady, user, sessionExpiresAt: null, ssoBusy, ssoError, authError, signIn, signInWithSso, signOut }), [user, authReady, ssoBusy, ssoError, authError, signIn, signInWithSso, signOut]);
  return _jsx(Ctx.Provider, { value, children });
}

export function useAuth() { const ctx = useContext(Ctx); if (!ctx) throw new Error('useAuth outside AuthProvider'); return ctx; }
