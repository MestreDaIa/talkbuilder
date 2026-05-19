export type NodeType =
  // flow
  | "start"
  | "webhook"
  | "http-request"
  | "redirect"
  | "go-to"
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
  | "condition"
  | "wait"
  | "await";

export interface NodeConfig {
  [key: string]: any;
}

export interface Node {
  id: string;
  type: NodeType;
  config: NodeConfig;
}

/**
 * Legacy alias used by the static example flow in src/data/flow.ts.
 * Kept loose so the example file (which uses simplified shapes like
 * { type: "bubble", content: "..." }) still typechecks.
 */
export interface ChatNode {
  id: string;
  type: string;
  content?: string;
  next?: string;
  [key: string]: unknown;
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
