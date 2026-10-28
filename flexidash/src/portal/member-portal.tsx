/**
 * FlexiDash Site-Facing Member Portal Shell
 *
 * Implements the comprehensive lifecycle and state machine for member dashboards:
 * - Loading: Initializing session & fetching server-authorized layout
 * - Unauthenticated: Member login & registration interface
 * - Authenticated: Renders effective layout canvas with user profile header
 * - Expired: Automatic session expiry detection with re-auth prompt
 * - Forbidden: Default-deny permission failure notice
 * - Empty: Friendly empty state when no widgets are assigned
 * - Error: Network or server fault with retry action
 *
 * ZERO LOCALSTORAGE GUARANTEE:
 * All auth tokens are stored exclusively in in-memory SessionManager.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiClientError, type PortalLayoutResponse } from '../client/api-client.ts';
import { sessionManager } from '../client/session-manager.ts';
import type { AuthSession } from '../models/session.ts';
import type { WidgetInstance } from '../layout/types.ts';
import { WidgetCanvas } from './widget-canvas.tsx';
import type { PortalViewState } from './types.ts';

export const MemberPortal: React.FC = () => {
  const [session, setSession] = useState<AuthSession | null>(() => sessionManager.getSession());
  const [viewState, setViewState] = useState<PortalViewState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [portalData, setPortalData] = useState<PortalLayoutResponse | null>(null);

  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // 1. Subscribe to SessionManager
  useEffect(() => {
    const unsubscribe = sessionManager.subscribe((newSession) => {
      setSession(newSession);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch authoritative portal layout
  const fetchLayout = useCallback(async () => {
    const currentSession = sessionManager.getSession();
    if (!currentSession) {
      setViewState('unauthenticated');
      return;
    }

    setViewState('loading');
    setErrorMessage('');

    try {
      const response = await apiClient.getPortalLayout(currentSession.instanceId);
      setPortalData(response);

      const widgets = response.layout?.widgets || [];
      if (widgets.length === 0) {
        setViewState('empty');
      } else {
        setViewState('authenticated');
      }
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          sessionManager.clearSession();
          setViewState('expired');
          setErrorMessage('Your session has expired or is invalid. Please sign in again.');
        } else if (err.statusCode === 403) {
          setViewState('forbidden');
          setErrorMessage('You do not have permission to access the member portal.');
        } else {
          setViewState('error');
          setErrorMessage(err.message || 'An unexpected API error occurred.');
        }
      } else {
        setViewState('error');
        setErrorMessage(err?.message || 'Failed to connect to the portal service.');
      }
    }
  }, []);

  // 3. React to session state changes
  useEffect(() => {
    if (session) {
      fetchLayout();
    } else {
      if (viewState !== 'expired') {
        setViewState('unauthenticated');
      }
    }
  }, [session, fetchLayout]);

  // Auth handlers
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      await apiClient.login({
        email,
        password,
      });
      // apiClient.login sets SessionManager, which triggers subscription
    } catch (err: any) {
      setAuthError(err?.message || 'Invalid email or password.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      await apiClient.register({
        email,
        password,
      });
    } catch (err: any) {
      setAuthError(err?.message || 'Registration failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch (err) {
      console.warn('[MemberPortal] Logout error:', err);
    }
    setViewState('unauthenticated');
    setPortalData(null);
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    apiClient
      .login({ email: demoEmail, password: demoPass })
      .catch((err) => setAuthError(err.message));
  };

  // Active WidgetInstance array from server-filtered layout
  const activeWidgetInstances: WidgetInstance[] = portalData?.layout?.widgets || [];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f7fafc',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#1a202c',
        display: 'flex',
        flexDirection: 'column',
      }}
      data-testid="member-portal-container"
      data-view-state={viewState}
    >
      {/* Header Navigation */}
      <header
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#3182ce',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '18px',
            }}
          >
            F
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#2d3748' }}>FlexiDash</div>
            <div style={{ fontSize: '11px', color: '#718096' }}>Site Member Portal</div>
          </div>
        </div>

        {session && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#2d3748' }}>
                {session.email || session.userId}
              </div>
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                {session.roles.map((r, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '10px',
                      backgroundColor: '#ebf8ff',
                      color: '#2b6cb0',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                  >
                    {r.replace('role_', '').toUpperCase()}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={fetchLayout}
              style={{
                backgroundColor: '#edf2f7',
                border: '1px solid #cbd5e0',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                color: '#4a5568',
                cursor: 'pointer',
                fontWeight: 500,
              }}
              title="Refresh Layout"
              data-testid="portal-refresh-btn"
            >
              🔄 Refresh
            </button>

            <button
              onClick={handleLogout}
              style={{
                backgroundColor: '#fff5f5',
                border: '1px solid #feb2b2',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                color: '#c53030',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              data-testid="portal-logout-btn"
            >
              Log Out
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '24px', maxWidth: '1280px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {/* Loading State */}
        {viewState === 'loading' && (
          <div
            style={{
              padding: '80px 24px',
              textAlign: 'center',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
            data-testid="portal-loading-state"
          >
            <div style={{ fontSize: '28px', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⏳</div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#2d3748' }}>Loading Member Portal</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#718096' }}>Authenticating session and fetching your authorized widgets...</p>
          </div>
        )}

        {/* Expired Session Banner */}
        {viewState === 'expired' && (
          <div
            role="alert"
            aria-live="polite"
            style={{
              backgroundColor: '#fffaf0',
              border: '1px solid #fbd38d',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
              color: '#c05621',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
            data-testid="portal-expired-state"
          >
            <span style={{ fontSize: '20px' }} aria-hidden="true">⚠️</span>
            <div>
              <strong style={{ fontSize: '14px' }}>Session Expired</strong>
              <div style={{ fontSize: '13px' }}>Your authenticated session has ended. Please sign in below to resume.</div>
            </div>
          </div>
        )}

        {/* Forbidden State */}
        {viewState === 'forbidden' && (
          <div
            style={{
              backgroundColor: '#fff5f5',
              border: '1px solid #feb2b2',
              borderRadius: '8px',
              padding: '24px',
              textAlign: 'center',
              color: '#c53030',
            }}
            data-testid="portal-forbidden-state"
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚫</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Access Denied</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#742a2a' }}>
              {errorMessage || 'Your active account role lacks permission to access this portal.'}
            </p>
            <button
              onClick={handleLogout}
              style={{
                backgroundColor: '#c53030',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Sign In with Different Account
            </button>
          </div>
        )}

        {/* Error State */}
        {viewState === 'error' && (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '32px',
              textAlign: 'center',
            }}
            data-testid="portal-error-state"
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#2d3748' }}>Unable to Load Portal</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#e53e3e' }}>{errorMessage}</p>
            <button
              onClick={fetchLayout}
              style={{
                backgroundColor: '#3182ce',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Unauthenticated / Sign-in View */}
        {(viewState === 'unauthenticated' || viewState === 'expired') && (
          <div
            style={{
              maxWidth: '440px',
              margin: '40px auto',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '28px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06)',
            }}
            data-testid="portal-auth-card"
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 700, color: '#1a202c' }}>
                {authMode === 'login' ? 'Member Portal Sign In' : 'Create Member Account'}
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#718096' }}>
                Access your personalized widgets and site controls
              </p>
            </div>

            {authError && (
              <div
                role="alert"
                aria-live="polite"
                style={{
                  backgroundColor: '#fff5f5',
                  border: '1px solid #feb2b2',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  marginBottom: '16px',
                  color: '#c53030',
                  fontSize: '13px',
                }}
                data-testid="portal-auth-error"
              >
                {authError}
              </div>
            )}

            <form onSubmit={authMode === 'login' ? handleLogin : handleRegister}>
              <div style={{ marginBottom: '14px' }}>
                <label
                  htmlFor="portal-auth-email"
                  style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4a5568', marginBottom: '4px' }}
                >
                  Email Address
                </label>
                <input
                  id="portal-auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e0',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                  data-testid="portal-auth-email"
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="portal-auth-password"
                  style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4a5568', marginBottom: '4px' }}
                >
                  Password
                </label>
                <input
                  id="portal-auth-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e0',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                  data-testid="portal-auth-password"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#3182ce',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: authLoading ? 'not-allowed' : 'pointer',
                  opacity: authLoading ? 0.7 : 1,
                }}
                data-testid="portal-auth-submit"
              >
                {authLoading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Register Account'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#718096' }}>
              {authMode === 'login' ? (
                <>
                  Need an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setAuthError('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3182ce',
                      cursor: 'pointer',
                      fontWeight: 600,
                      textDecoration: 'underline',
                      padding: 0,
                      font: 'inherit',
                    }}
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3182ce',
                      cursor: 'pointer',
                      fontWeight: 600,
                      textDecoration: 'underline',
                      padding: 0,
                      font: 'inherit',
                    }}
                  >
                    Sign In
                  </button>
                </>
              )}
            </div>

            {/* Quick Demo Login Credentials */}
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #edf2f7' }}>
              <div style={{ fontSize: '11px', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Quick Test Accounts:
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin@flexidash.local', 'AdminSecure123!')}
                  style={{
                    flex: 1,
                    padding: '6px',
                    fontSize: '11px',
                    backgroundColor: '#f7fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  data-testid="quick-login-admin"
                >
                  ⚡ Admin Demo
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('member@flexidash.local', 'MemberPass123!')}
                  style={{
                    flex: 1,
                    padding: '6px',
                    fontSize: '11px',
                    backgroundColor: '#f7fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  data-testid="quick-login-member"
                >
                  ⚡ Member Demo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Authenticated View: Active Layout & Canvas */}
        {viewState === 'authenticated' && portalData && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '18px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div>
                <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: 700, color: '#1a202c' }}>
                  {portalData.layout?.name || 'My Dashboard'}
                </h1>
                <div style={{ fontSize: '13px', color: '#718096' }}>
                  {portalData.isCustomized ? 'Personalized Layout' : 'Site Default Layout'} • {activeWidgetInstances.length} active widgets
                </div>
              </div>

              {portalData.isCustomized && (
                <span
                  style={{
                    fontSize: '12px',
                    backgroundColor: '#e6fffa',
                    color: '#234e52',
                    padding: '4px 10px',
                    borderRadius: '16px',
                    fontWeight: 600,
                  }}
                >
                  ✨ Customized by you
                </span>
              )}
            </div>

            <WidgetCanvas
              widgets={activeWidgetInstances}
              columns={portalData.layout?.columns || 4}
              session={session}
              permissions={session?.permissions}
              role={portalData.roles?.[0]}
              onRefresh={fetchLayout}
            />
          </div>
        )}

        {/* Empty State */}
        {viewState === 'empty' && (
          <WidgetCanvas
            widgets={[]}
            columns={4}
            session={session}
            permissions={session?.permissions}
            role={portalData?.roles?.[0]}
            onRefresh={fetchLayout}
          />
        )}
      </main>
    </div>
  );
};
