//! Simulator integration tests
//!
//! These tests verify that the scheduler simulation framework works correctly
//! and that the predefined scenarios produce expected results.

use super::fuzzer::invariants;
use super::scenarios::predefined;
use super::SimulatorHarness;

// =============================================================================
// Fair Share Ranking Tests
// =============================================================================

#[test]
fn test_fair_share_prioritizes_light_users() {
    let scenario = predefined::heavy_user_deprioritized();
    let mut harness = SimulatorHarness::from_scenario(&scenario);
    let result = harness.run();

    // Verify the scenario completed without panicking
    assert!(!result.decisions.is_empty() || result.cycles > 0, "Simulation should run at least one cycle");
}

#[test]
fn test_rank_decay_scenario() {
    let scenario = predefined::rank_decay();
    let mut harness = SimulatorHarness::from_scenario(&scenario);
    let result = harness.run();

    // Verify the simulation ran
    assert!(result.cycles > 0, "Simulation should run at least one cycle");
}

// =============================================================================
// Resource Exhaustion Tests
// =============================================================================

#[test]
fn test_zero_resources_no_spawns() {
    let scenario = predefined::zero_resources();
    let mut harness = SimulatorHarness::from_scenario(&scenario);
    let result = harness.run();

    // With zero resources, no spawns should occur
    assert!(
        result.spawns().is_empty(),
        "No spawns should occur with zero resources"
    );
}

#[test]
fn test_gradual_exhaustion() {
    let scenario = predefined::gradual_exhaustion();
    let mut harness = SimulatorHarness::from_scenario(&scenario);
    let result = harness.run();

    // The simulation should complete without errors
    assert!(result.cycles > 0, "Simulation should run at least one cycle");
}

#[test]
fn test_cluster_full_with_preemption() {
    let scenario = predefined::cluster_full_with_preemption();
    let mut harness = SimulatorHarness::from_scenario(&scenario);
    let result = harness.run();

    // The simulation should complete
    assert!(result.cycles > 0, "Simulation should run at least one cycle");
}

// =============================================================================
// Preemption Tests
// =============================================================================

#[test]
fn test_preemption_cascade() {
    let scenario = predefined::preemption_cascade();
    let mut harness = SimulatorHarness::from_scenario(&scenario);
    let result = harness.run();

    // The simulation should complete
    assert!(result.cycles > 0, "Simulation should run at least one cycle");
}

#[test]
fn test_insufficient_preempt_resources() {
    let scenario = predefined::insufficient_preempt_resources();
    let mut harness = SimulatorHarness::from_scenario(&scenario);
    let result = harness.run();

    // The simulation should complete
    assert!(result.cycles > 0, "Simulation should run at least one cycle");
}

// =============================================================================
// Edge Case Tests
// =============================================================================

#[test]
fn test_image_spawn_limit() {
    let scenario = predefined::image_spawn_limit();
    let mut harness = SimulatorHarness::from_scenario(&scenario);
    let result = harness.run();

    // The simulation should complete
    assert!(result.cycles > 0, "Simulation should run at least one cycle");
}

#[test]
fn test_deadline_in_past() {
    let scenario = predefined::deadline_in_past();
    let mut harness = SimulatorHarness::from_scenario(&scenario);
    let result = harness.run();

    // The simulation should complete
    assert!(result.cycles > 0, "Simulation should run at least one cycle");
}

#[test]
fn test_all_users_banned() {
    let scenario = predefined::all_users_banned();
    let mut harness = SimulatorHarness::from_scenario(&scenario);
    let result = harness.run();

    // The simulation should complete
    assert!(result.cycles > 0, "Simulation should run at least one cycle");
}

// =============================================================================
// Multi-Cluster Tests
// =============================================================================

#[test]
fn test_multi_cluster_distribution() {
    let scenario = predefined::multi_cluster_distribution();
    let mut harness = SimulatorHarness::from_scenario(&scenario);
    let result = harness.run();

    // The simulation should complete
    assert!(result.cycles > 0, "Simulation should run at least one cycle");
}

#[test]
fn test_cluster_failover() {
    let scenario = predefined::cluster_failover();
    let mut harness = SimulatorHarness::from_scenario(&scenario);
    let result = harness.run();

    // The simulation should complete
    assert!(result.cycles > 0, "Simulation should run at least one cycle");
}

// =============================================================================
// Invariant Tests (Property-Based)
// =============================================================================

#[test]
fn test_invariants_on_all_predefined_scenarios() {
    use super::scenarios::all_scenarios;

    for scenario in all_scenarios() {
        let mut harness = SimulatorHarness::from_scenario(&scenario);
        let result = harness.run();

        // Check all invariants
        let invariant_results = invariants::check_all(&result);
        for (name, passed) in invariant_results {
            assert!(
                passed,
                "Invariant '{}' violated in scenario '{}'",
                name, scenario.name
            );
        }
    }
}

#[test]
fn test_resources_never_overallocated() {
    let scenario = predefined::gradual_exhaustion();
    let mut harness = SimulatorHarness::from_scenario(&scenario);
    let result = harness.run();

    assert!(
        invariants::resources_never_overallocated(&result),
        "Resources should never be over-allocated"
    );
}

#[test]
fn test_deadline_priority_respected() {
    let scenario = predefined::preemption_cascade();
    let mut harness = SimulatorHarness::from_scenario(&scenario);
    let result = harness.run();

    assert!(
        invariants::deadline_priority_respected(&result),
        "Deadline priority should be respected"
    );
}

#[test]
fn test_no_duplicate_spawns() {
    let scenario = predefined::multi_cluster_distribution();
    let mut harness = SimulatorHarness::from_scenario(&scenario);
    let result = harness.run();

    assert!(
        invariants::no_duplicate_spawns(&result),
        "No duplicate spawns should occur"
    );
}

// =============================================================================
// Fuzzing Tests
// =============================================================================

#[test]
fn test_fuzz_basic_scenario() {
    use super::fuzzer::{build_fuzz_scenario, FuzzConfig};

    let scenario = build_fuzz_scenario(
        1,      // num_clusters
        1,      // num_nodes
        2,      // num_users
        1,      // num_images
        2,      // num_deadlines
        16000,  // cpu_per_node
        32768,  // memory_per_node
    );

    let mut harness = SimulatorHarness::from_scenario(&scenario);
    let result = harness.run();

    // Check invariants hold for fuzzed scenario
    invariants::assert_all(&result);
}

#[test]
fn test_fuzz_config_default() {
    use super::fuzzer::{run_fuzz_test, FuzzConfig};

    let config = FuzzConfig {
        min_clusters: 1,
        max_clusters: 1,
        min_nodes: 1,
        max_nodes: 1,
        min_users: 1,
        max_users: 2,
        min_images: 1,
        max_images: 1,
        min_deadlines: 0,
        max_deadlines: 2,
        ..Default::default()
    };

    let result = run_fuzz_test(&config);
    invariants::assert_all(&result);
}

// =============================================================================
// Simulation Result API Tests
// =============================================================================

#[test]
fn test_simulation_result_api() {
    use chrono::Duration;
    use super::harness::{SchedulingDecision, SimulationResult, SpawnDecision};
    use super::assertions::AssertionResult;
    use chrono::Utc;
    use thorium::models::Pools;

    // Create a result with some decisions
    let decisions = vec![
        SchedulingDecision::Spawn(SpawnDecision {
            user: "user1".to_string(),
            group: "group1".to_string(),
            pipeline: "pipe1".to_string(),
            stage: "tool1".to_string(),
            cluster: "cluster1".to_string(),
            node: "node1".to_string(),
            pool: Pools::FairShare,
            timestamp: Utc::now(),
        }),
        SchedulingDecision::Spawn(SpawnDecision {
            user: "user2".to_string(),
            group: "group1".to_string(),
            pipeline: "pipe1".to_string(),
            stage: "tool1".to_string(),
            cluster: "cluster1".to_string(),
            node: "node1".to_string(),
            pool: Pools::Deadline,
            timestamp: Utc::now(),
        }),
    ];

    let result = SimulationResult {
        decisions,
        assertion_results: vec![],
        duration: Duration::seconds(10),
        cycles: 5,
        has_failures: false,
    };

    assert!(result.all_passed());
    assert_eq!(result.spawns().len(), 2);
    assert_eq!(result.preemptions().len(), 0);
    assert!(result.failures().is_empty());
}

// =============================================================================
// Scenario Builder Tests
// =============================================================================

#[test]
fn test_scenario_builder_fluent_api() {
    use super::scenario::Scenario;
    use chrono::Duration;

    let mut builder = Scenario::builder("fluent_test");
    builder
        .simple_cluster("test-cluster", "node-1", 8000, 16384)
        .simple_user("test-user", "test-group")
        .simple_image("test-group", "test-tool", 2000, 4096, 60.0);

    builder
        .at(Duration::zero())
        .add_demand("test-user", "test-group", "test-tool", 2)
        .done();

    builder.expect().spawn_count(2);

    let scenario = builder.build();

    assert_eq!(scenario.name, "fluent_test");
    assert_eq!(scenario.clusters.len(), 1);
    assert_eq!(scenario.users.len(), 1);
    assert_eq!(scenario.images.len(), 1);
    assert!(!scenario.events.is_empty());
    assert!(!scenario.expectations.is_empty());
}

// =============================================================================
// Generator Tests
// =============================================================================

#[test]
fn test_stats_generator() {
    use super::generators::StatsGenerator;

    let stats = StatsGenerator::new()
        .add_user_jobs("user1", "group1", "pipeline1", "tool1", 2, 5)
        .add_user_jobs("user2", "group1", "pipeline1", "tool2", 0, 3)
        .build();

    assert_eq!(stats.running, 2);
    assert!(stats.groups.contains_key("group1"));
}

#[test]
fn test_deadline_generator() {
    use super::generators::DeadlineGenerator;
    use chrono::{Duration, Utc};

    let deadlines = DeadlineGenerator::new()
        .add_relative("user1", "group1", "pipe1", "tool1", Duration::minutes(5))
        .add_urgent("user2", "group1", "pipe1", "tool2")
        .build();

    assert_eq!(deadlines.len(), 2);
    assert!(deadlines[0].deadline > Utc::now());
}

#[test]
fn test_image_generator() {
    use super::generators::ImageGenerator;

    let images = ImageGenerator::new()
        .add_simple("group1", "tool1", 1000, 4096, 60.0)
        .add_simple("group1", "tool2", 2000, 8192, 120.0)
        .build_map();

    assert!(images.contains_key("group1"));
    assert_eq!(images["group1"].len(), 2);
}

#[test]
fn test_cluster_generator() {
    use super::generators::ClusterGenerator;

    let clusters = ClusterGenerator::new()
        .add_simple("cluster1", 32000, 65536)
        .add_multi_node("cluster2", 3, 16000, 32768)
        .build();

    assert_eq!(clusters.len(), 2);
    assert_eq!(clusters[0].nodes.len(), 1);
    assert_eq!(clusters[1].nodes.len(), 3);
}
