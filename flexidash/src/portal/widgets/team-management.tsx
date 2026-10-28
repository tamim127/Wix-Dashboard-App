/**
 * FlexiDash Team Leader Management Hub Widget
 */

import React, { useState } from 'react';
import type { WidgetComponentProps } from '../types.ts';

interface TeamTask {
  id: string;
  title: string;
  assignee: string;
  deadline: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING_APPROVAL';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export const TeamManagementWidget: React.FC<WidgetComponentProps> = ({ instance, onAction }) => {
  const [tasks, setTasks] = useState<TeamTask[]>([
    { id: 'tsk-1', title: 'Prepare Client Strategy Deck', assignee: 'Alex Morgan', deadline: 'Today, 5 PM', status: 'IN_PROGRESS', priority: 'HIGH' },
    { id: 'tsk-2', title: 'Review Q4 Budget Approvals', assignee: 'Jessica Taylor', deadline: 'Tomorrow', status: 'PENDING_APPROVAL', priority: 'HIGH' },
    { id: 'tsk-3', title: 'Coordinate Wix Bookings Calendar', assignee: 'Jordan Lee', deadline: 'Oct 30', status: 'COMPLETED', priority: 'MEDIUM' },
    { id: 'tsk-4', title: 'Member Community Event Setup', assignee: 'Casey Miller', deadline: 'Nov 2', status: 'IN_PROGRESS', priority: 'LOW' },
  ]);

  const handleApprove = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'COMPLETED' } : t))
    );
    onAction?.('approve_team_task', { taskId: id });
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      data-testid="widget-team-management"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: '#1a202c' }}>
            🎯 Team Leader Activity & Oversight Hub
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#718096' }}>
            Manage team assignments, deliverables, and member approval queues
          </p>
        </div>
        <span
          style={{
            backgroundColor: '#c6f6d5',
            color: '#22543d',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          Team Leader Privileges Active
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              padding: '10px 14px',
              borderRadius: '6px',
              backgroundColor: '#f7fafc',
              border: '1px solid #edf2f7',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    backgroundColor: task.priority === 'HIGH' ? '#fed7d7' : task.priority === 'MEDIUM' ? '#feebc8' : '#e2e8f0',
                    color: task.priority === 'HIGH' ? '#742a2a' : task.priority === 'MEDIUM' ? '#744210' : '#4a5568',
                  }}
                >
                  {task.priority}
                </span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#2d3748' }}>{task.title}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#718096', marginTop: '3px' }}>
                👤 {task.assignee} &nbsp;•&nbsp; Due: {task.deadline}
              </div>
            </div>
            <div>
              {task.status === 'PENDING_APPROVAL' ? (
                <button
                  type="button"
                  onClick={() => handleApprove(task.id)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: '#3182ce',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Approve
                </button>
              ) : (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: task.status === 'COMPLETED' ? '#22543d' : '#744210',
                    backgroundColor: task.status === 'COMPLETED' ? '#c6f6d5' : '#feebc8',
                    padding: '2px 8px',
                    borderRadius: '999px',
                  }}
                >
                  {task.status === 'COMPLETED' ? '✓ Completed' : 'In Progress'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
