import { useState, useEffect, type FC } from 'react';
import {
  Card,
  Box,
  Text,
  Heading,
  Button,
  Badge,
  Loader,
} from '@wix/design-system';

import { apiClient, ApiClientError, type PortalLayoutResponse } from '../../../../../client/api-client.ts';
import type { DashboardLayout, WidgetInstance, WidgetSize, WidgetDefinition } from '../../../../../layout/types.ts';
import { WIDGET_REGISTRY } from '../../../../../layout/registry.ts';

interface LayoutEditorProps {
  onAuditEvent?: (action: string, target: string, status: 'SUCCESS' | 'DENIED' | 'FAILED', details?: string) => void;
}

export const LayoutEditor: FC<LayoutEditorProps> = ({ onAuditEvent }) => {
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [savedLayout, setSavedLayout] = useState<DashboardLayout | null>(null);
  const [availableWidgets, setAvailableWidgets] = useState<WidgetDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [showAddDrawer, setShowAddDrawer] = useState(false);

  const isDirty = JSON.stringify(layout) !== JSON.stringify(savedLayout);

  const fetchLayout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: PortalLayoutResponse = await apiClient.getPortalLayout();
      setLayout(res.layout);
      setSavedLayout(res.layout);
      if (res.availableWidgets) {
        setAvailableWidgets(res.availableWidgets);
      } else {
        setAvailableWidgets(Object.values(WIDGET_REGISTRY));
      }
      onAuditEvent?.('LAYOUT_FETCH', res.layout.id, 'SUCCESS', `Loaded ${res.layout.widgets.length} widgets`);
    } catch (err) {
      const msg = err instanceof ApiClientError ? `Error (${err.statusCode}): ${err.message}` : (err as Error).message;
      setError(msg);
      setLayout(null);
      setSavedLayout(null);
      onAuditEvent?.('LAYOUT_FETCH', 'layout', 'FAILED', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLayout();
  }, []);

  const handleMoveWidget = (index: number, direction: 'up' | 'down') => {
    if (!layout) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= layout.widgets.length) return;

    const newWidgets = [...layout.widgets];
    const temp = newWidgets[index];
    newWidgets[index] = newWidgets[targetIndex];
    newWidgets[targetIndex] = temp;

    // Normalize order
    newWidgets.forEach((w, idx) => {
      w.order = idx;
    });

    setLayout({ ...layout, widgets: newWidgets });
  };

  const handleResizeWidget = (index: number, newSize: WidgetSize) => {
    if (!layout) return;
    const newWidgets = [...layout.widgets];
    newWidgets[index] = { ...newWidgets[index], size: newSize };
    setLayout({ ...layout, widgets: newWidgets });
  };

  const handleToggleVisibility = (index: number) => {
    if (!layout) return;
    const newWidgets = [...layout.widgets];
    newWidgets[index] = { ...newWidgets[index], visible: !newWidgets[index].visible };
    setLayout({ ...layout, widgets: newWidgets });
  };

  const handleRemoveWidget = (index: number) => {
    if (!layout) return;
    const removed = layout.widgets[index];
    const newWidgets = layout.widgets.filter((_, idx) => idx !== index);
    newWidgets.forEach((w, idx) => {
      w.order = idx;
    });
    setLayout({ ...layout, widgets: newWidgets });
    onAuditEvent?.('WIDGET_REMOVED', removed.widgetId, 'SUCCESS', `Instance: ${removed.instanceId}`);
  };

  const handleAddWidget = (def: WidgetDefinition) => {
    if (!layout) return;
    const newInstance: WidgetInstance = {
      instanceId: `inst-${def.id.replace('widget-', '')}-${Date.now().toString(36)}`,
      widgetId: def.id,
      size: def.defaultSize,
      order: layout.widgets.length,
      visible: true,
      config: { ...def.defaultConfig },
    };

    setLayout({
      ...layout,
      widgets: [...layout.widgets, newInstance],
    });
    setShowAddDrawer(false);
    onAuditEvent?.('WIDGET_ADDED', def.id, 'SUCCESS', `Added as ${def.defaultSize}`);
  };

  const handleSave = async () => {
    if (!layout) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiClient.savePortalLayout(layout);
      setLayout(res.layout);
      setSavedLayout(res.layout);
      setSuccess(`Layout saved successfully! (${res.layout.widgets.length} widgets active)`);
      onAuditEvent?.('LAYOUT_SAVED', res.layout.id, 'SUCCESS', `Persistent save across restarts`);
    } catch (err) {
      const msg = err instanceof ApiClientError ? `Error (${err.statusCode}): ${err.message}` : (err as Error).message;
      setError(msg);
      onAuditEvent?.('LAYOUT_SAVED', layout.id, 'DENIED', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiClient.resetPortalLayout();
      setLayout(res.layout);
      setSavedLayout(res.layout);
      setSuccess('Layout reverted to site-level default.');
      onAuditEvent?.('LAYOUT_RESET', res.layout.id, 'SUCCESS', 'Reset to site default');
    } catch (err) {
      const msg = err instanceof ApiClientError ? `Error (${err.statusCode}): ${err.message}` : (err as Error).message;
      setError(msg);
      onAuditEvent?.('LAYOUT_RESET', 'layout', 'FAILED', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (savedLayout) {
      setLayout(JSON.parse(JSON.stringify(savedLayout)));
      setError(null);
      setSuccess(null);
    }
  };

  const getSizeWidthPercentage = (size: WidgetSize): string => {
    switch (size) {
      case 'small':
        return '25%';
      case 'medium':
        return '50%';
      case 'large':
        return '75%';
      case 'full':
      default:
        return '100%';
    }
  };

  if (loading) {
    return (
      <Card>
        <Card.Content>
          <Box align="center" verticalAlign="middle" padding="SP6" gap="SP3" direction="vertical">
            <Loader size="medium" />
            <Text secondary size="small">Loading persistent dashboard layout...</Text>
          </Box>
        </Card.Content>
      </Card>
    );
  }

  if (error && !layout) {
    return (
      <Card>
        <Card.Header
          title="Dashboard Layout Engine"
          suffix={
            <Button size="small" onClick={fetchLayout}>
              Retry Load
            </Button>
          }
        />
        <Card.Divider />
        <Card.Content>
          <Box padding="SP4" backgroundColor="R50" direction="vertical" gap="SP2">
            <Text skin="error" weight="bold">{error}</Text>
            <Text size="small" secondary>
              Ensure you are authenticated with an active session in the Authentication tab.
            </Text>
          </Box>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Box direction="vertical" gap="SP4">
      {/* Editor Control Header */}
      <Card>
        <Card.Header
          title="Dashboard Layout Customizer"
          subtitle={
            layout?.userId
              ? `Personalized Layout for ${layout.userId} (${layout.name})`
              : `Site Default Layout (${layout?.name || 'Default'})`
          }
          suffix={
            <Box gap="SP2" verticalAlign="middle">
              {isDirty && <Badge skin="warning">Unsaved Changes</Badge>}
              <Badge skin="neutral">{layout?.widgets.length || 0} Widgets</Badge>
              <Button
                size="small"
                priority={previewMode ? 'primary' : 'secondary'}
                onClick={() => setPreviewMode(!previewMode)}
              >
                {previewMode ? 'Exit Preview' : 'Live Preview'}
              </Button>
            </Box>
          }
        />
        <Card.Divider />
        <Card.Content>
          <Box direction="vertical" gap="SP3">
            {error && (
              <Box padding="SP2" backgroundColor="R50">
                <Text skin="error" size="small" weight="bold">{error}</Text>
              </Box>
            )}
            {success && (
              <Box padding="SP2" backgroundColor="G50">
                <Text skin="success" size="small" weight="bold">{success}</Text>
              </Box>
            )}

            <Box align="space-between" verticalAlign="middle">
              <Box gap="SP2">
                <Button
                  size="small"
                  priority="secondary"
                  onClick={() => setShowAddDrawer(!showAddDrawer)}
                >
                  {showAddDrawer ? 'Close Widget Drawer' : '+ Add Widget'}
                </Button>
                <Button
                  size="small"
                  priority="secondary"
                  onClick={handleResetToDefault}
                  disabled={saving}
                >
                  Reset to Site Default
                </Button>
                {isDirty && (
                  <Button
                    size="small"
                    priority="secondary"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    Discard Changes
                  </Button>
                )}
              </Box>

              <Button
                size="small"
                priority="primary"
                onClick={handleSave}
                disabled={!isDirty || saving}
              >
                {saving ? <Loader size="tiny" /> : 'Save Persistent Layout'}
              </Button>
            </Box>
          </Box>
        </Card.Content>
      </Card>

      {/* Widget Registry Drawer (Add Widget) */}
      {showAddDrawer && (
        <Card>
          <Card.Header
            title="Available Registered Widgets"
            subtitle="Select a widget to add to your layout canvas. Only widgets permitted for your roles are listed."
          />
          <Card.Divider />
          <Card.Content>
            <Box direction="vertical" gap="SP3">
              {availableWidgets.map((def) => {
                const alreadyPlaced = layout?.widgets.some((w) => w.widgetId === def.id);
                return (
                  <Box
                    key={def.id}
                    align="space-between"
                    verticalAlign="middle"
                    padding="SP2"
                    backgroundColor="D80"
                  >
                    <Box direction="vertical" gap="SP1">
                      <Box gap="SP2" verticalAlign="middle">
                        <Text weight="bold">{def.title}</Text>
                        <Badge skin="neutral">{def.category}</Badge>
                        <Badge skin="warning">{def.requiredPermission}</Badge>
                      </Box>
                      <Text size="small" secondary>{def.description}</Text>
                    </Box>

                    <Button
                      size="tiny"
                      priority="secondary"
                      onClick={() => handleAddWidget(def)}
                    >
                      {alreadyPlaced ? '+ Add Another' : '+ Add to Canvas'}
                    </Button>
                  </Box>
                );
              })}
            </Box>
          </Card.Content>
        </Card>
      )}

      {/* Layout Grid Canvas */}
      {layout && layout.widgets.length === 0 ? (
        <Card>
          <Card.Content>
            <Box padding="SP6" align="center" verticalAlign="middle" direction="vertical" gap="SP2">
              <Heading size="small">Your Dashboard Layout is Empty</Heading>
              <Text secondary size="small">
                Click '+ Add Widget' above to add metrics, activity feeds, or management widgets.
              </Text>
            </Box>
          </Card.Content>
        </Card>
      ) : (
        <Box gap="SP3" style={{ flexWrap: 'wrap', display: 'flex' }}>
          {layout?.widgets.map((instance, index) => {
            const def = WIDGET_REGISTRY[instance.widgetId];
            const widthPct = getSizeWidthPercentage(instance.size);

            return (
              <Box
                key={instance.instanceId}
                style={{ width: `calc(${widthPct} - 12px)`, minWidth: '280px', marginBottom: '12px' }}
              >
                <Card>
                  {/* Widget Card Header */}
                  <Card.Header
                    title={def?.title || instance.widgetId}
                    suffix={
                      <Box gap="SP1" verticalAlign="middle">
                        <Badge skin={instance.visible ? 'success' : 'neutral'}>
                          {instance.visible ? 'Visible' : 'Hidden'}
                        </Badge>
                        <Badge skin="neutralLight">{instance.size}</Badge>
                      </Box>
                    }
                  />
                  <Card.Divider />

                  {/* Widget Card Content: Edit Mode vs Preview Mode */}
                  <Card.Content>
                    {previewMode ? (
                      /* Live Preview Mode Rendering */
                      <Box direction="vertical" gap="SP2" padding="SP2">
                        {instance.widgetId === 'widget-overview-metrics' && (
                          <Box direction="vertical" gap="SP2">
                            <Box gap="SP3">
                              <Box direction="vertical">
                                <Text size="tiny" secondary>Pageviews (24h)</Text>
                                <Heading size="medium">48,290</Heading>
                              </Box>
                              <Box direction="vertical">
                                <Text size="tiny" secondary>Bounce Rate</Text>
                                <Heading size="medium">24.6%</Heading>
                              </Box>
                              <Box direction="vertical">
                                <Text size="tiny" secondary>Avg Session</Text>
                                <Heading size="medium">4m 12s</Heading>
                              </Box>
                            </Box>
                            <Badge skin="success">Live Data Feed Active</Badge>
                          </Box>
                        )}

                        {instance.widgetId === 'widget-quick-stats' && (
                          <Box gap="SP2" verticalAlign="middle">
                            <Badge skin="general">Active Sessions: 142</Badge>
                            <Badge skin="warning">CPU: 18%</Badge>
                          </Box>
                        )}

                        {instance.widgetId === 'widget-recent-activity' && (
                          <Box direction="vertical" gap="SP1">
                            <Text size="tiny" weight="bold">Recent Member Events</Text>
                            <Text size="tiny" secondary>12:45 — User user_821 logged in</Text>
                            <Text size="tiny" secondary>12:30 — Member member@example.com registered</Text>
                            <Text size="tiny" secondary>11:15 — Role assigned to user_456</Text>
                          </Box>
                        )}

                        {instance.widgetId === 'widget-roles-table' && (
                          <Box direction="vertical" gap="SP1">
                            <Text size="tiny" weight="bold">RBAC Privileges</Text>
                            <Text size="tiny">Owner (12) | Admin (12) | Member (3)</Text>
                          </Box>
                        )}

                        {instance.widgetId === 'widget-audit-log' && (
                          <Box direction="vertical" gap="SP1">
                            <Badge skin="danger">Audit Trail Active</Badge>
                            <Text size="tiny" secondary>Immutable logging partitioned by instanceId</Text>
                          </Box>
                        )}

                        {instance.widgetId === 'widget-integrations' && (
                          <Box direction="vertical" gap="SP1">
                            <Text size="tiny" weight="bold">Webhooks & APIs</Text>
                            <Badge skin="success">Endpoints Healthy</Badge>
                          </Box>
                        )}

                        {instance.widgetId === 'widget-member-directory' && (
                          <Box direction="vertical" gap="SP1">
                            <Text size="tiny" weight="bold">Member Directory</Text>
                            <Text size="tiny" secondary>163 Total Registered Members</Text>
                          </Box>
                        )}

                        {instance.widgetId === 'widget-layout-editor' && (
                          <Box direction="vertical" gap="SP1">
                            <Text size="tiny" weight="bold">Layout Canvas</Text>
                            <Text size="tiny" secondary>Active Columns: {layout.columns}</Text>
                          </Box>
                        )}
                      </Box>
                    ) : (
                      /* Edit Mode Rendering with Controls */
                      <Box direction="vertical" gap="SP2">
                        <Text size="small" secondary>{def?.description || 'Custom widget instance'}</Text>
                        <Box gap="SP2" verticalAlign="middle">
                          <Text size="tiny" secondary>Category:</Text>
                          <Badge skin="neutral">{def?.category || 'general'}</Badge>
                          <Text size="tiny" secondary>Permission:</Text>
                          <Badge skin="warning">{def?.requiredPermission || 'dashboard:view'}</Badge>
                        </Box>
                      </Box>
                    )}
                  </Card.Content>

                  {/* Widget Card Actions (Edit Mode Only) */}
                  {!previewMode && (
                    <>
                      <Card.Divider />
                      <Box padding="SP2" align="space-between" verticalAlign="middle">
                        {/* Reorder Buttons */}
                        <Box gap="SP1">
                          <Button
                            size="tiny"
                            priority="secondary"
                            disabled={index === 0}
                            onClick={() => handleMoveWidget(index, 'up')}
                          >
                            ▲ Up
                          </Button>
                          <Button
                            size="tiny"
                            priority="secondary"
                            disabled={index === layout.widgets.length - 1}
                            onClick={() => handleMoveWidget(index, 'down')}
                          >
                            ▼ Down
                          </Button>
                        </Box>

                        {/* Resize Options */}
                        {def && def.supportedSizes.length > 1 && (
                          <Box gap="SP1" verticalAlign="middle">
                            <Text size="tiny" secondary>Size:</Text>
                            {def.supportedSizes.map((s) => (
                              <Button
                                key={s}
                                size="tiny"
                                priority={instance.size === s ? 'primary' : 'secondary'}
                                onClick={() => handleResizeWidget(index, s)}
                              >
                                {s[0].toUpperCase() + s.slice(1, 3)}
                              </Button>
                            ))}
                          </Box>
                        )}

                        {/* Visibility & Remove */}
                        <Box gap="SP1">
                          <Button
                            size="tiny"
                            priority="secondary"
                            onClick={() => handleToggleVisibility(index)}
                          >
                            {instance.visible ? 'Hide' : 'Show'}
                          </Button>
                          <Button
                            size="tiny"
                            priority="destructive"
                            onClick={() => handleRemoveWidget(index)}
                          >
                            ✕ Remove
                          </Button>
                        </Box>
                      </Box>
                    </>
                  )}
                </Card>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

