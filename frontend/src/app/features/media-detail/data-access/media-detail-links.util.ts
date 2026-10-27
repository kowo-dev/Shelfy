export function personUrl(id: number | string): string {
  return `/people/${id}`;
}

export function characterUrl(id: number | string): string {
  return `/characters/${id}`;
}

export function staffUrl(id: number | string): string {
  return `/staff/${id}`;
}

export function companyUrl(id: number | string): string {
  return `/companies/${id}`;
}

export function networkUrl(id: number | string): string {
  return `/networks/${id}`;
}

export function studioUrl(id: number | string): string {
  return `/studios/${id}`;
}

export function gameCompanyUrl(id: number | string): string {
  return `/game-companies/${id}`;
}

export function franchiseUrl(id: number | string): string {
  return `/franchises/${id}`;
}

export function browseUrl(mediaType: string, facet: string, idOrName: number | string): string {
  return `/browse/${mediaType}/${facet}/${idOrName}`;
}

export function browseQueryParams(name: string): { name: string } {
  return { name };
}

export function steamStoreUrl(appId: string): string {
  return `https://store.steampowered.com/app/${encodeURIComponent(appId)}`;
}
