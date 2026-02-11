//! Utility functions for repos

/// Validate the repo URL
///
/// # Arguments
///
/// * `url` - The URL to validate
pub fn validate_repo_url(url: &str) -> Result<(), thorium::Error> {
    let mut split = url.split('/');
    let host = split.next();
    if host.is_none() {
        return Err(thorium::Error::new("the repo URL is empty"));
    }
    let user = split.next();
    if user.is_none() {
        return Err(thorium::Error::new(
            "the repo URL is missing a user and name",
        ));
    }
    let name = split.next();
    if name.is_none() {
        return Err(thorium::Error::new("the repo URL is missing a name"));
    }
    if split.next().is_some() {
        return Err(thorium::Error::new("the repo URL has too many components"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // ==================== validate_repo_url tests ====================

    #[test]
    fn validate_repo_url_valid_github() {
        assert!(validate_repo_url("github.com/owner/repo").is_ok());
    }

    #[test]
    fn validate_repo_url_valid_gitlab() {
        assert!(validate_repo_url("gitlab.com/owner/repo").is_ok());
    }

    #[test]
    fn validate_repo_url_valid_with_protocol() {
        // With https:// protocol, this will have too many components
        // so the function expects just host/user/repo format
        assert!(validate_repo_url("https://github.com/owner/repo").is_err());
    }

    #[test]
    fn validate_repo_url_empty() {
        // Empty string still has one component (the empty string itself)
        // So it fails with "missing a user and name"
        let result = validate_repo_url("");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.msg().unwrap().contains("missing a user and name"));
    }

    #[test]
    fn validate_repo_url_host_only() {
        let result = validate_repo_url("github.com");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.msg().unwrap().contains("missing a user and name"));
    }

    #[test]
    fn validate_repo_url_host_and_user_only() {
        let result = validate_repo_url("github.com/owner");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.msg().unwrap().contains("missing a name"));
    }

    #[test]
    fn validate_repo_url_too_many_components() {
        let result = validate_repo_url("github.com/owner/repo/extra");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.msg().unwrap().contains("too many components"));
    }

    #[test]
    fn validate_repo_url_too_many_components_deep() {
        let result = validate_repo_url("github.com/owner/repo/a/b/c");
        assert!(result.is_err());
    }

    #[test]
    fn validate_repo_url_with_dashes() {
        assert!(validate_repo_url("github.com/my-org/my-repo").is_ok());
    }

    #[test]
    fn validate_repo_url_with_underscores() {
        assert!(validate_repo_url("github.com/my_org/my_repo").is_ok());
    }

    #[test]
    fn validate_repo_url_with_numbers() {
        assert!(validate_repo_url("github.com/user123/repo456").is_ok());
    }

    #[test]
    fn validate_repo_url_bitbucket() {
        assert!(validate_repo_url("bitbucket.org/owner/repo").is_ok());
    }

    #[test]
    fn validate_repo_url_custom_host() {
        assert!(validate_repo_url("git.example.com/owner/repo").is_ok());
    }
}
