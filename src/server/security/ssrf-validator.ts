import net from 'net';
import dns from 'dns';

/**
 * Restricted ports known to host internal administrative services or databases.
 * These should never be targeted by HTTP/HTTPS inference endpoints.
 */
export const RESTRICTED_PORTS = new Set([
  20, 21,    // FTP
  22,        // SSH
  23,        // Telnet
  25,        // SMTP
  53,        // DNS
  69,        // TFTP
  110,       // POP3
  135, 137, 138, 139, 445, // SMB / NetBIOS
  143,       // IMAP
  3306,      // MySQL
  5432,      // PostgreSQL
  6379,      // Redis
  11211,     // Memcached
  27017,     // MongoDB
]);

/**
 * Hostnames explicitly blocked as cloud metadata services.
 */
export const BLOCKED_HOSTNAMES = new Set([
  'instance-data',
  'metadata.google.internal',
  'metadata.goog',
  'metadata.azure.com',
  'metadata',
]);

export interface SSRFValidationOptions {
  /**
   * If true, permits private RFC1918 and loopback addresses (e.g. for local model runtimes).
   * Note: Cloud metadata (169.254.169.254, fe80::/10, etc.) is NEVER allowed even with this flag.
   */
  allowPrivateNetworks?: boolean;

  /**
   * Optional custom DNS resolver function for testing or isolated environments.
   */
  lookupFn?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;

  /**
   * Skip DNS lookup (only validate protocol, port, syntax, and IP literals).
   */
  skipDnsLookup?: boolean;
}

export interface SSRFValidationResult {
  isValid: boolean;
  reason?: string;
  normalizedUrl?: string;
  resolvedIps?: string[];
}

/**
 * Parses an IPv4 dotted-decimal string into four byte numbers.
 */
function parseIpv4(ip: string): [number, number, number, number] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = parseInt(part, 10);
    if (n < 0 || n > 255) return null;
    nums.push(n);
  }
  return [nums[0], nums[1], nums[2], nums[3]];
}

/**
 * Normalizes IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1 or ::ffff:a9fe:a9fe) to standard IPv4.
 */
function normalizeIpString(ip: string): string {
  let cleaned = ip.trim().toLowerCase().replace(/^\[|\]$/g, '');

  // Handle ::ffff: dotted-decimal or hex representation
  if (cleaned.startsWith('::ffff:')) {
    const rest = cleaned.slice(7);
    if (rest.includes('.')) {
      return rest;
    }
    const hexParts = rest.split(':');
    if (hexParts.length === 2) {
      const p1 = parseInt(hexParts[0], 16);
      const p2 = parseInt(hexParts[1], 16);
      if (!isNaN(p1) && !isNaN(p2)) {
        return `${(p1 >> 8) & 255}.${p1 & 255}.${(p2 >> 8) & 255}.${p2 & 255}`;
      }
    }
  }

  return cleaned;
}

/**
 * Checks whether an IP address is a Cloud Metadata address (AWS, GCP, Azure, etc.).
 * Cloud metadata endpoints MUST ALWAYS be blocked under all conditions.
 */
export function isCloudMetadataIp(ip: string): boolean {
  const normalized = normalizeIpString(ip);

  // AWS / Azure / GCP IPv4 link-local metadata: 169.254.0.0/16
  const v4 = parseIpv4(normalized);
  if (v4) {
    const [a, b] = v4;
    return a === 169 && b === 254;
  }

  // IPv6 link-local: fe80::/10 (starts with fe8, fe9, fea, feb)
  if (net.isIPv6(normalized)) {
    if (/^fe[89ab][0-9a-f]/i.test(normalized)) {
      return true;
    }
    // AWS IPv6 IMDS: fd00:ec2::254
    if (normalized.startsWith('fd00:ec2::')) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether an IP address is a Loopback address (127.0.0.0/8, ::1, 0.0.0.0/8).
 */
export function isLoopbackIp(ip: string): boolean {
  const normalized = normalizeIpString(ip);

  const v4 = parseIpv4(normalized);
  if (v4) {
    const [a] = v4;
    return a === 127 || a === 0;
  }

  if (net.isIPv6(normalized)) {
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized === '0:0:0:0:0:0:0:1' ||
      normalized === '0:0:0:0:0:0:0:0'
    );
  }

  return false;
}

/**
 * Checks whether an IP address is a Private RFC1918 / RFC4193 address.
 */
export function isPrivateIp(ip: string): boolean {
  const normalized = normalizeIpString(ip);

  const v4 = parseIpv4(normalized);
  if (v4) {
    const [a, b] = v4;
    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 100.64.0.0/10 Carrier-Grade NAT (100.64.0.0 - 100.127.255.255)
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (net.isIPv6(normalized)) {
    // Unique Local Addresses (fc00::/7 -> fc.. or fd..)
    if (/^f[cd][0-9a-f]{2}/i.test(normalized)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether an IP address is a Reserved, Multicast, or Broadcast address.
 */
export function isReservedOrMulticastIp(ip: string): boolean {
  const normalized = normalizeIpString(ip);

  const v4 = parseIpv4(normalized);
  if (v4) {
    const [a, b, c] = v4;
    // Multicast (224.0.0.0/4 -> 224 to 239)
    if (a >= 224 && a <= 239) return true;
    // Reserved for future use (240.0.0.0/4 -> 240 to 255)
    if (a >= 240) return true;
    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (a === 192 && b === 0 && c === 0) return true;
    // 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 0 && c === 2) return true;
    // 198.18.0.0/15 (Network Benchmark Testing)
    if (a === 198 && (b === 18 || b === 19)) return true;
    // 198.51.100.0/24 (TEST-NET-2)
    if (a === 198 && b === 51 && c === 100) return true;
    // 203.0.113.0/24 (TEST-NET-3)
    if (a === 203 && b === 0 && c === 113) return true;
    return false;
  }

  if (net.isIPv6(normalized)) {
    // Multicast (ff00::/8)
    if (/^ff[0-9a-f]{2}/i.test(normalized)) return true;
    // Documentation prefix (2001:db8::/32)
    if (normalized.startsWith('2001:db8:')) return true;
  }

  return false;
}

/**
 * Validates a target URL against Server-Side Request Forgery (SSRF) threats.
 */
export async function validateEndpointUrl(
  urlString: string,
  options?: SSRFValidationOptions
): Promise<SSRFValidationResult> {
  if (!urlString || typeof urlString !== 'string') {
    return { isValid: false, reason: 'Endpoint URL is required' };
  }

  const trimmed = urlString.trim();
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return { isValid: false, reason: 'Malformed URL: Invalid URL format' };
  }

  // 1. Protocol Validation: Only HTTP and HTTPS are permitted
  const protocol = parsedUrl.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    return {
      isValid: false,
      reason: `Forbidden protocol "${protocol}". Only http: and https: protocols are permitted.`,
    };
  }

  // 2. Reject embedded user credentials (e.g. http://user:pass@example.com)
  if (parsedUrl.username || parsedUrl.password) {
    return {
      isValid: false,
      reason: 'URL must not contain embedded user credentials (user:password@host)',
    };
  }

  // 3. Hostname checks
  let rawHostname = parsedUrl.hostname.toLowerCase();
  // Strip IPv6 brackets if present
  if (rawHostname.startsWith('[') && rawHostname.endsWith(']')) {
    rawHostname = rawHostname.slice(1, -1);
  }

  if (!rawHostname) {
    return { isValid: false, reason: 'URL hostname is missing' };
  }

  // Reject blocked metadata hostnames
  if (BLOCKED_HOSTNAMES.has(rawHostname) || rawHostname.endsWith('.google.internal')) {
    return {
      isValid: false,
      reason: `Access to cloud metadata hostname "${rawHostname}" is permanently forbidden.`,
    };
  }

  // 4. Port Validation
  const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : protocol === 'https:' ? 443 : 80;
  if (isNaN(port) || port < 1 || port > 65535) {
    return { isValid: false, reason: `Invalid port number: ${parsedUrl.port}` };
  }

  if (RESTRICTED_PORTS.has(port)) {
    return {
      isValid: false,
      reason: `Port ${port} is restricted for custom inference endpoints (database/internal service port).`,
    };
  }

  const allowPrivate =
    options?.allowPrivateNetworks ?? process.env.CORTEX_ALLOW_PRIVATE_ENDPOINTS === 'true';

  // 5. Hostname / IP address classification
  const isDirectIp = net.isIP(rawHostname) !== 0;

  let resolvedIps: string[] = [];

  if (isDirectIp) {
    resolvedIps = [rawHostname];
  } else if (rawHostname === 'localhost' || rawHostname.endsWith('.localhost')) {
    resolvedIps = ['127.0.0.1'];
  } else if (!options?.skipDnsLookup) {
    // Resolve DNS records
    try {
      if (options?.lookupFn) {
        const customResults = await options.lookupFn(rawHostname);
        resolvedIps = customResults.map((r) => r.address);
      } else {
        const lookupResults = await dns.promises.lookup(rawHostname, { all: true });
        resolvedIps = lookupResults.map((r) => r.address);
      }
    } catch (dnsErr: any) {
      return {
        isValid: false,
        reason: `DNS resolution failed for hostname "${rawHostname}": ${dnsErr.message || dnsErr.code}`,
      };
    }
  }

  if (resolvedIps.length === 0 && isDirectIp) {
    resolvedIps = [rawHostname];
  }

  // 6. Inspect every resolved IP address
  for (const ip of resolvedIps) {
    // Cloud metadata is strictly forbidden under all configurations
    if (isCloudMetadataIp(ip)) {
      return {
        isValid: false,
        reason: `Target IP address "${ip}" is a restricted cloud metadata address.`,
        resolvedIps,
      };
    }

    // Reserved / Multicast
    if (isReservedOrMulticastIp(ip)) {
      return {
        isValid: false,
        reason: `Target IP address "${ip}" is a reserved or multicast address.`,
        resolvedIps,
      };
    }

    // Loopback
    if (isLoopbackIp(ip) && !allowPrivate) {
      return {
        isValid: false,
        reason: `Target IP address "${ip}" is within a restricted loopback address range.`,
        resolvedIps,
      };
    }

    // Private networks (RFC 1918)
    if (isPrivateIp(ip) && !allowPrivate) {
      return {
        isValid: false,
        reason: `Target IP address "${ip}" is within a restricted private network range.`,
        resolvedIps,
      };
    }
  }

  return {
    isValid: true,
    normalizedUrl: parsedUrl.origin + parsedUrl.pathname + parsedUrl.search,
    resolvedIps,
  };
}

/**
 * Asserts that an endpoint URL is safe from SSRF; throws an Error if invalid.
 */
export async function assertSafeEndpointUrl(
  urlString: string,
  options?: SSRFValidationOptions
): Promise<string> {
  const result = await validateEndpointUrl(urlString, options);
  if (!result.isValid) {
    throw new Error(`SSRF protection: ${result.reason}`);
  }
  return result.normalizedUrl || urlString;
}
