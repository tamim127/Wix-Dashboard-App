import { extensions } from '@wix/astro/builders';

export default extensions.dashboardPage({
  id: '24dcd8b4-4f1a-44ba-8cce-8124670bfd4c',
  title: 'FlexiDash',
  routePath: '',
  component: './extensions/dashboard/pages/my-page/my-page.tsx',
  fullPage: false,
  metaData: {
    searchable: true,
    description: 'Configure member portal experiences, RBAC, authentication forms, and layouts.',
  },
});
