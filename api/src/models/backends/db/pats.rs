//! Database operations for Personal Access Tokens (PATs)

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use bb8_redis::redis::cmd;
use chrono::prelude::*;
use rand::prelude::*;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use tracing::{instrument, Level, event};
use uuid::Uuid;

use super::helpers;
use super::keys::PatKeys;
use crate::models::{
    PatCreateRequest, PatCreateResponse, PatListParams, PatUpdateRequest, PersonalAccessToken,
    TokenScope, PAT_PREFIX,
};
use crate::utils::{ApiError, Shared};
use crate::{bad, conn, deserialize, deserialize_ext, deserialize_opt, extract, internal_err, not_found, not_found_unwrapped, query, serialize, unauthorized};

/// Maximum length for PAT names.
const PAT_NAME_MAX_LEN: usize = 100;

/// Maximum length for PAT descriptions.
const PAT_DESCRIPTION_MAX_LEN: usize = 500;

/// Maximum number of PATs a single user can create.
const MAX_PATS_PER_USER: usize = 50;

/// Unit separator used as delimiter in token map values.
/// Guaranteed to not appear in UUIDs or usernames.
const TOKEN_MAP_DELIMITER: char = '\x1f';

/// Encode a token map entry: "argon2_hash\x1fpat_id\x1fowner"
fn encode_token_map(hash: &str, id: &str, owner: &str) -> String {
    format!(
        "{}{d}{}{d}{}",
        hash, id, owner,
        d = TOKEN_MAP_DELIMITER,
    )
}

/// Decode a token map entry into (argon2_hash, pat_id, owner).
fn decode_token_map(entry: &str) -> Result<(&str, &str, &str), ApiError> {
    let parts: Vec<&str> = entry.split(TOKEN_MAP_DELIMITER).collect();
    if parts.len() != 3 {
        event!(Level::ERROR, msg = "Malformed token map entry");
        return internal_err!("Internal authentication error".to_owned());
    }
    Ok((parts[0], parts[1], parts[2]))
}

/// Build an Argon2 hasher with the given secret key
fn build_argon2(secret_key: &str) -> Result<Argon2<'_>, ApiError> {
    helpers::build_argon2(secret_key)
}

/// Compute SHA-256 hex digest of a token for fast O(1) lookup
fn token_sha256(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

/// Generate a new PAT token value
///
/// Returns (full_token, argon2_hash, sha256_lookup, token_prefix)
fn generate_token(secret_key: &str) -> Result<(String, String, String, String), ApiError> {
    // Generate 32 random bytes
    let mut rng = rand::rng();
    let token_bytes: [u8; 32] = rng.random();
    let token_hex = hex::encode(token_bytes);

    // Create full token with prefix
    let full_token = format!("{}{}", PAT_PREFIX, token_hex);

    // Get prefix for identification (first 8 chars after thp_)
    let token_prefix = token_hex[..8].to_string();

    // Compute SHA-256 for fast O(1) lookup
    let lookup = token_sha256(&full_token);

    // Hash the token with Argon2 for secure storage
    let argon = build_argon2(secret_key)?;
    let salt = SaltString::generate(&mut OsRng);
    let token_hash = argon.hash_password(full_token.as_bytes(), &salt)?.to_string();

    Ok((full_token, token_hash, lookup, token_prefix))
}

/// Verify a token against its stored Argon2 hash
fn verify_token(token: &str, hash: &str, secret_key: &str) -> Result<bool, ApiError> {
    let parsed_hash = PasswordHash::new(hash)?;
    let argon = build_argon2(secret_key)?;
    Ok(argon.verify_password(token.as_bytes(), &parsed_hash).is_ok())
}

/// Cast a HashMap to a PersonalAccessToken
#[instrument(name = "db::pats::cast", skip_all, err(Debug))]
fn cast(mut raw: HashMap<String, String>) -> Result<PersonalAccessToken, ApiError> {
    if raw.is_empty() {
        return not_found!("PAT not found".to_owned());
    }

    // Parse scopes from JSON
    let scopes_str = extract!(raw, "scopes");
    let scopes: HashSet<TokenScope> = deserialize!(&scopes_str);

    // Parse optional groups
    let groups: Option<HashSet<String>> = deserialize_opt!(raw, "groups");

    Ok(PersonalAccessToken {
        id: Uuid::parse_str(&extract!(raw, "id"))?,
        name: extract!(raw, "name"),
        owner: extract!(raw, "owner"),
        scopes,
        groups,
        created_at: deserialize_ext!(raw, "created_at"),
        expires_at: deserialize_opt!(raw, "expires_at"),
        last_used_at: deserialize_opt!(raw, "last_used_at"),
        active: helpers::extract_bool_default(&mut raw, "active", true)?,
        description: helpers::extract_opt(&mut raw, "description"),
        token_hash: extract!(raw, "token_hash"),
        token_lookup: extract!(raw, "token_lookup"),
        token_prefix: extract!(raw, "token_prefix"),
    })
}

/// Create a new PAT
///
/// # Arguments
///
/// * `owner` - The username of the PAT owner
/// * `req` - The PAT creation request
/// * `shared` - Shared Thorium objects
#[instrument(name = "db::pats::create", skip(shared), err(Debug))]
pub async fn create(
    owner: &str,
    req: PatCreateRequest,
    shared: &Shared,
) -> Result<PatCreateResponse, ApiError> {
    // Validate request
    if req.name.is_empty() || req.name.len() > PAT_NAME_MAX_LEN {
        return bad!(format!("Token name must be between 1 and {PAT_NAME_MAX_LEN} characters"));
    }
    if req.scopes.is_empty() {
        return bad!("At least one scope must be specified".to_owned());
    }
    if let Some(desc) = &req.description {
        if desc.len() > PAT_DESCRIPTION_MAX_LEN {
            return bad!(format!(
                "Description must be at most {PAT_DESCRIPTION_MAX_LEN} characters"
            ));
        }
    }

    // Validate expiration is in the future (S3)
    if let Some(expires_at) = req.expires_at {
        if expires_at <= Utc::now() {
            return bad!("Expiration time must be in the future".to_owned());
        }
    }

    // Enforce per-user PAT count limit
    let user_pats_key = PatKeys::user_pats(owner, shared);
    let pat_count: i64 = query!(cmd("scard").arg(&user_pats_key), shared).await?;
    if pat_count >= MAX_PATS_PER_USER as i64 {
        return bad!(format!(
            "Maximum number of PATs ({MAX_PATS_PER_USER}) reached"
        ));
    }

    // Generate token and hash
    let secret_key = &shared.config.thorium.secret_key;
    let (full_token, token_hash, token_lookup, token_prefix) = generate_token(secret_key)?;

    // Create PAT struct
    let id = Uuid::new_v4();
    let now = Utc::now();

    let pat = PersonalAccessToken {
        id,
        name: req.name,
        owner: owner.to_string(),
        scopes: req.scopes,
        groups: req.groups,
        created_at: now,
        expires_at: req.expires_at,
        last_used_at: None,
        active: true,
        description: req.description,
        token_hash: token_hash.clone(),
        token_lookup: token_lookup.clone(),
        token_prefix: token_prefix.clone(),
    };

    // Build Redis keys
    let id_str = id.to_string();
    let keys = PatKeys::new(owner, &id_str, shared);
    let pat_owners_key = PatKeys::pat_owners(shared);

    // Build token map value with unit separator delimiter (S6)
    let token_map_value = encode_token_map(&token_hash, &id_str, owner);

    // Store in Redis
    let mut pipe = redis::pipe();
    pipe.atomic()
        // Add to user's PAT set
        .cmd("sadd").arg(&keys.user_pats).arg(&id_str)
        // Store PAT data
        .cmd("hset").arg(&keys.data)
            .arg("id").arg(&id_str)
            .arg("name").arg(&pat.name)
            .arg("owner").arg(&pat.owner)
            .arg("scopes").arg(serialize!(&pat.scopes))
            .arg("created_at").arg(serialize!(&pat.created_at))
            .arg("active").arg(pat.active)
            .arg("token_hash").arg(&token_hash)
            .arg("token_lookup").arg(&token_lookup)
            .arg("token_prefix").arg(&token_prefix)
        // Add to token map keyed by SHA-256 for O(1) lookup (S1)
        .cmd("hset").arg(&keys.tokens).arg(&token_lookup).arg(&token_map_value)
        // Add to global PAT ID -> owner mapping (S2)
        .cmd("hset").arg(&pat_owners_key).arg(&id_str).arg(owner);

    // Add optional fields
    if let Some(groups) = &pat.groups {
        pipe.cmd("hset").arg(&keys.data).arg("groups").arg(serialize!(groups));
    }
    if let Some(expires_at) = &pat.expires_at {
        pipe.cmd("hset").arg(&keys.data).arg("expires_at").arg(serialize!(expires_at));
    }
    if let Some(description) = &pat.description {
        pipe.cmd("hset").arg(&keys.data).arg("description").arg(description);
    }

    let _: () = pipe.query_async(conn!(shared)).await?;

    Ok(PatCreateResponse {
        token: full_token,
        pat,
    })
}

/// Get a PAT by ID
///
/// # Arguments
///
/// * `owner` - The username of the PAT owner
/// * `pat_id` - The UUID of the PAT
/// * `shared` - Shared Thorium objects
#[instrument(name = "db::pats::get", skip(shared), err(Debug))]
pub async fn get(owner: &str, pat_id: &Uuid, shared: &Shared) -> Result<PersonalAccessToken, ApiError> {
    let data_key = PatKeys::data(owner, &pat_id.to_string(), shared);
    let raw: HashMap<String, String> = query!(cmd("hgetall").arg(&data_key), shared).await?;
    cast(raw)
}

/// Get a PAT by ID without requiring the owner (for admin access)
///
/// Looks up the owner from the global PAT ID -> owner mapping, then fetches
/// the PAT data.
///
/// # Arguments
///
/// * `pat_id` - The UUID of the PAT
/// * `shared` - Shared Thorium objects
#[instrument(name = "db::pats::get_any", skip(shared), err(Debug))]
pub async fn get_any(pat_id: &Uuid, shared: &Shared) -> Result<PersonalAccessToken, ApiError> {
    let id_str = pat_id.to_string();
    let pat_owners_key = PatKeys::pat_owners(shared);

    // Look up the owner from the global mapping
    let owner: Option<String> = query!(cmd("hget").arg(&pat_owners_key).arg(&id_str), shared).await?;
    let owner = owner.ok_or_else(|| {
        not_found_unwrapped!("PAT not found".to_owned())
    })?;

    get(&owner, pat_id, shared).await
}

/// List all PATs for a user
///
/// # Arguments
///
/// * `owner` - The username of the PAT owner
/// * `params` - List filtering parameters
/// * `shared` - Shared Thorium objects
#[instrument(name = "db::pats::list", skip(shared), err(Debug))]
pub async fn list(
    owner: &str,
    params: &PatListParams,
    shared: &Shared,
) -> Result<Vec<PersonalAccessToken>, ApiError> {
    // Get all PAT IDs for this user
    let user_pats_key = PatKeys::user_pats(owner, shared);
    let pat_ids: Vec<String> = query!(cmd("smembers").arg(&user_pats_key), shared).await?;

    if pat_ids.is_empty() {
        return Ok(vec![]);
    }

    // Build pipeline to fetch all PAT data
    let mut pipe = redis::pipe();
    for pat_id in &pat_ids {
        pipe.cmd("hgetall").arg(PatKeys::data(owner, pat_id, shared));
    }

    let results: Vec<HashMap<String, String>> = pipe.query_async(conn!(shared)).await?;

    // Cast and filter results
    let mut pats: Vec<PersonalAccessToken> = results
        .into_iter()
        .filter_map(|raw| {
            cast(raw).ok().and_then(|pat| {
                // Apply active filter if specified
                if let Some(active_filter) = params.active {
                    if pat.active != active_filter {
                        return None;
                    }
                }
                Some(pat)
            })
        })
        .collect();

    // Sort by created_at descending (newest first)
    pats.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(pats)
}

/// Update a PAT
///
/// # Arguments
///
/// * `owner` - The username of the PAT owner
/// * `pat_id` - The UUID of the PAT
/// * `update` - The update request
/// * `shared` - Shared Thorium objects
#[instrument(name = "db::pats::update", skip(shared), err(Debug))]
pub async fn update(
    owner: &str,
    pat_id: &Uuid,
    update: PatUpdateRequest,
    shared: &Shared,
) -> Result<PersonalAccessToken, ApiError> {
    let id_str = pat_id.to_string();
    let data_key = PatKeys::data(owner, &id_str, shared);

    // First get the existing PAT to ensure it exists
    let mut pat = get(owner, pat_id, shared).await?;

    // Build update pipeline
    let mut pipe = redis::pipe();
    pipe.atomic();

    // Apply updates
    if let Some(name) = update.name {
        if name.is_empty() || name.len() > PAT_NAME_MAX_LEN {
            return bad!(format!("Token name must be between 1 and {PAT_NAME_MAX_LEN} characters"));
        }
        pat.name = name.clone();
        pipe.cmd("hset").arg(&data_key).arg("name").arg(&name);
    }

    if let Some(scopes) = update.scopes {
        if scopes.is_empty() {
            return bad!("At least one scope must be specified".to_owned());
        }
        pat.scopes = scopes.clone();
        pipe.cmd("hset").arg(&data_key).arg("scopes").arg(serialize!(&scopes));
    }

    if update.clear_groups {
        pat.groups = None;
        pipe.cmd("hdel").arg(&data_key).arg("groups");
    } else if let Some(groups) = update.groups {
        pat.groups = Some(groups.clone());
        pipe.cmd("hset").arg(&data_key).arg("groups").arg(serialize!(&groups));
    }

    if update.clear_description {
        pat.description = None;
        pipe.cmd("hdel").arg(&data_key).arg("description");
    } else if let Some(description) = update.description {
        if description.len() > PAT_DESCRIPTION_MAX_LEN {
            return bad!(format!(
                "Description must be at most {PAT_DESCRIPTION_MAX_LEN} characters"
            ));
        }
        pat.description = Some(description.clone());
        pipe.cmd("hset").arg(&data_key).arg("description").arg(&description);
    }

    if let Some(active) = update.active {
        pat.active = active;
        pipe.cmd("hset").arg(&data_key).arg("active").arg(active);
    }

    let _: () = pipe.query_async(conn!(shared)).await?;

    Ok(pat)
}

/// Delete a PAT
///
/// # Arguments
///
/// * `owner` - The username of the PAT owner
/// * `pat_id` - The UUID of the PAT
/// * `shared` - Shared Thorium objects
#[instrument(name = "db::pats::delete", skip(shared), err(Debug))]
pub async fn delete(owner: &str, pat_id: &Uuid, shared: &Shared) -> Result<(), ApiError> {
    let id_str = pat_id.to_string();
    let keys = PatKeys::new(owner, &id_str, shared);
    let pat_owners_key = PatKeys::pat_owners(shared);

    // Get the PAT to retrieve its token lookup key
    let pat = get(owner, pat_id, shared).await?;

    // Delete from Redis
    let mut pipe = redis::pipe();
    pipe.atomic()
        // Remove from user's PAT set
        .cmd("srem").arg(&keys.user_pats).arg(&id_str)
        // Delete PAT data
        .cmd("del").arg(&keys.data)
        // Remove from token map using SHA-256 lookup key
        .cmd("hdel").arg(&keys.tokens).arg(&pat.token_lookup)
        // Remove from global PAT ID -> owner mapping
        .cmd("hdel").arg(&pat_owners_key).arg(&id_str);

    let _: () = pipe.query_async(conn!(shared)).await?;

    Ok(())
}

/// Authenticate with a PAT token
///
/// Uses SHA-256 for O(1) lookup, then verifies with Argon2 for security.
///
/// # Arguments
///
/// * `token` - The full token string (including prefix)
/// * `shared` - Shared Thorium objects
#[instrument(name = "db::pats::authenticate", skip_all, err(Debug))]
pub async fn authenticate(token: &str, shared: &Shared) -> Result<PersonalAccessToken, ApiError> {
    // Verify token has correct prefix
    if !token.starts_with(PAT_PREFIX) {
        event!(Level::WARN, msg = "Token does not have PAT prefix");
        return unauthorized!();
    }

    // Compute SHA-256 for O(1) lookup
    let lookup = token_sha256(token);
    let tokens_key = PatKeys::tokens(shared);

    // Look up the token map entry by SHA-256 hash
    let entry: Option<String> = query!(cmd("hget").arg(&tokens_key).arg(&lookup), shared).await?;

    let entry = match entry {
        Some(e) => e,
        None => {
            event!(Level::WARN, msg = "No matching PAT found for token");
            return unauthorized!();
        }
    };

    // Parse the entry: "argon2_hash\x1fpat_id\x1fowner"
    let (argon2_hash, pat_id_str, owner) = decode_token_map(&entry)?;

    // Verify the token against the stored Argon2 hash
    let secret_key = &shared.config.thorium.secret_key;
    if !verify_token(token, argon2_hash, secret_key)? {
        event!(Level::WARN, msg = "Token SHA-256 matched but Argon2 verification failed");
        return unauthorized!();
    }

    // Get the full PAT data
    let uuid = Uuid::parse_str(pat_id_str)?;
    let pat = get(owner, &uuid, shared).await?;

    // Check if PAT is active
    if !pat.active {
        event!(Level::WARN, msg = "PAT is inactive", pat_id = ?pat.id);
        return unauthorized!("Token is inactive".to_owned());
    }

    // Check if PAT is expired
    if let Some(expires_at) = pat.expires_at {
        if expires_at < Utc::now() {
            event!(Level::WARN, msg = "PAT is expired", pat_id = ?pat.id);
            return unauthorized!("Token is expired".to_owned());
        }
    }

    Ok(pat)
}

/// Update the last_used_at timestamp for a PAT
///
/// This is called asynchronously after successful authentication
///
/// # Arguments
///
/// * `owner` - The username of the PAT owner
/// * `pat_id` - The UUID of the PAT
/// * `shared` - Shared Thorium objects
#[instrument(name = "db::pats::update_last_used", skip(shared), err(Debug))]
pub async fn update_last_used(owner: &str, pat_id: &Uuid, shared: &Shared) -> Result<(), ApiError> {
    let data_key = PatKeys::data(owner, &pat_id.to_string(), shared);
    let now = Utc::now();

    let _: () = cmd("hset")
        .arg(&data_key)
        .arg("last_used_at")
        .arg(serialize!(&now))
        .query_async(conn!(shared))
        .await?;

    Ok(())
}

/// Delete all PATs for a user
///
/// Used when deleting a user account
///
/// # Arguments
///
/// * `owner` - The username of the PAT owner
/// * `shared` - Shared Thorium objects
#[instrument(name = "db::pats::delete_all", skip(shared), err(Debug))]
pub async fn delete_all(owner: &str, shared: &Shared) -> Result<(), ApiError> {
    // Get all PAT IDs for this user
    let user_pats_key = PatKeys::user_pats(owner, shared);
    let pat_ids: Vec<String> = query!(cmd("smembers").arg(&user_pats_key), shared).await?;

    if pat_ids.is_empty() {
        return Ok(());
    }

    let tokens_key = PatKeys::tokens(shared);
    let pat_owners_key = PatKeys::pat_owners(shared);

    // Batch-fetch all token lookups in a single pipeline round trip
    let mut lookup_pipe = redis::pipe();
    let data_keys: Vec<String> = pat_ids
        .iter()
        .map(|pat_id| PatKeys::data(owner, pat_id, shared))
        .collect();
    for data_key in &data_keys {
        lookup_pipe.cmd("hget").arg(data_key).arg("token_lookup");
    }
    let lookups: Vec<Option<String>> = lookup_pipe.query_async(conn!(shared)).await?;

    // Build atomic pipeline to delete all PATs
    let mut pipe = redis::pipe();
    pipe.atomic();

    for (i, pat_id) in pat_ids.iter().enumerate() {
        // Delete PAT data
        pipe.cmd("del").arg(&data_keys[i]);

        // Remove from token map if lookup key exists
        if let Some(lookup) = &lookups[i] {
            pipe.cmd("hdel").arg(&tokens_key).arg(lookup);
        }

        // Remove from global PAT ID -> owner mapping
        pipe.cmd("hdel").arg(&pat_owners_key).arg(pat_id);
    }

    // Delete the user's PAT set
    pipe.cmd("del").arg(&user_pats_key);

    let _: () = pipe.query_async(conn!(shared)).await?;

    Ok(())
}
