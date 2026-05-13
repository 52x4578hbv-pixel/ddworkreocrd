export function isLocalPreviewMode(): boolean {
  const h = window.location.hash.replace('#', '').replace(/^\//, '')
  const route = h.split('?')[0]
  return route === 'local-preview'
}
