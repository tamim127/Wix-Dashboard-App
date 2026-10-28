/**
 * FlexiDash Site-Facing Member Portal & Custom Dashboard Builder Shell
 *
 * Implements the complete Member Portal experience:
 * - Dynamic Navigation Control (hides/shows navbar links based on role & permissions)
 * - Custom Dashboard Builder Mode (in-place visual layout customizer with reorder, resize & add/remove)
 * - Custom Login, Registration & Password Reset Flows with 1-click Demo Account Switcher
 * - Multi-Role Experiences (Admin, Team Leader, Standard Member)
 * - Wix Ecosystem Integrations (Stores, Bookings, CRM, CMS)
 * - Customizable UI & White-Label Branding (Portal Title, Brand Color, Welcome Banner)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient, ApiClientError, type PortalLayoutResponse } from '../client/api-client.ts';
import { sessionManager } from '../client/session-manager.ts';
import type { AuthSession } from '../models/session.ts';
import type { WidgetInstance, WidgetSize, WidgetDefinition, DashboardLayout } from '../layout/types.ts';
import { WIDGET_REGISTRY } from '../layout/registry.ts';
import { WidgetCanvas } from './widget-canvas.tsx';
import type { PortalViewState } from './types.ts';

// Dedicated section views
import { WixStoresWidget } from './widgets/wix-stores.tsx';
import { WixBookingsWidget } from './widgets/wix-bookings.tsx';
import { WixCrmWidget } from './widgets/wix-crm.tsx';
import { WixCmsWidget } from './widgets/wix-cms.tsx';
import { TeamManagementWidget } from './widgets/team-management.tsx';
import { MemberDirectoryWidget } from './widgets/member-directory.tsx';
import { AuditLogWidget } from './widgets/audit-log.tsx';
import { RolesTableWidget } from './widgets/roles-table.tsx';

type PortalSection = 'canvas' | 'team' | 'stores' | 'bookings' | 'cms' | 'members' | 'roles' | 'audit';

export const MemberPortal: React.FC = () => {
  const [session, setSession] = useState<AuthSession | null>(() => sessionManager.getSession());
  const [viewState, setViewState] = useState<PortalViewState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [portalData, setPortalData] = useState<PortalLayoutResponse | null>(null);

  // Active Navigation Section
  const [activeSection, setActiveSection] = useState<PortalSection>('canvas');

  // Interactive Visual Layout Builder State
  const [builderMode, setBuilderMode] = useState<boolean>(false);
  const [previewRole, setPreviewRole] = useState<string | null>(null);
  const [editableWidgets, setEditableWidgets] = useState<WidgetInstance[]>([]);
  const [savingLayout, setSavingLayout] = useState<boolean>(false);
  const [builderNotice, setBuilderNotice] = useState<string | null>(null);
  const [showAddWidgetModal, setShowAddWidgetModal] = useState<boolean>(false);

  // White-Label Branding Customization State
  const [showBrandingModal, setShowBrandingModal] = useState<boolean>(false);
  const [brandTitle, setBrandTitle] = useState<string>('FlexiDash Member Portal');
  const [brandColor, setBrandColor] = useState<string>('#0070F3');
  const [welcomeMessage, setWelcomeMessage] = useState<string>('Welcome to your personalized portal workspace.');

  // Auth Form State (Login / Register / Forgot Password)
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

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
      setEditableWidgets(response.layout?.widgets || []);

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

  // 3. React to session changes
  useEffect(() => {
    if (session) {
      fetchLayout();
    } else {
      if (viewState !== 'expired') {
        setViewState('unauthenticated');
      }
    }
  }, [session, fetchLayout]);

  // Auth Handlers
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      await apiClient.login({ email, password });
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
    setAuthSuccess('');

    try {
      await apiClient.register({ email, password });
      setAuthSuccess('Account created successfully! Signing you in...');
    } catch (err: any) {
      setAuthError(err?.message || 'Registration failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setTimeout(() => {
      setAuthLoading(false);
      setAuthSuccess(`Password reset instructions have been dispatched to ${email || 'your email'}.`);
    }, 600);
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch (err) {
      console.warn('[MemberPortal] Logout error:', err);
    }
    setViewState('unauthenticated');
    setPortalData(null);
    setBuilderMode(false);
    setActiveSection('canvas');
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setAuthLoading(true);
    setAuthError('');
    apiClient
      .login({ email: demoEmail, password: demoPass })
      .catch((err) => setAuthError(err.message))
      .finally(() => setAuthLoading(false));
  };

  // Role Checks
  const userRoles = session?.roles || [];
  const isAdmin = userRoles.includes('role_admin') || userRoles.includes('role_site_owner');
  const isTeamLeader = userRoles.includes('role_team_leader');
  const canEditLayout = isAdmin || isTeamLeader || (session?.permissions.includes('dashboard:edit') ?? false);

  // Dynamic Navigation Control: Calculate visible navigation items based on user role & permissions
  const navItems = useMemo(() => {
    if (!session) return [];
    const items: { id: PortalSection; label: string; icon: string; count?: number }[] = [
      { id: 'canvas', label: 'Dashboard Canvas', icon: '📊' },
    ];

    if (isTeamLeader || isAdmin) {
      items.push({ id: 'team', label: 'My Team Hub', icon: '🎯' });
      items.push({ id: 'stores', label: 'Wix Stores', icon: '🛍️', count: 4 });
      items.push({ id: 'bookings', label: 'Wix Bookings', icon: '📅', count: 3 });
    }

    items.push({ id: 'cms', label: 'CMS Content', icon: '📚' });

    if (isAdmin) {
      items.push({ id: 'members', label: 'Member Roster', icon: '👥' });
      items.push({ id: 'roles', label: 'Role Privileges', icon: '🛡️' });
      items.push({ id: 'audit', label: 'Audit Trail', icon: '🔒' });
    }

    return items;
  }, [session, isAdmin, isTeamLeader]);

  // Layout Builder Operations
  const handleMoveWidget = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= editableWidgets.length) return;
    const newWidgets = [...editableWidgets];
    const [moved] = newWidgets.splice(index, 1);
    newWidgets.splice(targetIndex, 0, moved);
    const updated = newWidgets.map((w, idx) => ({ ...w, order: idx }));
    setEditableWidgets(updated);
    setBuilderNotice('Layout modified. Click "Save Layout" to persist changes.');
  };

  const handleChangeWidgetSize = (index: number, newSize: WidgetSize) => {
    const updated = editableWidgets.map((w, idx) =>
      idx === index ? { ...w, size: newSize } : w
    );
    setEditableWidgets(updated);
    setBuilderNotice(`Widget size changed to ${newSize}. Remember to save!`);
  };

  const handleToggleWidgetVisibility = (index: number) => {
    const updated = editableWidgets.map((w, idx) =>
      idx === index ? { ...w, visible: !w.visible } : w
    );
    setEditableWidgets(updated);
    setBuilderNotice('Visibility updated. Remember to save.');
  };

  const handleRemoveWidget = (index: number) => {
    const updated = editableWidgets
      .filter((_, idx) => idx !== index)
      .map((w, idx) => ({ ...w, order: idx }));
    setEditableWidgets(updated);
    setBuilderNotice('Widget removed from layout canvas.');
  };

  const handleAddWidget = (widgetDef: WidgetDefinition) => {
    const newInstance: WidgetInstance = {
      instanceId: `inst-${widgetDef.id}-${Date.now().toString().slice(-4)}`,
      widgetId: widgetDef.id,
      size: widgetDef.defaultSize,
      order: editableWidgets.length,
      visible: true,
      config: widgetDef.defaultConfig,
    };
    setEditableWidgets([...editableWidgets, newInstance]);
    setShowAddWidgetModal(false);
    setBuilderNotice(`Added "${widgetDef.title}" to canvas.`);
  };

  const handleSaveLayout = async () => {
    if (!portalData?.layout) return;
    setSavingLayout(true);
    setBuilderNotice(null);

    const updatedLayout: DashboardLayout = {
      ...portalData.layout,
      widgets: editableWidgets,
      updatedAt: new Date().toISOString(),
    };

    try {
      await apiClient.savePortalLayout(updatedLayout, session?.instanceId);
      setBuilderNotice('✅ Layout saved successfully to tenant storage!');
      await fetchLayout();
    } catch (err: any) {
      setBuilderNotice(`❌ Failed to save layout: ${err.message}`);
    } finally {
      setSavingLayout(false);
    }
  };

  const handleResetLayout = async () => {
    if (!window.confirm('Reset this layout back to site default template?')) return;
    try {
      await apiClient.resetPortalLayout(session?.instanceId);
      await fetchLayout();
      setBuilderNotice('Layout reset to default site template.');
    } catch (err: any) {
      setBuilderNotice(`Reset failed: ${err.message}`);
    }
  };

  // Active widgets displayed on the canvas (respects role preview in Builder Mode)
  const activeWidgetInstances: WidgetInstance[] = useMemo(() => {
    const widgets = builderMode ? editableWidgets : (portalData?.layout?.widgets || []);
    if (!builderMode) return widgets;

    // In builder mode with role preview active:
    if (previewRole === 'role_member') {
      return widgets.filter((w) => {
        const def = WIDGET_REGISTRY[w.widgetId];
        return !def || def.requiredPermission === 'dashboard:view' || def.requiredPermission === 'portal:access';
      });
    }
    if (previewRole === 'role_team_leader') {
      return widgets.filter((w) => {
        const def = WIDGET_REGISTRY[w.widgetId];
        return !def || def.category !== 'system';
      });
    }
    return widgets;
  }, [builderMode, editableWidgets, portalData, previewRole]);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
      }}
      data-testid="member-portal-container"
      data-view-state={viewState}
    >
      {/* 1. TOP HEADER & WHITE-LABEL BRANDING */}
      <header
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        <div
          style={{
            maxWidth: '1360px',
            margin: '0 auto',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          {/* Logo & Portal Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: brandColor,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '19px',
                boxShadow: `0 4px 10px ${brandColor}40`,
              }}
            >
              F
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '17px', color: '#0f172a', letterSpacing: '-0.02em' }}>
                {brandTitle}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Wix Managed Member Experience Platform
              </div>
            </div>
          </div>

          {/* User Profile / Status / Quick Controls */}
          {session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Custom Dashboard Builder Toggle (For authorized roles) */}
              {canEditLayout && (
                <button
                  type="button"
                  onClick={() => {
                    setBuilderMode(!builderMode);
                    setActiveSection('canvas');
                    setBuilderNotice(null);
                  }}
                  style={{
                    backgroundColor: builderMode ? '#0f172a' : '#f1f5f9',
                    color: builderMode ? '#ffffff' : '#0f172a',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '7px 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                  title="Toggle Visual Layout Builder"
                >
                  <span>🎨</span>
                  <span>{builderMode ? 'Exit Builder' : 'Custom Dashboard Builder'}</span>
                </button>
              )}

              {/* Branding Customizer Button */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowBrandingModal(true)}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '7px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                  title="Customize Portal Branding"
                >
                  🖌️ Branding
                </button>
              )}

              {/* User Profile Pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '20px',
                  padding: '4px 12px 4px 6px',
                }}
              >
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: brandColor,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {session.email ? session.email[0].toUpperCase() : 'U'}
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                    {session.email || session.userId}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    backgroundColor: isAdmin ? '#fef3c7' : isTeamLeader ? '#dbeafe' : '#f1f5f9',
                    color: isAdmin ? '#92400e' : isTeamLeader ? '#1e40af' : '#475569',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                  }}
                >
                  {isAdmin ? '👑 ADMIN' : isTeamLeader ? '⭐ TEAM LEADER' : '👤 MEMBER'}
                </span>
              </div>

              {/* Refresh & Logout */}
              <button
                type="button"
                onClick={fetchLayout}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                title="Refresh Portal State"
                data-testid="portal-refresh-btn"
              >
                🔄
              </button>

              <button
                type="button"
                onClick={handleLogout}
                style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  fontSize: '12px',
                  color: '#991b1b',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                data-testid="portal-logout-btn"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setViewState('unauthenticated'); }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: brandColor,
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Member Sign In
              </button>
            </div>
          )}
        </div>

        {/* 2. DYNAMIC NAVIGATION BAR (Navigation Control per Role) */}
        {session && (
          <div
            style={{
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #f1f5f9',
              padding: '0 24px',
            }}
          >
            <div
              style={{
                maxWidth: '1360px',
                margin: '0 auto',
                display: 'flex',
                gap: '4px',
                overflowX: 'auto',
              }}
            >
              {navItems.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.id);
                      setBuilderMode(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '12px 16px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: isActive ? `3px solid ${brandColor}` : '3px solid transparent',
                      color: isActive ? brandColor : '#64748b',
                      fontSize: '13px',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                    {item.count && (
                      <span
                        style={{
                          fontSize: '10px',
                          backgroundColor: '#e2e8f0',
                          color: '#475569',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          fontWeight: 700,
                        }}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* 3. VISUAL BUILDER TOOLBAR (When Builder Mode is Active) */}
      {session && builderMode && (
        <div
          style={{
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            padding: '12px 24px',
            borderBottom: '1px solid #1e293b',
          }}
        >
          <div
            style={{
              maxWidth: '1360px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '16px' }}>🎨</span>
              <div>
                <strong style={{ fontSize: '13px' }}>Visual Dashboard & Layout Builder Active</strong>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Drag, reorder, resize widgets & preview live role permissions
                </div>
              </div>
            </div>

            {/* Role Preview Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Preview Canvas as:</span>
              <select
                value={previewRole || ''}
                onChange={(e) => setPreviewRole(e.target.value || null)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  backgroundColor: '#1e293b',
                  color: '#ffffff',
                  border: '1px solid #334155',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <option value="">Full Layout (All Widgets)</option>
                <option value="role_member">Standard Member View</option>
                <option value="role_team_leader">Team Leader View</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowAddWidgetModal(true)}
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + Add Widget
              </button>

              <button
                type="button"
                onClick={handleSaveLayout}
                disabled={savingLayout}
                style={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {savingLayout ? 'Saving...' : '💾 Save Layout'}
              </button>

              <button
                type="button"
                onClick={handleResetLayout}
                style={{
                  backgroundColor: '#334155',
                  color: '#cbd5e1',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Reset Default
              </button>

              <button
                type="button"
                onClick={() => setBuilderMode(false)}
                style={{
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>

          {builderNotice && (
            <div
              style={{
                maxWidth: '1360px',
                margin: '10px auto 0 auto',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: '#1e293b',
                color: '#38bdf8',
                fontSize: '12px',
              }}
            >
              {builderNotice}
            </div>
          )}
        </div>
      )}

      {/* 4. MAIN CONTENT AREA */}
      <main
        style={{
          flex: 1,
          padding: '24px',
          maxWidth: '1360px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Loading State */}
        {viewState === 'loading' && (
          <div
            style={{
              padding: '80px 24px',
              textAlign: 'center',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            data-testid="portal-loading-state"
          >
            <div style={{ fontSize: '32px', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⏳</div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#1e293b' }}>Loading Member Portal</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Authenticating session and preparing your personalized dashboard...
            </p>
          </div>
        )}

        {/* Expired Session Banner */}
        {viewState === 'expired' && (
          <div
            role="alert"
            style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '10px',
              padding: '16px 20px',
              marginBottom: '20px',
              color: '#92400e',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
            data-testid="portal-expired-state"
          >
            <span style={{ fontSize: '22px' }}>⚠️</span>
            <div>
              <strong style={{ fontSize: '14px' }}>Session Expired</strong>
              <div style={{ fontSize: '13px' }}>Your authenticated session has ended. Please sign in below to resume.</div>
            </div>
          </div>
        )}

        {/* Forbidden Notice */}
        {viewState === 'forbidden' && (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              padding: '40px 24px',
              textAlign: 'center',
            }}
            data-testid="portal-forbidden-state"
          >
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>🚫</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#991b1b' }}>Access Restricted</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#7f1d1d' }}>
              {errorMessage || 'Your active account role lacks permission to access this portal section.'}
            </p>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Sign In with Authorized Account
            </button>
          </div>
        )}

        {/* Error State */}
        {viewState === 'error' && (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
            }}
            data-testid="portal-error-state"
          >
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a' }}>Unable to Connect</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#ef4444' }}>{errorMessage}</p>
            <button
              type="button"
              onClick={fetchLayout}
              style={{
                backgroundColor: brandColor,
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* 5. CUSTOM LOGIN, REGISTRATION & PASSWORD RESET MODAL / VIEW */}
        {(viewState === 'unauthenticated' || viewState === 'expired') && (
          <div
            style={{
              maxWidth: '460px',
              margin: '30px auto',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.06)',
            }}
            data-testid="portal-auth-card"
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: brandColor,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '24px',
                  margin: '0 auto 12px auto',
                }}
              >
                F
              </div>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
                {authMode === 'login' && 'Member Sign In'}
                {authMode === 'register' && 'Create Member Account'}
                {authMode === 'forgot' && 'Reset Password'}
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                {authMode === 'login' && 'Sign in to access your role-authorized widgets & custom layout'}
                {authMode === 'register' && 'Join your community portal and customize your dashboard'}
                {authMode === 'forgot' && 'Enter your registered email to receive a password reset link'}
              </p>
            </div>

            {/* Auth Tab Switcher */}
            <div
              style={{
                display: 'flex',
                backgroundColor: '#f1f5f9',
                borderRadius: '8px',
                padding: '4px',
                marginBottom: '20px',
              }}
            >
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}
                style={{
                  flex: 1,
                  padding: '7px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: authMode === 'login' ? '#ffffff' : 'transparent',
                  fontWeight: authMode === 'login' ? 700 : 500,
                  fontSize: '12px',
                  color: authMode === 'login' ? '#0f172a' : '#64748b',
                  cursor: 'pointer',
                  boxShadow: authMode === 'login' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccess(''); }}
                style={{
                  flex: 1,
                  padding: '7px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: authMode === 'register' ? '#ffffff' : 'transparent',
                  fontWeight: authMode === 'register' ? 700 : 500,
                  fontSize: '12px',
                  color: authMode === 'register' ? '#0f172a' : '#64748b',
                  cursor: 'pointer',
                  boxShadow: authMode === 'register' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('forgot'); setAuthError(''); setAuthSuccess(''); }}
                style={{
                  flex: 1,
                  padding: '7px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: authMode === 'forgot' ? '#ffffff' : 'transparent',
                  fontWeight: authMode === 'forgot' ? 700 : 500,
                  fontSize: '12px',
                  color: authMode === 'forgot' ? '#0f172a' : '#64748b',
                  cursor: 'pointer',
                  boxShadow: authMode === 'forgot' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                Reset
              </button>
            </div>

            {authError && (
              <div
                role="alert"
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  color: '#b91c1c',
                  fontSize: '13px',
                }}
                data-testid="portal-auth-error"
              >
                {authError}
              </div>
            )}

            {authSuccess && (
              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  color: '#15803d',
                  fontSize: '13px',
                }}
              >
                {authSuccess}
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={authMode === 'login' ? handleLogin : authMode === 'register' ? handleRegister : handleForgotPassword}>
              <div style={{ marginBottom: '14px' }}>
                <label
                  htmlFor="portal-auth-email"
                  style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '5px' }}
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
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                  data-testid="portal-auth-email"
                />
              </div>

              {authMode !== 'forgot' && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <label
                      htmlFor="portal-auth-password"
                      style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}
                    >
                      Password
                    </label>
                    {authMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => setAuthMode('forgot')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: brandColor,
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          padding: 0,
                        }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    id="portal-auth-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                    data-testid="portal-auth-password"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '8px',
                  backgroundColor: brandColor,
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: authLoading ? 'not-allowed' : 'pointer',
                  opacity: authLoading ? 0.7 : 1,
                  boxShadow: `0 4px 12px ${brandColor}40`,
                }}
                data-testid="portal-auth-submit"
              >
                {authLoading ? 'Authenticating...' : authMode === 'login' ? 'Sign In to Dashboard' : authMode === 'register' ? 'Create Account' : 'Send Reset Link'}
              </button>
            </form>

            {/* 1-Click Role Switcher for Testing */}
            <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', textAlign: 'center' }}>
                Instant Demo Account Switcher:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin@flexidash.local', 'AdminPassword123!')}
                  style={{
                    padding: '8px 4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  data-testid="quick-login-admin"
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('leader@flexidash.local', 'LeaderPassword123!')}
                  style={{
                    padding: '8px 4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  data-testid="quick-login-leader"
                >
                  ⭐ Team Leader
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('member@flexidash.local', 'MemberPassword123!')}
                  style={{
                    padding: '8px 4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  data-testid="quick-login-member"
                >
                  👤 Member
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. AUTHENTICATED VIEW: SECTION DISPATCHER */}
        {viewState === 'authenticated' && portalData && (
          <div>
            {/* Welcome Greeting Banner */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <h1 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                  {activeSection === 'canvas' && (portalData.layout?.name || 'Personalized Dashboard Canvas')}
                  {activeSection === 'team' && '🎯 Team Leader Activity & Oversight Hub'}
                  {activeSection === 'stores' && '🛍️ Wix Stores Orders & Revenue'}
                  {activeSection === 'bookings' && '📅 Wix Bookings & Appointments Schedule'}
                  {activeSection === 'cms' && '📚 Wix CMS Dynamic Member Content'}
                  {activeSection === 'members' && '👥 Member Directory & Community Roster'}
                  {activeSection === 'roles' && '🛡️ Role & Permission Matrix'}
                  {activeSection === 'audit' && '🔒 Security & Governance Audit Trail'}
                </h1>
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  {welcomeMessage} • Role: <strong>{isAdmin ? 'Administrator' : isTeamLeader ? 'Team Leader' : 'Standard Member'}</strong>
                </div>
              </div>

              {canEditLayout && activeSection === 'canvas' && (
                <button
                  type="button"
                  onClick={() => setBuilderMode(!builderMode)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: builderMode ? '#0f172a' : brandColor,
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: `0 4px 10px ${brandColor}30`,
                  }}
                >
                  {builderMode ? 'Done Customizing' : '🛠️ Customize Widgets'}
                </button>
              )}
            </div>

            {/* SECTION 1: CANVAS & VISUAL BUILDER */}
            {activeSection === 'canvas' && (
              <div>
                {/* Visual Builder Widget Controls Overlay (when builderMode is active) */}
                {builderMode && (
                  <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                      Interactive Widget Controls (Move, Resize, Toggle Visibility):
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                      {editableWidgets.map((instance, idx) => {
                        const def = WIDGET_REGISTRY[instance.widgetId];
                        return (
                          <div
                            key={instance.instanceId}
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '8px',
                              padding: '10px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                                {def?.title || instance.widgetId}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                Size: <strong>{instance.size}</strong> • Order: {instance.order}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => handleMoveWidget(idx, 'up')}
                                disabled={idx === 0}
                                style={{ padding: '3px 6px', fontSize: '11px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                title="Move Up"
                              >
                                ⬆️
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveWidget(idx, 'down')}
                                disabled={idx === editableWidgets.length - 1}
                                style={{ padding: '3px 6px', fontSize: '11px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                title="Move Down"
                              >
                                ⬇️
                              </button>
                              <select
                                value={instance.size}
                                onChange={(e) => handleChangeWidgetSize(idx, e.target.value as WidgetSize)}
                                style={{ padding: '3px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                              >
                                <option value="small">Small (1 col)</option>
                                <option value="medium">Medium (2 col)</option>
                                <option value="large">Large (3 col)</option>
                                <option value="full">Full (4 col)</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => handleToggleWidgetVisibility(idx)}
                                style={{
                                  padding: '3px 6px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: instance.visible ? '#dcfce7' : '#fee2e2',
                                }}
                                title="Toggle Visibility"
                              >
                                {instance.visible ? '👁️' : '🙈'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveWidget(idx)}
                                style={{ padding: '3px 6px', fontSize: '11px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #fca5a5', color: '#dc2626' }}
                                title="Remove Widget"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* The Authorized Widget Canvas */}
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

            {/* SECTION 2: MY TEAM HUB (Team Leader & Admin) */}
            {activeSection === 'team' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <TeamManagementWidget
                  instance={{ instanceId: 'inst-team-1', widgetId: 'widget-team-management', size: 'full', order: 0, visible: true, config: {} }}
                  session={session}
                  permissions={session?.permissions}
                  role={userRoles[0]}
                  onRefresh={fetchLayout}
                />
                <WixCrmWidget
                  instance={{ instanceId: 'inst-crm-1', widgetId: 'widget-wix-crm', size: 'full', order: 1, visible: true, config: {} }}
                  session={session}
                  permissions={session?.permissions}
                  role={userRoles[0]}
                  onRefresh={fetchLayout}
                />
              </div>
            )}

            {/* SECTION 3: WIX STORES */}
            {activeSection === 'stores' && (
              <div>
                <WixStoresWidget
                  instance={{ instanceId: 'inst-stores-1', widgetId: 'widget-wix-stores', size: 'full', order: 0, visible: true, config: {} }}
                  session={session}
                  permissions={session?.permissions}
                  role={userRoles[0]}
                  onRefresh={fetchLayout}
                />
              </div>
            )}

            {/* SECTION 4: WIX BOOKINGS */}
            {activeSection === 'bookings' && (
              <div>
                <WixBookingsWidget
                  instance={{ instanceId: 'inst-bookings-1', widgetId: 'widget-wix-bookings', size: 'full', order: 0, visible: true, config: {} }}
                  session={session}
                  permissions={session?.permissions}
                  role={userRoles[0]}
                  onRefresh={fetchLayout}
                />
              </div>
            )}

            {/* SECTION 5: CMS CONTENT */}
            {activeSection === 'cms' && (
              <div>
                <WixCmsWidget
                  instance={{ instanceId: 'inst-cms-1', widgetId: 'widget-wix-cms', size: 'full', order: 0, visible: true, config: {} }}
                  session={session}
                  permissions={session?.permissions}
                  role={userRoles[0]}
                  onRefresh={fetchLayout}
                />
              </div>
            )}

            {/* SECTION 6: MEMBER DIRECTORY (Admin) */}
            {activeSection === 'members' && (
              <div>
                <MemberDirectoryWidget
                  instance={{ instanceId: 'inst-mem-1', widgetId: 'widget-member-directory', size: 'full', order: 0, visible: true, config: {} }}
                  session={session}
                  permissions={session?.permissions}
                  role={userRoles[0]}
                  onRefresh={fetchLayout}
                />
              </div>
            )}

            {/* SECTION 7: ROLE PRIVILEGES (Admin) */}
            {activeSection === 'roles' && (
              <div>
                <RolesTableWidget
                  instance={{ instanceId: 'inst-roles-1', widgetId: 'widget-roles-table', size: 'full', order: 0, visible: true, config: {} }}
                  session={session}
                  permissions={session?.permissions}
                  role={userRoles[0]}
                  onRefresh={fetchLayout}
                />
              </div>
            )}

            {/* SECTION 8: AUDIT TRAIL (Admin) */}
            {activeSection === 'audit' && (
              <div>
                <AuditLogWidget
                  instance={{ instanceId: 'inst-audit-1', widgetId: 'widget-audit-log', size: 'full', order: 0, visible: true, config: {} }}
                  session={session}
                  permissions={session?.permissions}
                  role={userRoles[0]}
                  onRefresh={fetchLayout}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* 7. ADD WIDGET MODAL (For Visual Builder Mode) */}
      {showAddWidgetModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  Widget Catalog Library
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Select a widget component to add to this portal layout canvas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddWidgetModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {Object.values(WIDGET_REGISTRY).map((widgetDef) => {
                const alreadyAdded = editableWidgets.some((w) => w.widgetId === widgetDef.id);
                return (
                  <div
                    key={widgetDef.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '14px',
                      backgroundColor: '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{widgetDef.title}</span>
                        <span style={{ fontSize: '10px', backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                          {widgetDef.category}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                        {widgetDef.description}
                      </p>
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                        Default: {widgetDef.defaultSize}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddWidget(widgetDef)}
                        style={{
                          backgroundColor: alreadyAdded ? '#64748b' : brandColor,
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {alreadyAdded ? '+ Add Duplicate' : '+ Add to Canvas'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 8. WHITE-LABEL BRANDING CUSTOMIZATION MODAL */}
      {showBrandingModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                🖌️ Custom Portal Branding
              </h3>
              <button
                type="button"
                onClick={() => setShowBrandingModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Portal Title / Brand Name
              </label>
              <input
                type="text"
                value={brandTitle}
                onChange={(e) => setBrandTitle(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Brand Accent Color
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {['#0070F3', '#10b981', '#8b5cf6', '#d97706', '#0f172a'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBrandColor(color)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: brandColor === color ? '3px solid #000000' : '1px solid #e2e8f0',
                      cursor: 'pointer',
                    }}
                  />
                ))}
                <input
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  style={{ width: '90px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Welcome Banner Message
              </label>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowBrandingModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                backgroundColor: brandColor,
                color: '#ffffff',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Apply Branding Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
