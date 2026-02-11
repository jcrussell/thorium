//! Key file for authenticating to Thorium

use std::path::{Path, PathBuf};

/// Auth keys for Thorium
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Keys {
    /// The ip to access the api at (must begin with http:// or https://)
    pub api: String,
    /// The username to use
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    /// The password to use
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    /// The token to use in place of basic auth
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
}

impl Keys {
    /// Create a new auth Keys object
    ///
    /// # Arguments
    ///
    /// * `path` - The path to use when reading in the Thorium auth keys
    pub fn new(path: &str) -> Result<Self, config::ConfigError> {
        Self::from_path(PathBuf::from(path))
    }

    /// Create a new auth Keys object from a path
    ///
    /// # Arguments
    ///
    /// * `path` - The path to use when reading in the Thorium auth keys
    pub fn from_path<P: AsRef<Path>>(path: P) -> Result<Self, config::ConfigError> {
        config::Config::builder()
            // load from a file first
            .add_source(config::File::from(path.as_ref()).format(config::FileFormat::Yaml))
            // then overlay any environment args ontop
            .add_source(config::Environment::with_prefix("THORIUM_KEYS").separator("__"))
            .build()?
            .try_deserialize()
    }

    /// Create a new auth keys object from an API URL and a token
    ///
    /// # Arguments
    ///
    /// * `api` - The url of the Thorium api to talk too
    /// * `token` - The token to use to authenticate to Thorium
    pub fn new_token<A: Into<String>, T: Into<String>>(api: A, token: T) -> Self {
        Keys {
            api: api.into(),
            username: None,
            password: None,
            token: Some(token.into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_new_token_sets_fields_correctly() {
        let keys = Keys::new_token("https://api.example.com", "my-token");
        assert_eq!(keys.api, "https://api.example.com");
        assert_eq!(keys.token, Some("my-token".to_string()));
        assert!(keys.username.is_none());
        assert!(keys.password.is_none());
    }

    #[test]
    fn keys_new_token_accepts_string_types() {
        let api = String::from("https://api.example.com");
        let token = String::from("my-token");
        let keys = Keys::new_token(api, token);
        assert_eq!(keys.api, "https://api.example.com");
        assert_eq!(keys.token, Some("my-token".to_string()));
    }

    #[test]
    fn keys_serializes_to_yaml() {
        let keys = Keys::new_token("https://api.example.com", "my-token");
        let yaml = serde_yaml::to_string(&keys).unwrap();
        assert!(yaml.contains("api:"));
        assert!(yaml.contains("https://api.example.com"));
        assert!(yaml.contains("token:"));
        assert!(yaml.contains("my-token"));
        // username and password are skipped when None
        assert!(!yaml.contains("username:"));
        assert!(!yaml.contains("password:"));
    }

    #[test]
    fn keys_deserializes_from_yaml() {
        let yaml = r#"
api: https://api.example.com
token: my-token
"#;
        let keys: Keys = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(keys.api, "https://api.example.com");
        assert_eq!(keys.token, Some("my-token".to_string()));
        assert!(keys.username.is_none());
        assert!(keys.password.is_none());
    }

    #[test]
    fn keys_deserializes_with_basic_auth() {
        let yaml = r#"
api: https://api.example.com
username: user
password: pass
"#;
        let keys: Keys = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(keys.api, "https://api.example.com");
        assert_eq!(keys.username, Some("user".to_string()));
        assert_eq!(keys.password, Some("pass".to_string()));
        assert!(keys.token.is_none());
    }
}
