export function normalizeEmbedUrl(url: string) {
  const normalized = normalizeExternalUrl(url);
  if (!normalized) return "";

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./, "");
    const youtubeParams = "modestbranding=1&rel=0&showinfo=0";

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}?${youtubeParams}` : normalized;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname.startsWith("/embed/")) {
        parsed.search = youtubeParams;
        return parsed.toString();
      }
      const id = parsed.searchParams.get("v") ?? parsed.pathname.split("/").filter(Boolean).at(-1);
      return id ? `https://www.youtube.com/embed/${id}?${youtubeParams}` : normalized;
    }

    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean).at(-1);
      return id ? `https://player.vimeo.com/video/${id}` : normalized;
    }

    if (host === "player.vimeo.com") return normalized;
  } catch {
    return normalized;
  }

  return normalized;
}

function normalizeExternalUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
