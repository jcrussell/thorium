//! The command line args for telling Thorctl which actions to take

use clap::Parser;
use std::path::PathBuf;
use thorium::models::NotificationLevel;
use uuid::Uuid;

use self::{
    ai::Ai,
    cart::Cart,
    clusters::{Clusters, Login},
    config::Config,
    files::Files,
    groups::Groups,
    images::Images,
    network_policies::NetworkPolicies,
    pipelines::Pipelines,
    reactions::Reactions,
    repos::Repos,
    results::Results,
    run::Run,
    tags::Tags,
    uncart::Uncart,
};
use crate::{args::toolbox::Toolbox, utils::repos::validate_repo_url};

pub mod ai;
pub mod cart;
pub mod clusters;
pub mod config;
pub mod files;
pub mod groups;
mod helpers;
pub mod images;
pub mod network_policies;
pub mod pipelines;
pub mod reactions;
pub mod repos;
pub mod results;
pub mod run;
pub mod tags;
pub mod toolbox;
mod traits;
pub mod uncart;

pub use traits::describe::DescribeCommand;
pub use traits::search::SearchParameterized;

/// Provide a default admin config path
fn default_admin_path() -> PathBuf {
    let mut default_admin_path = dirs::home_dir().unwrap_or_default();
    default_admin_path.push(".thorium");
    default_admin_path.push("thorium.yml");
    default_admin_path
}

/// Provide a default config path
fn default_config_path() -> PathBuf {
    let mut default_config_path = dirs::home_dir().unwrap_or_default();
    default_config_path.push(".thorium");
    default_config_path.push("config.yml");
    default_config_path
}

/// The command line args passed to Thorctl
#[derive(Parser, Debug)]
#[clap(version, author)]
pub struct Args {
    /// The path to load the core Thorium config file from for admin actions
    #[clap(long, default_value = default_admin_path().into_os_string())]
    pub admin: PathBuf,
    /// The path to authentication key files for regular actions
    #[clap(long, default_value = default_config_path().into_os_string())]
    pub config: PathBuf,
    /// The path to a keys file to used to authenticate with the Thorium API
    ///
    /// If provided, the keys file is used instead of the config file and
    /// configuration options must be provided using flags or environment variables
    #[clap(long, conflicts_with = "config")]
    pub keys: Option<PathBuf>,
    /// Don't check for updates from the API
    #[clap(long)]
    pub skip_update: bool,
    /// The command string to follow (files, images, pipelines, reactions, install, admins, agents, cart, uncart, update, config)
    #[clap(subcommand)]
    pub cmd: SubCommands,
    /// The number of parallel async actions to process at once
    #[clap(short, long, default_value_t = 10)]
    pub workers: usize,
    /// Disable progress tracking and only print errors to stderr
    #[clap(short, long)]
    pub quiet: bool,
}

/// The commands to send to handlers for Thorium
#[derive(Parser, Debug)]
pub enum SubCommands {
    /// Manage Thorium clusters
    #[clap(version, author, subcommand)]
    Clusters(Clusters),
    /// Login to Thorium interactively
    #[clap(version, author)]
    Login(Login),
    /// Perform group related tasks
    #[clap(version, author, subcommand)]
    Groups(Groups),
    /// Perform file related tasks
    #[clap(version, author, subcommand)]
    Files(Files),
    /// Perform image related tasks
    #[clap(version, author, subcommand)]
    Images(Images),
    /// Perform pipeline related tasks
    #[clap(version, author, subcommand)]
    Pipelines(Pipelines),
    /// Perform reaction related tasks
    #[clap(version, author, subcommand)]
    Reactions(Reactions),
    /// Perform result related tasks
    #[clap(version, author, subcommand)]
    Results(Results),
    /// Perform tag related tasks
    #[clap(version, author, subcommand)]
    Tags(Tags),
    /// Perform repository related tasks
    #[clap(version, author, subcommand)]
    Repos(Repos),
    /// Perform network policy related tasks
    #[clap(version, author, subcommand, visible_alias = "netpols")]
    NetworkPolicies(NetworkPolicies),
    /// Use AI to perform tasks in Thorium
    #[clap(version, author, subcommand)]
    AI(Ai),
    /// Cart files locally
    #[clap(version, author)]
    Cart(Cart),
    /// Uncart files locally
    #[clap(version, author)]
    Uncart(Uncart),
    /// Create and run a reaction, monitor its progress, and download its results
    #[clap(version, author)]
    Run(Run),
    /// Update Thorctl if necessary
    #[clap(version, author)]
    Update,
    /// Modify the Thorctl config file indicated by `--config`
    #[clap(version, author)]
    Config(Config),
    /// Perform toolbox related tasks
    #[clap(version, author, subcommand)]
    Toolbox(Toolbox),
}

/// The mode our command is in
#[derive(Debug)]
pub enum Mode {
    /// The command is being run on a file
    File,
    /// The command is being run on a repo
    Repo,
}

impl TryFrom<&String> for Mode {
    type Error = thorium::Error;

    fn try_from(sha256_or_repo: &String) -> Result<Self, Self::Error> {
        // check if the given SHA256/Repo is a valid SHA256
        if sha256_or_repo.len() == 64 && sha256_or_repo.chars().all(|c| c.is_ascii_hexdigit()) {
            // if we have a valid SHA256, assume File mode
            Ok(Mode::File)
        } else {
            match validate_repo_url(sha256_or_repo) {
                Ok(()) => Ok(Mode::Repo),
                Err(err) => Err(thorium::Error::new(format!(
                    "'{}' is neither a valid SHA256 nor a repo URL: {}",
                    sha256_or_repo,
                    err.msg().unwrap_or_default()
                ))),
            }
        }
    }
}

#[derive(clap::Args, Debug, Clone)]
#[group(required = false, multiple = true)]
pub struct GetNotificationOpts {
    /// Print the notifications ID's along with their contents
    #[clap(short, long)]
    pub ids: bool,
}

/// The params needed for creating a notification
#[derive(clap::Args, Debug, Clone)]
#[group(required = true, multiple = true)]
pub struct CreateNotification {
    /// The notification message
    #[clap(long)]
    pub msg: String,
    /// The notification's level of severity/importance
    #[clap(long)]
    pub level: NotificationLevel,
    /// An optional id of a ban this notification is associated with
    ///
    /// When the ban is deleted, the notification is deleted as well
    #[clap(long)]
    pub ban_id: Option<Uuid>,
    /// Whether or not the notification should automatically expire
    ///
    /// Notifications not at the `Error` level will automatically expire by default
    #[clap(long)]
    pub expire: Option<bool>,
}

#[cfg(test)]
mod tests {
    use super::*;

    // ==================== Mode TryFrom tests ====================

    #[test]
    fn mode_try_from_valid_sha256() {
        let sha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string();
        let mode = Mode::try_from(&sha256);
        assert!(mode.is_ok());
        assert!(matches!(mode.unwrap(), Mode::File));
    }

    #[test]
    fn mode_try_from_sha256_lowercase() {
        let sha256 = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789".to_string();
        let mode = Mode::try_from(&sha256);
        assert!(mode.is_ok());
        assert!(matches!(mode.unwrap(), Mode::File));
    }

    #[test]
    fn mode_try_from_sha256_uppercase() {
        let sha256 = "ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789".to_string();
        let mode = Mode::try_from(&sha256);
        assert!(mode.is_ok());
        assert!(matches!(mode.unwrap(), Mode::File));
    }

    #[test]
    fn mode_try_from_sha256_mixed_case() {
        let sha256 = "AbCdEf0123456789AbCdEf0123456789AbCdEf0123456789AbCdEf0123456789".to_string();
        let mode = Mode::try_from(&sha256);
        assert!(mode.is_ok());
        assert!(matches!(mode.unwrap(), Mode::File));
    }

    #[test]
    fn mode_try_from_sha256_too_short() {
        // 63 characters instead of 64
        let sha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85".to_string();
        let mode = Mode::try_from(&sha256);
        // Should fail since it's not 64 chars and not a valid repo URL
        assert!(mode.is_err());
    }

    #[test]
    fn mode_try_from_sha256_too_long() {
        // 65 characters instead of 64
        let sha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b8555".to_string();
        let mode = Mode::try_from(&sha256);
        // Should fail since it's not 64 chars and not a valid repo URL
        assert!(mode.is_err());
    }

    #[test]
    fn mode_try_from_sha256_with_invalid_chars() {
        // Has 'g' which is not valid hex
        let sha256 = "g3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string();
        let mode = Mode::try_from(&sha256);
        // Should fail since 'g' is not a hex digit
        assert!(mode.is_err());
    }

    #[test]
    fn mode_try_from_valid_github_repo() {
        // The Mode uses validate_repo_url which expects host/user/repo format (no protocol)
        let repo = "github.com/owner/repo".to_string();
        let mode = Mode::try_from(&repo);
        assert!(mode.is_ok());
        assert!(matches!(mode.unwrap(), Mode::Repo));
    }

    #[test]
    fn mode_try_from_valid_gitlab_repo() {
        let repo = "gitlab.com/owner/repo".to_string();
        let mode = Mode::try_from(&repo);
        assert!(mode.is_ok());
        assert!(matches!(mode.unwrap(), Mode::Repo));
    }

    #[test]
    fn mode_try_from_invalid_input() {
        let invalid = "not-a-sha256-or-repo".to_string();
        let mode = Mode::try_from(&invalid);
        assert!(mode.is_err());
        let err = mode.unwrap_err();
        assert!(err.msg().is_some());
    }

    #[test]
    fn mode_try_from_empty_string() {
        let empty = "".to_string();
        let mode = Mode::try_from(&empty);
        assert!(mode.is_err());
    }

    // ==================== default path tests ====================

    #[test]
    fn default_admin_path_ends_with_thorium_yml() {
        let path = default_admin_path();
        assert!(path.ends_with("thorium.yml"));
    }

    #[test]
    fn default_admin_path_contains_thorium_dir() {
        let path = default_admin_path();
        let path_str = path.to_string_lossy();
        assert!(path_str.contains(".thorium"));
    }

    #[test]
    fn default_config_path_ends_with_config_yml() {
        let path = default_config_path();
        assert!(path.ends_with("config.yml"));
    }

    #[test]
    fn default_config_path_contains_thorium_dir() {
        let path = default_config_path();
        let path_str = path.to_string_lossy();
        assert!(path_str.contains(".thorium"));
    }
}
