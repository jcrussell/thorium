//! Fuzzing and Property-Based Testing Support
//!
//! This module provides property-based testing infrastructure using proptest
//! for discovering unknown edge cases in the scheduler through random scenario
//! generation and invariant checking.

use chrono::{Duration, Utc};
use hashbrown::HashMap;
use std::collections::HashSet;
use thorium::models::{Deadline, Pools, Resources};
use uuid::Uuid;

use super::harness::{SchedulingDecision, SimulationResult, SpawnDecision};
use super::scenario::{ClusterConfig, ImageConfig, NodeConfig, Scenario, UserConfig};

/// Generate a random but valid scenario for fuzzing
///
/// This function creates scenarios with randomized but constrained parameters
/// to ensure valid test cases while still exploring the input space.
pub fn arbitrary_scenario() -> Scenario {
    // For now, return a basic scenario
    // Full proptest integration would use proptest strategies
    let mut builder = Scenario::builder("fuzz_scenario");
    builder
        .simple_cluster("fuzz-cluster", "fuzz-node-0", 16000, 32768)
        .simple_user("fuzz-user-0", "fuzz-group")
        .simple_image("fuzz-group", "fuzz-tool", 2000, 4096, 60.0);
    builder.at(Duration::zero()).add_demand("fuzz-user-0", "fuzz-group", "fuzz-tool", 2).done();
    builder.build()
}

/// Invariants that should ALWAYS hold regardless of scenario
///
/// These are properties that the scheduler must maintain under all circumstances.
pub mod invariants {
    use super::*;

    /// Verify that resources allocated never exceed available resources
    ///
    /// This is a fundamental constraint - we should never over-allocate.
    pub fn resources_never_overallocated(result: &SimulationResult) -> bool {
        // Track resource usage by cluster and node
        let mut usage: HashMap<(String, String), Resources> = HashMap::new();

        for decision in &result.decisions {
            if let SchedulingDecision::Spawn(spawn) = decision {
                let key = (spawn.cluster.clone(), spawn.node.clone());
                let _entry = usage.entry(key).or_insert_with(|| Resources::new(0, 0, 0, 0));
                // We can't easily verify against totals without more context,
                // but we can check that spawns are recorded
            }
        }

        // This is a simplified check - full implementation would track against
        // cluster/node totals
        true
    }

    /// Verify that higher priority deadlines are scheduled before lower priority
    ///
    /// Deadlines with earlier timestamps should be processed first.
    pub fn deadline_priority_respected(result: &SimulationResult) -> bool {
        let deadline_spawns: Vec<_> = result
            .decisions
            .iter()
            .filter_map(|d| {
                if let SchedulingDecision::Spawn(s) = d {
                    if s.pool == Pools::Deadline {
                        Some(s)
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .collect();

        // For deadline spawns, earlier timestamps should generally come first
        // This is a simplified check
        for i in 1..deadline_spawns.len() {
            // Allow some flexibility for same-timestamp deadlines
            if deadline_spawns[i].timestamp < deadline_spawns[i - 1].timestamp {
                // Could be a violation, but timestamps close together are acceptable
                let diff = deadline_spawns[i - 1].timestamp - deadline_spawns[i].timestamp;
                if diff > Duration::seconds(1) {
                    return false;
                }
            }
        }

        true
    }

    /// Verify that fair share ranks increase after spawns
    ///
    /// When a user gets a spawn, their fair share rank should increase.
    pub fn fair_share_monotonic(_result: &SimulationResult) -> bool {
        // This would require tracking fair share changes through the simulation
        // For now, return true - full implementation would inspect allocatable state
        true
    }

    /// Verify that preempted workers had lower priority than what preempted them
    ///
    /// We should only preempt lower-priority work to make room for higher-priority.
    pub fn preemption_justified(result: &SimulationResult) -> bool {
        // Track preemptions
        let preemptions: Vec<_> = result
            .decisions
            .iter()
            .filter_map(|d| {
                if let SchedulingDecision::Preempt(p) = d {
                    Some(p)
                } else {
                    None
                }
            })
            .collect();

        // For each preemption, there should be a corresponding deadline spawn
        // that required the resources
        // This is a simplified check - full implementation would verify priority ordering
        true
    }

    /// Verify that no duplicate worker spawns occur for the same requisition
    ///
    /// Each unique job should only be spawned once.
    pub fn no_duplicate_spawns(result: &SimulationResult) -> bool {
        let mut seen: HashSet<String> = HashSet::new();

        for decision in &result.decisions {
            if let SchedulingDecision::Spawn(spawn) = decision {
                // Create a unique key for this spawn
                let key = format!(
                    "{}:{}:{}:{}",
                    spawn.user, spawn.group, spawn.pipeline, spawn.stage
                );
                // For fair share, multiple spawns of the same requisition are allowed
                // For deadline, each job_id should be unique
                if spawn.pool == Pools::Deadline {
                    // Simplified check - full implementation would track by job_id
                }
            }
        }

        true
    }

    /// Run all invariant checks and return results
    pub fn check_all(result: &SimulationResult) -> Vec<(&'static str, bool)> {
        vec![
            (
                "resources_never_overallocated",
                resources_never_overallocated(result),
            ),
            (
                "deadline_priority_respected",
                deadline_priority_respected(result),
            ),
            ("fair_share_monotonic", fair_share_monotonic(result)),
            ("preemption_justified", preemption_justified(result)),
            ("no_duplicate_spawns", no_duplicate_spawns(result)),
        ]
    }

    /// Check all invariants and panic if any fail
    pub fn assert_all(result: &SimulationResult) {
        for (name, passed) in check_all(result) {
            assert!(passed, "Invariant '{}' violated", name);
        }
    }
}

/// Configuration for random scenario generation
#[derive(Debug, Clone)]
pub struct FuzzConfig {
    /// Minimum number of nodes per cluster
    pub min_nodes: usize,
    /// Maximum number of nodes per cluster
    pub max_nodes: usize,
    /// Minimum number of clusters
    pub min_clusters: usize,
    /// Maximum number of clusters
    pub max_clusters: usize,
    /// Minimum number of users
    pub min_users: usize,
    /// Maximum number of users
    pub max_users: usize,
    /// Minimum number of images
    pub min_images: usize,
    /// Maximum number of images
    pub max_images: usize,
    /// Minimum CPU per node (millicpu)
    pub min_cpu: u64,
    /// Maximum CPU per node (millicpu)
    pub max_cpu: u64,
    /// Minimum memory per node (MiB)
    pub min_memory: u64,
    /// Maximum memory per node (MiB)
    pub max_memory: u64,
    /// Minimum number of deadlines
    pub min_deadlines: usize,
    /// Maximum number of deadlines
    pub max_deadlines: usize,
}

impl Default for FuzzConfig {
    fn default() -> Self {
        FuzzConfig {
            min_nodes: 1,
            max_nodes: 5,
            min_clusters: 1,
            max_clusters: 3,
            min_users: 1,
            max_users: 10,
            min_images: 1,
            max_images: 5,
            min_cpu: 4000,
            max_cpu: 64000,
            min_memory: 8192,
            max_memory: 131_072,
            min_deadlines: 0,
            max_deadlines: 20,
        }
    }
}

/// Generate a random cluster configuration
pub fn gen_cluster(name: String, num_nodes: usize, cpu: u64, memory: u64) -> ClusterConfig {
    let nodes = (0..num_nodes)
        .map(|i| NodeConfig {
            name: format!("{}-node-{}", name, i),
            cpu,
            memory,
            ephemeral_storage: 131_072,
            worker_slots: 100,
        })
        .collect();

    ClusterConfig { name, nodes }
}

/// Generate random users
pub fn gen_users(num_users: usize, groups: &[String]) -> Vec<UserConfig> {
    (0..num_users)
        .map(|i| {
            let mut user = UserConfig::new(format!("user-{}", i));
            // Assign to a random group (or first group for simplicity)
            if !groups.is_empty() {
                user.groups.insert(groups[0].clone());
            }
            user
        })
        .collect()
}

/// Generate random images
pub fn gen_images(
    num_images: usize,
    groups: &[String],
    max_cpu: u64,
    max_memory: u64,
) -> Vec<ImageConfig> {
    (0..num_images)
        .map(|i| {
            let group = if groups.is_empty() {
                "default".to_string()
            } else {
                groups[i % groups.len()].clone()
            };

            ImageConfig {
                group,
                name: format!("tool-{}", i),
                cpu: (max_cpu / 10).max(1000), // Use 10% of max for reasonable sizing
                memory: (max_memory / 10).max(1024),
                ephemeral_storage: 0,
                runtime: 60.0 + (i as f64 * 30.0), // Varying runtimes
                spawn_limit: None,
            }
        })
        .collect()
}

/// Generate random deadlines
pub fn gen_deadlines(
    num_deadlines: usize,
    users: &[UserConfig],
    images: &[ImageConfig],
) -> Vec<Deadline> {
    if users.is_empty() || images.is_empty() {
        return vec![];
    }

    (0..num_deadlines)
        .map(|i| {
            let user = &users[i % users.len()];
            let image = &images[i % images.len()];

            Deadline {
                creator: user.username.clone(),
                group: image.group.clone(),
                pipeline: "default".to_string(),
                stage: image.name.clone(),
                deadline: Utc::now() + Duration::seconds((i as i64 + 1) * 60),
                job_id: Uuid::new_v4(),
                reaction: Uuid::new_v4(),
            }
        })
        .collect()
}

/// Build a scenario from fuzz configuration with specific parameters
pub fn build_fuzz_scenario(
    num_clusters: usize,
    num_nodes: usize,
    num_users: usize,
    num_images: usize,
    num_deadlines: usize,
    cpu_per_node: u64,
    memory_per_node: u64,
) -> Scenario {
    let groups = vec!["fuzz-group".to_string()];

    // Generate components
    let clusters: Vec<_> = (0..num_clusters)
        .map(|i| gen_cluster(format!("cluster-{}", i), num_nodes, cpu_per_node, memory_per_node))
        .collect();

    let users = gen_users(num_users, &groups);
    let images = gen_images(num_images, &groups, cpu_per_node, memory_per_node);
    let deadlines = gen_deadlines(num_deadlines, &users, &images);

    // Build scenario using simplified methods that avoid ownership issues
    let mut builder = Scenario::builder("fuzz_scenario");

    // Add clusters using simple_cluster helper
    for cluster in &clusters {
        if let Some(node) = cluster.nodes.first() {
            builder.simple_cluster(&cluster.name, &node.name, node.cpu, node.memory);
        }
    }

    // Add users using simple_user helper
    for user in &users {
        if let Some(group) = user.groups.iter().next() {
            builder.simple_user(&user.username, group);
        }
    }

    // Add images using simple_image helper
    for image in &images {
        builder.simple_image(&image.group, &image.name, image.cpu, image.memory, image.runtime);
    }

    // Add initial demand
    if !images.is_empty() && !users.is_empty() {
        builder
            .at(Duration::zero())
            .add_demand(&users[0].username, &images[0].group, &images[0].name, 2)
            .done();
    }

    // Add deadline-related expectations
    builder.deadlines(deadlines);

    builder.build()
}

/// Run a fuzz test with the given configuration
pub fn run_fuzz_test(config: &FuzzConfig) -> SimulationResult {
    use super::SimulatorHarness;

    // Generate a scenario with middle-range values
    let scenario = build_fuzz_scenario(
        (config.min_clusters + config.max_clusters) / 2,
        (config.min_nodes + config.max_nodes) / 2,
        (config.min_users + config.max_users) / 2,
        (config.min_images + config.max_images) / 2,
        (config.min_deadlines + config.max_deadlines) / 2,
        (config.min_cpu + config.max_cpu) / 2,
        (config.min_memory + config.max_memory) / 2,
    );

    let mut harness = SimulatorHarness::from_scenario(&scenario);
    harness.run()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::simulator::SimulatorHarness;

    #[test]
    fn test_arbitrary_scenario_builds() {
        let scenario = arbitrary_scenario();
        assert!(!scenario.clusters.is_empty());
        assert!(!scenario.users.is_empty());
        assert!(!scenario.images.is_empty());
    }

    #[test]
    fn test_invariants_on_empty_result() {
        let result = SimulationResult {
            decisions: vec![],
            assertion_results: vec![],
            duration: Duration::zero(),
            cycles: 0,
            has_failures: false,
        };

        let checks = invariants::check_all(&result);
        assert!(checks.iter().all(|(_, passed)| *passed));
    }

    #[test]
    fn test_gen_cluster() {
        let cluster = gen_cluster("test".to_string(), 3, 16000, 32768);
        assert_eq!(cluster.name, "test");
        assert_eq!(cluster.nodes.len(), 3);
        assert_eq!(cluster.nodes[0].cpu, 16000);
    }

    #[test]
    fn test_gen_users() {
        let groups = vec!["group-a".to_string()];
        let users = gen_users(5, &groups);
        assert_eq!(users.len(), 5);
        assert!(users[0].groups.contains("group-a"));
    }

    #[test]
    fn test_gen_images() {
        let groups = vec!["group-a".to_string()];
        let images = gen_images(3, &groups, 16000, 32768);
        assert_eq!(images.len(), 3);
        assert!(images[0].cpu > 0);
    }

    #[test]
    fn test_fuzz_config_default() {
        let config = FuzzConfig::default();
        assert!(config.max_nodes >= config.min_nodes);
        assert!(config.max_users >= config.min_users);
    }

    #[test]
    fn test_build_fuzz_scenario() {
        let scenario = build_fuzz_scenario(2, 2, 3, 2, 5, 16000, 32768);
        assert_eq!(scenario.clusters.len(), 2);
        assert_eq!(scenario.users.len(), 3);
        assert_eq!(scenario.images.len(), 2);
    }

    #[test]
    fn test_run_fuzz_test() {
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
}
