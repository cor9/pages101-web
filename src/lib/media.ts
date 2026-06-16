export function getDocumentViewerUrl(fileUrl: string) {
  const trimmed = fileUrl.trim();
  if (!trimmed) return "";

  return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(trimmed)}`;
}

export function isPdfFile(fileNameOrUrl: string) {
  return /\.pdf(\?|#|$)/i.test(fileNameOrUrl);
}
