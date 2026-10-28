/**
 * FlexiDash Secure In-Memory Session Manager
 *
 * CRITICAL SECURITY INVARIANT:
 * - Tokens and privileged session claims are stored strictly in private module memory.
 * - NEVER persisted to window.localStorage or window.sessionStorage, preventing XSS token exfiltration.
 * - Client secrets are never exposed to browser context.
 */

import type { AuthSession } from '../models/session.ts';

export type SessionChangeListener = (session: AuthSession | null) => void;

class SessionManager {
  private activeToken: string | null = null;
  private activeSession: AuthSession | null = null;
  private listeners: Set<SessionChangeListener> = new Set();

  /**
   * Set active in-memory session and bearer token
   */
  public setSession(token: string, session: AuthSession): void {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token passed to SessionManager');
    }
    this.activeToken = token;
    this.activeSession = session;
    this.notifyListeners();
  }

  /**
   * Invalidate and purge the in-memory session
   */
  public clearSession(): void {
    this.activeToken = null;
    this.activeSession = null;
    this.notifyListeners();
  }

  /**
   * Get the current in-memory bearer token
   */
  public getToken(): string | null {
    return this.activeToken;
  }

  /**
   * Get the active session details
   */
  public getSession(): AuthSession | null {
    return this.activeSession;
  }

  /**
   * Check if a valid session exists in memory
   */
  public isAuthenticated(): boolean {
    if (!this.activeToken || !this.activeSession) {
      return false;
    }
    // Check local expiration timestamp if available
    if (this.activeSession.expiresAt && Date.now() / 1000 > this.activeSession.expiresAt) {
      this.clearSession();
      return false;
    }
    return true;
  }

  /**
   * Subscribe to session state changes
   */
  public subscribe(listener: SessionChangeListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state
    listener(this.activeSession);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const session = this.activeSession;
    for (const listener of this.listeners) {
      try {
        listener(session);
      } catch (err) {
        console.error('[SessionManager] Listener error:', err);
      }
    }
  }
}

export const sessionManager = new SessionManager();

