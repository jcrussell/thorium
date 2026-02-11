//! Personal Access Tokens (PATs) for fine-grained API access control

use chrono::prelude::*;
use schemars::JsonSchema;
use std::collections::HashSet;
use strum::EnumIter;
use uuid::Uuid;

/// Token scopes for fine-grained permission control
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash, JsonSchema, EnumIter)]
#[cfg_attr(feature = "api", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum TokenScope {
    // File scopes
    /// Read file metadata and download files
    ReadFiles,
    /// Upload files and modify file metadata
    WriteFiles,
    /// Delete file submissions
    DeleteFiles,

    // Repo scopes
    /// Read repository metadata and download repos
    ReadRepos,
    /// Create and modify repositories
    WriteRepos,
    /// Delete repositories
    DeleteRepos,

    // Tag scopes
    /// Read tags on files and repos
    ReadTags,
    /// Add tags to files and repos
    WriteTags,
    /// Remove tags from files and repos
    DeleteTags,

    // Image scopes
    /// View image definitions
    ReadImages,
    /// Create and modify images (requires Developer role)
    WriteImages,
    /// Delete images
    DeleteImages,

    // Pipeline scopes
    /// View pipeline definitions
    ReadPipelines,
    /// Create and modify pipelines (requires Developer role)
    WritePipelines,
    /// Delete pipelines
    DeletePipelines,

    // Reaction scopes
    /// View reactions and their status
    ReadReactions,
    /// Create reactions
    WriteReactions,
    /// Cancel and delete reactions
    DeleteReactions,

    // Job scopes
    /// View job status and logs
    ReadJobs,
    /// Modify job state (internal use)
    WriteJobs,

    // Result scopes
    /// Read analysis results
    ReadResults,
    /// Upload analysis results
    WriteResults,

    // Comment scopes
    /// Read comments on files
    ReadComments,
    /// Create comments on files
    WriteComments,
    /// Delete comments
    DeleteComments,

    // Entity scopes
    /// View entities
    ReadEntities,
    /// Create and modify entities
    WriteEntities,
    /// Delete entities
    DeleteEntities,

    // Group scopes
    /// View group information
    ReadGroups,

    // User scopes
    /// Read own user information
    ReadUser,
    /// Modify own user settings
    WriteUser,

    // Search scopes
    /// Search files and file results
    SearchFiles,
    /// Search repositories
    SearchRepos,
    /// Search analysis results
    SearchResults,

    // Admin scopes (require Admin role)
    /// Administer users (admin only)
    AdminUsers,
    /// Administer groups (admin only)
    AdminGroups,
    /// Administer system settings (admin only)
    AdminSystem,

    // Special full access scope
    /// Full API access - bypasses all scope checks
    FullAccess,
}

impl TokenScope {
    /// Check if this scope requires admin role
    pub fn requires_admin(&self) -> bool {
        matches!(
            self,
            TokenScope::AdminUsers
                | TokenScope::AdminGroups
                | TokenScope::AdminSystem
                | TokenScope::FullAccess
        )
    }

    /// Get a human-readable description of this scope
    pub fn description(&self) -> &'static str {
        match self {
            TokenScope::ReadFiles => "Read file metadata and download files",
            TokenScope::WriteFiles => "Upload files and modify file metadata",
            TokenScope::DeleteFiles => "Delete file submissions",
            TokenScope::ReadRepos => "Read repository metadata and download repos",
            TokenScope::WriteRepos => "Create and modify repositories",
            TokenScope::DeleteRepos => "Delete repositories",
            TokenScope::ReadTags => "Read tags on files and repos",
            TokenScope::WriteTags => "Add tags to files and repos",
            TokenScope::DeleteTags => "Remove tags from files and repos",
            TokenScope::ReadImages => "View image definitions",
            TokenScope::WriteImages => "Create and modify images (requires Developer role)",
            TokenScope::DeleteImages => "Delete images",
            TokenScope::ReadPipelines => "View pipeline definitions",
            TokenScope::WritePipelines => "Create and modify pipelines (requires Developer role)",
            TokenScope::DeletePipelines => "Delete pipelines",
            TokenScope::ReadReactions => "View reactions and their status",
            TokenScope::WriteReactions => "Create reactions",
            TokenScope::DeleteReactions => "Cancel and delete reactions",
            TokenScope::ReadJobs => "View job status and logs",
            TokenScope::WriteJobs => "Modify job state",
            TokenScope::ReadResults => "Read analysis results",
            TokenScope::WriteResults => "Upload analysis results",
            TokenScope::ReadComments => "Read comments on files",
            TokenScope::WriteComments => "Create comments on files",
            TokenScope::DeleteComments => "Delete comments",
            TokenScope::ReadEntities => "View entities",
            TokenScope::WriteEntities => "Create and modify entities",
            TokenScope::DeleteEntities => "Delete entities",
            TokenScope::ReadGroups => "View group information",
            TokenScope::ReadUser => "Read own user information",
            TokenScope::WriteUser => "Modify own user settings",
            TokenScope::SearchFiles => "Search files and file results",
            TokenScope::SearchRepos => "Search repositories",
            TokenScope::SearchResults => "Search analysis results",
            TokenScope::AdminUsers => "Administer users (admin only)",
            TokenScope::AdminGroups => "Administer groups (admin only)",
            TokenScope::AdminSystem => "Administer system settings (admin only)",
            TokenScope::FullAccess => "Full API access (dangerous)",
        }
    }

    /// Get all available scopes
    pub fn all() -> Vec<TokenScope> {
        use strum::IntoEnumIterator;
        TokenScope::iter().collect()
    }

    /// Get predefined scope bundles for common use cases
    pub fn bundle(name: &str) -> Option<HashSet<TokenScope>> {
        match name {
            "read_only" => Some(HashSet::from([
                TokenScope::ReadFiles,
                TokenScope::ReadRepos,
                TokenScope::ReadTags,
                TokenScope::ReadImages,
                TokenScope::ReadPipelines,
                TokenScope::ReadReactions,
                TokenScope::ReadJobs,
                TokenScope::ReadResults,
                TokenScope::ReadComments,
                TokenScope::ReadEntities,
                TokenScope::ReadGroups,
                TokenScope::ReadUser,
                TokenScope::SearchFiles,
                TokenScope::SearchRepos,
                TokenScope::SearchResults,
            ])),
            "analyst" => Some(HashSet::from([
                TokenScope::ReadFiles,
                TokenScope::WriteFiles,
                TokenScope::ReadRepos,
                TokenScope::WriteRepos,
                TokenScope::ReadTags,
                TokenScope::WriteTags,
                TokenScope::ReadImages,
                TokenScope::ReadPipelines,
                TokenScope::ReadReactions,
                TokenScope::WriteReactions,
                TokenScope::ReadJobs,
                TokenScope::ReadResults,
                TokenScope::ReadComments,
                TokenScope::WriteComments,
                TokenScope::ReadGroups,
                TokenScope::ReadUser,
                TokenScope::WriteUser,
                TokenScope::SearchFiles,
                TokenScope::SearchRepos,
                TokenScope::SearchResults,
            ])),
            "ci_automation" => Some(HashSet::from([
                TokenScope::ReadFiles,
                TokenScope::WriteFiles,
                TokenScope::ReadPipelines,
                TokenScope::ReadReactions,
                TokenScope::WriteReactions,
                TokenScope::ReadJobs,
                TokenScope::ReadResults,
            ])),
            "developer" => Some(HashSet::from([
                TokenScope::ReadImages,
                TokenScope::WriteImages,
                TokenScope::DeleteImages,
                TokenScope::ReadPipelines,
                TokenScope::WritePipelines,
                TokenScope::DeletePipelines,
                TokenScope::ReadReactions,
                TokenScope::WriteReactions,
                TokenScope::ReadJobs,
                TokenScope::ReadResults,
            ])),
            _ => None,
        }
    }

    /// Get all available bundle names
    pub fn bundle_names() -> Vec<&'static str> {
        vec!["read_only", "analyst", "ci_automation", "developer"]
    }
}

/// The prefix for Personal Access Tokens
pub const PAT_PREFIX: &str = "thp_";

/// A Personal Access Token for API access
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "api", derive(utoipa::ToSchema))]
pub struct PersonalAccessToken {
    /// Unique identifier for this token
    pub id: Uuid,
    /// Human-readable name for the token
    pub name: String,
    /// The username this token belongs to
    pub owner: String,
    /// The scopes granted to this token
    pub scopes: HashSet<TokenScope>,
    /// Optional group restrictions (None = all user groups)
    pub groups: Option<HashSet<String>>,
    /// When this token was created
    pub created_at: DateTime<Utc>,
    /// When this token expires (None = never)
    pub expires_at: Option<DateTime<Utc>>,
    /// When this token was last used
    pub last_used_at: Option<DateTime<Utc>>,
    /// Whether this token is currently active
    pub active: bool,
    /// Optional description/notes
    pub description: Option<String>,
    /// The hash of the token (for internal use, never exposed)
    #[serde(skip_serializing, default)]
    pub token_hash: String,
    /// SHA-256 of the raw token for fast O(1) lookup (for internal use, never exposed)
    #[serde(skip_serializing, default)]
    pub token_lookup: String,
    /// Prefix of the token for identification (first 8 chars after thp_)
    pub token_prefix: String,
}

/// Request to create a new PAT
#[derive(Serialize, Deserialize, Debug)]
#[cfg_attr(feature = "api", derive(utoipa::ToSchema))]
pub struct PatCreateRequest {
    /// Human-readable name for the token
    pub name: String,
    /// The scopes to grant
    pub scopes: HashSet<TokenScope>,
    /// Optional group restrictions
    pub groups: Option<HashSet<String>>,
    /// Optional expiration time
    pub expires_at: Option<DateTime<Utc>>,
    /// Optional description
    pub description: Option<String>,
}

impl PatCreateRequest {
    /// Create a new PAT create request
    ///
    /// # Arguments
    ///
    /// * `name` - Human-readable name for the token
    /// * `scopes` - The scopes to grant
    pub fn new<S: Into<String>>(name: S, scopes: HashSet<TokenScope>) -> Self {
        PatCreateRequest {
            name: name.into(),
            scopes,
            groups: None,
            expires_at: None,
            description: None,
        }
    }

    /// Set group restrictions for this token
    pub fn groups(mut self, groups: HashSet<String>) -> Self {
        self.groups = Some(groups);
        self
    }

    /// Set expiration time for this token
    pub fn expires_at(mut self, expires_at: DateTime<Utc>) -> Self {
        self.expires_at = Some(expires_at);
        self
    }

    /// Set description for this token
    pub fn description<S: Into<String>>(mut self, description: S) -> Self {
        self.description = Some(description.into());
        self
    }
}

/// Response after creating a PAT (only time full token is shown)
#[derive(Serialize, Deserialize, Debug)]
#[cfg_attr(feature = "api", derive(utoipa::ToSchema))]
pub struct PatCreateResponse {
    /// The full token value (only shown once!)
    pub token: String,
    /// The token metadata
    pub pat: PersonalAccessToken,
}

/// Update request for a PAT
#[derive(Serialize, Deserialize, Debug, Default)]
#[cfg_attr(feature = "api", derive(utoipa::ToSchema))]
pub struct PatUpdateRequest {
    /// Updated name
    pub name: Option<String>,
    /// Updated scopes
    pub scopes: Option<HashSet<TokenScope>>,
    /// Updated group restrictions
    pub groups: Option<HashSet<String>>,
    /// Clear group restrictions (allow all groups)
    #[serde(default)]
    pub clear_groups: bool,
    /// Updated description
    pub description: Option<String>,
    /// Clear description
    #[serde(default)]
    pub clear_description: bool,
    /// Set active status
    pub active: Option<bool>,
}

/// Information about a scope for the API
#[derive(Serialize, Deserialize, Debug)]
#[cfg_attr(feature = "api", derive(utoipa::ToSchema))]
pub struct ScopeInfo {
    /// The scope identifier
    pub scope: TokenScope,
    /// Human-readable description
    pub description: String,
    /// Whether this scope requires admin role
    pub requires_admin: bool,
}

impl From<TokenScope> for ScopeInfo {
    fn from(scope: TokenScope) -> Self {
        ScopeInfo {
            description: scope.description().to_string(),
            requires_admin: scope.requires_admin(),
            scope,
        }
    }
}

/// Information about a scope bundle
#[derive(Serialize, Deserialize, Debug)]
#[cfg_attr(feature = "api", derive(utoipa::ToSchema))]
pub struct ScopeBundleInfo {
    /// The bundle name
    pub name: String,
    /// The scopes included in this bundle
    pub scopes: HashSet<TokenScope>,
}

/// List parameters for PATs
#[derive(Serialize, Deserialize, Debug, Default)]
#[cfg_attr(feature = "api", derive(utoipa::ToSchema))]
pub struct PatListParams {
    /// Filter by active status
    pub active: Option<bool>,
}
