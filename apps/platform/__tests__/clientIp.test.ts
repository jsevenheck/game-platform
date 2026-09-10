import { getTrustedProxyHops, resolveClientIp } from '../server/observability/clientIp';

describe('clientIp', () => {
  describe('getTrustedProxyHops', () => {
    it('defaults to 1 (the deployed single Traefik hop)', () => {
      expect(getTrustedProxyHops({})).toBe(1);
    });

    it('reads TRUST_PROXY_HOPS when set to a valid non-negative integer', () => {
      expect(getTrustedProxyHops({ TRUST_PROXY_HOPS: '2' })).toBe(2);
      expect(getTrustedProxyHops({ TRUST_PROXY_HOPS: '0' })).toBe(0);
    });

    it('falls back to 1 for an invalid value', () => {
      expect(getTrustedProxyHops({ TRUST_PROXY_HOPS: 'not-a-number' })).toBe(1);
      expect(getTrustedProxyHops({ TRUST_PROXY_HOPS: '-1' })).toBe(1);
    });
  });

  describe('resolveClientIp', () => {
    // F8 regression: the previous implementation took the LEFTMOST entry of
    // X-Forwarded-For — exactly the part a client can set to any value it
    // likes — instead of the entry appended by the one trusted reverse
    // proxy hop, making the connection rate limiter trivially bypassable.
    it('trusts the rightmost entry with one trusted hop, not the client-supplied leftmost one', () => {
      const spoofed = 'attacker-controlled-value, 203.0.113.7';
      expect(resolveClientIp(spoofed, '10.0.0.5', 1)).toBe('203.0.113.7');
    });

    it('trusts only the real socket peer when zero hops are trusted', () => {
      expect(resolveClientIp('1.2.3.4', '10.0.0.5', 0)).toBe('10.0.0.5');
    });

    it('falls back to the socket peer address when no header is present', () => {
      expect(resolveClientIp(undefined, '10.0.0.5', 1)).toBe('10.0.0.5');
    });

    it('falls back to "unknown" when neither is available', () => {
      expect(resolveClientIp(undefined, undefined, 1)).toBe('unknown');
    });

    it('trusts the Nth-from-right entry for a multi-hop chain', () => {
      const chain = 'client-claimed, edge-proxy, internal-lb';
      expect(resolveClientIp(chain, '10.0.0.5', 2)).toBe('edge-proxy');
    });

    it('handles an array header value (Node can normalize duplicate headers to an array)', () => {
      expect(resolveClientIp(['1.2.3.4', '5.6.7.8'], '10.0.0.5', 1)).toBe('5.6.7.8');
    });
  });
});
