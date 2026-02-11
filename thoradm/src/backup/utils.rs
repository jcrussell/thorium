//! Some utilities to help thoradm do what it needs to do

use scylla::client::session::Session;
use scylla::errors::ExecutionError;
use scylla::response::query_result::QueryResult;

/// Drop a materialized view in scylla
///
/// # Arguments
///
/// * `name` - The name of the materialized view to delete
/// * `cluster` - The cluster we are deleting a materialized view from
/// * `scylla` - The scylla session to use
pub async fn drop_materialized_view(
    ns: &str,
    name: &str,
    scylla: &Session,
) -> Result<QueryResult, ExecutionError> {
    // Drop the target table
    let table_drop = format!(
        "drop materialized view if exists {ns}.{name}",
        ns = ns,
        name = name
    );
    // execute our query
    scylla.query_unpaged(table_drop, &[]).await
}

/// The shared functions across all traits
pub trait Utils {
    /// The name of the table we are operating on
    fn name() -> &'static str;

    /// Get the pretty name of the table
    fn pretty_name() -> String {
        Self::name().replace('_', " ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Test struct implementing Utils trait
    struct TestTable;
    impl Utils for TestTable {
        fn name() -> &'static str {
            "test_table_name"
        }
    }

    struct SingleWordTable;
    impl Utils for SingleWordTable {
        fn name() -> &'static str {
            "samples"
        }
    }

    struct MultiUnderscoreTable;
    impl Utils for MultiUnderscoreTable {
        fn name() -> &'static str {
            "user_login_history"
        }
    }

    struct EmptyTable;
    impl Utils for EmptyTable {
        fn name() -> &'static str {
            ""
        }
    }

    // ==================== Utils::name tests ====================

    #[test]
    fn utils_name_returns_static_str() {
        assert_eq!(TestTable::name(), "test_table_name");
    }

    // ==================== Utils::pretty_name tests ====================

    #[test]
    fn utils_pretty_name_replaces_underscores() {
        assert_eq!(TestTable::pretty_name(), "test table name");
    }

    #[test]
    fn utils_pretty_name_single_word() {
        // No underscores, should be unchanged
        assert_eq!(SingleWordTable::pretty_name(), "samples");
    }

    #[test]
    fn utils_pretty_name_multiple_underscores() {
        assert_eq!(MultiUnderscoreTable::pretty_name(), "user login history");
    }

    #[test]
    fn utils_pretty_name_empty() {
        assert_eq!(EmptyTable::pretty_name(), "");
    }

}
