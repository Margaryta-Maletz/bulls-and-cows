/**
 * Normalizes a student's answer for comparison with stored correct answers.
 *
 * Pipeline (in order):
 *   \r\n / \r  →  \n
 *   trim
 *   toLowerCase
 *   collapse multiple spaces
 *   remove spaces around  , [ ] ( )
 *   parseFloat: "1.0" → "1"
 */
export function normalize(raw: string): string {
  return raw
    .replaceAll('\r\n', '\n').replaceAll('\r', '\n')
    .trim()
    .toLowerCase()
    .replace(/ {2,}/g, ' ')
    .replace(/\x20([,[\]()])/g, '$1')
    .replace(/([,[\]()])\x20/g, '$1')
    .split(/([,[\]()\s]+)/)
    .map(normalizeFloatToken)
    .join('');
}

// Split-based float normalization avoids the O(n²) backtracking of /\d+\.\d+/.
// Each token is the text between known delimiters, so Number() either parses it
// fully or returns NaN — no partial-parse ambiguity.
function normalizeFloatToken(token: string): string {
  const n = Number(token);
  return Number.isFinite(n) && token.includes('.') ? String(n) : token;
}
