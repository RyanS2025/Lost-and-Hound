import { createContext, useContext, useState, useCallback } from 'react';

const DemoContext = createContext(null);

export function DemoProvider({ children }) {
  const [isDemoMode, setIsDemoMode] = useState(false);

  const enterDemo = useCallback(() => setIsDemoMode(true), []);
  const exitDemo  = useCallback(() => setIsDemoMode(false), []);

  return (
    <DemoContext.Provider value={{ isDemoMode, enterDemo, exitDemo }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  return useContext(DemoContext);
}
