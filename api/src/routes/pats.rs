//! Routes for Personal Access Token (PAT) management
//!
//! NOTE: These routes use the `User` extractor (not `AuthContext`), which only
//! accepts session-based authentication. PATs cannot be used to manage other PATs.
//! This is an intentional security invariant - if refactoring authentication,
//! ensure PAT management routes continue to reject PAT-based auth.

use axum::extract::{Json, Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, post};
use axum::Router;
use std::collections::HashSet;
use tracing::instrument;
use utoipa::OpenApi;
use uuid::Uuid;

use super::OpenApiSecurity;
use crate::models::backends::db;
use crate::models::{
    PatCreateRequest, PatCreateResponse, PatListParams, PatUpdateRequest,
    PersonalAccessToken, ScopeBundleInfo, ScopeInfo, TokenScope, User, UserRole,
};
use crate::utils::{ApiError, AppState};
use crate::{bad, unauthorized};

/// Validate scope and group restrictions for a PAT request.
///
/// Checks that non-admin users don't request admin scopes and that
/// group restrictions reference groups the user belongs to.
fn validate_pat_scopes_and_groups(
    user: &User,
    scopes: &HashSet<TokenScope>,
    groups: Option<&HashSet<String>>,
) -> Result<(), ApiError> {
    // Validate that user is not requesting admin scopes without admin role
    for scope in scopes {
        if scope.requires_admin() && user.role != UserRole::Admin {
            return bad!(format!(
                "Scope '{}' requires admin role",
                serde_json::to_string(scope).unwrap_or_default()
            ));
        }
    }

    // Validate group restrictions if specified
    if let Some(groups) = groups {
        for group in groups {
            if !user.groups.contains(group) && user.role != UserRole::Admin {
                return bad!(format!(
                    "Cannot restrict token to group '{}' - you are not a member",
                    group
                ));
            }
        }
    }

    Ok(())
}

/// Resolve a PAT by ID, handling admin fallback for cross-user access.
///
/// For non-admins, looks up the PAT under the user's own namespace.
/// For admins, falls back to `get_any` if not found under their namespace.
/// Returns an error if a non-admin tries to access another user's PAT.
async fn resolve_pat(
    user: &User,
    id: &Uuid,
    state: &AppState,
) -> Result<PersonalAccessToken, ApiError> {
    let pat = match db::pats::get(&user.username, id, &state.shared).await {
        Ok(pat) => pat,
        Err(e) if user.role == UserRole::Admin && e.code == StatusCode::NOT_FOUND => {
            db::pats::get_any(id, &state.shared).await?
        }
        Err(e) => return Err(e),
    };

    if pat.owner != user.username && user.role != UserRole::Admin {
        return unauthorized!();
    }

    Ok(pat)
}

/// Create a new Personal Access Token
///
/// Returns the full token value only once - it cannot be retrieved later.
///
/// # Arguments
///
/// * `user` - The authenticated user creating the token (session auth only)
/// * `state` - Shared Thorium objects
/// * `req` - The PAT creation request
#[utoipa::path(
    post,
    path = "/api/pats/",
    request_body = PatCreateRequest,
    responses(
        (status = 201, description = "PAT created successfully", body = PatCreateResponse),
        (status = 400, description = "Invalid request"),
        (status = 401, description = "Not authorized"),
    ),
    security(
        ("bearer" = []),
    )
)]
#[instrument(name = "routes::pats::create", skip_all, err(Debug))]
async fn create(
    user: User,
    State(state): State<AppState>,
    Json(req): Json<PatCreateRequest>,
) -> Result<(StatusCode, Json<PatCreateResponse>), ApiError> {
    validate_pat_scopes_and_groups(&user, &req.scopes, req.groups.as_ref())?;

    // Create the PAT
    let response = db::pats::create(&user.username, req, &state.shared).await?;

    Ok((StatusCode::CREATED, Json(response)))
}

/// List all PATs for the authenticated user
///
/// # Arguments
///
/// * `user` - The authenticated user (session auth only)
/// * `state` - Shared Thorium objects
#[utoipa::path(
    get,
    path = "/api/pats/",
    params(
        ("params" = PatListParams, Query, description = "Optional filters for listing PATs")
    ),
    responses(
        (status = 200, description = "List of PATs", body = Vec<PersonalAccessToken>),
        (status = 401, description = "Not authorized"),
    ),
    security(
        ("bearer" = []),
    )
)]
#[instrument(name = "routes::pats::list", skip_all, err(Debug))]
async fn list(
    user: User,
    Query(params): Query<PatListParams>,
    State(state): State<AppState>,
) -> Result<Json<Vec<PersonalAccessToken>>, ApiError> {
    let pats = db::pats::list(&user.username, &params, &state.shared).await?;
    Ok(Json(pats))
}

/// Get a specific PAT by ID
///
/// Admins can access PATs owned by other users.
///
/// # Arguments
///
/// * `user` - The authenticated user (session auth only)
/// * `id` - The UUID of the PAT
/// * `state` - Shared Thorium objects
#[utoipa::path(
    get,
    path = "/api/pats/{id}",
    params(
        ("id" = Uuid, Path, description = "The PAT UUID"),
    ),
    responses(
        (status = 200, description = "PAT details", body = PersonalAccessToken),
        (status = 404, description = "PAT not found"),
        (status = 401, description = "Not authorized"),
    ),
    security(
        ("bearer" = []),
    )
)]
#[instrument(name = "routes::pats::get", skip_all, err(Debug))]
async fn get_pat(
    user: User,
    Path(id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<PersonalAccessToken>, ApiError> {
    let pat = resolve_pat(&user, &id, &state).await?;
    Ok(Json(pat))
}

/// Update a PAT
///
/// Admins can update PATs owned by other users.
///
/// # Arguments
///
/// * `user` - The authenticated user (session auth only)
/// * `id` - The UUID of the PAT
/// * `state` - Shared Thorium objects
/// * `update` - The update request
#[utoipa::path(
    patch,
    path = "/api/pats/{id}",
    params(
        ("id" = Uuid, Path, description = "The PAT UUID"),
    ),
    request_body = PatUpdateRequest,
    responses(
        (status = 200, description = "PAT updated", body = PersonalAccessToken),
        (status = 404, description = "PAT not found"),
        (status = 400, description = "Invalid request"),
        (status = 401, description = "Not authorized"),
    ),
    security(
        ("bearer" = []),
    )
)]
#[instrument(name = "routes::pats::update", skip_all, err(Debug))]
async fn update(
    user: User,
    Path(id): Path<Uuid>,
    State(state): State<AppState>,
    Json(update_req): Json<PatUpdateRequest>,
) -> Result<Json<PersonalAccessToken>, ApiError> {
    // Resolve first to verify ownership before making changes
    let existing = resolve_pat(&user, &id, &state).await?;

    // Validate scopes/groups if they're being updated
    if let Some(scopes) = &update_req.scopes {
        validate_pat_scopes_and_groups(&user, scopes, update_req.groups.as_ref())?;
    } else if let Some(groups) = &update_req.groups {
        // Groups are being updated without scopes - still validate groups
        validate_pat_scopes_and_groups(&user, &HashSet::new(), Some(groups))?;
    }

    let pat = db::pats::update(&existing.owner, &id, update_req, &state.shared).await?;

    Ok(Json(pat))
}

/// Revoke (delete) a PAT
///
/// Admins can delete PATs owned by other users.
///
/// # Arguments
///
/// * `user` - The authenticated user (session auth only)
/// * `id` - The UUID of the PAT
/// * `state` - Shared Thorium objects
#[utoipa::path(
    delete,
    path = "/api/pats/{id}",
    params(
        ("id" = Uuid, Path, description = "The PAT UUID"),
    ),
    responses(
        (status = 204, description = "PAT revoked"),
        (status = 404, description = "PAT not found"),
        (status = 401, description = "Not authorized"),
    ),
    security(
        ("bearer" = []),
    )
)]
#[instrument(name = "routes::pats::delete", skip_all, err(Debug))]
async fn delete_pat(
    user: User,
    Path(id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<StatusCode, ApiError> {
    let pat = resolve_pat(&user, &id, &state).await?;
    db::pats::delete(&pat.owner, &id, &state.shared).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// List all available token scopes
///
/// Returns information about all available scopes including descriptions
/// and whether they require admin role.
#[utoipa::path(
    get,
    path = "/api/pats/scopes",
    responses(
        (status = 200, description = "List of available scopes", body = Vec<ScopeInfo>),
        (status = 401, description = "Not authorized"),
    ),
    security(
        ("bearer" = []),
    )
)]
#[instrument(name = "routes::pats::list_scopes", skip_all)]
async fn list_scopes(user: User) -> Result<Json<Vec<ScopeInfo>>, ApiError> {
    let scopes: Vec<ScopeInfo> = TokenScope::all()
        .into_iter()
        .map(ScopeInfo::from)
        .collect();
    Ok(Json(scopes))
}

/// List available scope bundles
///
/// Returns predefined scope bundles for common use cases.
#[utoipa::path(
    get,
    path = "/api/pats/bundles",
    responses(
        (status = 200, description = "List of scope bundles", body = Vec<ScopeBundleInfo>),
        (status = 401, description = "Not authorized"),
    ),
    security(
        ("bearer" = []),
    )
)]
#[instrument(name = "routes::pats::list_bundles", skip_all)]
async fn list_bundles(user: User) -> Result<Json<Vec<ScopeBundleInfo>>, ApiError> {
    let bundles: Vec<ScopeBundleInfo> = TokenScope::bundle_names()
        .into_iter()
        .filter_map(|name| {
            TokenScope::bundle(name).map(|scopes| ScopeBundleInfo {
                name: name.to_string(),
                scopes,
            })
        })
        .collect();
    Ok(Json(bundles))
}

/// The struct containing our openapi docs
#[derive(OpenApi)]
#[openapi(
    paths(create, list, get_pat, update, delete_pat, list_scopes, list_bundles),
    components(schemas(
        PatCreateRequest,
        PatCreateResponse,
        PatUpdateRequest,
        PersonalAccessToken,
        TokenScope,
        ScopeInfo,
        ScopeBundleInfo
    )),
    modifiers(&OpenApiSecurity),
)]
pub struct PatApiDocs;

/// Return the openapi docs for these routes
#[allow(dead_code)]
async fn openapi() -> Json<utoipa::openapi::OpenApi> {
    Json(PatApiDocs::openapi())
}

/// Add the PAT routes to our router
///
/// # Arguments
///
/// * `router` - The router to add routes to
pub fn mount(router: Router<AppState>) -> Router<AppState> {
    router
        .route("/pats/", get(list).post(create))
        .route("/pats/scopes", get(list_scopes))
        .route("/pats/bundles", get(list_bundles))
        .route("/pats/{id}", get(get_pat).patch(update).delete(delete_pat))
}
