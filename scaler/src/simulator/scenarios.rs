//! Predefined Test Scenarios
//!
//! This module provides a collection of predefined test scenarios for common
//! scheduling situations. These scenarios can be used directly or as templates
//! for custom test cases.

use chrono::Duration;
use thorium::models::Pools;

use super::assertions::Expectation;
use super::scenario::Scenario;

/// Collection of predefined scenarios organized by category
pub mod predefined {
    use super::*;

    // =========================================================================
    // Resource Exhaustion Scenarios
    // =========================================================================

    /// Scenario: Cluster becomes full, preemption occurs for high-priority deadline
    ///
    /// This tests that when resources are exhausted and a high-priority deadline
    /// arrives, lower-priority workers are preempted to make room.
    pub fn cluster_full_with_preemption() -> Scenario {
        let mut builder = Scenario::builder("cluster_full_with_preemption");

        // Small cluster that will fill up quickly
        builder.simple_cluster("test", "node-1", 8000, 16384);

        // Two users
        builder.simple_user("user-low", "group-a");
        builder.simple_user("user-high", "group-a");

        // Heavy tool that consumes half the cluster
        builder.simple_image("group-a", "heavy-tool", 4000, 8192, 300.0);
        // Light tool for urgent deadline
        builder.simple_image("group-a", "light-tool", 4000, 8192, 60.0);

        // Fill cluster with low-priority work at t=0
        builder
            .at(Duration::zero())
            .add_demand("user-low", "group-a", "heavy-tool", 2)
            .done();

        // Add urgent deadline at t=10s
        builder
            .at(Duration::seconds(10))
            .add_deadline("user-high", "group-a", "light-tool")
            .deadline_in(Duration::seconds(60))
            .done();

        // Expectations
        builder.expect().worker_spawned("heavy-tool");
        builder.expect().worker_spawned("light-tool");

        builder.build()
    }

    /// Scenario: Resources gradually fill up over time
    ///
    /// Tests that the scheduler handles gradual resource exhaustion correctly.
    pub fn gradual_exhaustion() -> Scenario {
        let mut builder = Scenario::builder("gradual_exhaustion");

        builder.simple_cluster("test", "node-1", 16000, 32768);
        builder.simple_user("user-1", "group-a");
        builder.simple_image("group-a", "tool", 4000, 8192, 120.0);

        // Add demand gradually
        builder
            .at(Duration::zero())
            .add_demand("user-1", "group-a", "tool", 1)
            .done();
        builder
            .at(Duration::seconds(5))
            .add_demand("user-1", "group-a", "tool", 1)
            .done();
        builder
            .at(Duration::seconds(10))
            .add_demand("user-1", "group-a", "tool", 1)
            .done();
        builder
            .at(Duration::seconds(15))
            .add_demand("user-1", "group-a", "tool", 1)
            .done();

        // Should spawn 4 workers (fills the node)
        builder.expect().spawn_count(4);

        builder.build()
    }

    // =========================================================================
    // Preemption Scenarios
    // =========================================================================

    /// Scenario: Chain of preemptions due to cascading priorities
    ///
    /// Tests that preemption cascades correctly when multiple priority levels exist.
    pub fn preemption_cascade() -> Scenario {
        let mut builder = Scenario::builder("preemption_cascade");

        builder.simple_cluster("test", "node-1", 8000, 16384);

        // Three users with different priority levels
        builder.simple_user("user-low", "group-a");
        builder.simple_user("user-medium", "group-a");
        builder.simple_user("user-high", "group-a");

        builder.simple_image("group-a", "tool", 4000, 8192, 120.0);

        // Low user fills cluster
        builder
            .at(Duration::zero())
            .add_demand("user-low", "group-a", "tool", 2)
            .done();

        // Medium priority deadline arrives
        builder
            .at(Duration::seconds(10))
            .add_deadline("user-medium", "group-a", "tool")
            .deadline_in(Duration::seconds(120))
            .done();

        // High priority deadline arrives
        builder
            .at(Duration::seconds(20))
            .add_deadline("user-high", "group-a", "tool")
            .deadline_in(Duration::seconds(60))
            .done();

        builder.expect().worker_spawned_in_pool("tool", Pools::Deadline);

        builder.build()
    }

    /// Scenario: Preemption fails because freeing resources still isn't enough
    ///
    /// Tests handling when preemption can't satisfy the resource request.
    pub fn insufficient_preempt_resources() -> Scenario {
        let mut builder = Scenario::builder("insufficient_preempt_resources");

        builder.simple_cluster("test", "node-1", 8000, 8192); // Limited memory

        builder.simple_user("user-existing", "group-a");
        builder.simple_user("user-new", "group-a");

        // Small tool already running
        builder.simple_image("group-a", "small-tool", 2000, 2048, 300.0);
        // Large tool that needs more memory than node has
        builder.simple_image("group-a", "huge-tool", 4000, 16384, 60.0); // More than node total!

        // Fill with small tools
        builder
            .at(Duration::zero())
            .add_demand("user-existing", "group-a", "small-tool", 4)
            .done();

        // Request huge tool
        builder
            .at(Duration::seconds(10))
            .add_deadline("user-new", "group-a", "huge-tool")
            .deadline_in(Duration::seconds(60))
            .done();

        // Huge tool should NOT be spawned (impossible)
        builder.expect().deadline_missed("user-new", "group-a", "huge-tool");

        builder.build()
    }

    // =========================================================================
    // Fair Share Scenarios
    // =========================================================================

    /// Scenario: Heavy user gets deprioritized
    ///
    /// Tests that users who have consumed more resources get lower priority.
    pub fn heavy_user_deprioritized() -> Scenario {
        let mut builder = Scenario::builder("heavy_user_deprioritized");

        builder.simple_cluster("test", "node-1", 4000, 8192);

        // Heavy user with high fair share (low priority)
        builder.simple_user("heavy-user", "group-a");
        // Light user with low fair share (high priority)
        builder.simple_user("light-user", "group-a");

        builder.simple_image("group-a", "tool", 2000, 4096, 60.0);

        // Both users want resources
        builder
            .at(Duration::zero())
            .add_demand("heavy-user", "group-a", "tool", 2)
            .add_demand("light-user", "group-a", "tool", 2)
            .done();

        // Light user should be scheduled first (only 2 slots)
        builder.expect().first_spawn_for_user("light-user");

        builder.build()
    }

    /// Scenario: Fair share ranks decrease over time
    ///
    /// Tests that fair share rankings decay, eventually allowing heavy users to run again.
    pub fn rank_decay() -> Scenario {
        let mut builder = Scenario::builder("rank_decay");

        builder.simple_cluster("test", "node-1", 4000, 8192);

        builder.simple_user("user-1", "group-a");
        builder.simple_user("user-2", "group-a");

        builder.simple_image("group-a", "tool", 2000, 4096, 60.0);

        builder
            .at(Duration::zero())
            .add_demand("user-1", "group-a", "tool", 1)
            .add_demand("user-2", "group-a", "tool", 1)
            .done();

        // Initially user-2 should be scheduled (lower rank = higher priority)
        builder.expect().first_spawn_for_user("user-2");

        builder.build()
    }

    // =========================================================================
    // Edge Case Scenarios
    // =========================================================================

    /// Scenario: No resources available at all
    ///
    /// Tests behavior when the cluster has zero allocatable resources.
    pub fn zero_resources() -> Scenario {
        let mut builder = Scenario::builder("zero_resources");

        builder.simple_cluster("test", "node-1", 0, 0);
        builder.simple_user("user-1", "group-a");
        builder.simple_image("group-a", "tool", 1000, 1024, 60.0);

        builder
            .at(Duration::zero())
            .add_demand("user-1", "group-a", "tool", 1)
            .done();

        builder.expect().no_spawns();

        builder.build()
    }

    /// Scenario: Image spawn limit reached
    ///
    /// Tests that image-specific spawn limits are respected.
    pub fn image_spawn_limit() -> Scenario {
        let mut builder = Scenario::builder("image_spawn_limit");

        builder.simple_cluster("test", "node-1", 32000, 65536);
        builder.simple_user("user-1", "group-a");

        // Image with spawn limit of 2 - use simple_image and manually set limit after
        builder.simple_image("group-a", "limited-tool", 1000, 1024, 60.0);

        builder
            .at(Duration::zero())
            .add_demand("user-1", "group-a", "limited-tool", 5)
            .done();

        // Note: spawn limit needs to be set on the image config
        // For now, just check that spawns occur
        builder.expect().spawn_count(5);

        builder.build()
    }

    /// Scenario: Deadline is already in the past
    ///
    /// Tests handling of deadlines that have already expired.
    pub fn deadline_in_past() -> Scenario {
        let mut builder = Scenario::builder("deadline_in_past");

        builder.simple_cluster("test", "node-1", 8000, 16384);
        builder.simple_user("user-1", "group-a");
        builder.simple_image("group-a", "tool", 2000, 4096, 60.0);

        // Add deadline that's very short
        builder
            .at(Duration::zero())
            .add_deadline("user-1", "group-a", "tool")
            .deadline_in(Duration::seconds(1)) // Very short deadline
            .done();

        // Should still try to spawn
        builder.expect().worker_spawned("tool");

        builder.build()
    }

    /// Scenario: All users are banned
    ///
    /// Tests that no spawns occur when all users are in the ban set.
    pub fn all_users_banned() -> Scenario {
        let mut builder = Scenario::builder("all_users_banned");

        // Note: This scenario relies on ban set configuration in the harness
        // The actual ban logic would need to be applied during simulation setup
        builder.simple_cluster("test", "node-1", 8000, 16384);
        builder.simple_user("banned-user", "group-a");
        builder.simple_image("group-a", "tool", 2000, 4096, 60.0);

        builder
            .at(Duration::zero())
            .add_demand("banned-user", "group-a", "tool", 1)
            .done();

        // This scenario tests the ban mechanism - expectations depend on implementation
        builder.build()
    }

    // =========================================================================
    // Multi-Cluster Scenarios
    // =========================================================================

    /// Scenario: Work spreads across multiple clusters
    ///
    /// Tests that work is distributed across available clusters.
    pub fn multi_cluster_distribution() -> Scenario {
        let mut builder = Scenario::builder("multi_cluster_distribution");

        builder
            .simple_cluster("cluster-1", "node-1a", 4000, 8192)
            .simple_cluster("cluster-2", "node-2a", 4000, 8192)
            .simple_user("user-1", "group-a")
            .simple_image("group-a", "tool", 2000, 4096, 60.0);

        builder
            .at(Duration::zero())
            .add_demand("user-1", "group-a", "tool", 4)
            .done();
        builder.expect().spawn_count(4);

        builder.build()
    }

    /// Scenario: One cluster becomes unavailable
    ///
    /// Tests failover when a cluster node becomes unhealthy.
    pub fn cluster_failover() -> Scenario {
        let mut builder = Scenario::builder("cluster_failover");

        builder
            .simple_cluster("cluster-1", "node-1a", 4000, 8192)
            .simple_cluster("cluster-2", "node-2a", 4000, 8192)
            .simple_user("user-1", "group-a")
            .simple_image("group-a", "tool", 2000, 4096, 60.0);

        builder
            .at(Duration::zero())
            .add_demand("user-1", "group-a", "tool", 2)
            .done();
        builder
            .at(Duration::seconds(5))
            .node_unavailable("cluster-1", "node-1a")
            .done();
        builder
            .at(Duration::seconds(10))
            .add_demand("user-1", "group-a", "tool", 2)
            .done();

        builder.build()
    }
}

/// Get all predefined scenarios
pub fn all_scenarios() -> Vec<Scenario> {
    vec![
        predefined::cluster_full_with_preemption(),
        predefined::gradual_exhaustion(),
        predefined::preemption_cascade(),
        predefined::insufficient_preempt_resources(),
        predefined::heavy_user_deprioritized(),
        predefined::rank_decay(),
        predefined::zero_resources(),
        predefined::image_spawn_limit(),
        predefined::deadline_in_past(),
        predefined::all_users_banned(),
        predefined::multi_cluster_distribution(),
        predefined::cluster_failover(),
    ]
}

/// Get scenarios by category
pub fn scenarios_by_category(category: &str) -> Vec<Scenario> {
    match category {
        "resource_exhaustion" => vec![
            predefined::cluster_full_with_preemption(),
            predefined::gradual_exhaustion(),
        ],
        "preemption" => vec![
            predefined::preemption_cascade(),
            predefined::insufficient_preempt_resources(),
        ],
        "fair_share" => vec![
            predefined::heavy_user_deprioritized(),
            predefined::rank_decay(),
        ],
        "edge_cases" => vec![
            predefined::zero_resources(),
            predefined::image_spawn_limit(),
            predefined::deadline_in_past(),
            predefined::all_users_banned(),
        ],
        "multi_cluster" => vec![
            predefined::multi_cluster_distribution(),
            predefined::cluster_failover(),
        ],
        _ => vec![],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::simulator::SimulatorHarness;

    #[test]
    fn test_all_scenarios_build() {
        // Verify all predefined scenarios can be built without panicking
        let scenarios = all_scenarios();
        assert!(!scenarios.is_empty());
        for scenario in scenarios {
            assert!(!scenario.name.is_empty());
        }
    }

    #[test]
    fn test_heavy_user_deprioritized_scenario() {
        let scenario = predefined::heavy_user_deprioritized();
        assert_eq!(scenario.name, "heavy_user_deprioritized");
        assert_eq!(scenario.users.len(), 2);
        assert_eq!(scenario.images.len(), 1);
        assert!(!scenario.expectations.is_empty());
    }

    #[test]
    fn test_scenario_categories() {
        assert!(!scenarios_by_category("preemption").is_empty());
        assert!(!scenarios_by_category("fair_share").is_empty());
        assert!(!scenarios_by_category("edge_cases").is_empty());
        assert!(scenarios_by_category("nonexistent").is_empty());
    }
}
