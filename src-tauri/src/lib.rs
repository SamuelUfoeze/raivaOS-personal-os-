mod commands;
mod db;
mod models;

use db::Database;
use tauri::Manager;
use commands::llm::LlamaState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_dir = app.path().app_data_dir().unwrap_or_else(|_| {
                std::env::current_dir().unwrap().join("data")
            });
            let database = Database::new(app_dir).expect("Failed to initialize database");
            app.manage(database);
            app.manage(LlamaState::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Notes
            commands::get_all_notes,
            commands::get_note,
            commands::create_note,
            commands::update_note,
            commands::delete_note,
            commands::toggle_favorite,
            // Tags
            commands::get_tags_for_note,
            commands::get_all_tags,
            // Habits
            commands::get_all_habits,
            commands::create_habit,
            commands::update_habit,
            commands::delete_habit,
            commands::log_habit_tick,
            commands::get_habit_logs,
            commands::get_habit_logs_all,
            commands::get_habit_today_status,
            // Projects
            commands::get_all_projects,
            commands::create_project,
            commands::update_project,
            commands::delete_project,
            // Goals
            commands::get_all_goals,
            commands::create_goal,
            commands::update_goal,
            commands::delete_goal,
            // Tasks
            commands::get_all_tasks,
            commands::create_task,
            commands::update_task_status,
            commands::update_task,
            commands::delete_task,
            commands::get_tasks_by_quadrant,
            commands::get_all_tasks_with_sources,
            // Focus Sessions
            commands::log_focus_session,
            commands::get_focus_sessions,
            // Chat
            commands::get_chat_threads,
            commands::create_chat_thread,
            commands::get_chat_messages,
            commands::save_chat_message,
            commands::delete_chat_thread,
            // Visions
            commands::get_all_visions,
            commands::upsert_vision,
            commands::delete_vision,
            // Audit
            commands::get_latest_audit,
            commands::run_audit,
            // Batch
            commands::get_all,
            // LLM
            commands::get_available_models,
            commands::download_model,
            commands::cancel_download,
            commands::get_model_status,
            commands::start_llama_server,
            commands::stop_llama_server,
            commands::get_llama_status,
            commands::chat_completion,
        ])
        .run(tauri::generate_context!())
        .expect("error while running RAIVA OS");
}
