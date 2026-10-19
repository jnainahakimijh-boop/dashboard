// Applies the persisted theme and density before first paint (external file: compatible with a strict CSP).
try {
  var p = JSON.parse(localStorage.getItem('vdi.prefs') || '{}');
  var mode = p.theme || 'light';
  if (mode === 'system') mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = mode;
  document.documentElement.dataset.density = p.density || 'comfortable';
  if (p.language) document.documentElement.lang = p.language;
} catch (e) {
  document.documentElement.dataset.theme = 'light';
}
