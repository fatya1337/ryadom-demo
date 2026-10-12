// Shared verbatim with the patient project. Codes belong in fragments, never queries.
export function invitationCode(value: string): boolean {
  return /^[a-f0-9]{48}$/.test(value);
}

export function readInvitationFragment(hash: string): string | null {
  if (!hash.startsWith("#invite=")) return null;
  const code = hash.slice(8);
  return invitationCode(code) ? code : "";
}

export function invitationLink(doctorURL: string, code: string): string | null {
  if (!invitationCode(code)) return null;
  try {
    const url = new URL(doctorURL);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username || url.password || url.search || url.hash ||
      !url.pathname.replace(/\/$/, "").endsWith("/live")
    ) return null;
    url.hash = `invite=${code}`;
    return url.toString();
  } catch {
    return null;
  }
}
