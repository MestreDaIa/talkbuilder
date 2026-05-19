import { BubbleTextConfig } from "./NodesBubblesConfig/BubbleTextConfig";
import { BubbleNumberConfig } from "./NodesBubblesConfig/BubbleNumberConfig";
import { BubbleImageConfig } from "./NodesBubblesConfig/BubbleImageConfig";
import { BubbleVideoConfig } from "./NodesBubblesConfig/BubbleVideoConfig";
import { BubbleAudioConfig } from "./NodesBubblesConfig/BubbleAudioConfig";
import { BubbleFileConfig } from "./NodesBubblesConfig/BubbleFileConfig";
import { InputTextConfig } from "./NodesInputsConfig/InputTextConfig";
import { InputNumberConfig } from "./NodesInputsConfig/InputNumberConfig";
import { InputMailConfig } from "./NodesInputsConfig/InputMailConfig";
import { InputPhoneConfig } from "./NodesInputsConfig/InputPhoneConfig";
import { InputButtonConfig } from "./NodesInputsConfig/InputButtonConfig";
import { InputWebSiteConfig } from "./NodesInputsConfig/InputWebSiteConfig";
import { SetVariableConfig } from "./NodesLogicConfig/SetVariableConfig";
import { ScriptConfig } from "./NodesLogicConfig/ScriptConfig";
import { ConditionConfig } from "./NodesLogicConfig/ConditionConfig";
import { WaitConfig } from "./NodesLogicConfig/WaitConfig";
import { StartConfig, WebhookConfig, HttpRequestConfig, RedirectConfig, GoToConfig } from "./NodesFlowConfig";
import { AIConfig } from "./NodesAIConfig";
import { GoogleSheetsConfig, HumanHandoffConfig } from "./NodesIntegrationsConfig";

export const nodeConfigComponents: Record<string, React.FC<any>> = {
  // Flow
  "start": StartConfig,
  "webhook": WebhookConfig,
  "http-request": HttpRequestConfig,
  "redirect": RedirectConfig,
  "go-to": GoToConfig,
  // Bubbles
  "bubble-text": BubbleTextConfig,
  "bubble-number": BubbleNumberConfig,
  "bubble-image": BubbleImageConfig,
  "bubble-audio": BubbleAudioConfig,
  "bubble-document": BubbleFileConfig,
  "bubble-video": BubbleVideoConfig,
  // Inputs
  "input-text": InputTextConfig,
  "input-number": InputNumberConfig,
  "input-webSite": InputWebSiteConfig,
  "input-mail": InputMailConfig,
  "input-phone": InputPhoneConfig,
  "input-image": InputTextConfig,
  "input-video": InputTextConfig,
  "input-audio": InputTextConfig,
  "input-document": InputTextConfig,
  "input-buttons": InputButtonConfig,
  // Logic
  "set-variable": SetVariableConfig,
  "script": ScriptConfig,
  "condition": ConditionConfig,
  "wait": WaitConfig,
  // AI
  "ai-node": AIConfig,
  // Integrations
  "google-sheets": GoogleSheetsConfig,
  "human-handoff": HumanHandoffConfig,
};
