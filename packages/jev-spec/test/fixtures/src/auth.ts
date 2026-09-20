export interface SessionPayload {
  userId: string;
  tokenId: string;
  expiresAt: number;
}

export class SessionService {
  private revokedTokens = new Set<string>();

  verifyToken(token: string): SessionPayload | null {
    if (!token || !token.startsWith('valid-sig-')) {
      return null;
    }
    const tokenId = token.replace('valid-sig-', '');
    if (this.revokedTokens.has(tokenId)) {
      return null;
    }
    return {
      userId: 'user-123',
      tokenId,
      expiresAt: Date.now() + 3600 * 1000,
    };
  }

  revoke(tokenId: string): void {
    this.revokedTokens.add(tokenId);
  }
}
