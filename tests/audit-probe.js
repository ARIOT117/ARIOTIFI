// Audit only: count actual Player listeners and active object URLs, without
// keeping references to DOM nodes, components or removed listener functions.
(() => {
  const urls = new Set(), create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  URL.createObjectURL = function(blob) { const url = create.call(this, blob); urls.add(url); return url; };
  URL.revokeObjectURL = function(url) { urls.delete(url); return revoke.call(this, url); };
  window.__vgAudit = () => ({
    playerListeners: Object.fromEntries(Object.entries(Spicetify.Player.eventListeners).map(([k, v]) => [k, v.length])),
    blobURLs: urls.size
  });
})();
