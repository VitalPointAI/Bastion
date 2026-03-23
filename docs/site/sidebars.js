/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    'index',
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/overview',
        'architecture/data-model',
      ],
    },
    {
      type: 'category',
      label: 'Capabilities',
      items: [
        'capabilities/understand-tab',
        'capabilities/design-tab',
        'capabilities/plan-tab',
        'capabilities/direct-tab',
        'capabilities/cop-tab',
        'capabilities/assess-tab',
        'capabilities/resources-tab',
        'capabilities/knowledge-graph',
        'capabilities/robot-bridge',
        'capabilities/robot-vision',
        'capabilities/swarm-behavior',
      ],
    },
    {
      type: 'category',
      label: 'AI Agents',
      items: [
        'ai-agents/overview',
        'ai-agents/agent-catalog',
      ],
    },
    {
      type: 'category',
      label: 'Governance',
      items: [
        'governance/dao-structure',
        'governance/authority-model',
      ],
    },
    {
      type: 'category',
      label: 'Blockchain',
      items: [
        'blockchain/near-integration',
        'blockchain/resource-registry',
      ],
    },
    {
      type: 'category',
      label: 'Exercises',
      items: [
        'exercises/scenario-setup',
        'exercises/training-mode',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: [
        'deployment/getting-started',
      ],
    },
    {
      type: 'category',
      label: 'API',
      items: [
        'api/rest-endpoints',
      ],
    },
  ],
};

module.exports = sidebars;
