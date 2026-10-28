/**
 * FlexiDash Widget Factory & Registry-Based Renderer
 *
 * Maps widget identifiers to their respective UI component implementations.
 * Integrates an Error Boundary for each widget to safeguard against unexpected
 * exceptions and isolate faults without crashing the dashboard.
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import type { WidgetInstance, WidgetDefinition } from '../layout/types.ts';
import { WIDGET_REGISTRY } from '../layout/registry.ts';
import type { WidgetComponentProps } from './types.ts';

import { OverviewMetricsWidget } from './widgets/overview-metrics.tsx';
import { QuickStatsWidget } from './widgets/quick-stats.tsx';
import { RecentActivityWidget } from './widgets/recent-activity.tsx';
import { MemberDirectoryWidget } from './widgets/member-directory.tsx';
import { RolesTableWidget } from './widgets/roles-table.tsx';
import { LayoutEditorWidget } from './widgets/layout-editor-widget.tsx';
import { IntegrationsWidget } from './widgets/integrations.tsx';
import { AuditLogWidget } from './widgets/audit-log.tsx';
import { UnknownWidget } from './widgets/unknown-widget.tsx';

interface ErrorBoundaryProps {
  widgetId: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class WidgetErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'Unknown runtime error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[WidgetErrorBoundary] Caught error in widget "${this.props.widgetId}":`, error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            border: '1px solid #feb2b2',
            backgroundColor: '#fff5f5',
            color: '#c53030',
            borderRadius: '8px',
            padding: '16px',
            fontSize: '13px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
          data-testid={`widget-error-${this.props.widgetId}`}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>
            Widget Error ({this.props.widgetId})
          </div>
          <div style={{ fontSize: '12px', color: '#742a2a' }}>
            {this.state.errorMessage}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const WIDGET_COMPONENT_MAP: Record<string, React.FC<WidgetComponentProps>> = {
  'widget-overview-metrics': OverviewMetricsWidget,
  'widget-quick-stats': QuickStatsWidget,
  'widget-recent-activity': RecentActivityWidget,
  'widget-member-directory': MemberDirectoryWidget,
  'widget-roles-table': RolesTableWidget,
  'widget-layout-editor': LayoutEditorWidget,
  'widget-integrations': IntegrationsWidget,
  'widget-audit-log': AuditLogWidget,
};

export function getWidgetComponent(widgetId: string): React.FC<WidgetComponentProps> {
  const component = WIDGET_COMPONENT_MAP[widgetId];
  return component || UnknownWidget;
}

export function renderWidgetInstance(
  instance: WidgetInstance,
  options: Omit<WidgetComponentProps, 'instance' | 'definition'>
): React.ReactElement {
  const Component = getWidgetComponent(instance.widgetId);
  const definition: WidgetDefinition | undefined = WIDGET_REGISTRY[instance.widgetId];

  return (
    <WidgetErrorBoundary key={instance.instanceId} widgetId={instance.widgetId}>
      <Component
        instance={instance}
        definition={definition}
        session={options.session}
        permissions={options.permissions}
        role={options.role}
        onRefresh={options.onRefresh}
        onAction={options.onAction}
      />
    </WidgetErrorBoundary>
  );
}

