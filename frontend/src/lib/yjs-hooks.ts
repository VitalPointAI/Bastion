import { useState, useEffect, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

interface User {
  did: string;
  name: string;
  role: string;
  color: string;
}

interface UseYjsDocumentOptions {
  documentId: string;
  planId: string;
  user: User;
  wsUrl?: string;
}

interface UseYjsDocumentResult {
  doc: Y.Doc | null;
  connected: boolean;
  connectedUsers: User[];
  getText: (name: string) => Y.Text | null;
  getArray: <T>(name: string) => Y.Array<T> | null;
  getMap: <T>(name: string) => Y.Map<T> | null;
}

export function useYjsDocument({
  documentId,
  planId,
  user,
  wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/collab`,
}: UseYjsDocumentOptions): UseYjsDocumentResult {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);

  // Initialize Yjs document and WebSocket provider
  useEffect(() => {
    const ydoc = new Y.Doc();

    // Build connection URL with params
    const url = new URL(wsUrl);
    url.searchParams.set('documentId', documentId);
    url.searchParams.set('planId', planId);
    url.searchParams.set('did', user.did);
    url.searchParams.set('name', user.name);
    url.searchParams.set('role', user.role);

    const wsProvider = new WebsocketProvider(
      url.origin + url.pathname,
      documentId,
      ydoc,
      {
        params: {
          documentId,
          planId,
          did: user.did,
          name: user.name,
          role: user.role,
        },
      }
    );

    // Track connection status from external WebSocket provider
    wsProvider.on('status', (event: { status: string }) => {
       
      setConnected(event.status === 'connected');
    });

    // Track connected users via awareness (external Yjs source)
    wsProvider.awareness.on('change', () => {
      const users: User[] = [];
      wsProvider.awareness.getStates().forEach((state) => {
        if (state.user) {
          users.push(state.user as User);
        }
      });
       
      setConnectedUsers(users);
    });

    // Set local user state
    wsProvider.awareness.setLocalStateField('user', user);

    // Sync Yjs doc reference to React state - intentional setState in effect
     
    setDoc(ydoc);

    // Cleanup on unmount
    return () => {
      wsProvider.destroy();
      ydoc.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconnecting on user.name/user.role change is unnecessary; only reconnect on identity (user.did) or document change
  }, [documentId, planId, user.did, wsUrl]);

  // Helper to get Y.Text
  const getText = useCallback(
    (name: string): Y.Text | null => {
      if (!doc) return null;
      return doc.getText(name);
    },
    [doc]
  );

  // Helper to get Y.Array
  const getArray = useCallback(
    <T,>(name: string): Y.Array<T> | null => {
      if (!doc) return null;
      return doc.getArray(name);
    },
    [doc]
  );

  // Helper to get Y.Map
  const getMap = useCallback(
    <T,>(name: string): Y.Map<T> | null => {
      if (!doc) return null;
      return doc.getMap(name);
    },
    [doc]
  );

  return {
    doc,
    connected,
    connectedUsers,
    getText,
    getArray,
    getMap,
  };
}

// Hook for observing Y.Text changes
export function useYjsText(text: Y.Text | null): string {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!text) return;

    // Sync React state with external Yjs document - intentional setState in effect
     
    setValue(text.toString());

    // Observe changes from Yjs (external source) and sync to React state
    const observer = () => {
       
      setValue(text.toString());
    };

    text.observe(observer);

    return () => {
      text.unobserve(observer);
    };
  }, [text]);

  return value;
}

// Hook for observing Y.Array changes
export function useYjsArray<T>(array: Y.Array<T> | null): T[] {
  const [value, setValue] = useState<T[]>([]);

  useEffect(() => {
    if (!array) return;

    // Sync React state with external Yjs document - intentional setState in effect
     
    setValue(array.toArray());

    // Observe changes from Yjs (external source) and sync to React state
    const observer = () => {
       
      setValue(array.toArray());
    };

    array.observe(observer);

    return () => {
      array.unobserve(observer);
    };
  }, [array]);

  return value;
}

// Hook for observing Y.Map changes
export function useYjsMap<T>(map: Y.Map<T> | null): Map<string, T> {
  const [value, setValue] = useState<Map<string, T>>(new Map());

  useEffect(() => {
    if (!map) return;

    // Sync React state with external Yjs document - intentional setState in effect
    const entries = new Map<string, T>();
    map.forEach((v, k) => entries.set(k, v));
     
    setValue(entries);

    // Observe changes from Yjs (external source) and sync to React state
    const observer = () => {
      const newEntries = new Map<string, T>();
      map.forEach((v, k) => newEntries.set(k, v));
       
      setValue(newEntries);
    };

    map.observe(observer);

    return () => {
      map.unobserve(observer);
    };
  }, [map]);

  return value;
}
