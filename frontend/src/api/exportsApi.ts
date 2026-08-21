// PDF export endpoints. Exports can take seconds on large collections, so
// downloads go through downloadPdf() to give the UI a pending state.

export const exportUrls = {
  allCards: '/api/cards/export.pdf',
  binderCards: (binderId: string) => `/api/binders/${binderId}/export-cards.pdf`,
  binderPages: (binderId: string) => `/api/binders/${binderId}/export-pages.pdf`,
};

export async function downloadPdf(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`export → ${res.status}: ${await res.text()}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}
