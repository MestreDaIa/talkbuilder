import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Container } from '@/types/chatbot';

interface VariablesContextType {
  variables: Record<string, string>;
  addVariable: (name: string, value?: string) => void;
  setVariable: (name: string, value: string) => void;
  getVariable: (name: string) => string | undefined;
  getAllVariableNames: () => string[];
  replaceVariablesInText: (text: string, extraVars?: Record<string, string>) => string;
  syncVariablesFromNodes: (containers: Container[]) => void;
}

const VariablesContext = createContext<VariablesContextType | undefined>(undefined);

export const VariablesProvider = ({ children }: { children: ReactNode }) => {
  const [variables, setVariables] = useState<Record<string, string>>({});

  const sanitize = (name: string) => name.trim().replace(/^{{\s*/, '').replace(/\s*}}$/, '');

  const addVariable = (name: string, value: string = '') => {
    setVariables(prev => ({ ...prev, [sanitize(name)]: value }));
  };

  const setVariableValue = (name: string, value: string) => {
    setVariables(prev => ({ ...prev, [sanitize(name)]: value }));
  };

  const getVariable = (name: string) => {
    return variables[name];
  };

  const getAllVariableNames = () => {
    return Object.keys(variables);
  };

  const replaceVariablesInText = (text: string, extraVars?: Record<string, string>) => {
    let result = text ?? '';
    const allVars = { ...variables, ...extraVars } as Record<string, string | undefined>;

    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    Object.entries(allVars).forEach(([rawName, value]) => {
      const name = sanitize(rawName);
      if (!name) return;
      const pattern = new RegExp(`{{\\s*${escapeRegExp(name)}\\s*}}`, 'gi');
      result = result.replace(pattern, value ?? '');
    });
    return result;
  };

  const syncVariablesFromNodes = (containers: Container[]) => {
    containers.forEach(container => {
      container.nodes.forEach(node => {
        if (node.type === 'set-variable' && node.config.variableName) {
          const varName = sanitize(node.config.variableName);
          if (varName && !variables[varName]) {
            addVariable(varName, '');
          }
        }

        if (node.type.startsWith('input-') && node.config.saveVariable) {
          const varName = sanitize(node.config.saveVariable);
          if (varName && !variables[varName]) {
            addVariable(varName, '');
          }
        }

        if (node.type === 'input-buttons' && node.config.buttons) {
          (node.config.buttons as any[]).forEach((button: any) => {
            if (button.saveVariable) {
              const varName = sanitize(button.saveVariable);
              if (varName && !variables[varName]) {
                addVariable(varName, '');
              }
            }
          });
        }
      });
    });
  };

  return (
    <VariablesContext.Provider
      value={{
        variables,
        addVariable,
        setVariable: setVariableValue,
        getVariable,
        getAllVariableNames,
        replaceVariablesInText,
        syncVariablesFromNodes,
      }}
    >
      {children}
    </VariablesContext.Provider>
  );
};

export const useVariables = () => {
  const context = useContext(VariablesContext);
  if (!context) {
    throw new Error('useVariables must be used within VariablesProvider');
  }
  return context;
};
