//! Simulator Test Harness
//!
//! This module provides the test orchestration harness that runs simulations
//! using the scheduler's allocation logic with mocked dependencies.

use chrono::{DateTime, Duration, Utc};
use hashbrown::HashMap as HBHashMap;
use std::collections::{BTreeMap, HashMap, HashSet};
use thorium::conf::SpawnSlots;
use thorium::models::{
    Deadline, Image, ImageScaler, Pools, ScalerStats, SystemSettings, SystemStats,
};
use thorium::Conf;

use super::assertions::{verify_expectations, AssertionResult, Expectation};
use super::generators::ImageGenerator;
use super::scenario::{ClusterConfig, Scenario, ScheduledEvent};
use crate::libs::schedulers::{
    Allocatable, AllocatableUpdate, NodeAllocatableUpdate, NodeResources,
};
use crate::{DryRun, DryRunNode};

/// A recorded scheduling decision
#[derive(Debug, Clone)]
pub enum SchedulingDecision {
    /// A worker was spawned
    Spawn(SpawnDecision),
    /// A worker was preempted (scaled down)
    Preempt(PreemptDecision),
}

/// Details of a spawn decision
#[derive(Debug, Clone)]
pub struct SpawnDecision {
    /// User the worker is for
    pub user: String,
    /// Group the worker is in
    pub group: String,
    /// Pipeline the worker is for
    pub pipeline: String,
    /// Stage/image the worker runs
    pub stage: String,
    /// Cluster the worker was placed on
    pub cluster: String,
    /// Node the worker was placed on
    pub node: String,
    /// Pool the worker was spawned in
    pub pool: Pools,
    /// Time of the decision
    pub timestamp: DateTime<Utc>,
}

/// Details of a preemption decision
#[derive(Debug, Clone)]
pub struct PreemptDecision {
    /// User whose worker was preempted
    pub user: String,
    /// Group of the preempted worker
    pub group: String,
    /// Pipeline of the preempted worker
    pub pipeline: String,
    /// Stage/image of the preempted worker
    pub stage: String,
    /// Worker name
    pub name: String,
    /// Time of the decision
    pub timestamp: DateTime<Utc>,
}

/// Result of running a simulation
#[derive(Debug)]
pub struct SimulationResult {
    /// All scheduling decisions made during simulation
    pub decisions: Vec<SchedulingDecision>,
    /// Results of evaluating all expectations
    pub assertion_results: Vec<AssertionResult>,
    /// Total simulation time
    pub duration: Duration,
    /// Number of allocation cycles run
    pub cycles: usize,
    /// Whether any assertions failed
    pub has_failures: bool,
}

impl SimulationResult {
    /// Check if all assertions passed
    pub fn all_passed(&self) -> bool {
        !self.has_failures
    }

    /// Get all failures
    pub fn failures(&self) -> Vec<&AssertionResult> {
        self.assertion_results
            .iter()
            .filter(|r| !r.passed)
            .collect()
    }

    /// Get spawn decisions
    pub fn spawns(&self) -> Vec<&SpawnDecision> {
        self.decisions
            .iter()
            .filter_map(|d| {
                if let SchedulingDecision::Spawn(s) = d {
                    Some(s)
                } else {
                    None
                }
            })
            .collect()
    }

    /// Get preemption decisions
    pub fn preemptions(&self) -> Vec<&PreemptDecision> {
        self.decisions
            .iter()
            .filter_map(|d| {
                if let SchedulingDecision::Preempt(p) = d {
                    Some(p)
                } else {
                    None
                }
            })
            .collect()
    }
}

/// Mock cache that provides image and user data for simulation
pub struct MockCache {
    /// Images by group then name (using hashbrown for compatibility with allocatable)
    pub images: HBHashMap<String, HBHashMap<String, Image>>,
    /// Users by username (just the names and groups)
    pub users: HashMap<String, HashSet<String>>,
    /// Groups that exist
    pub groups: HashSet<String>,
    /// System settings
    pub settings: SystemSettings,
}

impl MockCache {
    /// Create from scenario
    pub fn from_scenario(scenario: &Scenario) -> Self {
        // Build images
        let images = ImageGenerator::new().from_scenario(scenario).build_map();

        // Build users (just username -> groups mapping)
        let mut users = HashMap::new();
        for user_config in &scenario.users {
            users.insert(user_config.username.clone(), user_config.groups.clone());
        }

        // Collect groups
        let groups: HashSet<String> = scenario
            .users
            .iter()
            .flat_map(|u| u.groups.iter().cloned())
            .collect();

        MockCache {
            images,
            users,
            groups,
            settings: SystemSettings::default(),
        }
    }

    /// Get an image by group and name
    pub fn get_image(&self, group: &str, name: &str) -> Option<&Image> {
        self.images.get(group).and_then(|m| m.get(name))
    }
}

/// The main simulator harness that orchestrates test execution
pub struct SimulatorHarness {
    /// Virtual time for deterministic testing
    time: DateTime<Utc>,
    /// The allocatable state under test
    allocatable: Allocatable,
    /// Mock cache with test data
    mock_cache: MockCache,
    /// Events to inject at specific times
    pending_events: BTreeMap<Duration, Vec<ScheduledEvent>>,
    /// Recorded decisions for assertions
    decisions: Vec<SchedulingDecision>,
    /// Current system stats
    stats: SystemStats,
    /// Current deadlines
    deadlines: Vec<Deadline>,
    /// Expectations to verify
    expectations: Vec<Expectation>,
    /// Start time for calculating offsets
    start_time: DateTime<Utc>,
    /// DryRun scheduler backend
    dry_run: HashMap<String, DryRun>,
}

impl SimulatorHarness {
    /// Create a harness from a scenario
    ///
    /// # Arguments
    /// * `scenario` - The scenario to simulate
    /// * `conf` - Thorium configuration (load from test config file)
    pub fn from_scenario_with_conf(scenario: &Scenario, conf: Conf) -> Self {
        let start_time = Utc::now();

        // Create mock cache
        let mock_cache = MockCache::from_scenario(scenario);

        // Create allocatable with initial state
        let allocatable = Self::create_allocatable(scenario, conf);

        // Create DryRun schedulers for each cluster
        let mut dry_run = HashMap::new();
        for cluster in &scenario.clusters {
            let dr = Self::create_dry_run(cluster);
            dry_run.insert(cluster.name.clone(), dr);
        }

        // Generate initial stats and deadlines from scenario
        let stats = scenario.initial_stats.clone().unwrap_or_else(|| {
            // Create empty SystemStats
            SystemStats {
                deadlines: 0,
                running: 0,
                users: 0,
                k8s: ScalerStats::new(0, 0),
                baremetal: ScalerStats::new(0, 0),
                external: ScalerStats::new(0, 0),
                groups: HashMap::new(),
            }
        });
        let deadlines = scenario.initial_deadlines.clone();

        SimulatorHarness {
            time: start_time,
            allocatable,
            mock_cache,
            pending_events: scenario.events.clone(),
            decisions: Vec::new(),
            stats,
            deadlines,
            expectations: scenario.expectations.clone(),
            start_time,
            dry_run,
        }
    }

    /// Create a harness from a scenario using a test config file
    ///
    /// This will attempt to load a test configuration from a standard location.
    /// For testing, you can create a minimal config file.
    pub fn from_scenario(scenario: &Scenario) -> Self {
        // Try to load config from standard test location, fall back to creating minimal harness
        let conf = Self::load_test_conf();
        Self::from_scenario_with_conf(scenario, conf)
    }

    /// Load a test configuration
    fn load_test_conf() -> Conf {
        // Try common test config paths
        let paths = [
            "tests/config.yml",
            "test_config.yml",
            "../tests/config.yml",
        ];

        for path in paths {
            if let Ok(conf) = Conf::new(path) {
                return conf;
            }
        }

        // If no config found, try to create from a temp file
        // For now, panic with helpful message
        panic!(
            "No test configuration found. Please create a test config file at one of: {:?}",
            paths
        );
    }

    /// Create an Allocatable from scenario configuration
    fn create_allocatable(scenario: &Scenario, conf: Conf) -> Allocatable {
        // Collect user ranks for initialization
        let user_ranks: Vec<(String, u64)> = scenario
            .users
            .iter()
            .map(|u| (u.username.clone(), u.initial_fair_share))
            .collect();

        // Create allocatable with the test constructor
        let mut allocatable = Allocatable::new_for_test_with_ranks(ImageScaler::K8s, user_ranks, conf);

        // Set up clusters
        for cluster_config in &scenario.clusters {
            let update = Self::cluster_config_to_update(cluster_config);
            allocatable.update(&cluster_config.name, update);
        }

        allocatable
    }

    /// Convert cluster config to allocatable update
    fn cluster_config_to_update(cluster: &ClusterConfig) -> AllocatableUpdate {
        let mut update = AllocatableUpdate::default();

        for node_config in &cluster.nodes {
            let node_update = NodeAllocatableUpdate::new(
                node_config.to_resources(),
                node_config.to_resources(),
            );
            update.nodes.insert(node_config.name.clone(), node_update);
        }

        update
    }

    /// Create a DryRun scheduler from cluster config
    fn create_dry_run(cluster: &ClusterConfig) -> DryRun {
        let mut nodes = HBHashMap::new();

        for node_config in &cluster.nodes {
            let mut resources = NodeResources::new(node_config.name.clone(), SpawnSlots::default());
            resources.available = node_config.to_resources();
            resources.total = node_config.to_resources();

            nodes.insert(
                node_config.name.clone(),
                DryRunNode::from_resources(node_config.name.clone(), resources),
            );
        }

        DryRun { nodes }
    }

    /// Run one allocation cycle
    pub fn step(&mut self) {
        // Use the testable allocation method with image map
        self.allocatable.allocate_with_image_map(
            &self.stats,
            self.deadlines.clone(),
            &self.mock_cache.images,
        );

        // Record spawn decisions from allocatable.changes
        self.record_decisions();
    }

    /// Record decisions from the current changes
    fn record_decisions(&mut self) {
        // Record spawns
        for (cluster, deadline_map) in &self.allocatable.changes.spawns {
            for (timestamp, spawns) in deadline_map {
                for spawn in spawns {
                    self.decisions.push(SchedulingDecision::Spawn(SpawnDecision {
                        user: spawn.req.user.clone(),
                        group: spawn.req.group.clone(),
                        pipeline: spawn.req.pipeline.clone(),
                        stage: spawn.req.stage.clone(),
                        cluster: cluster.clone(),
                        node: spawn.node.clone(),
                        pool: spawn.pool,
                        timestamp: self.time,
                    }));
                }
            }
        }

        // Record preemptions (scale downs)
        for (cluster, scale_downs) in &self.allocatable.changes.scale_down {
            for spawn in scale_downs {
                self.decisions
                    .push(SchedulingDecision::Preempt(PreemptDecision {
                        user: spawn.req.user.clone(),
                        group: spawn.req.group.clone(),
                        pipeline: spawn.req.pipeline.clone(),
                        stage: spawn.req.stage.clone(),
                        name: spawn.name.clone(),
                        timestamp: self.time,
                    }));
            }
        }
    }

    /// Advance virtual time and process events
    pub fn advance(&mut self, duration: Duration) {
        let target = self.time + duration;

        // Process any events that should occur before target time
        let elapsed = self.time - self.start_time;
        let target_elapsed = target - self.start_time;

        // Collect events to process (those between elapsed and target_elapsed)
        let events_to_process: Vec<_> = self
            .pending_events
            .range(elapsed..=target_elapsed)
            .flat_map(|(_, events)| events.clone())
            .collect();

        // Process events
        for event in events_to_process {
            self.process_event(event);
        }

        // Remove processed events
        self.pending_events = self
            .pending_events
            .clone()
            .into_iter()
            .filter(|(time, _)| *time > target_elapsed)
            .collect();

        // Update time
        self.time = target;
    }

    /// Process a scheduled event
    fn process_event(&mut self, event: ScheduledEvent) {
        match event {
            ScheduledEvent::AddDemand {
                user,
                group,
                pipeline,
                stage,
                count,
            } => {
                // Update stats to reflect new demand
                // This would normally update the SystemStats structure
                // For simulation, we'll add to a tracking structure
            }
            ScheduledEvent::AddDeadline {
                user,
                group,
                pipeline,
                stage,
                deadline,
                job_id,
                reaction,
            } => {
                self.deadlines.push(Deadline {
                    creator: user,
                    group,
                    pipeline,
                    stage,
                    deadline,
                    job_id,
                    reaction,
                });
            }
            ScheduledEvent::SetFairShareRank { user, rank } => {
                // Remove user from current rank
                for (_, users) in &mut self.allocatable.fair_share {
                    users.remove(&user);
                }
                // Add to new rank
                let rank_set = self
                    .allocatable
                    .fair_share
                    .entry(rank)
                    .or_insert_with(HashSet::new);
                rank_set.insert(user);
            }
            ScheduledEvent::NodeUnavailable { cluster, node } => {
                // Mark node as unavailable in dry run
                if let Some(dr) = self.dry_run.get_mut(&cluster) {
                    if let Some(n) = dr.nodes.get_mut(&node) {
                        n.set_health(thorium::models::NodeHealth::Unhealthy);
                    }
                }
            }
            ScheduledEvent::NodeAvailable { cluster, node } => {
                // Mark node as available in dry run
                if let Some(dr) = self.dry_run.get_mut(&cluster) {
                    if let Some(n) = dr.nodes.get_mut(&node) {
                        n.set_health(thorium::models::NodeHealth::Healthy);
                    }
                }
            }
            ScheduledEvent::CompleteWorker { name } => {
                // Find and remove worker, releasing resources
                for dr in self.dry_run.values_mut() {
                    for node in dr.nodes.values_mut() {
                        node.workers.retain(|w| w.name != name);
                    }
                }
            }
        }
    }

    /// Run the full simulation
    pub fn run(&mut self) -> SimulationResult {
        let max_duration = Duration::hours(1); // Default max
        let time_step = Duration::seconds(1); // Default step
        let mut cycles = 0;

        // Run until max duration or no more events
        while self.time - self.start_time < max_duration {
            // Run allocation cycle
            self.step();
            cycles += 1;

            // Advance time
            self.advance(time_step);

            // Check if we should stop (no more events and no pending work)
            if self.pending_events.is_empty() && self.deadlines.is_empty() {
                break;
            }
        }

        // Verify expectations
        let assertion_results = verify_expectations(&self.expectations, &self.decisions);
        let has_failures = assertion_results.iter().any(|r| !r.passed);

        SimulationResult {
            decisions: self.decisions.clone(),
            assertion_results,
            duration: self.time - self.start_time,
            cycles,
            has_failures,
        }
    }

    /// Run a single allocation cycle with custom stats and deadlines
    pub fn step_with_data(&mut self, stats: &SystemStats, deadlines: Vec<Deadline>) {
        self.stats = stats.clone();
        self.deadlines = deadlines;
        self.step();
    }

    /// Get current decisions
    pub fn decisions(&self) -> &[SchedulingDecision] {
        &self.decisions
    }

    /// Get current time
    pub fn current_time(&self) -> DateTime<Utc> {
        self.time
    }

    /// Get the allocatable state (for inspection)
    pub fn allocatable(&self) -> &Allocatable {
        &self.allocatable
    }

    /// Get mutable allocatable state (for manual manipulation)
    pub fn allocatable_mut(&mut self) -> &mut Allocatable {
        &mut self.allocatable
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::simulator::scenario::Scenario;

    #[test]
    fn test_harness_creation() {
        let mut builder = Scenario::builder("test");
        builder
            .simple_cluster("test-cluster", "node-1", 8000, 16384)
            .simple_user("test-user", "test-group")
            .simple_image("test-group", "test-tool", 2000, 4096, 60.0);
        let scenario = builder.build();

        let harness = SimulatorHarness::from_scenario(&scenario);
        assert!(harness.decisions.is_empty());
        assert!(!harness.dry_run.is_empty());
    }

    #[test]
    fn test_simulation_result() {
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
        ];

        let result = SimulationResult {
            decisions,
            assertion_results: vec![],
            duration: Duration::seconds(10),
            cycles: 5,
            has_failures: false,
        };

        assert!(result.all_passed());
        assert_eq!(result.spawns().len(), 1);
        assert_eq!(result.preemptions().len(), 0);
    }
}
