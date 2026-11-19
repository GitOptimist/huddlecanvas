/** Normalize supported video links; never accept arbitrary iframe markup. */
export function parseVideoSource(input) {
  if (typeof input !== 'string' || input.length > 2048) return null;
  let url;
  try { url = new URL(input.trim()); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  const host = url.hostname;
  let id;
  if (host === 'youtu.be') id = url.pathname.slice(1);
  if (['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = /^\/(?:embed|shorts)\/([^/]+)$/.exec(url.pathname)?.[1];
  }
  if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
    return { provider: 'youtube', id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, requiresConsent: true };
  }
  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    id = (host === 'player.vimeo.com' ? /^\/video\/([0-9]{1,12})$/ : /^\/([0-9]{1,12})$/).exec(url.pathname)?.[1];
    if (id) return { provider: 'vimeo', id, embedUrl: `https://player.vimeo.com/video/${id}?dnt=1`, requiresConsent: true };
  }
  return null;
}
