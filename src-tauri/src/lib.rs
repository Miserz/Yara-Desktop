mod chat;
mod chats;
mod logging;
mod providers;

use std::sync::Mutex;

use chat::commands::GenerationsState;
use chats::store::ChatsStore;
use logging::LogState;
use providers::store::Store;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let store = Store::load(app.handle())?;
            app.manage(Mutex::new(store));
            let chats = ChatsStore::open(app.handle())?;
            app.manage(Mutex::new(chats));
            app.manage(GenerationsState::default());
            app.manage(LogState::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            providers::commands::get_data,
            providers::commands::add_provider,
            providers::commands::update_provider,
            providers::commands::remove_provider,
            providers::commands::add_model,
            providers::commands::remove_model,
            providers::commands::set_active_model,
            providers::commands::set_model_enabled,
            providers::commands::set_enabled_models,
            providers::commands::fetch_remote_models,
            providers::commands::test_provider,
            chats::commands::create_chat,
            chats::commands::list_chats,
            chats::commands::delete_chat,
            chats::commands::rename_chat,
            chats::commands::load_messages,
            chats::commands::search_chats,
            chats::commands::clear_all_chats,
            chats::commands::edit_message,
            chats::commands::truncate_from,
            chat::commands::start_chat,
            chat::commands::stop_chat,
            chat::commands::get_active_generation,
            logging::get_logs,
            logging::clear_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
