import { Awareness } from 'y-protocols/awareness';
import { CollaborationUser } from './types.js';

// Color palette for user cursors
const CURSOR_COLORS = [
  '#3498db', '#e74c3c', '#2ecc71', '#9b59b6', '#f1c40f',
  '#1abc9c', '#e67e22', '#34495e', '#95a5a6', '#d35400'
];

class AwarenessManager {
  private colorIndex = 0;

  /**
   * Get next cursor color in rotation
   */
  private getNextColor(): string {
    const color = CURSOR_COLORS[this.colorIndex % CURSOR_COLORS.length];
    this.colorIndex++;
    return color;
  }

  /**
   * Set user's awareness state
   */
  setUserState(awareness: Awareness, user: CollaborationUser): void {
    awareness.setLocalStateField('user', {
      ...user,
      color: user.color || this.getNextColor()
    });
  }

  /**
   * Get all connected users from awareness
   */
  getConnectedUsers(awareness: Awareness): CollaborationUser[] {
    const users: CollaborationUser[] = [];

    awareness.getStates().forEach((state, clientId) => {
      if (state.user) {
        users.push(state.user as CollaborationUser);
      }
    });

    return users;
  }

  /**
   * Update cursor position for a user
   */
  updateCursor(awareness: Awareness, cursor: { line: number; column: number; section?: string }): void {
    awareness.setLocalStateField('cursor', cursor);
  }

  /**
   * Clean up disconnected user states
   */
  cleanupDisconnected(awareness: Awareness, activeClientIds: Set<number>): void {
    awareness.getStates().forEach((_, clientId) => {
      if (!activeClientIds.has(clientId)) {
        awareness.setLocalStateField('user', null);
      }
    });
  }
}

export const awarenessManager = new AwarenessManager();
