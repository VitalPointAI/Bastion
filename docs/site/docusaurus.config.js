// @ts-check
const { themes: prismThemes } = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'BASTION Documentation',
  tagline: 'Blockchain Autonomous Strategy & Tactical Intelligence Operational Network',
  favicon: 'img/favicon.ico',

  url: 'https://docs.bastion.vitalpoint.ai',
  baseUrl: '/',

  organizationName: 'VitalPointAI',
  projectName: 'Bastion',

  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/VitalPointAI/Bastion/tree/master/docs/site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'dark',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'BASTION',
        logo: {
          alt: 'BASTION Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: 'Documentation',
          },
          {
            href: 'https://github.com/VitalPointAI/Bastion',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentation',
            items: [
              { label: 'Architecture', to: '/architecture/overview' },
              { label: 'Capabilities', to: '/capabilities/understand-tab' },
              { label: 'AI Agents', to: '/ai-agents/overview' },
            ],
          },
          {
            title: 'Platform',
            items: [
              { label: 'Governance', to: '/governance/dao-structure' },
              { label: 'Blockchain', to: '/blockchain/near-integration' },
              { label: 'API Reference', to: '/api/rest-endpoints' },
            ],
          },
          {
            title: 'More',
            items: [
              { label: 'GitHub', href: 'https://github.com/VitalPointAI/Bastion' },
              { label: 'Deployment', to: '/deployment/getting-started' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} VitalPoint AI. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'json', 'rust', 'sql', 'toml'],
      },
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 4,
      },
    }),
};

module.exports = config;
