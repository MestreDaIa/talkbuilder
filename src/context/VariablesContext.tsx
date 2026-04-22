import { createContext, useCallback, useContext, useState } from "react";

type VariableContextType = {
  variables: Record<string, any>;
  setVariables: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  getAllVariableNames: () => string[];
  addVariable: (name: string, value?: any) => void;
  setVariable: (name: string, value: any) => void;
  replaceVariablesInText: (text: string) => string;
};

const VariablesContext = createContext<VariableContextType | null>(null);

export function VariablesProvider({ children }: { children: React.ReactNode }) {
  const [variables, setVariables] = useState<Record<string, any>>({});

  const getAllVariableNames = useCallback(
    () => Object.keys(variables),
    [variables]
  );

  const addVariable = useCallback((name: string, value: any = "") => {
    setVariables((prev) =>
      name in prev ? prev : { ...prev, [name]: value }
    );
  }, []);

  const setVariable = useCallback((name: string, value: any) => {
    setVariables((prev) => ({ ...prev, [name]: value }));
  }, []);

  const replaceVariablesInText = useCallback(
    (text: string) => {
      if (!text) return text;
      return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => {
        const v = variables[key];
        return v == null ? "" : String(v);
      });
    },
    [variables]
  );

  return (
    <VariablesContext.Provider
      value={{
        variables,
        setVariables,
        getAllVariableNames,
        addVariable,
        setVariable,
        replaceVariablesInText,
      }}
    >
      {children}
    </VariablesContext.Provider>
  );
}

export function useVariables() {
  const context = useContext(VariablesContext);
  if (!context) {
    throw new Error("useVariables must be used within VariablesProvider");
  }
  return context;
}
