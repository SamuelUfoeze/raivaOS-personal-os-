use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub tier: String,
    pub size: String,
    pub filename: String,
    pub download_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelStatus {
    pub downloaded: bool,
    pub downloading: bool,
    pub progress: f64,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub model_id: String,
    pub progress: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub prompt: String,
    pub system_prompt: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlamaStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub model: Option<String>,
}

pub struct LlamaState {
    pub process: Mutex<Option<Child>>,
    pub port: Mutex<Option<u16>>,
    pub loaded_model: Mutex<Option<String>>,
    pub downloads: Mutex<HashMap<String, DownloadHandle>>,
}

pub struct DownloadHandle {
    pub cancel: Arc<AtomicBool>,
    pub progress: Arc<Mutex<f64>>,
}

impl LlamaState {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
            port: Mutex::new(None),
            loaded_model: Mutex::new(None),
            downloads: Mutex::new(HashMap::new()),
        }
    }
}

fn available_models() -> &'static [ModelInfo] {
    static MODELS: OnceLock<Vec<ModelInfo>> = OnceLock::new();
    MODELS.get_or_init(|| {
        vec![
            ModelInfo {
                id: "qwen2.5-1.5b".into(),
                name: "Qwen 2.5 1.5B Instruct".into(),
                tier: "standard".into(),
                size: "1.5B".into(),
                filename: "qwen2.5-1.5b-instruct-q4_k_m.gguf".into(),
                download_url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf".into(),
            },
            ModelInfo {
                id: "qwen2.5-7b".into(),
                name: "Qwen 2.5 7B Instruct".into(),
                tier: "pro".into(),
                size: "7B".into(),
                filename: "qwen2.5-7b-instruct-q4_k_m.gguf".into(),
                download_url: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf".into(),
            },
        ]
    })
}

#[tauri::command]
pub fn get_available_models() -> Vec<ModelInfo> {
    available_models().to_vec()
}

#[tauri::command]
pub async fn download_model(
    app: tauri::AppHandle,
    state: tauri::State<'_, LlamaState>,
    model_id: String,
) -> Result<(), String> {
    let model = available_models()
        .iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| format!("Unknown model: {}", model_id))?;

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app dir: {}", e))?;
    let models_dir = app_dir.join("models");
    std::fs::create_dir_all(&models_dir)
        .map_err(|e| format!("Failed to create models dir: {}", e))?;

    let model_path = models_dir.join(&model.filename);
    if model_path.exists() {
        return Err("Model already downloaded".into());
    }

    // Download to a .part temp file so an interrupted download never leaves
    // a corrupt file at the final path. Stale partials are cleaned up here.
    let part_path = model_path.with_extension("gguf.part");
    if part_path.exists() {
        let _ = std::fs::remove_file(&part_path);
    }

    let cancel = Arc::new(AtomicBool::new(false));
    let progress = Arc::new(Mutex::new(0.0));
    {
        let mut downloads = state.downloads.lock().map_err(|e| e.to_string())?;
        downloads.insert(
            model_id.clone(),
            DownloadHandle {
                cancel: Arc::clone(&cancel),
                progress: Arc::clone(&progress),
            },
        );
    }

    let client = reqwest::Client::new();
    let response = client
        .get(&model.download_url)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {}", e))?;

    let total_size = response
        .content_length()
        .unwrap_or(0);

    let mut downloaded: u64 = 0;
    let mut file = tokio::fs::File::create(&part_path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    let mut stream = response.bytes_stream();

    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::Relaxed) {
            let _ = tokio::fs::remove_file(&part_path).await;
            let mut downloads = state.downloads.lock().map_err(|e| e.to_string())?;
            downloads.remove(&model_id);
            return Err("Download cancelled".into());
        }
        let chunk = chunk.map_err(|e| {
            let _ = std::fs::remove_file(&part_path);
            format!("Download stream error: {}", e)
        })?;
        downloaded += chunk.len() as u64;
        tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
            .await
            .map_err(|e| {
                let _ = std::fs::remove_file(&part_path);
                format!("Write error: {}", e)
            })?;

        let progress_value = if total_size > 0 {
            downloaded as f64 / total_size as f64 * 100.0
        } else {
            0.0
        };
        if let Ok(mut p) = progress.lock() {
            *p = progress_value;
        }

        let _ = app.emit(
            "download-progress",
            DownloadProgress {
                model_id: model_id.clone(),
                progress: progress_value,
                downloaded_bytes: downloaded,
                total_bytes: total_size,
            },
        );
    }

    drop(file);
    tokio::fs::rename(&part_path, &model_path)
        .await
        .map_err(|e| format!("Failed to finalize download: {}", e))?;

    {
        let mut downloads = state.downloads.lock().map_err(|e| e.to_string())?;
        downloads.remove(&model_id);
    }

    let _ = app.emit(
        "download-complete",
        serde_json::json!({ "model_id": model_id, "path": model_path.to_string_lossy() }),
    );

    Ok(())
}

#[tauri::command]
pub async fn cancel_download(
    state: tauri::State<'_, LlamaState>,
    model_id: String,
) -> Result<(), String> {
    let downloads = state.downloads.lock().map_err(|e| e.to_string())?;
    if let Some(handle) = downloads.get(&model_id) {
        handle.cancel.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
pub async fn get_model_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, LlamaState>,
    model_id: String,
) -> Result<ModelStatus, String> {
    let model = available_models()
        .iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| format!("Unknown model: {}", model_id))?;

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app dir: {}", e))?;
    let model_path = app_dir.join("models").join(&model.filename);
    let downloaded = model_path.exists();

    let (downloading, progress) = {
        let downloads = state.downloads.lock().map_err(|e| e.to_string())?;
        if let Some(handle) = downloads.get(&model_id) {
            let p = *handle.progress.lock().map_err(|e| e.to_string())?;
            (true, p)
        } else {
            (false, 0.0)
        }
    };

    Ok(ModelStatus {
        downloaded,
        downloading,
        progress: if downloaded {
            100.0
        } else if downloading {
            progress
        } else {
            0.0
        },
        path: if downloaded {
            Some(model_path.to_string_lossy().to_string())
        } else {
            None
        },
    })
}

fn find_llama_server(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    if let Ok(dir) = app.path().resource_dir() {
        for candidate in [
            dir.join("llama-server"),
            dir.join("binaries").join("llama-server"),
            dir.join("llama").join("llama-server"),
        ] {
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let candidate = dir.join("llama-server");
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }
    None
}

#[tauri::command]
pub async fn start_llama_server(
    app: tauri::AppHandle,
    state: tauri::State<'_, LlamaState>,
    model_path: String,
    port: u16,
    ngl: u32,
) -> Result<String, String> {
    let mut proc = state.process.lock().map_err(|e| e.to_string())?;
    if proc.is_some() {
        return Err("Server already running".into());
    }

    if !std::path::Path::new(&model_path).exists() {
        return Err(format!("Model file not found: {}", model_path));
    }

    let binary = find_llama_server(&app)
        .ok_or_else(|| "llama-server binary not found (not bundled and not on PATH)".to_string())?;

    // The llama.cpp launcher loads libllama-server-impl.so from $ORIGIN.
    // Set LD_LIBRARY_PATH defensively so the libs are found whether they
    // land beside the launcher, in a llama/ subdir, or in binaries/.
    let lib_path = app
        .path()
        .resource_dir()
        .map(|d| {
            let d = d.to_string_lossy().to_string();
            format!("{}/binaries:{}/llama:{}", d, d, d)
        })
        .unwrap_or_default();

    let child = Command::new(binary)
        .args([
            "-m", &model_path,
            "--port", &port.to_string(),
            "--ngl", &ngl.to_string(),
            "-c", "4096",
            "--mlock",
        ])
        .env("LD_LIBRARY_PATH", lib_path)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start llama-server: {}", e))?;

    *proc = Some(child);
    let mut p = state.port.lock().map_err(|e| e.to_string())?;
    *p = Some(port);
    let mut lm = state.loaded_model.lock().map_err(|e| e.to_string())?;
    *lm = Some(model_path);

    Ok(format!("llama-server started on port {}", port))
}

#[tauri::command]
pub async fn stop_llama_server(
    state: tauri::State<'_, LlamaState>,
) -> Result<(), String> {
    let mut proc = state.process.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = proc.take() {
        child
            .kill()
            .map_err(|e| format!("Failed to kill llama-server: {}", e))?;
        child
            .wait()
            .map_err(|e| format!("Failed to wait on process: {}", e))?;
    }
    let mut p = state.port.lock().map_err(|e| e.to_string())?;
    *p = None;
    let mut lm = state.loaded_model.lock().map_err(|e| e.to_string())?;
    *lm = None;
    Ok(())
}

#[tauri::command]
pub async fn get_llama_status(
    state: tauri::State<'_, LlamaState>,
) -> Result<LlamaStatus, String> {
    let running = state
        .process
        .lock()
        .map_err(|e| e.to_string())?
        .is_some();
    let port = *state.port.lock().map_err(|e| e.to_string())?;
    let model = state
        .loaded_model
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    Ok(LlamaStatus { running, port, model })
}

#[tauri::command]
pub async fn chat_completion(
    state: tauri::State<'_, LlamaState>,
    request: ChatRequest,
) -> Result<ChatResponse, String> {
    let port = state
        .port
        .lock()
        .map_err(|e| e.to_string())?
        .ok_or("llama-server not running")?;

    let system_prompt = request
        .system_prompt
        .unwrap_or_else(|| "You are a helpful AI assistant.".into());

    let body = serde_json::json!({
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": request.prompt }
        ],
        "max_tokens": request.max_tokens.unwrap_or(2048),
        "temperature": request.temperature.unwrap_or(0.7),
        "stream": false,
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://127.0.0.1:{}/v1/chat/completions", port))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Chat request failed: {}", e))?;

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let text = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();

    Ok(ChatResponse { text })
}
