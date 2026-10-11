// KYC document files are only ever served through an authenticated route
// (never a public static path -- these are PAN cards and bank cheques), so
// a plain <a href> can't be used directly; the browser won't attach the
// Bearer token to a normal navigation. Fetches as a blob with the token
// attached, then opens it via a short-lived object URL.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/admin';

export async function openDocumentFile(documentId: string) {
  const token = localStorage.getItem('adminAccessToken');
  const response = await fetch(`${API_BASE_URL}/kyc/documents/${documentId}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Could not load the document');

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Revoke after a delay long enough for the new tab to load it -- can't
  // revoke immediately, the browser hasn't finished reading the blob yet.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
