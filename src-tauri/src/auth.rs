use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

#[tauri::command]
pub fn hash_password(password: String) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Failed to hash password: {e}"))?
        .to_string();
    Ok(hash)
}

#[tauri::command]
pub fn verify_password(password: String, hash: String) -> Result<bool, String> {
    let parsed_hash = match PasswordHash::new(&hash) {
        Ok(h) => h,
        Err(e) => return Err(format!("Invalid password hash format: {e}")),
    };
    let argon2 = Argon2::default();
    Ok(argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok())
}
