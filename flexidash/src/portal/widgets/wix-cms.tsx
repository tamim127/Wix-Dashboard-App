/**
 * FlexiDash Wix CMS Dynamic Member Content Widget
 */

import React from 'react';
import type { WidgetComponentProps } from '../types.ts';

interface CmsItem {
  id: string;
  title: string;
  category: string;
  readTime: string;
  published: string;
  restrictedToRole?: string;
}

export const WixCmsWidget: React.FC<WidgetComponentProps> = ({ instance, role }) => {
  const articles: CmsItem[] = [
    { id: 'art-1', title: 'Q4 Product Roadmap & Feature Highlights', category: 'Product Strategy', readTime: '5 min read', published: 'Oct 24, 2026' },
    { id: 'art-2', title: 'Security Best Practices: Multi-Tenant Access Control', category: 'Security Guides', readTime: '8 min read', published: 'Oct 21, 2026' },
    { id: 'art-3', title: 'Team Leader Toolkit: Driving Collaborative Success', category: 'Leadership', readTime: '6 min read', published: 'Oct 18, 2026', restrictedToRole: 'role_team_leader' },
    { id: 'art-4', title: 'Wix Headless & Custom Element Deployment Guide', category: 'Developer Docs', readTime: '12 min read', published: 'Oct 15, 2026' },
  ];

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
      data-testid="widget-wix-cms"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: '#1a202c' }}>
            📚 Wix CMS Resources & Content
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#718096' }}>
            Curated knowledgebase articles, downloadable guides & member announcements
          </p>
        </div>
        <span
          style={{
            backgroundColor: '#e9d8fd',
            color: '#553c9e',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          CMS Collection Active
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {articles.map((art) => (
          <div
            key={art.id}
            style={{
              padding: '12px',
              borderRadius: '6px',
              backgroundColor: '#f7fafc',
              border: '1px solid #edf2f7',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#3182ce', textTransform: 'uppercase' }}>
                  {art.category}
                </span>
                {art.restrictedToRole && (
                  <span style={{ fontSize: '10px', backgroundColor: '#fed7d7', color: '#742a2a', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                    Team Leader Only
                  </span>
                )}
              </div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#2d3748', lineHeight: 1.4 }}>
                {art.title}
              </div>
            </div>
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a0aec0' }}>
              <span>{art.readTime}</span>
              <span>{art.published}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
