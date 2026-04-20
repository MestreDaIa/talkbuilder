export type NodeType =
  // flow
  | "start"
  | "webhook"
  | "http-request"
  // bubbles
  | "bubble-text"
  | "bubble-number"
  | "bubble-image"
  | "bubble-video"
  | "bubble-audio"
  | "bubble-document"
  // inputs
  | "input-text"
  | "input-number"
  | "input-mail"
  | "input-phone"
  | "input-image"
  | "input-video"
  | "input-audio"
  | "input-document"
  | "input-buttons"
  | "input-webSite"
  // logic
  | "set-variable"
  | "script"
  | "condition";

export interface NodeConfig {
  [key: string]: any;
}

export interface Node {
  id: string;
  type: NodeType;
  config: NodeConfig;
}

export interface Container {
  id: string;
  nodes: Node[];
  nameContainer?: string;
  position: { x: number; y: number };
}

export interface ButtonConfig {
  id: string;
  label: string;
  value?: string;
  description?: string;
  redirectUrl?: string;
}

export interface ButtonGroupConfig {
  buttons: ButtonConfig[];
  saveVariable?: string;
  isMultipleChoice?: boolean;
  isSearchable?: boolean;
  submitLabel?: string;
}

export interface Edge {
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface Workspace {
  name: string;
  containers: Container[];
  edges?: Edge[];
}

// Condition types
export interface ConditionComparison {
  id: string;
  variableName: string;
  operator: 
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "greater_than"
    | "less_than"
    | "is_set"
    | "is_empty"
    | "starts_with"
    | "ends_with"
    | "matches_regex"
    | "not_matches_regex";
  value?: string;
}

export interface ConditionGroup {
  id: string;
  comparisons: ConditionComparison[];
  logicalOperator: "AND" | "OR";
}
