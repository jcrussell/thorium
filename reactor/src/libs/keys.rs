//! Handles user keys operations

use thorium::Error;

use std::path::PathBuf;

/// Get the base path to store keys at
#[cfg(target_os = "linux")]
pub fn base_path() -> PathBuf {
    PathBuf::from("/opt/thorium-keys")
}

/// Get the base path to store keys at
#[cfg(target_os = "windows")]
pub fn base_path() -> PathBuf {
    PathBuf::from("C:\\thorium\\keys")
}

/// Build the path a users keys should be written too/at
///
/// # Arguments
///
/// * `username` - The user whose keys we want to write/get
pub fn path(username: &str) -> PathBuf {
    // start with the bas path for our keys
    let mut path = base_path();
    // append our username
    path.push(username);
    path.push("keys.yml");
    path
}

/// Check if a target users key file exists and if it is correct
///
/// # Arguments
///
/// `path` - The path to check against
/// `token` - The token to look for
pub async fn exists(path: &PathBuf, token: &str) -> Result<bool, Error> {
    // determine if this users keys exist on disk or not
    if path.exists() {
        // this users key exists so make sure its correct
        // read in this users current key file
        let data = tokio::fs::read_to_string(path).await?;
        // check this users token is in our key file
        if data.contains(token) {
            return Ok(true);
        } else {
            // a keys file exists but its wrong so delete it
            tokio::fs::remove_file(path).await?;
        }
    }
    // this file doesn't currently exist
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ==================== base_path tests ====================

    #[test]
    #[cfg(target_os = "linux")]
    fn base_path_linux() {
        let path = base_path();
        assert_eq!(path, PathBuf::from("/opt/thorium-keys"));
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn base_path_windows() {
        let path = base_path();
        assert_eq!(path, PathBuf::from("C:\\thorium\\keys"));
    }

    #[test]
    fn base_path_is_absolute() {
        let path = base_path();
        assert!(path.is_absolute());
    }

    // ==================== path() tests ====================

    #[test]
    fn path_includes_username() {
        let p = path("testuser");
        let path_str = p.to_string_lossy();
        assert!(path_str.contains("testuser"));
    }

    #[test]
    fn path_ends_with_keys_yml() {
        let p = path("anyuser");
        assert!(p.ends_with("keys.yml"));
    }

    #[test]
    fn path_contains_base_path() {
        let p = path("user");
        let base = base_path();
        assert!(p.starts_with(base));
    }

    #[test]
    fn path_different_users_different_paths() {
        let p1 = path("user1");
        let p2 = path("user2");
        assert_ne!(p1, p2);
    }

    #[test]
    fn path_empty_username() {
        // Should still work with empty username
        let p = path("");
        assert!(p.ends_with("keys.yml"));
    }

    #[test]
    fn path_special_chars_username() {
        // Usernames with special chars
        let p = path("user-with-dashes");
        let path_str = p.to_string_lossy();
        assert!(path_str.contains("user-with-dashes"));
    }
}
