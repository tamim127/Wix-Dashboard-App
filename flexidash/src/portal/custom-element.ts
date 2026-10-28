/**
 * FlexiDash Member Portal Web Component
 *
 * Implements a standard HTMLElement Custom Element that mounts the
 * MemberPortal React root, enabling embedded placement on Wix site pages.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemberPortal } from './member-portal.tsx';

export class FlexiDashPortalElement extends HTMLElement {
  private root: ReactDOM.Root | null = null;

  connectedCallback(): void {
    if (!this.root) {
      this.root = ReactDOM.createRoot(this);
      this.root.render(React.createElement(MemberPortal));
    }
  }

  disconnectedCallback(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

if (typeof window !== 'undefined' && !customElements.get('flexidash-portal')) {
  customElements.define('flexidash-portal', FlexiDashPortalElement);
}

