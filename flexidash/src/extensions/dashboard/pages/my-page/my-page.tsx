import { useState, useEffect, type FC } from 'react';
import {
  Page,
  WixDesignSystemProvider,
  Card,
  Box,
  Text,
  Heading,
  Button,
  Badge,
  Tabs,
  Table,
  Input,
  FormField,
  Loader,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';

import { apiClient, ApiClientError } from '../../../../client/api-client.ts';
import { sessionManager } from '../../../../client/session-manager.ts';
import type { AuthSession } from '../../../../models/session.ts';
import type { AuditEvent } from '../../../../audit/types.ts';
import type { RoleWithMeta, MemberRecord } from '../../../../rbac/storage/types.ts';
import type { PageAccessRule } from '../../../../rbac/page-access.ts';
import { PERMISSION_CATALOG, ALL_PERMISSION_KEYS } from '../../../../models/rbac.ts';
import { LayoutEditor } from './components/layout-editor.tsx';

export const DashboardPage: FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'auth' | 'rbac' | 'members' | 'page_access' | 'layouts' | 'audit'>('overview');
  const [currentSession, setCurrentSession] = useState<AuthSession | null>(null);

  // Authentication Tab States
  const [loginEmail, setLoginEmail] = useState('admin@flexidash.local');
  const [loginPassword, setLoginPassword] = useState('AdminPassword123!');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);

  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // RBAC Tab: Roles States
  const [rolesList, setRolesList] = useState<RoleWithMeta[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);

  // Create Role State
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>(['dashboard:view', 'portal:access']);
  const [createRoleLoading, setCreateRoleLoading] = useState(false);
  const [createRoleError, setCreateRoleError] = useState<string | null>(null);

  // Edit Role State
  const [editingRole, setEditingRole] = useState<RoleWithMeta | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleDescription, setEditRoleDescription] = useState('');
  const [editRolePermissions, setEditRolePermissions] = useState<string[]>([]);
  const [editRoleLoading, setEditRoleLoading] = useState(false);
  const [editRoleError, setEditRoleError] = useState<string | null>(null);

  // Delete Role State
  const [roleToDelete, setRoleToDelete] = useState<RoleWithMeta | null>(null);
  const [deleteRoleLoading, setDeleteRoleLoading] = useState(false);
  const [deleteRoleError, setDeleteRoleError] = useState<string | null>(null);

  // Role Assignment State
  const [assignTargetUser, setAssignTargetUser] = useState('dev-user-target-456');
  const [assignRoleId, setAssignRoleId] = useState('role_admin');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [showRoleConfirm, setShowRoleConfirm] = useState(false);

  // Members Tab States
  const [membersList, setMembersList] = useState<MemberRecord[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState('');
  const [memberPage, setMemberPage] = useState(1);
  const [memberTotalPages, setMemberTotalPages] = useState(1);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberPlatformStatus, setMemberPlatformStatus] = useState('');

  // Page Access Tab States
  const [pageRules, setPageRules] = useState<PageAccessRule[]>([]);
  const [allowedRoutes, setAllowedRoutes] = useState<string[]>([]);
  const [pageAccessLoading, setPageAccessLoading] = useState(false);
  const [pageAccessError, setPageAccessError] = useState<string | null>(null);
  const [testPath, setTestPath] = useState('/portal/audit');
  const [testResult, setTestResult] = useState<{ path: string; allowed: boolean; reason?: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Persistent Audit Events State
  const [persistentLogs, setPersistentLogs] = useState<AuditEvent[]>([]);
  const [persistentTotal, setPersistentTotal] = useState(0);
  const [persistentPage, setPersistentPage] = useState(1);
  const [persistentTotalPages, setPersistentTotalPages] = useState(1);
  const [persistentLoading, setPersistentLoading] = useState(false);
  const [persistentError, setPersistentError] = useState<string | null>(null);
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditFilterOutcome, setAuditFilterOutcome] = useState('');

  // Subscribe to SessionManager
  useEffect(() => {
    const unsubscribe = sessionManager.subscribe((session) => {
      setCurrentSession(session);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Roles
  const fetchRoles = async () => {
    if (!currentSession) return;
    setRolesLoading(true);
    setRolesError(null);
    try {
      const res = await apiClient.getRoles();
      setRolesList(res.roles);
      if (res.roles.length > 0 && !assignRoleId) {
        setAssignRoleId(res.roles[0].id);
      }
    } catch (err: any) {
      setRolesError(err instanceof ApiClientError ? `[${err.errorCode}] ${err.message}` : (err as Error).message);
    } finally {
      setRolesLoading(false);
    }
  };

  // Fetch Members
  const fetchMembers = async (page = 1) => {
    if (!currentSession) return;
    setMembersLoading(true);
    setMembersError(null);
    try {
      const res = await apiClient.getMembers({
        page,
        limit: 10,
        search: memberSearch || undefined,
        roleId: memberRoleFilter || undefined,
      });
      setMembersList(res.members);
      setMemberTotal(res.total);
      setMemberPage(res.page);
      setMemberTotalPages(res.totalPages);
      setMemberPlatformStatus(res.platformStatus);
    } catch (err: any) {
      setMembersError(err instanceof ApiClientError ? `[${err.errorCode}] ${err.message}` : (err as Error).message);
    } finally {
      setMembersLoading(false);
    }
  };

  // Fetch Page Access Matrix
  const fetchPageAccess = async () => {
    if (!currentSession) return;
    setPageAccessLoading(true);
    setPageAccessError(null);
    try {
      const res = await apiClient.getPageAccess();
      setPageRules(res.rules);
      setAllowedRoutes(res.allowedRoutes);
    } catch (err: any) {
      setPageAccessError(err instanceof ApiClientError ? `[${err.errorCode}] ${err.message}` : (err as Error).message);
    } finally {
      setPageAccessLoading(false);
    }
  };

  // Fetch Audit Logs
  const fetchPersistentAuditLogs = async (page = 1) => {
    if (!currentSession) return;
    setPersistentLoading(true);
    setPersistentError(null);
    try {
      const res = await apiClient.getAuditLogs({
        page,
        limit: 10,
        action: auditFilterAction || undefined,
        outcome: (auditFilterOutcome as any) || undefined,
      });
      setPersistentLogs(res.events);
      setPersistentTotal(res.totalCount);
      setPersistentPage(res.page);
      setPersistentTotalPages(res.totalPages);
    } catch (err: any) {
      setPersistentError(err instanceof ApiClientError ? `[${err.errorCode}] ${err.message}` : (err as Error).message);
    } finally {
      setPersistentLoading(false);
    }
  };

  // Load data on tab change
  useEffect(() => {
    if (activeTab === 'rbac') fetchRoles();
    if (activeTab === 'members') fetchMembers(1);
    if (activeTab === 'page_access') fetchPageAccess();
    if (activeTab === 'audit') fetchPersistentAuditLogs(1);
  }, [activeTab, currentSession]);

  const addAuditEvent = (_action?: string, _target?: string, _status?: string, _details?: string) => {
    if (activeTab === 'audit' && currentSession) {
      fetchPersistentAuditLogs(1);
    }
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError(null);
    setLoginSuccess(null);
    try {
      const res = await apiClient.login({
        email: loginEmail,
        password: loginPassword,
      });
      setLoginSuccess(`Authenticated successfully as ${res.session.email} (${res.session.roles.join(', ')})`);
      addAuditEvent('AUTH_LOGIN', res.session.email, 'SUCCESS', `Issued token for ${res.session.userId}`);
    } catch (err) {
      const msg = err instanceof ApiClientError ? `[${err.errorCode}] ${err.message}` : (err as Error).message;
      setLoginError(msg);
      addAuditEvent('AUTH_LOGIN', loginEmail, 'FAILED', msg);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async () => {
    setRegLoading(true);
    setRegError(null);
    setRegSuccess(null);
    try {
      const res = await apiClient.register({
        email: regEmail,
        password: regPassword,
      });
      setRegSuccess(`Account created & logged in: ${res.session.email}`);
      addAuditEvent('AUTH_REGISTER', res.session.email, 'SUCCESS', `Created account ${res.session.userId}`);
    } catch (err) {
      const msg = err instanceof ApiClientError ? `[${err.errorCode}] ${err.message}` : (err as Error).message;
      setRegError(msg);
      addAuditEvent('AUTH_REGISTER', regEmail, 'FAILED', msg);
    } finally {
      setRegLoading(false);
    }
  };

  const handleLogout = async () => {
    const previousEmail = currentSession?.email || 'session';
    try {
      await apiClient.logout();
      setLoginSuccess(null);
      addAuditEvent('AUTH_LOGOUT', previousEmail, 'SUCCESS', 'In-memory token purged');
    } catch {
      sessionManager.clearSession();
      addAuditEvent('AUTH_LOGOUT', previousEmail, 'SUCCESS', 'Forced client token purge');
    }
  };

  const handleCreateRole = async () => {
    setCreateRoleLoading(true);
    setCreateRoleError(null);
    try {
      await apiClient.createRole({
        name: newRoleName,
        id: newRoleId || undefined,
        description: newRoleDescription,
        permissions: newRolePermissions,
      });
      setShowCreateRole(false);
      setNewRoleName('');
      setNewRoleId('');
      setNewRoleDescription('');
      setNewRolePermissions(['dashboard:view', 'portal:access']);
      await fetchRoles();
    } catch (err) {
      const msg = err instanceof ApiClientError ? `[${err.errorCode}] ${err.message}` : (err as Error).message;
      setCreateRoleError(msg);
    } finally {
      setCreateRoleLoading(false);
    }
  };

  const handleStartEditRole = (role: RoleWithMeta) => {
    setEditingRole(role);
    setEditRoleName(role.name);
    setEditRoleDescription(role.description);
    setEditRolePermissions([...role.permissions]);
    setEditRoleError(null);
  };

  const handleUpdateRole = async () => {
    if (!editingRole) return;
    setEditRoleLoading(true);
    setEditRoleError(null);
    try {
      await apiClient.updateRole({
        roleId: editingRole.id,
        name: editRoleName,
        description: editRoleDescription,
        permissions: editRolePermissions,
      });
      setEditingRole(null);
      await fetchRoles();
    } catch (err) {
      const msg = err instanceof ApiClientError ? `[${err.errorCode}] ${err.message}` : (err as Error).message;
      setEditRoleError(msg);
    } finally {
      setEditRoleLoading(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    setDeleteRoleLoading(true);
    setDeleteRoleError(null);
    try {
      await apiClient.deleteRole(roleToDelete.id);
      setRoleToDelete(null);
      await fetchRoles();
    } catch (err) {
      const msg = err instanceof ApiClientError ? `[${err.errorCode}] ${err.message}` : (err as Error).message;
      setDeleteRoleError(msg);
    } finally {
      setDeleteRoleLoading(false);
    }
  };

  const handleAssignRole = async () => {
    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(null);
    try {
      const res = await apiClient.assignRole({
        targetUserId: assignTargetUser,
        roleId: assignRoleId,
      });
      setAssignSuccess(`Role '${res.assignment.roleId}' successfully assigned to user '${res.assignment.targetUserId}'`);
      setShowRoleConfirm(false);
      await fetchRoles();
      if (activeTab === 'members') await fetchMembers(memberPage);
    } catch (err) {
      const msg = err instanceof ApiClientError ? `Error (${err.statusCode}): ${err.message}` : (err as Error).message;
      setAssignError(msg);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleTestRouteAccess = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await apiClient.getPageAccess(testPath);
      setTestResult({
        path: testPath,
        allowed: res.allowed !== false,
        reason: res.reason,
      });
    } catch (err: any) {
      setTestResult({
        path: testPath,
        allowed: false,
        reason: err instanceof ApiClientError ? `[${err.errorCode}] ${err.message}` : (err as Error).message,
      });
    } finally {
      setTestLoading(false);
    }
  };

  const togglePermission = (
    currentList: string[],
    setList: (val: string[]) => void,
    permKey: string
  ) => {
    if (currentList.includes(permKey)) {
      setList(currentList.filter((p) => p !== permKey));
    } else {
      setList([...currentList, permKey]);
    }
  };

  return (
    <WixDesignSystemProvider>
      <Page>
        <Page.Header
          title="FlexiDash Portal & Access Builder"
          subtitle="Configure custom authentication, role-based access control, granular page protection, and member portals."
          actionsBar={
            <Box gap="SP2" verticalAlign="middle">
              {currentSession ? (
                <Box gap="SP2" verticalAlign="middle">
                  <Badge skin="success">Signed in: {currentSession.email}</Badge>
                  <Button priority="secondary" size="small" onClick={handleLogout}>
                    Sign Out
                  </Button>
                </Box>
              ) : (
                <Badge skin="neutralLight">No Active Session</Badge>
              )}
            </Box>
          }
        />

        <Page.Content>
          <Box direction="vertical" gap="SP4">
            <Tabs
              activeId={activeTab}
              onClick={(tab) => setActiveTab(tab.id as typeof activeTab)}
              items={[
                { id: 'overview', title: 'System Overview' },
                { id: 'auth', title: 'Authentication & Forms' },
                { id: 'rbac', title: 'Roles & Permissions (RBAC)' },
                { id: 'members', title: 'Member Roster' },
                { id: 'page_access', title: 'Page Access Rules' },
                { id: 'layouts', title: 'Dashboard Layouts' },
                { id: 'audit', title: 'Security Audit Log' },
              ]}
            />

            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <Box direction="vertical" gap="SP4">
                <Box gap="SP4">
                  <Box width="50%">
                    <Card>
                      <Card.Header
                        title="Installation Context"
                        suffix={<Badge skin="success">Active</Badge>}
                      />
                      <Card.Divider />
                      <Card.Content>
                        <Box direction="vertical" gap="SP2">
                          <Text size="small" secondary>Multi-Tenant Isolation:</Text>
                          <Text weight="bold">Partitioned by Cryptographic instanceId</Text>
                          <Text size="small" secondary>Storage Engine:</Text>
                          <Text weight="bold">Persistent File (Local) / Cloudflare KV (Production)</Text>
                          <Text size="small" secondary>Platform Integration Status:</Text>
                          <Badge skin="warning">Local Dev Adapter (Pending Live Wix CRM Deployment)</Badge>
                          <Text size="small" secondary>Access Control Model:</Text>
                          <Text weight="bold">Granular Default-Deny RBAC with Server Page Restrictions</Text>
                          <Text size="small" secondary>Security Audit Trail:</Text>
                          <Badge skin="success">Active (IAuditLogStorageAdapter)</Badge>
                          <Text size="small" secondary>Session Token Security:</Text>
                          <Text size="small">In-memory private closure (Strict zero-localStorage)</Text>
                        </Box>
                      </Card.Content>
                    </Card>
                  </Box>

                  <Box width="50%">
                    <Card>
                      <Card.Header
                        title="Active Session & Permissions"
                        suffix={currentSession ? <Badge skin="success">Authenticated</Badge> : <Badge skin="warning">Guest</Badge>}
                      />
                      <Card.Divider />
                      <Card.Content>
                        {currentSession ? (
                          <Box direction="vertical" gap="SP2">
                            <Text size="small" secondary>User ID:</Text>
                            <Text weight="bold">{currentSession.userId}</Text>
                            <Text size="small" secondary>Email:</Text>
                            <Text weight="bold">{currentSession.email}</Text>
                            <Text size="small" secondary>Assigned Roles:</Text>
                            <Box gap="SP1">
                              {currentSession.roles.map((r) => (
                                <Badge key={r} skin="general">{r}</Badge>
                              ))}
                            </Box>
                            <Text size="small" secondary>Granted Permissions ({currentSession.permissions.length}):</Text>
                            <Box gap="SP1">
                              {currentSession.permissions.slice(0, 8).map((p) => (
                                <Badge key={p} skin="neutral">{p}</Badge>
                              ))}
                              {currentSession.permissions.length > 8 && (
                                <Badge skin="neutralLight">+{currentSession.permissions.length - 8} more</Badge>
                              )}
                            </Box>
                          </Box>
                        ) : (
                          <Box direction="vertical" gap="SP2">
                            <Text size="small" secondary>No active session found.</Text>
                            <Text size="small">
                              Authenticate in the <strong>Authentication & Forms</strong> tab to evaluate server-enforced roles and permissions.
                            </Text>
                          </Box>
                        )}
                      </Card.Content>
                    </Card>
                  </Box>
                </Box>
              </Box>
            )}

            {/* TAB: AUTHENTICATION */}
            {activeTab === 'auth' && (
              <Box direction="vertical" gap="SP4">
                <Box gap="SP4">
                  <Box width="50%">
                    <Card>
                      <Card.Header title="Member Sign In" subtitle="POST /api/flexidash/auth/login" />
                      <Card.Divider />
                      <Card.Content>
                        <Box direction="vertical" gap="SP3">
                          <FormField label="Email" required>
                            <Input
                              value={loginEmail}
                              onChange={(e) => setLoginEmail(e.target.value)}
                              placeholder="admin@flexidash.local"
                            />
                          </FormField>
                          <FormField label="Password" required>
                            <Input
                              type="password"
                              value={loginPassword}
                              onChange={(e) => setLoginPassword(e.target.value)}
                              placeholder="AdminPassword123!"
                            />
                          </FormField>

                          {loginError && (
                            <Box padding="SP2" backgroundColor="R50">
                              <Text skin="error" size="small" weight="bold">{loginError}</Text>
                            </Box>
                          )}
                          {loginSuccess && (
                            <Box padding="SP2" backgroundColor="G50">
                              <Text skin="success" size="small" weight="bold">{loginSuccess}</Text>
                            </Box>
                          )}

                          <Button
                            priority="primary"
                            disabled={loginLoading}
                            onClick={handleLogin}
                          >
                            {loginLoading ? <Loader size="tiny" /> : 'Sign In'}
                          </Button>
                        </Box>
                      </Card.Content>
                    </Card>
                  </Box>

                  <Box width="50%">
                    <Card>
                      <Card.Header title="Register New Account" subtitle="POST /api/flexidash/auth/register" />
                      <Card.Divider />
                      <Card.Content>
                        <Box direction="vertical" gap="SP3">
                          <FormField label="Email" required>
                            <Input
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              placeholder="newmember@example.com"
                            />
                          </FormField>
                          <FormField label="Password (min 8 chars)" required>
                            <Input
                              type="password"
                              value={regPassword}
                              onChange={(e) => setRegPassword(e.target.value)}
                              placeholder="Choose secure password"
                            />
                          </FormField>

                          {regError && (
                            <Box padding="SP2" backgroundColor="R50">
                              <Text skin="error" size="small" weight="bold">{regError}</Text>
                            </Box>
                          )}
                          {regSuccess && (
                            <Box padding="SP2" backgroundColor="G50">
                              <Text skin="success" size="small" weight="bold">{regSuccess}</Text>
                            </Box>
                          )}

                          <Button
                            priority="secondary"
                            disabled={regLoading}
                            onClick={handleRegister}
                          >
                            {regLoading ? <Loader size="tiny" /> : 'Register Account'}
                          </Button>
                        </Box>
                      </Card.Content>
                    </Card>
                  </Box>
                </Box>
              </Box>
            )}

            {/* TAB: RBAC MATRIX & ROLES CRUD */}
            {activeTab === 'rbac' && (
              <Box direction="vertical" gap="SP4">
                <Card>
                  <Card.Header
                    title="Role Definitions & Granular Permissions"
                    subtitle="Manage custom roles, view system roles, and configure permission mappings."
                    suffix={
                      <Box gap="SP2">
                        <Button
                          priority="secondary"
                          size="small"
                          disabled={rolesLoading}
                          onClick={fetchRoles}
                        >
                          {rolesLoading ? <Loader size="tiny" /> : '🔄 Refresh Roles'}
                        </Button>
                        <Button
                          priority="primary"
                          size="small"
                          onClick={() => {
                            setShowCreateRole(!showCreateRole);
                            setEditingRole(null);
                          }}
                        >
                          {showCreateRole ? 'Cancel' : '➕ Create Custom Role'}
                        </Button>
                      </Box>
                    }
                  />
                  <Card.Divider />

                  {rolesError && (
                    <Box padding="SP3" backgroundColor="R50">
                      <Text skin="error" size="small" weight="bold">{rolesError}</Text>
                    </Box>
                  )}

                  {/* Create Role Form */}
                  {showCreateRole && (
                    <Box padding="SP4" direction="vertical" gap="SP3" backgroundColor="B50">
                      <Heading size="small">Create New Custom Role</Heading>
                      <Box gap="SP3">
                        <Box width="50%">
                          <FormField label="Role Name" required>
                            <Input
                              value={newRoleName}
                              onChange={(e) => setNewRoleName(e.target.value)}
                              placeholder="e.g. Content Manager"
                            />
                          </FormField>
                        </Box>
                        <Box width="50%">
                          <FormField label="Role ID (Optional - auto-generated if blank)">
                            <Input
                              value={newRoleId}
                              onChange={(e) => setNewRoleId(e.target.value)}
                              placeholder="e.g. role_content_manager"
                            />
                          </FormField>
                        </Box>
                      </Box>

                      <FormField label="Description">
                        <Input
                          value={newRoleDescription}
                          onChange={(e) => setNewRoleDescription(e.target.value)}
                          placeholder="Role scope and authority description"
                        />
                      </FormField>

                      <FormField label="Assigned Permissions">
                        <Box gap="SP2" direction="vertical" padding="SP2" backgroundColor="D80">
                          <Text size="small" secondary>Select permissions to grant to this role:</Text>
                          <Box gap="SP2" style={{ flexWrap: 'wrap' }}>
                            {ALL_PERMISSION_KEYS.map((perm) => (
                              <label key={perm} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '12px', fontSize: '13px' }}>
                                <input
                                  type="checkbox"
                                  checked={newRolePermissions.includes(perm)}
                                  onChange={() => togglePermission(newRolePermissions, setNewRolePermissions, perm)}
                                />
                                <span>{PERMISSION_CATALOG[perm]?.name || perm}</span>
                              </label>
                            ))}
                          </Box>
                        </Box>
                      </FormField>

                      {createRoleError && (
                        <Box padding="SP2" backgroundColor="R50">
                          <Text skin="error" size="small" weight="bold">{createRoleError}</Text>
                        </Box>
                      )}

                      <Box gap="SP2">
                        <Button
                          priority="primary"
                          disabled={createRoleLoading || !newRoleName}
                          onClick={handleCreateRole}
                        >
                          {createRoleLoading ? <Loader size="tiny" /> : 'Save New Role'}
                        </Button>
                        <Button
                          priority="secondary"
                          onClick={() => setShowCreateRole(false)}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  )}

                  {/* Edit Role Form */}
                  {editingRole && (
                    <Box padding="SP4" direction="vertical" gap="SP3" backgroundColor="Y50">
                      <Heading size="small">Edit Custom Role: {editingRole.name}</Heading>
                      <FormField label="Role Name" required>
                        <Input
                          value={editRoleName}
                          onChange={(e) => setEditRoleName(e.target.value)}
                        />
                      </FormField>

                      <FormField label="Description">
                        <Input
                          value={editRoleDescription}
                          onChange={(e) => setEditRoleDescription(e.target.value)}
                        />
                      </FormField>

                      <FormField label="Granted Permissions">
                        <Box gap="SP2" direction="vertical" padding="SP2" backgroundColor="D80">
                          <Box gap="SP2" style={{ flexWrap: 'wrap' }}>
                            {ALL_PERMISSION_KEYS.map((perm) => (
                              <label key={perm} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '12px', fontSize: '13px' }}>
                                <input
                                  type="checkbox"
                                  checked={editRolePermissions.includes(perm)}
                                  onChange={() => togglePermission(editRolePermissions, setEditRolePermissions, perm)}
                                />
                                <span>{PERMISSION_CATALOG[perm]?.name || perm}</span>
                              </label>
                            ))}
                          </Box>
                        </Box>
                      </FormField>

                      {editRoleError && (
                        <Box padding="SP2" backgroundColor="R50">
                          <Text skin="error" size="small" weight="bold">{editRoleError}</Text>
                        </Box>
                      )}

                      <Box gap="SP2">
                        <Button
                          priority="primary"
                          disabled={editRoleLoading || !editRoleName}
                          onClick={handleUpdateRole}
                        >
                          {editRoleLoading ? <Loader size="tiny" /> : 'Save Changes'}
                        </Button>
                        <Button
                          priority="secondary"
                          onClick={() => setEditingRole(null)}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  )}

                  {/* Delete Confirmation Box */}
                  {roleToDelete && (
                    <Box padding="SP4" direction="vertical" gap="SP3" backgroundColor="R50">
                      <Heading size="small">⚠️ Confirm Role Deletion</Heading>
                      <Text size="small">
                        Are you sure you want to permanently delete role <strong>"{roleToDelete.name}"</strong> ({roleToDelete.id})?
                      </Text>
                      {roleToDelete.memberCount > 0 && (
                        <Box padding="SP2" backgroundColor="Y50">
                          <Text skin="standard" size="small" weight="bold">
                            Warning: {roleToDelete.memberCount} member(s) are currently assigned this role. Server safety rules will block deletion until members are reassigned.
                          </Text>
                        </Box>
                      )}
                      {deleteRoleError && (
                        <Box padding="SP2" backgroundColor="R50">
                          <Text skin="error" size="small" weight="bold">{deleteRoleError}</Text>
                        </Box>
                      )}
                      <Box gap="SP2">
                        <Button
                          priority="primary"
                          skin="destructive"
                          disabled={deleteRoleLoading}
                          onClick={handleDeleteRole}
                        >
                          {deleteRoleLoading ? <Loader size="tiny" /> : 'Confirm Deletion'}
                        </Button>
                        <Button
                          priority="secondary"
                          onClick={() => setRoleToDelete(null)}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  )}

                  <Table
                    data={rolesList}
                    columns={[
                      {
                        title: 'Role Name & ID',
                        render: (row: RoleWithMeta) => (
                          <Box direction="vertical">
                            <Text weight="bold">{row.name}</Text>
                            <Text size="tiny" secondary>{row.id}</Text>
                          </Box>
                        ),
                      },
                      {
                        title: 'Description',
                        render: (row: RoleWithMeta) => <Text size="small">{row.description}</Text>,
                      },
                      {
                        title: 'Permissions',
                        render: (row: RoleWithMeta) => (
                          <Badge skin="neutral">{row.permissions?.length || 0} permissions</Badge>
                        ),
                      },
                      {
                        title: 'Type',
                        render: (row: RoleWithMeta) =>
                          row.isSystem ? <Badge skin="warning">System</Badge> : <Badge skin="standard">Custom</Badge>,
                      },
                      {
                        title: 'Members',
                        render: (row: RoleWithMeta) => <Text>{row.memberCount}</Text>,
                      },
                      {
                        title: 'Actions',
                        render: (row: RoleWithMeta) => (
                          <Box gap="SP1">
                            {row.isSystem ? (
                              <Badge skin="neutralLight">Protected</Badge>
                            ) : (
                              <>
                                <Button
                                  size="tiny"
                                  priority="secondary"
                                  onClick={() => handleStartEditRole(row)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="tiny"
                                  priority="secondary"
                                  skin="destructive"
                                  onClick={() => setRoleToDelete(row)}
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                          </Box>
                        ),
                      },
                    ]}
                  >
                    <Table.Content />
                  </Table>
                </Card>

                {/* Role Assignment Action Card */}
                <Card>
                  <Card.Header
                    title="Administrative Role Assignment"
                    subtitle="Assign roles to tenant members. Backend enforces self-promotion prevention and privilege escalation checks."
                  />
                  <Card.Divider />
                  <Card.Content>
                    <Box direction="vertical" gap="SP3">
                      <Box gap="SP3">
                        <Box width="50%">
                          <FormField label="Target User ID" required>
                            <Input
                              value={assignTargetUser}
                              onChange={(e) => setAssignTargetUser(e.target.value)}
                              placeholder="dev-user-target-456"
                            />
                          </FormField>
                        </Box>
                        <Box width="50%">
                          <FormField label="Role ID to Assign" required>
                            <Input
                              value={assignRoleId}
                              onChange={(e) => setAssignRoleId(e.target.value)}
                              placeholder="role_vip"
                            />
                          </FormField>
                        </Box>
                      </Box>

                      {assignError && (
                        <Box padding="SP2" backgroundColor="R50">
                          <Text skin="error" size="small" weight="bold">{assignError}</Text>
                        </Box>
                      )}
                      {assignSuccess && (
                        <Box padding="SP2" backgroundColor="G50">
                          <Text skin="success" size="small" weight="bold">{assignSuccess}</Text>
                        </Box>
                      )}

                      {showRoleConfirm ? (
                        <Box
                          direction="vertical"
                          gap="SP2"
                          padding="SP3"
                          backgroundColor="Y50"
                        >
                          <Text weight="bold" skin="standard">
                            ⚠️ Confirmation Required: Privilege Assignment
                          </Text>
                          <Text size="small">
                            You are about to assign role <strong>"{assignRoleId}"</strong> to member <strong>"{assignTargetUser}"</strong>.
                            This takes immediate effect and will be logged in the permanent audit trail.
                          </Text>
                          <Box gap="SP2">
                            <Button
                              priority="primary"
                              skin="warning"
                              disabled={assignLoading}
                              onClick={handleAssignRole}
                            >
                              {assignLoading ? <Loader size="tiny" /> : 'Confirm & Apply Assignment'}
                            </Button>
                            <Button
                              priority="secondary"
                              disabled={assignLoading}
                              onClick={() => setShowRoleConfirm(false)}
                            >
                              Cancel
                            </Button>
                          </Box>
                        </Box>
                      ) : (
                        <Button
                          priority="primary"
                          disabled={assignLoading}
                          onClick={() => setShowRoleConfirm(true)}
                        >
                          Assign Role via API
                        </Button>
                      )}
                    </Box>
                  </Card.Content>
                </Card>
              </Box>
            )}

            {/* TAB: MEMBERS ROSTER */}
            {activeTab === 'members' && (
              <Box direction="vertical" gap="SP4">
                <Card>
                  <Card.Header
                    title="Tenant Member Roster"
                    subtitle="Inspect member accounts, assigned roles, and effective permission envelopes."
                    suffix={
                      <Button
                        priority="secondary"
                        size="small"
                        disabled={membersLoading}
                        onClick={() => fetchMembers(memberPage)}
                      >
                        {membersLoading ? <Loader size="tiny" /> : '🔄 Refresh Roster'}
                      </Button>
                    }
                  />
                  <Card.Divider />
                  <Card.Content>
                    <Box gap="SP3" verticalAlign="bottom">
                      <Box width="50%">
                        <FormField label="Search Member (Email, Name, or User ID)">
                          <Input
                            placeholder="e.g. member@flexidash.local"
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                          />
                        </FormField>
                      </Box>
                      <Box width="30%">
                        <FormField label="Filter by Role ID">
                          <Input
                            placeholder="e.g. role_admin"
                            value={memberRoleFilter}
                            onChange={(e) => setMemberRoleFilter(e.target.value)}
                          />
                        </FormField>
                      </Box>
                      <Box width="20%">
                        <Button
                          priority="secondary"
                          onClick={() => fetchMembers(1)}
                        >
                          Apply Filter
                        </Button>
                      </Box>
                    </Box>

                    {memberPlatformStatus && (
                      <Box marginTop="SP3" padding="SP2" backgroundColor="B50">
                        <Text size="small" secondary>Data Source Status:</Text>
                        <Text size="small" weight="bold">{memberPlatformStatus}</Text>
                      </Box>
                    )}

                    {membersError && (
                      <Box marginTop="SP3" padding="SP2" backgroundColor="R50">
                        <Text skin="error" size="small" weight="bold">{membersError}</Text>
                      </Box>
                    )}
                  </Card.Content>
                  <Card.Divider />

                  {!currentSession ? (
                    <Box padding="SP5" align="center" verticalAlign="middle">
                      <Text secondary size="small">
                        Sign in with an administrative account to view member roster.
                      </Text>
                    </Box>
                  ) : membersList.length === 0 ? (
                    <Box padding="SP5" align="center" verticalAlign="middle">
                      <Text secondary size="small">
                        No members matched your search criteria.
                      </Text>
                    </Box>
                  ) : (
                    <Table
                      data={membersList}
                      columns={[
                        {
                          title: 'User ID',
                          render: (row: MemberRecord) => <Text weight="bold">{row.userId}</Text>,
                        },
                        {
                          title: 'Name & Email',
                          render: (row: MemberRecord) => (
                            <Box direction="vertical">
                              <Text>{row.name || '-'}</Text>
                              <Text size="tiny" secondary>{row.email}</Text>
                            </Box>
                          ),
                        },
                        {
                          title: 'Assigned Roles',
                          render: (row: MemberRecord) => (
                            <Box gap="SP1">
                              {row.roles.map((r) => (
                                <Badge key={r} skin="general">{r}</Badge>
                              ))}
                            </Box>
                          ),
                        },
                        {
                          title: 'Type',
                          render: (row: MemberRecord) =>
                            row.isDemoData ? (
                              <Badge skin="warning">Demo Account</Badge>
                            ) : (
                              <Badge skin="success">Live Member</Badge>
                            ),
                        },
                        {
                          title: 'Quick Actions',
                          render: (row: MemberRecord) => (
                            <Button
                              size="tiny"
                              priority="secondary"
                              onClick={() => {
                                setAssignTargetUser(row.userId);
                                setActiveTab('rbac');
                              }}
                            >
                              Assign Role
                            </Button>
                          ),
                        },
                      ]}
                    >
                      <Table.Content />
                    </Table>
                  )}

                  {memberTotal > 0 && (
                    <Box
                      padding="SP3"
                      verticalAlign="middle"
                      align="space-between"
                      borderTop="1px solid #edf2f7"
                    >
                      <Text size="small" secondary>
                        Showing page {memberPage} of {memberTotalPages} ({memberTotal} total members)
                      </Text>
                      <Box gap="SP2">
                        <Button
                          size="small"
                          priority="secondary"
                          disabled={memberPage <= 1 || membersLoading}
                          onClick={() => fetchMembers(memberPage - 1)}
                        >
                          Previous
                        </Button>
                        <Button
                          size="small"
                          priority="secondary"
                          disabled={memberPage >= memberTotalPages || membersLoading}
                          onClick={() => fetchMembers(memberPage + 1)}
                        >
                          Next
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Card>
              </Box>
            )}

            {/* TAB: PAGE ACCESS RULES */}
            {activeTab === 'page_access' && (
              <Box direction="vertical" gap="SP4">
                <Card>
                  <Card.Header
                    title="Server-Enforced Page Access Matrix"
                    subtitle="Route protection rules enforced server-side. Direct URL visits without authorized permissions return 403 Forbidden."
                    suffix={
                      <Button
                        priority="secondary"
                        size="small"
                        disabled={pageAccessLoading}
                        onClick={fetchPageAccess}
                      >
                        {pageAccessLoading ? <Loader size="tiny" /> : '🔄 Refresh Matrix'}
                      </Button>
                    }
                  />
                  <Card.Divider />

                  {pageAccessError && (
                    <Box padding="SP3" backgroundColor="R50">
                      <Text skin="error" size="small" weight="bold">{pageAccessError}</Text>
                    </Box>
                  )}

                  <Table
                    data={pageRules}
                    columns={[
                      {
                        title: 'Route Path',
                        render: (row: PageAccessRule) => <Text weight="bold">{row.path}</Text>,
                      },
                      {
                        title: 'Section',
                        render: (row: PageAccessRule) => <Badge skin="general">{row.section}</Badge>,
                      },
                      {
                        title: 'Page Title',
                        render: (row: PageAccessRule) => <Text>{row.name}</Text>,
                      },
                      {
                        title: 'Required Permission',
                        render: (row: PageAccessRule) => (
                          <Badge skin="neutral">{row.requiredPermission || 'None (Public)'}</Badge>
                        ),
                      },
                      {
                        title: 'Current Session Access',
                        render: (row: PageAccessRule) =>
                          allowedRoutes.includes(row.path) ? (
                            <Badge skin="success">Authorized</Badge>
                          ) : (
                            <Badge skin="danger">Forbidden (403)</Badge>
                          ),
                      },
                    ]}
                  >
                    <Table.Content />
                  </Table>
                </Card>

                {/* Interactive Route Access Simulator */}
                <Card>
                  <Card.Header
                    title="Interactive Route Access Tester"
                    subtitle="Test how the server authorization engine evaluates any target path against the caller's session."
                  />
                  <Card.Divider />
                  <Card.Content>
                    <Box direction="vertical" gap="SP3">
                      <Box gap="SP3" verticalAlign="bottom">
                        <Box width="70%">
                          <FormField label="Target Route Path">
                            <Input
                              value={testPath}
                              onChange={(e) => setTestPath(e.target.value)}
                              placeholder="/portal/audit"
                            />
                          </FormField>
                        </Box>
                        <Box width="30%">
                          <Button
                            priority="primary"
                            disabled={testLoading || !testPath}
                            onClick={handleTestRouteAccess}
                          >
                            {testLoading ? <Loader size="tiny" /> : 'Evaluate Server Access'}
                          </Button>
                        </Box>
                      </Box>

                      {testResult && (
                        <Box
                          padding="SP3"
                          backgroundColor={testResult.allowed ? 'G50' : 'R50'}
                          direction="vertical"
                          gap="SP1"
                        >
                          <Text weight="bold" skin={testResult.allowed ? 'success' : 'error'}>
                            {testResult.allowed ? '✅ Access Granted (200 OK)' : '🚫 Access Denied (403 Forbidden)'}
                          </Text>
                          <Text size="small">
                            Path: <code>{testResult.path}</code>
                          </Text>
                          {testResult.reason && (
                            <Text size="small">Reason: {testResult.reason}</Text>
                          )}
                        </Box>
                      )}
                    </Box>
                  </Card.Content>
                </Card>
              </Box>
            )}

            {/* TAB: LAYOUTS */}
            {activeTab === 'layouts' && (
              <LayoutEditor onAuditEvent={addAuditEvent} />
            )}

            {/* TAB: AUDIT LOG */}
            {activeTab === 'audit' && (
              <Box direction="vertical" gap="SP3">
                <Card>
                  <Card.Header
                    title="Persistent Security Audit Trail"
                    subtitle="Immutable server-backed audit logs recorded by IAuditLogStorageAdapter with automatic credential redaction."
                    suffix={
                      <Button
                        priority="secondary"
                        size="small"
                        disabled={persistentLoading}
                        onClick={() => fetchPersistentAuditLogs(persistentPage)}
                      >
                        {persistentLoading ? <Loader size="tiny" /> : '🔄 Refresh Log'}
                      </Button>
                    }
                  />
                  <Card.Divider />
                  <Card.Content>
                    <Box gap="SP3" verticalAlign="bottom">
                      <Box width="40%">
                        <FormField label="Filter by Action">
                          <Input
                            placeholder="e.g. auth:login, rbac:role_assign"
                            value={auditFilterAction}
                            onChange={(e) => setAuditFilterAction(e.target.value)}
                          />
                        </FormField>
                      </Box>
                      <Box width="30%">
                        <FormField label="Filter by Outcome">
                          <Input
                            placeholder="SUCCESS, FAILURE, or DENIED"
                            value={auditFilterOutcome}
                            onChange={(e) => setAuditFilterOutcome(e.target.value)}
                          />
                        </FormField>
                      </Box>
                      <Box width="30%">
                        <Button
                          priority="secondary"
                          onClick={() => fetchPersistentAuditLogs(1)}
                        >
                          Filter
                        </Button>
                      </Box>
                    </Box>

                    {persistentError && (
                      <Box marginTop="SP3" padding="SP2" backgroundColor="R50">
                        <Text skin="error" size="small" weight="bold">{persistentError}</Text>
                      </Box>
                    )}
                  </Card.Content>
                  <Card.Divider />

                  {!currentSession ? (
                    <Box padding="SP5" align="center" verticalAlign="middle">
                      <Text secondary size="small">
                        Sign in with an administrative account (e.g. admin@flexidash.local) to query the server-side audit trail.
                      </Text>
                    </Box>
                  ) : persistentLogs.length === 0 ? (
                    <Box padding="SP5" align="center" verticalAlign="middle">
                      <Text secondary size="small">
                        No persistent audit records matched your query. Actions in the Authentication, Roles, and Layout tabs are automatically recorded.
                      </Text>
                    </Box>
                  ) : (
                    <Table
                      data={persistentLogs}
                      columns={[
                        {
                          title: 'Action',
                          render: (row: AuditEvent) => <Badge skin="general">{row.action}</Badge>,
                        },
                        {
                          title: 'Actor',
                          render: (row: AuditEvent) => <Text size="small">{row.actorId || 'system'}</Text>,
                        },
                        {
                          title: 'Target',
                          render: (row: AuditEvent) => <Text size="small" weight="bold">{row.target || '-'}</Text>,
                        },
                        {
                          title: 'Outcome',
                          render: (row: AuditEvent) =>
                            row.outcome === 'SUCCESS' ? (
                              <Badge skin="success">SUCCESS</Badge>
                            ) : row.outcome === 'DENIED' ? (
                              <Badge skin="warning">DENIED</Badge>
                            ) : (
                              <Badge skin="danger">{row.outcome}</Badge>
                            ),
                        },
                        {
                          title: 'Details / Metadata',
                          render: (row: AuditEvent) => (
                            <Text size="small">
                              {row.metadata ? JSON.stringify(row.metadata) : '-'}
                            </Text>
                          ),
                        },
                        {
                          title: 'Timestamp (UTC)',
                          render: (row: AuditEvent) => (
                            <Text size="small" secondary>
                              {new Date(row.timestamp).toLocaleTimeString()}
                            </Text>
                          ),
                        },
                      ]}
                    >
                      <Table.Content />
                    </Table>
                  )}

                  {persistentTotal > 0 && (
                    <Box
                      padding="SP3"
                      verticalAlign="middle"
                      align="space-between"
                      borderTop="1px solid #edf2f7"
                    >
                      <Text size="small" secondary>
                        Showing page {persistentPage} of {persistentTotalPages} ({persistentTotal} total events)
                      </Text>
                      <Box gap="SP2">
                        <Button
                          size="small"
                          priority="secondary"
                          disabled={persistentPage <= 1 || persistentLoading}
                          onClick={() => fetchPersistentAuditLogs(persistentPage - 1)}
                        >
                          Previous
                        </Button>
                        <Button
                          size="small"
                          priority="secondary"
                          disabled={persistentPage >= persistentTotalPages || persistentLoading}
                          onClick={() => fetchPersistentAuditLogs(persistentPage + 1)}
                        >
                          Next
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Card>
              </Box>
            )}
          </Box>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
};

export default DashboardPage;
