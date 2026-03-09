/**
 * AIStaffPanel -- Global floating overlay
 *
 * Always renders as a floating draggable/resizable panel regardless of tab.
 * Opened via top-bar "AI Activity" button in ProblemSetTabContainer.
 */

import { useAIStaff } from '../../context/AIStaffContext.tsx';
import { AIStaffFloating } from './AIStaffFloating.tsx';
import './AIStaffPanel.css';

export function AIStaffPanel() {
  const { isOpen } = useAIStaff();

  if (!isOpen) return null;

  return <AIStaffFloating />;
}
