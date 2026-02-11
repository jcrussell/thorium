use crate::utils::Shared;

/// The keys to use to access PAT data/sets in Redis
#[derive(Debug)]
pub struct PatKeys {
    /// The key to the global PAT token hash map (hash -> pat_id:owner)
    pub tokens: String,
    /// The key to this user's PAT set
    pub user_pats: String,
    /// The key to a specific PAT's data
    pub data: String,
}

impl PatKeys {
    /// Builds the keys to access PAT data/sets in Redis
    ///
    /// # Arguments
    ///
    /// * `owner` - The username of the PAT owner
    /// * `pat_id` - The UUID of the PAT
    /// * `shared` - Shared Thorium objects
    pub fn new(owner: &str, pat_id: &str, shared: &Shared) -> Self {
        PatKeys {
            tokens: Self::tokens(shared),
            user_pats: Self::user_pats(owner, shared),
            data: Self::data(owner, pat_id, shared),
        }
    }

    /// Builds the global token hash map key
    ///
    /// This maps token hashes to "pat_id:owner" strings for fast lookup
    ///
    /// # Arguments
    ///
    /// * `shared` - Shared Thorium objects
    pub fn tokens(shared: &Shared) -> String {
        format!("{ns}:pats_token_map", ns = shared.config.thorium.namespace)
    }

    /// Builds the key to a user's PAT set
    ///
    /// # Arguments
    ///
    /// * `owner` - The username of the PAT owner
    /// * `shared` - Shared Thorium objects
    pub fn user_pats(owner: &str, shared: &Shared) -> String {
        format!(
            "{ns}:user_pats:{owner}",
            ns = shared.config.thorium.namespace,
            owner = owner,
        )
    }

    /// Builds the key to a specific PAT's data
    ///
    /// # Arguments
    ///
    /// * `owner` - The username of the PAT owner
    /// * `pat_id` - The UUID of the PAT
    /// * `shared` - Shared Thorium objects
    pub fn data(owner: &str, pat_id: &str, shared: &Shared) -> String {
        format!(
            "{ns}:pat_data:{owner}:{pat_id}",
            ns = shared.config.thorium.namespace,
            owner = owner,
            pat_id = pat_id,
        )
    }

    /// Builds the key to the global PAT ID -> owner mapping
    ///
    /// This maps pat_id strings to owner usernames for admin cross-user lookup.
    ///
    /// # Arguments
    ///
    /// * `shared` - Shared Thorium objects
    pub fn pat_owners(shared: &Shared) -> String {
        format!(
            "{ns}:pat_owners",
            ns = shared.config.thorium.namespace,
        )
    }
}
