/**
 * AIStaffPanel -- Mode-switching shell
 *
 * Renders the appropriate AI staff panel variant based on the active tab:
 * - Process tabs (Understand, Design, Plan): docked right sidebar
 * - Watch tabs (COP, Assess, Direct): floating draggable overlay
 */

import { useAIStaff } from '../../context/AIStaffContext.tsx';
import { isProcessTab, isWatchTab } from './AgentRoutingConfig.ts';
import { AIStaffDocked } from './AIStaffDocked.tsx';
import { AIStaffFloating } from './AIStaffFloating.tsx';
import './AIStaffPanel.css';

export function AIStaffPanel() {
  const { activeTab, isOpen } = useAIStaff();

  if (isProcessTab(activeTab)) {
    if (!isOpen) return null;
    return <AIStaffDocked />;
  }

  if (isWatchTab(activeTab)) {
    return <AIStaffFloating />;
  }

  return null;
}
