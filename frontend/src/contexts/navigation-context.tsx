'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type NavigationContextValue = {
    isNavigating: boolean;
    setNavigating: (value: boolean) => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
    const [isNavigating, setNavigating] = useState(false);
    const setNavigatingStable = useCallback((value: boolean) => setNavigating(value), []);
    return (
        <NavigationContext.Provider value={{ isNavigating, setNavigating: setNavigatingStable }}>
            {children}
        </NavigationContext.Provider>
    );
}

export function useNavigation() {
    const ctx = useContext(NavigationContext);
    if (!ctx) return { isNavigating: false, setNavigating: () => {} };
    return ctx;
}
