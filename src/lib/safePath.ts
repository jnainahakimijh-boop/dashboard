/** Links built from stored values (favourites, saved views, search results) must stay inside the application. */
export function internalPath(path: string, fallback = '/'): string {
  return /^\/(?![/\\])[^\s\\]*$/.test(path) ? path : fallback;
}
