import { invoke } from "./db";
import type { ModelTier } from "./settings";

export interface ModelInfo {
  id: string;
  name: string;
  tier: ModelTier;
  size: string;
  filename: string;
  download_url: string;
}

export interface ModelStatus {
  downloaded: boolean;
  downloading: boolean;
  progress: number;
  path: string | null;
}

export interface LlamaStatus {
  running: boolean;
  port: number | null;
  model: string | null;
}

export interface ChatRequest {
  prompt: string;
  system_prompt?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  text: string;
}

export interface DownloadProgress {
  model_id: string;
  progress: number;
  downloaded_bytes: number;
  total_bytes: number;
}

type ProgressCallback = (progress: DownloadProgress) => void;

class LLMManager {
  private progressListeners = new Map<string, Set<ProgressCallback>>();
  private listening = false;

  private ensureListening() {
    if (this.listening) return;
    this.listening = true;
    if (typeof window !== "undefined" && "TAURI" in window) {
      const unlisten = [] as (() => void)[];
      import("@tauri-apps/api/event").then(({ listen }) => {
        listen<DownloadProgress>("download-progress", (e) => {
          const cbs = this.progressListeners.get(e.payload.model_id);
          if (cbs) cbs.forEach((cb) => cb(e.payload));
        });
      });
    }
  }

  onProgress(modelId: string, cb: ProgressCallback): () => void {
    this.ensureListening();
    if (!this.progressListeners.has(modelId)) {
      this.progressListeners.set(modelId, new Set());
    }
    this.progressListeners.get(modelId)!.add(cb);
    return () => this.progressListeners.get(modelId)?.delete(cb);
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    return invoke<ModelInfo[]>("get_available_models");
  }

  async getModelStatus(modelId: string): Promise<ModelStatus> {
    return invoke<ModelStatus>("get_model_status", { modelId });
  }

  async downloadModel(modelId: string): Promise<void> {
    return invoke<void>("download_model", { modelId });
  }

  async cancelDownload(modelId: string): Promise<void> {
    return invoke<void>("cancel_download", { modelId });
  }

  async startServer(modelPath: string, port = 8080, ngl = 32): Promise<string> {
    return invoke<string>("start_llama_server", {
      modelPath,
      port,
      ngl,
    });
  }

  async stopServer(): Promise<void> {
    return invoke<void>("stop_llama_server");
  }

  async getStatus(): Promise<LlamaStatus> {
    return invoke<LlamaStatus>("get_llama_status");
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return invoke<ChatResponse>("chat_completion", { request });
  }
}

export const llm = new LLMManager();
