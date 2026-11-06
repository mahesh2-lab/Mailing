import axios from "axios";
import dns from "node:dns";
import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import { isIP } from "node:net";

export function isSafeHttpUrl(raw: string): { ok: boolean; reason?: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `Blocked protocol "${url.protocol}"` };
  }
  if (url.username || url.password) return { ok: false, reason: "Credentials in URLs are not allowed" };

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: `Blocked internal host "${host}"` };
  }
  if (host === "::1" || host === "::" || /^(fe[89ab]|fc|fd)/.test(host)) {
    return { ok: false, reason: `Blocked IPv6 host "${host}"` };
  }

  const parts = host.split(".").map(Number);
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168))) {
      return { ok: false, reason: `Blocked private/reserved IP "${host}"` };
    }
  }
  return { ok: true };
}

function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0));
  }
  if (isIP(address) !== 6) return false;
  const host = address.toLowerCase();
  if (host.startsWith("::ffff:")) return isPublicAddress(host.slice(7));
  return /^[23]/.test(host) && !host.startsWith("2001:db8:");
}

function safeDnsLookup(
  hostname: string,
  options: unknown,
  callback: (error: NodeJS.ErrnoException | null, address?: string | dns.LookupAddress[], family?: number) => void,
) {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      return callback(Object.assign(new Error("Host resolves to a non-public address"), { code: "EACCES" }));
    }
    const all = typeof options === "object" && options !== null && "all" in options && options.all;
    return all ? callback(null, addresses) : callback(null, addresses[0].address, addresses[0].family);
  });
}

export async function requestSafeHttp(url: string, method: string, data: unknown) {
  const httpAgent = new HttpAgent({ lookup: safeDnsLookup as typeof dns.lookup });
  const httpsAgent = new HttpsAgent({ lookup: safeDnsLookup as typeof dns.lookup });
  try {
    const response = await axios({
      url,
      method,
      data,
      timeout: 5000,
      maxRedirects: 0,
      httpAgent,
      httpsAgent,
      proxy: false,
    });
    return { status: response.status, data: response.data };
  } finally {
    httpAgent.destroy();
    httpsAgent.destroy();
  }
}
