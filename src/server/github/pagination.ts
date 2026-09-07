export function parseLinkHeader(value: string | null): Record<string, string> {
  if (!value) return {};
  const links: Record<string, string> = {};
  for (const part of value.split(",")) {
    const match = part.trim().match(/^<([^>]+)>;\s*rel="([^"]+)"$/);
    if (match?.[1] && match[2]) links[match[2]] = match[1];
  }
  return links;
}
