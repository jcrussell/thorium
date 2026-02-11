//! Authentication context for handling both session tokens and PATs

use std::collections::HashSet;

use crate::models::{PersonalAccessToken, TokenScope, User, UserRole};

/// Represents an authenticated request context
///
/// This enum wraps either a session-authenticated user or a PAT-authenticated
/// user, providing a unified interface for checking permissions while respecting
/// token scope restrictions.
#[derive(Debug, Clone)]
pub enum AuthContext {
    /// Authenticated via session token (full access based on user role)
    Session(User),
    /// Authenticated via Personal Access Token (scoped access)
    Pat {
        /// The user who owns this token
        user: User,
        /// The PAT used for authentication
        pat: PersonalAccessToken,
    },
}

impl AuthContext {
    /// Get the underlying user
    pub fn user(&self) -> &User {
        match self {
            AuthContext::Session(user) => user,
            AuthContext::Pat { user, .. } => user,
        }
    }

    /// Get the username
    pub fn username(&self) -> &str {
        &self.user().username
    }

    /// Check if this is an admin user
    pub fn is_admin(&self) -> bool {
        self.user().role == UserRole::Admin
    }

    /// Check if this context has a specific scope
    ///
    /// Session tokens have all scopes implicitly.
    /// PATs must have the scope explicitly or have FullAccess.
    pub fn has_scope(&self, scope: TokenScope) -> bool {
        match self {
            AuthContext::Session(_) => true, // Session tokens have all scopes
            AuthContext::Pat { pat, .. } => {
                pat.scopes.contains(&TokenScope::FullAccess) || pat.scopes.contains(&scope)
            }
        }
    }

    /// Check if this context has any of the specified scopes
    pub fn has_any_scope(&self, scopes: &[TokenScope]) -> bool {
        match self {
            AuthContext::Session(_) => true,
            AuthContext::Pat { pat, .. } => {
                pat.scopes.contains(&TokenScope::FullAccess)
                    || scopes.iter().any(|s| pat.scopes.contains(s))
            }
        }
    }

    /// Check if this context has all of the specified scopes
    pub fn has_all_scopes(&self, scopes: &[TokenScope]) -> bool {
        match self {
            AuthContext::Session(_) => true,
            AuthContext::Pat { pat, .. } => {
                pat.scopes.contains(&TokenScope::FullAccess)
                    || scopes.iter().all(|s| pat.scopes.contains(s))
            }
        }
    }

    /// Check if a group is accessible via this auth context
    ///
    /// For session auth, checks user's group membership.
    /// For PAT auth, also checks PAT's group restrictions.
    pub fn can_access_group(&self, group: &str) -> bool {
        let user = self.user();

        // Admins can access all groups
        if user.role == UserRole::Admin {
            return true;
        }

        // Check user's group membership
        if !user.groups.contains(&group.to_owned()) {
            return false;
        }

        // For PATs, also check group restrictions
        if let AuthContext::Pat { pat, .. } = self {
            if let Some(restricted_groups) = &pat.groups {
                if !restricted_groups.contains(group) {
                    return false;
                }
            }
        }

        true
    }

    /// Check if any of the specified groups are accessible
    pub fn can_access_any_group(&self, groups: &[String]) -> bool {
        groups.iter().any(|g| self.can_access_group(g))
    }

    /// Check if all of the specified groups are accessible
    pub fn can_access_all_groups(&self, groups: &[String]) -> bool {
        groups.iter().all(|g| self.can_access_group(g))
    }

    /// Get the restricted groups for this context (None = all user groups)
    pub fn restricted_groups(&self) -> Option<&HashSet<String>> {
        match self {
            AuthContext::Session(_) => None,
            AuthContext::Pat { pat, .. } => pat.groups.as_ref(),
        }
    }

    /// Get the effective groups for this context
    ///
    /// Returns the intersection of user's groups and PAT's group restrictions,
    /// or just user's groups if no PAT restrictions exist.
    pub fn effective_groups(&self) -> Vec<String> {
        let user = self.user();

        match self {
            AuthContext::Session(_) => user.groups.clone(),
            AuthContext::Pat { pat, .. } => {
                if let Some(restricted) = &pat.groups {
                    user.groups
                        .iter()
                        .filter(|g| restricted.contains(*g))
                        .cloned()
                        .collect()
                } else {
                    user.groups.clone()
                }
            }
        }
    }

    /// Check if this is PAT authentication
    pub fn is_pat(&self) -> bool {
        matches!(self, AuthContext::Pat { .. })
    }

    /// Check if this is session authentication
    pub fn is_session(&self) -> bool {
        matches!(self, AuthContext::Session(_))
    }

    /// Get the PAT if this is PAT authentication
    pub fn pat(&self) -> Option<&PersonalAccessToken> {
        match self {
            AuthContext::Session(_) => None,
            AuthContext::Pat { pat, .. } => Some(pat),
        }
    }
}

impl From<User> for AuthContext {
    fn from(user: User) -> Self {
        AuthContext::Session(user)
    }
}

impl From<(User, PersonalAccessToken)> for AuthContext {
    fn from((user, pat): (User, PersonalAccessToken)) -> Self {
        AuthContext::Pat { user, pat }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn test_user(role: UserRole, groups: Vec<String>) -> User {
        User {
            username: "testuser".to_string(),
            password: None,
            email: "test@example.com".to_string(),
            role,
            groups,
            token: "testtoken".to_string(),
            token_expiration: Utc::now(),
            unix: None,
            settings: crate::models::UserSettings::default(),
            verified: true,
            verification_token: None,
            verification_sent: None,
        }
    }

    fn test_pat(scopes: HashSet<TokenScope>, groups: Option<HashSet<String>>) -> PersonalAccessToken {
        PersonalAccessToken {
            id: uuid::Uuid::new_v4(),
            name: "test-token".to_string(),
            owner: "testuser".to_string(),
            scopes,
            groups,
            created_at: Utc::now(),
            expires_at: None,
            last_used_at: None,
            active: true,
            description: None,
            token_hash: "hash".to_string(),
            token_lookup: "lookup".to_string(),
            token_prefix: "abc12345".to_string(),
        }
    }

    #[test]
    fn test_session_has_all_scopes() {
        let user = test_user(UserRole::User, vec!["group1".to_string()]);
        let auth = AuthContext::Session(user);

        assert!(auth.has_scope(TokenScope::ReadFiles));
        assert!(auth.has_scope(TokenScope::WriteFiles));
        assert!(auth.has_scope(TokenScope::AdminUsers));
    }

    #[test]
    fn test_pat_scope_check() {
        let user = test_user(UserRole::User, vec!["group1".to_string()]);
        let pat = test_pat(
            HashSet::from([TokenScope::ReadFiles, TokenScope::ReadRepos]),
            None,
        );
        let auth = AuthContext::Pat { user, pat };

        assert!(auth.has_scope(TokenScope::ReadFiles));
        assert!(auth.has_scope(TokenScope::ReadRepos));
        assert!(!auth.has_scope(TokenScope::WriteFiles));
        assert!(!auth.has_scope(TokenScope::AdminUsers));
    }

    #[test]
    fn test_pat_full_access_scope() {
        let user = test_user(UserRole::User, vec!["group1".to_string()]);
        let pat = test_pat(HashSet::from([TokenScope::FullAccess]), None);
        let auth = AuthContext::Pat { user, pat };

        assert!(auth.has_scope(TokenScope::ReadFiles));
        assert!(auth.has_scope(TokenScope::WriteFiles));
        assert!(auth.has_scope(TokenScope::AdminUsers));
    }

    #[test]
    fn test_group_access_session() {
        let user = test_user(UserRole::User, vec!["group1".to_string(), "group2".to_string()]);
        let auth = AuthContext::Session(user);

        assert!(auth.can_access_group("group1"));
        assert!(auth.can_access_group("group2"));
        assert!(!auth.can_access_group("group3"));
    }

    #[test]
    fn test_group_access_pat_restricted() {
        let user = test_user(UserRole::User, vec!["group1".to_string(), "group2".to_string()]);
        let pat = test_pat(
            HashSet::from([TokenScope::ReadFiles]),
            Some(HashSet::from(["group1".to_string()])),
        );
        let auth = AuthContext::Pat { user, pat };

        assert!(auth.can_access_group("group1"));
        assert!(!auth.can_access_group("group2")); // User has access but PAT restricts
        assert!(!auth.can_access_group("group3"));
    }

    #[test]
    fn test_admin_bypasses_group_check() {
        let user = test_user(UserRole::Admin, vec![]);
        let auth = AuthContext::Session(user);

        assert!(auth.can_access_group("any_group"));
    }

    #[test]
    fn test_effective_groups() {
        let user = test_user(UserRole::User, vec!["group1".to_string(), "group2".to_string(), "group3".to_string()]);
        let pat = test_pat(
            HashSet::from([TokenScope::ReadFiles]),
            Some(HashSet::from(["group1".to_string(), "group2".to_string()])),
        );
        let auth = AuthContext::Pat { user, pat };

        let effective = auth.effective_groups();
        assert!(effective.contains(&"group1".to_string()));
        assert!(effective.contains(&"group2".to_string()));
        assert!(!effective.contains(&"group3".to_string()));
    }
}
