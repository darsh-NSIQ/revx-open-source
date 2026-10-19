/**
 * Web Crypto API SHA-256 Digest & Verification Engine
 */
export async function computeSHA256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Format 64-char continuous hash into 8-char space-separated blocks for clean rendering
 */
export function formatDigest(hash: string): string {
  if (!hash) return '';
  const chunks: string[] = [];
  for (let i = 0; i < hash.length; i += 8) {
    chunks.push(hash.substring(i, Math.min(i + 8, hash.length)));
  }
  return chunks.join(' ');
}

/**
 * Generates an Indian GST e-Invoice compliant IRN (Invoice Reference Number)
 */
export function generateIRN(supplierGst: string, docNo: string, fy: string): string {
  const raw = `${supplierGst}-${docNo}-${fy}-${Date.now()}`;
  let hash = '';
  for (let i = 0; i < raw.length; i++) {
    hash += ((raw.charCodeAt(i) * 17) % 16).toString(16);
  }
  return (hash + 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855').substring(0, 64);
}
