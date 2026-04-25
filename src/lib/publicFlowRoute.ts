export interface PublicFlowRoute {
  slug: string;
  publicId: string;
}

export function buildPublicFlowHashUrl(baseUrl: string, slug: string, publicId: string) {
  const safeBaseUrl = baseUrl.replace(/\/$/, "");
  return `${safeBaseUrl}/#/${encodeURIComponent(slug)}/flow/${encodeURIComponent(publicId)}`;
}

export function getPublicFlowFromHash(hash: string): PublicFlowRoute | null {
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const match = normalizedHash.match(/^\/([^/]+)\/flow\/([^/?#]+)$/);

  if (!match) return null;

  return {
    slug: decodeURIComponent(match[1]),
    publicId: decodeURIComponent(match[2]),
  };
}