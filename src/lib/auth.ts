// Shared staff-passcode helpers. Works in both the edge proxy and node
// routes via Web Crypto. The cookie stores a hash, never the passcode.

export const AUTH_COOKIE = "hsc_staff";

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
