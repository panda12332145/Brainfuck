/**
 * Utilidades para salvar/carregar programas: base64 seguro para UTF-8
 * (usado no link de compartilhamento) e download de arquivos.
 */

/** base64 "url safe" de uma string UTF-8. */
export function encodeShare(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Desfaz `encodeShare`. Devolve null se o texto não for um base64 válido. */
export function decodeShare(s: string): string | null {
  try {
    const b = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b + "=".repeat((4 - (b.length % 4)) % 4));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Empacota código + entrada em um payload de compartilhamento. */
export function buildSharePayload(code: string, input: string): string {
  return encodeShare(JSON.stringify({ v: 1, code, input }));
}

/** Lê um payload de compartilhamento. Devolve null se for inválido. */
export function readSharePayload(hash: string): { code: string; input: string } | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.startsWith("c=")) return null;
  const json = decodeShare(raw.slice(2));
  if (!json) return null;
  try {
    const obj = JSON.parse(json) as unknown;
    if (typeof obj !== "object" || obj === null) return null;
    const { code, input } = obj as { code?: unknown; input?: unknown };
    if (typeof code !== "string") return null;
    return { code, input: typeof input === "string" ? input : "" };
  } catch {
    return null;
  }
}

/** Dispara o download de um arquivo de texto no navegador. */
export function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // dá tempo do navegador começar o download antes de liberar a URL
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
