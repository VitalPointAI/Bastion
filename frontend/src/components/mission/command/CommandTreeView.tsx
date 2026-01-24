/**
 * Command Tree View Component
 *
 * Org chart visualization of command hierarchy using react-organizational-chart.
 * Displays units in tree structure with military symbology.
 */

import { useEffect, useState } from 'react';
import { Tree, TreeNode } from 'react-organizational-chart';
import type { HierarchyNode } from '../../../lib/types/command';
import { commandService } from '../../../lib/command-service';
import { CommandNode } from './CommandNode';
import './CommandTreeView.css';

interface CommandTreeViewProps {
  missionId: string;
}

export function CommandTreeView({ missionId }: CommandTreeViewProps) {
  const [hierarchyRoots, setHierarchyRoots] = useState<HierarchyNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHierarchy();
  }, [missionId]);

  async function loadHierarchy() {
    try {
      setLoading(true);
      setError(null);
      const roots = await commandService.getHierarchy(missionId);
      setHierarchyRoots(roots);
    } catch (err) {
      console.error('Failed to load hierarchy:', err);
      setError(err instanceof Error ? err.message : 'Failed to load hierarchy');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Recursively render tree nodes.
   */
  function renderTree(node: HierarchyNode): React.ReactNode {
    const hasChildren = node.children && node.children.length > 0;

    // Check if unit has multiple parent relationships (multi-hatted)
    const multiHatted = false; // TODO: Implement multi-hat detection

    const treeNode = (
      <TreeNode
        label={
          <CommandNode
            unit={node.unit}
            relationshipType={node.relationshipType}
            multiHatted={multiHatted}
          />
        }
      >
        {hasChildren && node.children.map((child) => renderTree(child))}
      </TreeNode>
    );

    return treeNode;
  }

  if (loading) {
    return (
      <div className="command-tree-loading">
        <div className="spinner" />
        <p>Loading command hierarchy...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="command-tree-error">
        <p>Error: {error}</p>
        <button onClick={loadHierarchy} className="btn-retry">
          Retry
        </button>
      </div>
    );
  }

  if (!hierarchyRoots || hierarchyRoots.length === 0) {
    return (
      <div className="command-tree-empty">
        <p>No command hierarchy defined.</p>
        <p className="command-tree-hint">Add units and relationships to build the hierarchy.</p>
      </div>
    );
  }

  return (
    <div className="command-tree-container">
      <div className="command-tree-wrapper">
        {hierarchyRoots.map((root, index) => (
          <Tree
            key={root.unit.id}
            lineWidth="2px"
            lineColor="#4A90E2"
            lineBorderRadius="8px"
            label={
              <CommandNode
                unit={root.unit}
                relationshipType={root.relationshipType}
              />
            }
          >
            {root.children && root.children.map((child) => renderTree(child))}
          </Tree>
        ))}
      </div>
    </div>
  );
}
