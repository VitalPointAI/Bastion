/**
 * UserContext
 *
 * Provides user identity information across the application.
 * Populated by AuthWrapper after account initialization.
 */

import { createContext, useContext, type ReactNode } from 'react';

interface UserContextType {
  userDID: string | null;
  accountId: string | null;
  email: string | null;
  mpcRegistered: boolean;
  isAuthenticated: boolean;
}

const defaultContext: UserContextType = {
  userDID: null,
  accountId: null,
  email: null,
  mpcRegistered: false,
  isAuthenticated: false,
};

const UserContext = createContext<UserContextType>(defaultContext);

interface UserProviderProps {
  children: ReactNode;
  value: UserContextType;
}

export function UserProvider({ children, value }: UserProviderProps) {
  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  return useContext(UserContext);
}
