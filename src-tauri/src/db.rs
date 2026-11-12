use chrono::Utc;
use rusqlite::{
    types::{Value, ValueRef},
    Connection,
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value as JsonValue};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::State;
use uuid::Uuid;

pub struct DbState {
    pub conn: Mutex<Connection>,
    pub db_path: PathBuf,
    pub data_dir: PathBuf,
    pub backups_dir: PathBuf,
    pub import_dir: PathBuf,
    pub device_id: String,
}

#[derive(Deserialize)]
pub struct BatchStatement {
    pub sql: String,
    pub params: Vec<JsonValue>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbInfo {
    pub db_path: String,
    pub data_dir: String,
    pub backups_dir: String,
    pub import_dir: String,
    pub journal_mode: String,
    pub device_id: String,
    pub applied_migrations: Vec<i64>,
}

struct Migration {
    version: i64,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    sql: include_str!("../migrations/0001_init.sql"),
}];

fn resolve_portable_root() -> Result<PathBuf, String> {
    let exe_path = std::env::current_exe().map_err(|e| format!("Failed to locate exe: {e}"))?;
    let exe_dir = exe_path
        .parent()
        .ok_or_else(|| "Failed to get exe parent directory".to_string())?;

    // During `tauri dev`, the binary lives in `src-tauri/target/debug/`.
    // Use a dedicated `.dev-portable` folder in the project root so dev runs stay clean,
    // while release builds use the exact folder containing Rauhaah.exe.
    let exe_dir_str = exe_dir.to_string_lossy();
    if cfg!(debug_assertions) && (exe_dir_str.ends_with("target\\debug") || exe_dir_str.ends_with("target/debug")) {
        if let Some(src_tauri) = exe_dir.parent().and_then(|p| p.parent()) {
            return Ok(src_tauri.join(".dev-portable"));
        }
    }

    Ok(exe_dir.to_path_buf())
}

fn load_or_create_device_id(data_dir: &Path) -> Result<String, String> {
    let id_file = data_dir.join(".device_id");
    if id_file.exists() {
        let content = fs::read_to_string(&id_file)
            .map_err(|e| format!("Failed to read device_id: {e}"))?;
        let trimmed = content.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }
    let new_id = Uuid::now_v7().to_string();
    fs::write(&id_file, &new_id).map_err(|e| format!("Failed to write device_id: {e}"))?;
    Ok(new_id)
}

fn json_to_sql_value(v: &JsonValue) -> Result<Value, String> {
    match v {
        JsonValue::Null => Ok(Value::Null),
        JsonValue::Bool(b) => Ok(Value::Integer(if *b { 1 } else { 0 })),
        JsonValue::Number(n) => {
            if let Some(i) = n.as_i64() {
                Ok(Value::Integer(i))
            } else if let Some(f) = n.as_f64() {
                Ok(Value::Real(f))
            } else {
                Err(format!("Unsupported numeric value: {n}"))
            }
        }
        JsonValue::String(s) => Ok(Value::Text(s.clone())),
        _ => Err(format!("Unsupported SQL parameter type: {v}")),
    }
}

fn sql_ref_to_json(val: ValueRef<'_>) -> JsonValue {
    match val {
        ValueRef::Null => JsonValue::Null,
        ValueRef::Integer(i) => JsonValue::from(i),
        ValueRef::Real(f) => JsonValue::from(f),
        ValueRef::Text(t) => JsonValue::from(String::from_utf8_lossy(t).to_string()),
        ValueRef::Blob(b) => JsonValue::from(b.to_vec()),
    }
}

pub fn init_db() -> Result<DbState, String> {
    let root = resolve_portable_root()?;
    let data_dir = root.join("data");
    let backups_dir = root.join("backups");
    let import_dir = root.join("Import");

    fs::create_dir_all(&data_dir).map_err(|e| format!("Failed to create data dir: {e}"))?;
    fs::create_dir_all(&backups_dir).map_err(|e| format!("Failed to create backups dir: {e}"))?;
    fs::create_dir_all(import_dir.join("Processed"))
        .map_err(|e| format!("Failed to create Import/Processed dir: {e}"))?;
    fs::create_dir_all(import_dir.join("Failed"))
        .map_err(|e| format!("Failed to create Import/Failed dir: {e}"))?;

    let device_id = load_or_create_device_id(&data_dir)?;
    let db_path = data_dir.join("rauhaah.db");

    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open SQLite: {e}"))?;
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;
        ",
    )
    .map_err(|e| format!("Failed to configure SQLite PRAGMAs: {e}"))?;

    run_migrations(&conn)?;
    seed_default_branch(&conn, &device_id)?;

    Ok(DbState {
        conn: Mutex::new(conn),
        db_path,
        data_dir,
        backups_dir,
        import_dir,
        device_id,
    })
}

fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY NOT NULL,
            applied_at TEXT NOT NULL
        );",
    )
    .map_err(|e| format!("Failed to create schema_migrations: {e}"))?;

    for m in MIGRATIONS {
        let already_applied: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1",
                [m.version],
                |row| row.get(0),
            )
            .map_err(|e| format!("Migration check failed: {e}"))?;

        if already_applied == 0 {
            let tx = conn
                .unchecked_transaction()
                .map_err(|e| format!("Failed to begin migration tx: {e}"))?;
            tx.execute_batch(m.sql)
                .map_err(|e| format!("Migration {} failed: {e}", m.version))?;
            let now = Utc::now().to_rfc3339();
            tx.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
                rusqlite::params![m.version, now],
            )
            .map_err(|e| format!("Failed to record migration {}: {e}", m.version))?;
            tx.commit()
                .map_err(|e| format!("Failed to commit migration {}: {e}", m.version))?;
        }
    }

    Ok(())
}

fn seed_default_branch(conn: &Connection, device_id: &str) -> Result<(), String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM branches WHERE deleted_at IS NULL",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check branches: {e}"))?;

    if count == 0 {
        let now = Utc::now().to_rfc3339();
        let branch_id = Uuid::now_v7().to_string();
        let log_id = Uuid::now_v7().to_string();
        let tx = conn
            .unchecked_transaction()
            .map_err(|e| format!("Failed to begin branch seed tx: {e}"))?;
        tx.execute(
            "INSERT INTO branches (id, name, code, is_default, created_at, updated_at, device_id)
             VALUES (?1, 'Main', 'MAIN', 1, ?2, ?2, ?3)",
            rusqlite::params![branch_id, now, device_id],
        )
        .map_err(|e| format!("Failed to seed default branch: {e}"))?;
        tx.execute(
            "INSERT INTO change_log (id, table_name, row_id, operation, changed_at, synced)
             VALUES (?1, 'branches', ?2, 'insert', ?3, 0)",
            rusqlite::params![log_id, branch_id, now],
        )
        .map_err(|e| format!("Failed to log default branch: {e}"))?;
        tx.commit()
            .map_err(|e| format!("Failed to commit default branch: {e}"))?;
    }

    Ok(())
}

#[tauri::command]
pub fn db_query(
    state: State<'_, DbState>,
    sql: String,
    params: Vec<JsonValue>,
) -> Result<Vec<JsonValue>, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    let sql_params: Vec<Value> = params
        .iter()
        .map(json_to_sql_value)
        .collect::<Result<Vec<_>, _>>()?;

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("SQL prepare error: {e}"))?;
    let col_names: Vec<String> = stmt
        .column_names()
        .iter()
        .map(|s| s.to_string())
        .collect();

    let rows = stmt
        .query_map(rusqlite::params_from_iter(sql_params.iter()), |row| {
            let mut map = Map::new();
            for (idx, col) in col_names.iter().enumerate() {
                let val_ref = row.get_ref(idx)?;
                map.insert(col.clone(), sql_ref_to_json(val_ref));
            }
            Ok(JsonValue::Object(map))
        })
        .map_err(|e| format!("SQL query error: {e}"))?;

    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| format!("Row read error: {e}"))?);
    }
    Ok(result)
}

#[tauri::command]
pub fn db_execute(
    state: State<'_, DbState>,
    sql: String,
    params: Vec<JsonValue>,
) -> Result<usize, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;
    let sql_params: Vec<Value> = params
        .iter()
        .map(json_to_sql_value)
        .collect::<Result<Vec<_>, _>>()?;

    conn.execute(&sql, rusqlite::params_from_iter(sql_params.iter()))
        .map_err(|e| format!("SQL execute error: {e}"))
}

#[tauri::command]
pub fn db_batch_tx(state: State<'_, DbState>, statements: Vec<BatchStatement>) -> Result<(), String> {
    let mut conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;

    let tx = conn
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|e| format!("Failed to start BEGIN IMMEDIATE transaction: {e}"))?;

    for item in statements {
        let sql_params: Vec<Value> = item
            .params
            .iter()
            .map(json_to_sql_value)
            .collect::<Result<Vec<_>, _>>()?;
        tx.execute(&item.sql, rusqlite::params_from_iter(sql_params.iter()))
            .map_err(|e| format!("Batch statement failed: {e}"))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn db_info(state: State<'_, DbState>) -> Result<DbInfo, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "Database lock poisoned".to_string())?;

    let journal_mode: String = conn
        .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
        .map_err(|e| format!("Failed to read journal_mode: {e}"))?;

    let mut stmt = conn
        .prepare("SELECT version FROM schema_migrations ORDER BY version ASC")
        .map_err(|e| format!("Failed to read migrations: {e}"))?;
    let versions = stmt
        .query_map([], |row| row.get::<_, i64>(0))
        .map_err(|e| format!("Failed to query migrations: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect migrations: {e}"))?;

    Ok(DbInfo {
        db_path: state.db_path.to_string_lossy().to_string(),
        data_dir: state.data_dir.to_string_lossy().to_string(),
        backups_dir: state.backups_dir.to_string_lossy().to_string(),
        import_dir: state.import_dir.to_string_lossy().to_string(),
        journal_mode,
        device_id: state.device_id.clone(),
        applied_migrations: versions,
    })
}
