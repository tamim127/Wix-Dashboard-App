/**
 * FlexiDash Wix Stores & Ecommerce Widget
 */

import React, { useState } from 'react';
import type { WidgetComponentProps } from '../types.ts';

interface OrderItem {
  id: string;
  orderNumber: string;
  customerName: string;
  itemsCount: number;
  total: string;
  status: 'FULFILLED' | 'UNFULFILLED' | 'PROCESSING';
  date: string;
}

export const WixStoresWidget: React.FC<WidgetComponentProps> = ({ instance, onAction }) => {
  const [orders, setOrders] = useState<OrderItem[]>([
    { id: 'ord-101', orderNumber: '#10084', customerName: 'Emma Watson', itemsCount: 2, total: '$148.50', status: 'UNFULFILLED', date: '12 mins ago' },
    { id: 'ord-102', orderNumber: '#10083', customerName: 'Liam Chen', itemsCount: 1, total: '$89.00', status: 'FULFILLED', date: '1 hour ago' },
    { id: 'ord-103', orderNumber: '#10082', customerName: 'Sophia Miller', itemsCount: 4, total: '$320.00', status: 'PROCESSING', date: '3 hours ago' },
    { id: 'ord-104', orderNumber: '#10081', customerName: 'Marcus Vance', itemsCount: 1, total: '$45.00', status: 'FULFILLED', date: 'Yesterday' },
  ]);

  const handleFulfill = (id: string, orderNumber: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: 'FULFILLED' } : o))
    );
    onAction?.('fulfill_order', { orderId: id, orderNumber });
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
      data-testid="widget-wix-stores"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: '#1a202c' }}>
            🛍️ Wix Stores & Ecommerce
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#718096' }}>
            Live orders, fulfillment status & gross merchandise revenue
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#2b6cb0' }}>$4,892.50</div>
          <div style={{ fontSize: '11px', color: '#38a169', fontWeight: 600 }}>+18.4% this week</div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #edf2f7', textAlign: 'left', color: '#a0aec0', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '8px 4px' }}>Order #</th>
              <th style={{ padding: '8px 4px' }}>Customer</th>
              <th style={{ padding: '8px 4px' }}>Total</th>
              <th style={{ padding: '8px 4px' }}>Status</th>
              <th style={{ padding: '8px 4px', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((ord) => (
              <tr key={ord.id} style={{ borderBottom: '1px solid #f7fafc' }}>
                <td style={{ padding: '10px 4px', fontWeight: 700, color: '#2d3748' }}>{ord.orderNumber}</td>
                <td style={{ padding: '10px 4px', color: '#4a5568' }}>{ord.customerName}</td>
                <td style={{ padding: '10px 4px', fontWeight: 600 }}>{ord.total}</td>
                <td style={{ padding: '10px 4px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: ord.status === 'FULFILLED' ? '#c6f6d5' : ord.status === 'PROCESSING' ? '#feebc8' : '#fed7d7',
                      color: ord.status === 'FULFILLED' ? '#22543d' : ord.status === 'PROCESSING' ? '#744210' : '#742a2a',
                    }}
                  >
                    {ord.status}
                  </span>
                </td>
                <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                  {ord.status !== 'FULFILLED' && (
                    <button
                      type="button"
                      onClick={() => handleFulfill(ord.id, ord.orderNumber)}
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
                      Fulfill
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
