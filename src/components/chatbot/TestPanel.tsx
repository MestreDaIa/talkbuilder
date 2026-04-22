import { useState, useEffect, useRef } from "react";
import { X, Send, Headphones, Play, Pause, Image as ImageIcon, Video as VideoIcon, FileText, Mic, Camera, Upload, Trash2, StopCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { type Container, type Node, type ButtonConfig, type Edge } from "../../types/chatbot";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Checkbox } from "../../components/ui/checkbox";
import { useVariables } from "@/context/VariablesContext";
import { renderTextSegments } from "@/lib/textParser";

// Replace {{variableName}} with JSON.stringify(value) for safe JS interpolation
const replaceVariablesInJs = (code: string, vars: Record<string, any>): string => {
  return code.replace(/{{\s*([^}]+?)\s*}}/g, (_, varName) => {
    const value = vars[varName.trim()];
    return value !== undefined ? JSON.stringify(value) : '""';
  });
};

// Execute JavaScript code or return literal value
const executeJavaScript = (
  code: string,
  vars: Record<string, any>,
  setVar: (name: string, value: string) => void,
  getVar: (name: string) => string | undefined,
  replaceVars: (text: string, extraVars?: Record<string, string>) => string
): string => {
  const trimmedCode = (code ?? "").trim();
  
  // If empty, return empty
  if (!trimmedCode) return "";
  
  // If doesn't contain 'return', treat as literal value with variable substitution
  if (!trimmedCode.includes("return")) {
    return replaceVars(trimmedCode, vars);
  }
  
  try {
    // Replace {{var}} patterns with their JSON.stringify values for safe JS
    const preparedCode = replaceVariablesInJs(trimmedCode, vars);
    
    // Create a function with available variables and helpers in scope
    const varNames = Object.keys(vars);
    const varValues = Object.values(vars);
    
    // Build function that has access to all variables and helpers
    const fn = new Function(
      ...varNames,
      "setVariable",
      "getVariable",
      "variables",
      preparedCode
    );
    
    // Execute and return result
    const result = fn(
      ...varValues,
      setVar,
      getVar,
      vars
    );
    
    return result !== undefined ? String(result) : "";
  } catch (error: any) {
    console.error("Erro ao executar código JavaScript:", error);
    return `[Erro: ${error.message}]`;
  }
};

// Evaluate a single comparison
const evaluateComparison = (varValue: string, operator: string, compareValue: string): boolean => {
  const normalizedVar = (varValue ?? "").toString().trim();
  const normalizedCompare = (compareValue ?? "").toString().trim();

  switch (operator) {
    case "equals":
      return normalizedVar === normalizedCompare;
    case "not_equals":
      return normalizedVar !== normalizedCompare;
    case "contains":
      return normalizedVar.includes(normalizedCompare);
    case "not_contains":
      return !normalizedVar.includes(normalizedCompare);
    case "greater_than": {
      const numVar = Number(normalizedVar);
      const numCompare = Number(normalizedCompare);
      if (!Number.isNaN(numVar) && !Number.isNaN(numCompare)) return numVar >= numCompare;
      return normalizedVar >= normalizedCompare;
    }
    case "less_than": {
      const numVar = Number(normalizedVar);
      const numCompare = Number(normalizedCompare);
      if (!Number.isNaN(numVar) && !Number.isNaN(numCompare)) return numVar <= numCompare;
      return normalizedVar <= normalizedCompare;
    }
    case "is_set":
      return normalizedVar !== "";
    case "is_empty":
      return normalizedVar === "";
    case "starts_with":
      return normalizedVar.startsWith(normalizedCompare);
    case "ends_with":
      return normalizedVar.endsWith(normalizedCompare);
    case "matches_regex":
      try {
        const match = normalizedCompare.match(/^\/(.*)\/([gimsuy]*)$/);
        const regex = match ? new RegExp(match[1], match[2]) : new RegExp(normalizedCompare);
        return regex.test(normalizedVar);
      } catch {
        return false;
      }
    case "not_matches_regex":
      try {
        const match = normalizedCompare.match(/^\/(.*)\/([gimsuy]*)$/);
        const regex = match ? new RegExp(match[1], match[2]) : new RegExp(normalizedCompare);
        return !regex.test(normalizedVar);
      } catch {
        return true;
      }
    default:
      return false;
  }
};

interface AudioPlayerProps {
  src: string;
  autoPlay?: boolean;
}

const AudioPlayer = ({ src, autoPlay }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100);
    };
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    audio.currentTime = newTime;
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio ref={audioRef} src={src} autoPlay={autoPlay} />
      <button
        onClick={togglePlay}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors flex-shrink-0"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 text-white" />
        ) : (
          <Play className="h-4 w-4 text-white ml-0.5" />
        )}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div
          onClick={handleProgressClick}
          className="h-1.5 bg-white/30 rounded-full cursor-pointer overflow-hidden"
        >
          <div
            className="h-full bg-white rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-white/70">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

interface TestPanelProps {
  isOpen: boolean;
  onClose: () => void;
  startContainer: Container | null;
  allContainers: Container[];
  edges?: Edge[];
}

interface Message {
  id: string;
  type: "bot" | "user";
  content: string;
  isVideo?: boolean;
  isImage?: boolean;
  isFile?: boolean;
  isAudio?: boolean;
  alt?: string;
  autoplay?: boolean;
}

export const TestPanel = ({ isOpen, onClose, startContainer, allContainers, edges = [] }: TestPanelProps) => {
  const { replaceVariablesInText, setVariable, variables, setVariables } = useVariables();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [currentContainerId, setCurrentContainerId] = useState<string | null>(null);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [currentInputNode, setCurrentInputNode] = useState<Node | null>(null);
  const [activeButtons, setActiveButtons] = useState<ButtonConfig[]>([]);
  const [waitingForButton, setWaitingForButton] = useState(false);
  const [isMultipleChoice, setIsMultipleChoice] = useState(false);
  const [selectedButtons, setSelectedButtons] = useState<string[]>([]);
  const [submitLabel, setSubmitLabel] = useState("Enviar");
  // Media upload state
  const [mediaPreview, setMediaPreview] = useState<{ url: string; name?: string } | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pendingVarsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && startContainer) {
      setMessages([]);
      setCurrentContainerId(startContainer.id);
      setCurrentNodeIndex(0);
      setWaitingForInput(false);
      setWaitingForButton(false);
      setActiveButtons([]);
      setIsMultipleChoice(false);
      setSelectedButtons([]);
      setMediaPreview(null);
      setIsRecordingAudio(false);
      pendingVarsRef.current = {};
      // Reset all variables so a fresh test session doesn't reuse stale values
      setVariables({});
      processNextNode(startContainer, 0, {});
    }
  }, [isOpen, startContainer]);

  const processNextNode = async (container: Container, nodeIndex: number, extraVars: Record<string, string> = {}) => {
    if (!container || nodeIndex >= container.nodes.length) {
      const nextEdge = edges.find((edge) => edge.source === container.id);
      if (nextEdge) {
        const nextContainer = allContainers.find((c) => c.id === nextEdge.target);
        if (nextContainer) {
          setTimeout(() => {
            setCurrentContainerId(nextContainer.id);
            setCurrentNodeIndex(0);
            processNextNode(nextContainer, 0, extraVars);
          }, 500);
        }
      }
      return;
    }

    const node = container.nodes[nodeIndex];

    // Handle start node - initialize variables and continue
    if (node.type === "start") {
      const initialVars = node.config.initialVariables || [];
      initialVars.forEach(({ name, defaultValue }: { name: string; defaultValue: string }) => {
        if (name) {
          setVariable(name, defaultValue || "");
          extraVars[name] = defaultValue || "";
        }
      });
      processNextNode(container, nodeIndex + 1, extraVars);
      return;
    }

    // Handle webhook node - simulate received data in test mode
    if (node.type === "webhook") {
      const responseVariable = node.config.responseVariable || "webhookData";
      const simulatedData = { test: true, timestamp: Date.now() };
      setVariable(responseVariable, JSON.stringify(simulatedData));
      extraVars[responseVariable] = JSON.stringify(simulatedData);
      
      setMessages((prev) => [...prev, { 
        id: `webhook-${Date.now()}`, 
        type: "bot", 
        content: `📥 Webhook recebido (simulado)` 
      }]);
      
      processNextNode(container, nodeIndex + 1, extraVars);
      return;
    }

    // Handle http-request node - execute fetch
    if (node.type === "http-request") {
      const { method = "GET", url, responseVariable = "httpResponse" } = node.config;
      const allVars = { ...variables, ...extraVars };
      const processedUrl = replaceVariablesInText(url || "", allVars);
      
      if (!processedUrl) {
        setMessages((prev) => [...prev, { 
          id: `error-${Date.now()}`, 
          type: "bot", 
          content: `⚠️ HTTP Request: URL não configurada` 
        }]);
        processNextNode(container, nodeIndex + 1, extraVars);
        return;
      }

      setMessages((prev) => [...prev, { 
        id: `http-${Date.now()}`, 
        type: "bot", 
        content: `🔄 Executando ${method} ${processedUrl}...` 
      }]);

      try {
        const response = await fetch(processedUrl, { method });
        const text = await response.text();
        let data = text;
        try { data = JSON.stringify(JSON.parse(text)); } catch {}
        
        setVariable(responseVariable, data);
        extraVars[responseVariable] = data;
        
        setMessages((prev) => [...prev, { 
          id: `http-ok-${Date.now()}`, 
          type: "bot", 
          content: `✅ HTTP ${response.status}` 
        }]);
      } catch (error: any) {
        setMessages((prev) => [...prev, { 
          id: `http-err-${Date.now()}`, 
          type: "bot", 
          content: `❌ Erro HTTP: ${error.message}` 
        }]);
      }
      
      processNextNode(container, nodeIndex + 1, extraVars);
      return;
    }

    if (node.type === "set-variable") {
      const variableName = node.config.variableName;
      const rawValue = node.config.customValue || node.config.value || "";
      
      if (variableName) {
        // Merge current variables with extraVars for the execution context
        const allVars = { ...variables, ...extraVars };
        
        // Execute the JavaScript code or get literal value
        const executedValue = executeJavaScript(
          rawValue,
          allVars,
          (name: string, val: string) => {
            setVariable(name, val);
            extraVars[name] = val;
          },
          (name: string) => allVars[name],
          replaceVariablesInText
        );
        
        setVariable(variableName, executedValue);
        extraVars[variableName] = executedValue;
      }
      processNextNode(container, nodeIndex + 1, extraVars);
      return;
    }

    // Handle script node - executes JavaScript without necessarily setting a specific variable
    if (node.type === "script") {
      const code = node.config.code || "";
      
      if (code.trim()) {
        const allVars = { ...variables, ...extraVars };
        
        try {
          // Replace {{var}} patterns with their JSON.stringify values for safe JS
          const preparedCode = replaceVariablesInJs(code, allVars);
          
          const varNames = Object.keys(allVars);
          const varValues = Object.values(allVars);
          
          const fn = new Function(
            ...varNames,
            "setVariable",
            "getVariable",
            "variables",
            preparedCode
          );
          
          fn(
            ...varValues,
            (name: string, val: string) => {
              setVariable(name, val);
              extraVars[name] = val;
            },
            (name: string) => allVars[name],
            allVars
          );
        } catch (error: any) {
          console.error("Erro ao executar script:", error);
          // Show error message in chat
          setMessages((prev) => [...prev, { 
            id: `error-${Date.now()}`, 
            type: "bot", 
            content: `⚠️ Erro no script: ${error.message}` 
          }]);
        }
      }
      
      processNextNode(container, nodeIndex + 1, extraVars);
      return;
    }

    // Handle condition node
    if (node.type === "condition") {
      const sanitize = (name: string) => (name || "").trim().replace(/^{{\s*/, "").replace(/\s*}}$/, "");

      const conditionGroups = (node.config.conditions || []) as Array<{
        id: string;
        comparisons: Array<{ variableName: string; operator: string; value?: string }>;
        logicalOperator?: "AND" | "OR";
      }>;

      let matchedConditionId: string | null = null;

      for (const group of conditionGroups) {
        const comparisons = group.comparisons || [];
        if (comparisons.length === 0) continue;

        const logicOperator = group.logicalOperator || "AND";
        let groupResult = logicOperator === "AND" ? true : false;

        for (const comparison of comparisons) {
          const rawVarName = comparison.variableName || "";
          const varName = sanitize(rawVarName);

          const varValue =
            (extraVars[varName] ??
              extraVars[rawVarName] ??
              variables[varName] ??
              variables[rawVarName] ??
              "") as string;

          const compareValue = replaceVariablesInText(comparison.value || "", extraVars);

          const comparisonResult = evaluateComparison(varValue, comparison.operator, compareValue);

          if (logicOperator === "AND") {
            groupResult = groupResult && comparisonResult;
          } else {
            groupResult = groupResult || comparisonResult;
          }
        }

        if (groupResult) {
          matchedConditionId = group.id;
          break;
        }
      }

      const targetEdge = matchedConditionId
        ? edges.find((e) => e.sourceHandle === `${node.id}-cond-${matchedConditionId}`)
        : edges.find((e) => e.sourceHandle === `${node.id}-else`);

      if (targetEdge) {
        const targetContainer = allContainers.find((c) => c.id === targetEdge.target);
        if (targetContainer) {
          setTimeout(() => {
            setCurrentContainerId(targetContainer.id);
            setCurrentNodeIndex(0);
            processNextNode(targetContainer, 0, extraVars);
          }, 500);
          return;
        }
      }

      // Fallback: if wiring is missing, continue in same container
      processNextNode(container, nodeIndex + 1, extraVars);
      return;
    }

    if (node.type.startsWith("bubble")) {
      if (node.type === "bubble-image" && node.config.ImageURL) {
        setTimeout(() => {
          setMessages((prev) => [...prev, { id: `${node.id}-${Date.now()}`, type: "bot", content: node.config.ImageURL, isImage: true, alt: node.config.ImageAlt || "Imagem" }]);
          setTimeout(() => processNextNode(container, nodeIndex + 1, extraVars), 500);
        }, 500);
      } else if (node.type === "bubble-video" && node.config.VideoURL) {
        setTimeout(() => {
          setMessages((prev) => [...prev, { id: `${node.id}-${Date.now()}`, type: "bot", content: node.config.VideoURL, isVideo: true }]);
          setTimeout(() => processNextNode(container, nodeIndex + 1, extraVars), 500);
        }, 500);
      } else if (node.type === "bubble-audio") {
        const audioURL = node.config.AudioURL;
        if (audioURL && typeof audioURL === "string" && audioURL.trim() !== "") {
          setTimeout(() => {
            setMessages((prev) => [...prev, {
              id: `${node.id}-${Date.now()}`,
              type: "bot",
              content: audioURL,
              isAudio: true,
              alt: node.config.AudioAlt || "Áudio",
              autoplay: node.config.AudioAutoplay || false,
            }]);
            setTimeout(() => processNextNode(container, nodeIndex + 1, extraVars), 500);
          }, 500);
        } else {
          processNextNode(container, nodeIndex + 1, extraVars);
        }
      } else {
        const message = node.config.message || node.config.number || "";
        if (message) {
          setTimeout(() => {
            setMessages((prev) => [...prev, { id: `${node.id}-${Date.now()}`, type: "bot", content: replaceVariablesInText(message, extraVars) }]);
            setTimeout(() => processNextNode(container, nodeIndex + 1, extraVars), 500);
          }, 500);
        } else {
          processNextNode(container, nodeIndex + 1, extraVars);
        }
      }
    } else if (node.type === "input-buttons") {
      const buttons = (node.config.buttons as ButtonConfig[]) || [];
      const multiChoice = node.config.isMultipleChoice || false;
      const submitLbl = node.config.submitLabel || "Enviar";
      
      setActiveButtons(buttons);
      setIsMultipleChoice(multiChoice);
      setSubmitLabel(submitLbl);
      setSelectedButtons([]);
      setWaitingForButton(true);
      setCurrentInputNode(node);
      setCurrentNodeIndex(nodeIndex);
    } else if (node.type.startsWith("input")) {
      setCurrentInputNode(node);
      setWaitingForInput(true);
      setCurrentNodeIndex(nodeIndex);
    } else {
      processNextNode(container, nodeIndex + 1, extraVars);
    }
  };

  const handleButtonClick = (button: ButtonConfig) => {
    if (!waitingForButton || !currentInputNode) return;
    
    // Get the value to save - use value if defined, otherwise use label
    const valueToSave = button.value || button.label;
    const saveVariable = currentInputNode.config.saveVariable;
    
    if (saveVariable) {
      setVariable(saveVariable, valueToSave);
      pendingVarsRef.current[saveVariable] = valueToSave;
    }
    
    setMessages((prev) => [...prev, { id: Date.now().toString(), type: "user", content: button.label }]);
    setActiveButtons([]);
    setWaitingForButton(false);

    // Check if there's a specific edge for this button
    const buttonEdge = edges.find(e => e.sourceHandle === `${currentInputNode.id}-btn-${button.id}`);
    
    if (buttonEdge) {
      // Navigate to the button's specific target
      const targetContainer = allContainers.find(c => c.id === buttonEdge.target);
      if (targetContainer) {
        setTimeout(() => {
          setCurrentContainerId(targetContainer.id);
          setCurrentNodeIndex(0);
          processNextNode(targetContainer, 0, pendingVarsRef.current);
        }, 500);
        return;
      }
    }
    
    // Check for default edge
    const defaultEdge = edges.find(e => e.sourceHandle === `${currentInputNode.id}-default`);
    if (defaultEdge) {
      const targetContainer = allContainers.find(c => c.id === defaultEdge.target);
      if (targetContainer) {
        setTimeout(() => {
          setCurrentContainerId(targetContainer.id);
          setCurrentNodeIndex(0);
          processNextNode(targetContainer, 0, pendingVarsRef.current);
        }, 500);
        return;
      }
    }
    
    // Fallback: continue to next node in current container
    const currentContainer = allContainers.find(c => c.id === currentContainerId);
    if (currentContainer) {
      processNextNode(currentContainer, currentNodeIndex + 1, pendingVarsRef.current);
    }
  };

  // Handle multiple choice toggle
  const handleToggleButton = (buttonId: string) => {
    setSelectedButtons(prev => 
      prev.includes(buttonId) 
        ? prev.filter(id => id !== buttonId)
        : [...prev, buttonId]
    );
  };

  // Handle multiple choice submit
  const handleMultipleChoiceSubmit = () => {
    if (!currentInputNode || selectedButtons.length === 0) return;
    
    const selectedBtns = activeButtons.filter(btn => selectedButtons.includes(btn.id));
    const values = selectedBtns.map(btn => btn.value || btn.label);
    const labels = selectedBtns.map(btn => btn.label);
    
    const saveVariable = currentInputNode.config.saveVariable;
    if (saveVariable) {
      const valueToSave = values.join(", ");
      setVariable(saveVariable, valueToSave);
      pendingVarsRef.current[saveVariable] = valueToSave;
    }
    
    setMessages((prev) => [...prev, { 
      id: Date.now().toString(), 
      type: "user", 
      content: labels.join(", ") 
    }]);
    
    setActiveButtons([]);
    setWaitingForButton(false);
    setIsMultipleChoice(false);
    setSelectedButtons([]);
    
    // For multiple choice, use default edge or continue to next node
    const defaultEdge = edges.find(e => e.sourceHandle === `${currentInputNode.id}-default`);
    if (defaultEdge) {
      const targetContainer = allContainers.find(c => c.id === defaultEdge.target);
      if (targetContainer) {
        setTimeout(() => {
          setCurrentContainerId(targetContainer.id);
          setCurrentNodeIndex(0);
          processNextNode(targetContainer, 0, pendingVarsRef.current);
        }, 500);
        return;
      }
    }
    
    const currentContainer = allContainers.find(c => c.id === currentContainerId);
    if (currentContainer) {
      processNextNode(currentContainer, currentNodeIndex + 1, pendingVarsRef.current);
    }
  };

  // Determine which media-input type the current input node expects
  const mediaInputType: "image" | "video" | "audio" | "document" | null = (() => {
    if (!currentInputNode) return null;
    switch (currentInputNode.type) {
      case "input-image": return "image";
      case "input-video": return "video";
      case "input-audio": return "audio";
      case "input-document": return "document";
      default: return null;
    }
  })();

  const isMediaInput = mediaInputType !== null;

  const acceptByType: Record<string, string> = {
    image: "image/*",
    video: "video/*",
    audio: "audio/*",
    document: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };

  const placeholderByType: Record<string, string> = {
    image: "Toque para enviar uma imagem",
    video: "Toque para enviar um vídeo",
    audio: "Toque para gravar ou enviar áudio",
    document: "Toque para enviar um documento",
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setMediaPreview({ url: dataUrl, name: file.name });
    } catch (err) {
      console.error(err);
    } finally {
      e.target.value = "";
    }
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];

      // Pick the best supported mime type (Safari/iOS prefers mp4, others webm)
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ];
      const supported = candidates.find(
        (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(t)
      );
      const recorder = supported
        ? new MediaRecorder(stream, { mimeType: supported })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || supported || "audio/webm";
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const ext = mimeType.includes("mp4")
          ? "m4a"
          : mimeType.includes("ogg")
          ? "ogg"
          : "webm";
        const reader = new FileReader();
        reader.onload = () => {
          setMediaPreview({ url: reader.result as string, name: `gravacao.${ext}` });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      // Request periodic dataavailable so the blob has proper duration metadata
      recorder.start(250);
      setIsRecordingAudio(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      alert("Não foi possível acessar o microfone.");
    }
  };

  const stopAudioRecording = () => {
    mediaRecorderRef.current?.stop();
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecordingAudio(false);
  };

  const handleSendMedia = () => {
    if (!mediaPreview || !currentInputNode || !mediaInputType) return;
    const saveVariable = currentInputNode.config.saveVariable;
    if (saveVariable) {
      setVariable(saveVariable, mediaPreview.url);
      pendingVarsRef.current[saveVariable] = mediaPreview.url;
    }
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        type: "user",
        content: mediaInputType === "document" ? (mediaPreview.name || "documento") : mediaPreview.url,
        isImage: mediaInputType === "image",
        isVideo: mediaInputType === "video",
        isAudio: mediaInputType === "audio",
        isFile: mediaInputType === "document",
        alt: mediaPreview.name,
      },
    ]);
    setMediaPreview(null);
    setWaitingForInput(false);
    setCurrentInputNode(null);
    const currentContainer = allContainers.find((c) => c.id === currentContainerId);
    if (currentContainer) setTimeout(() => processNextNode(currentContainer, currentNodeIndex + 1, pendingVarsRef.current), 500);
  };

  const handleSendMessage = () => {
    if (!currentInput.trim() || !waitingForInput) return;
    if (currentInputNode?.config.saveVariable) {
      setVariable(currentInputNode.config.saveVariable, currentInput);
      pendingVarsRef.current[currentInputNode.config.saveVariable] = currentInput;
    }
    setMessages((prev) => [...prev, { id: Date.now().toString(), type: "user", content: currentInput }]);
    setCurrentInput("");
    setWaitingForInput(false);
    setCurrentInputNode(null);
    const currentContainer = allContainers.find((c) => c.id === currentContainerId);
    if (currentContainer) setTimeout(() => processNextNode(currentContainer, currentNodeIndex + 1, pendingVarsRef.current), 500);
  };

  const formatRecTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <aside className="w-80 absolute top-0 right-0 h-full bg-card border-l border-border shadow-2xl flex flex-col">
      <div className="flex flex-col w-full h-full">
        <div className="h-14 border-b border-border px-3 flex items-center justify-between bg-gradient-to-r from-primary/20 via-card to-card">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--bot-flow)" }} />
            <h2 className="font-semibold text-sm text-foreground">Teste do Fluxo</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-3 bg-background/40">
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === "bot" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm shadow-md ${
                    message.type === "bot" ? "rounded-bl-sm" : "rounded-br-sm"
                  }`}
                  style={
                    message.type === "bot"
                      ? { background: "var(--bot-msg-bg)", color: "var(--bot-msg-fg)" }
                      : { background: "var(--user-msg-bg)", color: "var(--user-msg-fg)" }
                  }
                >
                  {message.isImage ? (
                    <img src={message.content} alt={message.alt} className="max-w-full rounded" />
                  ) : message.isVideo ? (
                    <video src={message.content} controls className="max-w-full rounded" />
                  ) : message.isAudio ? (
                    <div className="flex items-center gap-2">
                      <Headphones className="h-4 w-4 flex-shrink-0" />
                      <AudioPlayer src={message.content} autoPlay={message.autoplay} />
                    </div>
                  ) : message.isFile ? (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate max-w-[180px]">{message.content}</span>
                    </div>
                  ) : (
                    renderTextSegments(message.content)
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        {waitingForButton && activeButtons.length > 0 && (
          <div className="p-3 border-t border-border space-y-2 bg-card">
            {isMultipleChoice ? (
              <>
                {activeButtons.map((btn) => (
                  <label
                    key={btn.id}
                    className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/40 cursor-pointer hover:bg-muted transition-colors"
                  >
                    <Checkbox
                      checked={selectedButtons.includes(btn.id)}
                      onCheckedChange={() => handleToggleButton(btn.id)}
                    />
                    <span className="text-sm text-foreground">{btn.label}</span>
                  </label>
                ))}
                <Button
                  className="w-full"
                  onClick={handleMultipleChoiceSubmit}
                  disabled={selectedButtons.length === 0}
                >
                  {submitLabel}
                </Button>
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeButtons.map((btn) => (
                  <Button
                    key={btn.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleButtonClick(btn)}
                  >
                    {btn.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
        {waitingForInput && !waitingForButton && (
          isMediaInput ? (
            <div className="p-3 border-t border-border bg-card space-y-2">
              {/* Preview da mídia escolhida */}
              {mediaPreview && (
                <div className="rounded-lg border border-border bg-muted/40 p-2 space-y-2">
                  {mediaInputType === "image" && (
                    <img src={mediaPreview.url} alt="preview" className="max-h-40 mx-auto rounded" />
                  )}
                  {mediaInputType === "video" && (
                    <video src={mediaPreview.url} controls className="max-h-40 w-full rounded" />
                  )}
                  {mediaInputType === "audio" && (
                    <div
                      className="rounded-xl px-3 py-2 flex items-center gap-2"
                      style={{ background: "var(--user-msg-bg)", color: "var(--user-msg-fg)" }}
                    >
                      <Headphones className="h-4 w-4 flex-shrink-0" />
                      <AudioPlayer src={mediaPreview.url} />
                    </div>
                  )}
                  {mediaInputType === "document" && (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <FileText className="h-4 w-4" />
                      <span className="truncate">{mediaPreview.name || "documento"}</span>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={() => setMediaPreview(null)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Remover
                  </Button>
                </div>
              )}

              {/* Gravação de áudio em andamento */}
              {isRecordingAudio && (
                <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2">
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                    Gravando... {formatRecTime(recordingTime)}
                  </div>
                  <Button size="sm" variant="destructive" onClick={stopAudioRecording}>
                    <StopCircle className="h-4 w-4 mr-1" /> Parar
                  </Button>
                </div>
              )}

              {/* Botões de captura/upload */}
              {!mediaPreview && !isRecordingAudio && (
                <div className="space-y-2">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors bg-muted/20"
                  >
                    {mediaInputType === "image" && <ImageIcon className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />}
                    {mediaInputType === "video" && <VideoIcon className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />}
                    {mediaInputType === "audio" && <Headphones className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />}
                    {mediaInputType === "document" && <FileText className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />}
                    <p className="text-xs text-muted-foreground">{placeholderByType[mediaInputType!]}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-1" /> Enviar arquivo
                    </Button>
                    {(mediaInputType === "image" || mediaInputType === "video") && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        <Camera className="h-4 w-4 mr-1" />
                        {mediaInputType === "image" ? "Câmera" : "Gravar"}
                      </Button>
                    )}
                    {mediaInputType === "audio" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={startAudioRecording}
                      >
                        <Mic className="h-4 w-4 mr-1" /> Gravar
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Botão de envio */}
              {mediaPreview && (
                <Button className="w-full" onClick={handleSendMedia}>
                  <Send className="h-4 w-4 mr-1" /> Enviar
                </Button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={acceptByType[mediaInputType!]}
                className="hidden"
                onChange={handleFilePick}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept={mediaInputType === "video" ? "video/*" : "image/*"}
                capture="environment"
                className="hidden"
                onChange={handleFilePick}
              />
            </div>
          ) : (
            <div className="p-3 border-t border-border flex gap-2 bg-card">
              <Input
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Digite..."
                className="flex-1 bg-background border-border"
              />
              <Button size="icon" onClick={handleSendMessage}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )
        )}
      </div>
    </aside>
  );
};
