//! Scenario Definition and Builder DSL
//!
//! This module provides types and a fluent builder pattern for defining test scenarios
//! for the scheduler simulator.

use chrono::{DateTime, Duration, Utc};
use hashbrown::HashMap;
use std::collections::{BTreeMap, HashSet};
use thorium::models::{Deadline, Resources, SystemStats};
use uuid::Uuid;

use super::assertions::Expectation;

/// Configuration for a single node in a cluster
#[derive(Debug, Clone)]
pub struct NodeConfig {
    /// The name of this node
    pub name: String,
    /// CPU resources in millicpu
    pub cpu: u64,
    /// Memory resources in MiB
    pub memory: u64,
    /// Ephemeral storage in MiB
    pub ephemeral_storage: u64,
    /// Number of worker slots
    pub worker_slots: u64,
}

impl NodeConfig {
    /// Create a new node configuration with default resources
    pub fn new(name: impl Into<String>) -> Self {
        NodeConfig {
            name: name.into(),
            cpu: 32000,        // 32 cores
            memory: 65536,     // 64 GiB
            ephemeral_storage: 131_072, // 128 GiB
            worker_slots: 100,
        }
    }

    /// Convert to Resources
    pub fn to_resources(&self) -> Resources {
        Resources::new(self.cpu, self.memory, self.ephemeral_storage, self.worker_slots)
    }
}

/// Builder for node configuration
#[derive(Debug)]
pub struct NodeConfigBuilder<'a> {
    config: NodeConfig,
    cluster_builder: &'a mut ClusterConfigBuilder,
}

impl<'a> NodeConfigBuilder<'a> {
    /// Set CPU resources in millicpu
    pub fn cpu(mut self, millicpu: u64) -> Self {
        self.config.cpu = millicpu;
        self
    }

    /// Set memory resources in MiB
    pub fn memory(mut self, mebibytes: u64) -> Self {
        self.config.memory = mebibytes;
        self
    }

    /// Set ephemeral storage in MiB
    pub fn storage(mut self, mebibytes: u64) -> Self {
        self.config.ephemeral_storage = mebibytes;
        self
    }

    /// Set number of worker slots
    pub fn worker_slots(mut self, slots: u64) -> Self {
        self.config.worker_slots = slots;
        self
    }

    /// Finish configuring this node and return to cluster builder
    pub fn done(self) -> &'a mut ClusterConfigBuilder {
        self.cluster_builder.nodes.push(self.config);
        self.cluster_builder
    }
}

/// Configuration for a cluster
#[derive(Debug, Clone)]
pub struct ClusterConfig {
    /// The name of this cluster
    pub name: String,
    /// The nodes in this cluster
    pub nodes: Vec<NodeConfig>,
}

impl ClusterConfig {
    /// Create a new cluster configuration
    pub fn new(name: impl Into<String>) -> Self {
        ClusterConfig {
            name: name.into(),
            nodes: Vec::new(),
        }
    }
}

/// Builder for cluster configuration
#[derive(Debug)]
pub struct ClusterConfigBuilder {
    name: String,
    nodes: Vec<NodeConfig>,
}

impl ClusterConfigBuilder {
    fn new(name: impl Into<String>) -> Self {
        ClusterConfigBuilder {
            name: name.into(),
            nodes: Vec::new(),
        }
    }

    /// Add a node to this cluster
    pub fn node(&mut self, name: impl Into<String>) -> NodeConfigBuilder<'_> {
        NodeConfigBuilder {
            config: NodeConfig::new(name),
            cluster_builder: self,
        }
    }

    /// Finish configuring this cluster
    fn build(self) -> ClusterConfig {
        ClusterConfig {
            name: self.name,
            nodes: self.nodes,
        }
    }
}

/// Configuration for a user
#[derive(Debug, Clone)]
pub struct UserConfig {
    /// The username
    pub username: String,
    /// Groups this user belongs to
    pub groups: HashSet<String>,
    /// Initial fair share rank (0 = highest priority)
    pub initial_fair_share: u64,
}

impl UserConfig {
    /// Create a new user configuration
    pub fn new(username: impl Into<String>) -> Self {
        UserConfig {
            username: username.into(),
            groups: HashSet::new(),
            initial_fair_share: 0,
        }
    }
}

/// Builder for user configuration
#[derive(Debug)]
pub struct UserConfigBuilder<'a> {
    config: UserConfig,
    scenario_builder: &'a mut ScenarioBuilder,
}

impl<'a> UserConfigBuilder<'a> {
    /// Add this user to a group
    pub fn in_group(mut self, group: impl Into<String>) -> Self {
        self.config.groups.insert(group.into());
        self
    }

    /// Set the initial fair share rank
    pub fn initial_fair_share(mut self, rank: u64) -> Self {
        self.config.initial_fair_share = rank;
        self
    }

    /// Finish configuring this user and return to scenario builder
    pub fn done(self) -> &'a mut ScenarioBuilder {
        self.scenario_builder.users.push(self.config);
        self.scenario_builder
    }
}

/// Configuration for an image/tool
#[derive(Debug, Clone)]
pub struct ImageConfig {
    /// The group this image belongs to
    pub group: String,
    /// The name of this image
    pub name: String,
    /// CPU resources required in millicpu
    pub cpu: u64,
    /// Memory resources required in MiB
    pub memory: u64,
    /// Ephemeral storage required in MiB
    pub ephemeral_storage: u64,
    /// Expected runtime in seconds
    pub runtime: f64,
    /// Spawn limit (None = unlimited)
    pub spawn_limit: Option<u64>,
}

impl ImageConfig {
    /// Create a new image configuration with defaults
    pub fn new(group: impl Into<String>, name: impl Into<String>) -> Self {
        ImageConfig {
            group: group.into(),
            name: name.into(),
            cpu: 1000,      // 1 core
            memory: 4096,   // 4 GiB
            ephemeral_storage: 0,
            runtime: 60.0,  // 1 minute
            spawn_limit: None,
        }
    }

    /// Convert to Resources
    pub fn to_resources(&self) -> Resources {
        Resources::new(self.cpu, self.memory, self.ephemeral_storage, 1)
    }
}

/// Builder for image configuration
#[derive(Debug)]
pub struct ImageConfigBuilder<'a> {
    config: ImageConfig,
    scenario_builder: &'a mut ScenarioBuilder,
}

impl<'a> ImageConfigBuilder<'a> {
    /// Set CPU resources in millicpu
    pub fn cpu(mut self, millicpu: u64) -> Self {
        self.config.cpu = millicpu;
        self
    }

    /// Set memory resources in MiB
    pub fn memory(mut self, mebibytes: u64) -> Self {
        self.config.memory = mebibytes;
        self
    }

    /// Set ephemeral storage in MiB
    pub fn storage(mut self, mebibytes: u64) -> Self {
        self.config.ephemeral_storage = mebibytes;
        self
    }

    /// Set expected runtime in seconds
    pub fn runtime(mut self, seconds: f64) -> Self {
        self.config.runtime = seconds;
        self
    }

    /// Set spawn limit
    pub fn spawn_limit(mut self, limit: u64) -> Self {
        self.config.spawn_limit = Some(limit);
        self
    }

    /// Finish configuring this image and return to scenario builder
    pub fn done(self) -> &'a mut ScenarioBuilder {
        self.scenario_builder.images.push(self.config);
        self.scenario_builder
    }
}

/// Events that can be scheduled to occur at specific times during simulation
#[derive(Debug, Clone)]
pub enum ScheduledEvent {
    /// Add demand for fair share scheduling
    AddDemand {
        user: String,
        group: String,
        pipeline: String,
        stage: String,
        count: u64,
    },
    /// Add a deadline
    AddDeadline {
        user: String,
        group: String,
        pipeline: String,
        stage: String,
        deadline: DateTime<Utc>,
        job_id: Uuid,
        reaction: Uuid,
    },
    /// Change a user's fair share rank
    SetFairShareRank { user: String, rank: u64 },
    /// Simulate a node becoming unavailable
    NodeUnavailable { cluster: String, node: String },
    /// Simulate a node becoming available
    NodeAvailable { cluster: String, node: String },
    /// Complete a worker (freeing resources)
    CompleteWorker { name: String },
}

/// Builder for scheduling events at a specific time
#[derive(Debug)]
pub struct EventScheduleBuilder<'a> {
    time: Duration,
    scenario_builder: &'a mut ScenarioBuilder,
}

impl<'a> EventScheduleBuilder<'a> {
    /// Add demand for a specific user/image combination
    pub fn add_demand(
        mut self,
        user: impl Into<String>,
        group: impl Into<String>,
        stage: impl Into<String>,
        count: u64,
    ) -> Self {
        let event = ScheduledEvent::AddDemand {
            user: user.into(),
            group: group.into(),
            pipeline: "default".to_string(),
            stage: stage.into(),
            count,
        };
        self.scenario_builder.add_event(self.time, event);
        self
    }

    /// Add a deadline for a job
    pub fn add_deadline(
        mut self,
        user: impl Into<String>,
        group: impl Into<String>,
        stage: impl Into<String>,
    ) -> DeadlineEventBuilder<'a> {
        DeadlineEventBuilder {
            user: user.into(),
            group: group.into(),
            pipeline: "default".to_string(),
            stage: stage.into(),
            event_time: self.time,
            scenario_builder: self.scenario_builder,
        }
    }

    /// Set a user's fair share rank
    pub fn set_fair_share(mut self, user: impl Into<String>, rank: u64) -> Self {
        let event = ScheduledEvent::SetFairShareRank {
            user: user.into(),
            rank,
        };
        self.scenario_builder.add_event(self.time, event);
        self
    }

    /// Mark a node as unavailable
    pub fn node_unavailable(
        mut self,
        cluster: impl Into<String>,
        node: impl Into<String>,
    ) -> Self {
        let event = ScheduledEvent::NodeUnavailable {
            cluster: cluster.into(),
            node: node.into(),
        };
        self.scenario_builder.add_event(self.time, event);
        self
    }

    /// Mark a node as available
    pub fn node_available(mut self, cluster: impl Into<String>, node: impl Into<String>) -> Self {
        let event = ScheduledEvent::NodeAvailable {
            cluster: cluster.into(),
            node: node.into(),
        };
        self.scenario_builder.add_event(self.time, event);
        self
    }

    /// Complete a worker, freeing its resources
    pub fn complete_worker(mut self, name: impl Into<String>) -> Self {
        let event = ScheduledEvent::CompleteWorker { name: name.into() };
        self.scenario_builder.add_event(self.time, event);
        self
    }

    /// Finish scheduling events at this time and return to scenario builder
    pub fn done(self) -> &'a mut ScenarioBuilder {
        self.scenario_builder
    }
}

/// Builder for deadline events
#[derive(Debug)]
pub struct DeadlineEventBuilder<'a> {
    user: String,
    group: String,
    pipeline: String,
    stage: String,
    event_time: Duration,
    scenario_builder: &'a mut ScenarioBuilder,
}

impl<'a> DeadlineEventBuilder<'a> {
    /// Set the pipeline for this deadline
    pub fn pipeline(mut self, pipeline: impl Into<String>) -> Self {
        self.pipeline = pipeline.into();
        self
    }

    /// Set deadline relative to current simulation time
    pub fn deadline_in(self, duration: Duration) -> EventScheduleBuilder<'a> {
        let event = ScheduledEvent::AddDeadline {
            user: self.user,
            group: self.group,
            pipeline: self.pipeline,
            stage: self.stage,
            deadline: Utc::now() + self.event_time + duration,
            job_id: Uuid::new_v4(),
            reaction: Uuid::new_v4(),
        };
        self.scenario_builder.add_event(self.event_time, event);
        EventScheduleBuilder {
            time: self.event_time,
            scenario_builder: self.scenario_builder,
        }
    }

    /// Set an absolute deadline
    pub fn deadline_at(self, deadline: DateTime<Utc>) -> EventScheduleBuilder<'a> {
        let event = ScheduledEvent::AddDeadline {
            user: self.user,
            group: self.group,
            pipeline: self.pipeline,
            stage: self.stage,
            deadline,
            job_id: Uuid::new_v4(),
            reaction: Uuid::new_v4(),
        };
        self.scenario_builder.add_event(self.event_time, event);
        EventScheduleBuilder {
            time: self.event_time,
            scenario_builder: self.scenario_builder,
        }
    }
}

/// A complete test scenario
#[derive(Debug, Clone)]
pub struct Scenario {
    /// Name of this scenario for identification
    pub name: String,
    /// Cluster configurations
    pub clusters: Vec<ClusterConfig>,
    /// User configurations
    pub users: Vec<UserConfig>,
    /// Image configurations
    pub images: Vec<ImageConfig>,
    /// Events scheduled to occur at specific times (relative to start)
    pub events: BTreeMap<Duration, Vec<ScheduledEvent>>,
    /// Initial system stats (if provided)
    pub initial_stats: Option<SystemStats>,
    /// Initial deadlines (if provided)
    pub initial_deadlines: Vec<Deadline>,
    /// Expected outcomes to verify
    pub expectations: Vec<Expectation>,
    /// Maximum simulation duration
    pub max_duration: Duration,
    /// Time step for simulation advancement
    pub time_step: Duration,
}

impl Scenario {
    /// Create a new scenario builder
    pub fn builder(name: impl Into<String>) -> ScenarioBuilder {
        ScenarioBuilder::new(name)
    }
}

/// Builder for creating test scenarios
#[derive(Debug)]
pub struct ScenarioBuilder {
    name: String,
    clusters: Vec<ClusterConfig>,
    users: Vec<UserConfig>,
    images: Vec<ImageConfig>,
    events: BTreeMap<Duration, Vec<ScheduledEvent>>,
    initial_stats: Option<SystemStats>,
    initial_deadlines: Vec<Deadline>,
    expectations: Vec<Expectation>,
    max_duration: Duration,
    time_step: Duration,
    current_cluster_builder: Option<ClusterConfigBuilder>,
}

impl ScenarioBuilder {
    /// Create a new scenario builder
    pub fn new(name: impl Into<String>) -> Self {
        ScenarioBuilder {
            name: name.into(),
            clusters: Vec::new(),
            users: Vec::new(),
            images: Vec::new(),
            events: BTreeMap::new(),
            initial_stats: None,
            initial_deadlines: Vec::new(),
            expectations: Vec::new(),
            max_duration: Duration::hours(1),
            time_step: Duration::seconds(1),
            current_cluster_builder: None,
        }
    }

    /// Start configuring a cluster
    pub fn cluster(&mut self, name: impl Into<String>) -> ClusterBuilderRef<'_> {
        self.current_cluster_builder = Some(ClusterConfigBuilder::new(name));
        ClusterBuilderRef { scenario: self }
    }

    /// Add a user
    pub fn user(&mut self, username: impl Into<String>) -> UserConfigBuilder<'_> {
        UserConfigBuilder {
            config: UserConfig::new(username),
            scenario_builder: self,
        }
    }

    /// Add an image
    pub fn image(
        &mut self,
        group: impl Into<String>,
        name: impl Into<String>,
    ) -> ImageConfigBuilder<'_> {
        ImageConfigBuilder {
            config: ImageConfig::new(group, name),
            scenario_builder: self,
        }
    }

    /// Schedule events at a specific time offset from start
    pub fn at(&mut self, offset: Duration) -> EventScheduleBuilder<'_> {
        EventScheduleBuilder {
            time: offset,
            scenario_builder: self,
        }
    }

    /// Set initial system stats
    pub fn stats(&mut self, stats: SystemStats) -> &mut Self {
        self.initial_stats = Some(stats);
        self
    }

    /// Add initial deadlines
    pub fn deadlines(&mut self, deadlines: Vec<Deadline>) -> &mut Self {
        self.initial_deadlines = deadlines;
        self
    }

    /// Set initial fair share rank for a user
    pub fn initial_fair_share(&mut self, user: impl Into<String>, rank: u64) -> &mut Self {
        let username = user.into();
        for u in &mut self.users {
            if u.username == username {
                u.initial_fair_share = rank;
                break;
            }
        }
        self
    }

    /// Add an expectation
    pub fn expect(&mut self) -> super::assertions::ExpectationBuilder<'_> {
        super::assertions::ExpectationBuilder::new(self)
    }

    /// Add an expectation directly
    pub fn add_expectation(&mut self, expectation: Expectation) {
        self.expectations.push(expectation);
    }

    /// Set the maximum simulation duration
    pub fn max_duration(&mut self, duration: Duration) -> &mut Self {
        self.max_duration = duration;
        self
    }

    /// Set the time step for simulation advancement
    pub fn time_step(&mut self, step: Duration) -> &mut Self {
        self.time_step = step;
        self
    }

    /// Add an event at a specific time
    fn add_event(&mut self, time: Duration, event: ScheduledEvent) {
        self.events.entry(time).or_insert_with(Vec::new).push(event);
    }

    /// Add a complete cluster configuration directly
    pub fn add_cluster(&mut self, config: ClusterConfig) -> &mut Self {
        self.clusters.push(config);
        self
    }

    /// Add a simple single-node cluster
    pub fn simple_cluster(
        &mut self,
        cluster_name: impl Into<String>,
        node_name: impl Into<String>,
        cpu: u64,
        memory: u64,
    ) -> &mut Self {
        self.clusters.push(ClusterConfig {
            name: cluster_name.into(),
            nodes: vec![NodeConfig {
                name: node_name.into(),
                cpu,
                memory,
                ephemeral_storage: 131_072,
                worker_slots: 100,
            }],
        });
        self
    }

    /// Add a complete user configuration directly
    pub fn add_user(&mut self, config: UserConfig) -> &mut Self {
        self.users.push(config);
        self
    }

    /// Add a simple user in one group
    pub fn simple_user(&mut self, username: impl Into<String>, group: impl Into<String>) -> &mut Self {
        let mut groups = HashSet::new();
        groups.insert(group.into());
        self.users.push(UserConfig {
            username: username.into(),
            groups,
            initial_fair_share: 0,
        });
        self
    }

    /// Add a complete image configuration directly
    pub fn add_image(&mut self, config: ImageConfig) -> &mut Self {
        self.images.push(config);
        self
    }

    /// Add a simple image
    pub fn simple_image(
        &mut self,
        group: impl Into<String>,
        name: impl Into<String>,
        cpu: u64,
        memory: u64,
        runtime: f64,
    ) -> &mut Self {
        self.images.push(ImageConfig {
            group: group.into(),
            name: name.into(),
            cpu,
            memory,
            ephemeral_storage: 0,
            runtime,
            spawn_limit: None,
        });
        self
    }

    /// Build the scenario
    pub fn build(mut self) -> Scenario {
        // If there's a cluster builder in progress, build it
        if let Some(builder) = self.current_cluster_builder.take() {
            self.clusters.push(builder.build());
        }

        Scenario {
            name: self.name,
            clusters: self.clusters,
            users: self.users,
            images: self.images,
            events: self.events,
            initial_stats: self.initial_stats,
            initial_deadlines: self.initial_deadlines,
            expectations: self.expectations,
            max_duration: self.max_duration,
            time_step: self.time_step,
        }
    }
}

/// Helper to access cluster builder through scenario builder
#[derive(Debug)]
pub struct ClusterBuilderRef<'a> {
    scenario: &'a mut ScenarioBuilder,
}

impl<'a> ClusterBuilderRef<'a> {
    /// Add a node to the cluster being built
    pub fn node(&mut self, name: impl Into<String>) -> ClusterNodeBuilder<'_, 'a> {
        ClusterNodeBuilder {
            config: NodeConfig::new(name),
            cluster_ref: self,
        }
    }

    /// Finish configuring this cluster and return to scenario builder
    pub fn done(self) -> &'a mut ScenarioBuilder {
        if let Some(builder) = self.scenario.current_cluster_builder.take() {
            self.scenario.clusters.push(builder.build());
        }
        self.scenario
    }
}

/// Builder for nodes within a cluster reference
#[derive(Debug)]
pub struct ClusterNodeBuilder<'a, 'b>
where
    'b: 'a,
{
    config: NodeConfig,
    cluster_ref: &'a mut ClusterBuilderRef<'b>,
}

impl<'a, 'b> ClusterNodeBuilder<'a, 'b>
where
    'b: 'a,
{
    /// Set CPU resources in millicpu
    pub fn cpu(mut self, millicpu: u64) -> Self {
        self.config.cpu = millicpu;
        self
    }

    /// Set memory resources in MiB
    pub fn memory(mut self, mebibytes: u64) -> Self {
        self.config.memory = mebibytes;
        self
    }

    /// Set ephemeral storage in MiB
    pub fn storage(mut self, mebibytes: u64) -> Self {
        self.config.ephemeral_storage = mebibytes;
        self
    }

    /// Set number of worker slots
    pub fn worker_slots(mut self, slots: u64) -> Self {
        self.config.worker_slots = slots;
        self
    }

    /// Finish configuring this node
    pub fn done(self) -> &'a mut ClusterBuilderRef<'b> {
        if let Some(ref mut builder) = self.cluster_ref.scenario.current_cluster_builder {
            builder.nodes.push(self.config);
        }
        self.cluster_ref
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scenario_builder_basic() {
        let mut builder = Scenario::builder("basic_test");

        builder
            .simple_cluster("test-cluster", "node-1", 8000, 16384)
            .simple_user("test-user", "test-group")
            .simple_image("test-group", "test-tool", 2000, 4096, 60.0);

        let scenario = builder.build();

        assert_eq!(scenario.name, "basic_test");
        assert_eq!(scenario.clusters.len(), 1);
        assert_eq!(scenario.clusters[0].nodes.len(), 1);
        assert_eq!(scenario.users.len(), 1);
        assert_eq!(scenario.images.len(), 1);
    }

    #[test]
    fn test_scenario_builder_events() {
        let mut builder = Scenario::builder("event_test");

        builder
            .simple_cluster("test", "node-1", 8000, 16384)
            .simple_user("user-1", "group-a")
            .simple_image("group-a", "tool", 2000, 4096, 60.0);

        builder
            .at(Duration::zero())
            .add_demand("user-1", "group-a", "tool", 2)
            .done();

        builder
            .at(Duration::seconds(10))
            .add_deadline("user-1", "group-a", "tool")
            .deadline_in(Duration::seconds(60))
            .done();

        let scenario = builder.build();

        assert_eq!(scenario.events.len(), 2);
        assert!(scenario.events.contains_key(&Duration::zero()));
        assert!(scenario.events.contains_key(&Duration::seconds(10)));
    }
}
