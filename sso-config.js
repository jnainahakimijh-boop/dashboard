/*
  Optional real Veolia OIDC/Entra configuration.
  Leave these empty for the built-in prototype SSO simulation.
  For real SSO, use values supplied by the authorised Veolia identity team.
*/
window.VEOLIA_SSO_CONFIG = {
  authorizeUrl: '',
  tokenUrl: '',
  clientId: '',
  redirectUri: window.location.origin + '/',
  scope: 'openid profile email',
  logoutUrl: ''
};
