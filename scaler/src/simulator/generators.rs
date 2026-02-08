//! Test Data Generators
//!
//! This module provides generators for creating realistic test data for simulation,
//! including system stats, deadlines, users, images, and cluster configurations.

use chrono::{DateTime, Duration, Utc};
use hashbrown::HashMap as HBHashMap;
use std::collections::{HashMap, HashSet};
use thorium::models::{
    Deadline, GroupStats, Image, ImageScaler, PipelineStats, Resources, ScalerStats, SpawnLimits,
    StageStats, SystemStats,
};
use uuid::Uuid;

use super::scenario::{ClusterConfig, ImageConfig, NodeConfig, Scenario, UserConfig};

/// Generator for creating SystemStats for testing
#[derive(Debug, Default)]
pub struct StatsGenerator {
    groups: HashMap<String, GroupStats>,
}

impl StatsGenerator {
    /// Create a new stats generator
    pub fn new() -> Self {
        StatsGenerator {
            groups: HashMap::new(),
        }
    }

    /// Add jobs for a user in a specific group/pipeline/stage
    ///
    /// # Arguments
    /// * `user` - The username
    /// * `group` - The group name
    /// * `pipeline` - The pipeline name
    /// * `stage` - The stage/image name
    /// * `running` - Number of running jobs
    /// * `created` - Number of created (pending) jobs
    pub fn add_user_jobs(
        mut self,
        user: impl Into<String>,
        group: impl Into<String>,
        pipeline: impl Into<String>,
        stage: impl Into<String>,
        running: u64,
        created: u64,
    ) -> Self {
        let group = group.into();
        let pipeline = pipeline.into();
        let stage = stage.into();
        let user = user.into();

        // Get or create group stats
        let group_stats = self.groups.entry(group.clone()).or_insert_with(|| GroupStats {
            pipelines: HashMap::new(),
        });

        // Get or create pipeline stats
        let pipeline_stats = group_stats
            .pipelines
            .entry(pipeline)
            .or_insert_with(|| PipelineStats {
                stages: HashMap::new(),
            });

        // Get or create stage stats map
        let stage_map = pipeline_stats
            .stages
            .entry(stage)
            .or_insert_with(HashMap::new);

        // Add or update user stats
        stage_map.insert(
            user,
            StageStats {
                created,
                running,
                completed: 0,
                failed: 0,
                sleeping: 0,
                total: created + running,
            },
        );

        self
    }

    /// Convenience method to add jobs with running=0 and specified created count
    pub fn add_pending_jobs(
        self,
        user: impl Into<String>,
        group: impl Into<String>,
        pipeline: impl Into<String>,
        stage: impl Into<String>,
        count: u64,
    ) -> Self {
        self.add_user_jobs(user, group, pipeline, stage, 0, count)
    }

    /// Build the SystemStats
    pub fn build(self) -> SystemStats {
        // Calculate totals
        let mut total_deadlines = 0i64;
        let mut total_running = 0i64;

        for group_stats in self.groups.values() {
            for pipeline_stats in group_stats.pipelines.values() {
                for stage_map in pipeline_stats.stages.values() {
                    for stage_stats in stage_map.values() {
                        total_running += stage_stats.running as i64;
                        total_deadlines += stage_stats.created as i64;
                    }
                }
            }
        }

        SystemStats {
            deadlines: total_deadlines,
            running: total_running,
            users: 0, // Not used in allocation
            k8s: ScalerStats::new(total_deadlines, total_running),
            baremetal: ScalerStats::new(0, 0),
            external: ScalerStats::new(0, 0),
            groups: self.groups,
        }
    }
}

/// Generator for creating deadlines for testing
#[derive(Debug, Default)]
pub struct DeadlineGenerator {
    deadlines: Vec<Deadline>,
}

impl DeadlineGenerator {
    /// Create a new deadline generator
    pub fn new() -> Self {
        DeadlineGenerator {
            deadlines: Vec::new(),
        }
    }

    /// Add a deadline
    pub fn add(
        mut self,
        user: impl Into<String>,
        group: impl Into<String>,
        pipeline: impl Into<String>,
        stage: impl Into<String>,
        deadline: DateTime<Utc>,
    ) -> Self {
        self.deadlines.push(Deadline {
            creator: user.into(),
            group: group.into(),
            pipeline: pipeline.into(),
            stage: stage.into(),
            deadline,
            job_id: Uuid::new_v4(),
            reaction: Uuid::new_v4(),
        });
        self
    }

    /// Add a deadline relative to now
    pub fn add_relative(
        self,
        user: impl Into<String>,
        group: impl Into<String>,
        pipeline: impl Into<String>,
        stage: impl Into<String>,
        from_now: Duration,
    ) -> Self {
        let deadline = Utc::now() + from_now;
        self.add(user, group, pipeline, stage, deadline)
    }

    /// Add an urgent deadline (in 1 minute)
    pub fn add_urgent(
        self,
        user: impl Into<String>,
        group: impl Into<String>,
        pipeline: impl Into<String>,
        stage: impl Into<String>,
    ) -> Self {
        self.add_relative(user, group, pipeline, stage, Duration::minutes(1))
    }

    /// Build the deadline list
    pub fn build(self) -> Vec<Deadline> {
        self.deadlines
    }
}

/// Generator for creating Image configurations
#[derive(Debug)]
pub struct ImageGenerator {
    images: Vec<Image>,
}

impl Default for ImageGenerator {
    fn default() -> Self {
        Self::new()
    }
}

impl ImageGenerator {
    /// Create a new image generator
    pub fn new() -> Self {
        ImageGenerator { images: Vec::new() }
    }

    /// Add an image from ImageConfig
    pub fn from_config(mut self, config: &ImageConfig) -> Self {
        self.images.push(Self::config_to_image(config));
        self
    }

    /// Add images from all ImageConfigs in a scenario
    pub fn from_scenario(mut self, scenario: &Scenario) -> Self {
        for config in &scenario.images {
            self.images.push(Self::config_to_image(config));
        }
        self
    }

    /// Add a custom image
    pub fn add(
        mut self,
        group: impl Into<String>,
        name: impl Into<String>,
        resources: Resources,
        runtime: f64,
    ) -> Self {
        let name = name.into();
        self.images.push(Image {
            group: group.into(),
            name: name.clone(),
            creator: "system".to_string(),
            version: None,
            scaler: ImageScaler::K8s,
            image: Some(format!("thorium/{}", name)),
            lifetime: None,
            timeout: Some(3600),
            resources,
            spawn_limit: SpawnLimits::Unlimited,
            env: HashMap::new(),
            runtime,
            volumes: Vec::new(),
            args: Default::default(),
            modifiers: None,
            description: None,
            security_context: Default::default(),
            used_by: Vec::new(),
            collect_logs: false,
            generator: false,
            dependencies: Default::default(),
            display_type: Default::default(),
            output_collection: Default::default(),
            child_filters: Default::default(),
            clean_up: None,
            kvm: None,
            bans: HashMap::new(),
            network_policies: HashSet::new(),
        });
        self
    }

    /// Add a simple image with default resources
    pub fn add_simple(
        self,
        group: impl Into<String>,
        name: impl Into<String>,
        cpu: u64,
        memory: u64,
        runtime: f64,
    ) -> Self {
        self.add(group, name, Resources::new(cpu, memory, 0, 1), runtime)
    }

    /// Convert ImageConfig to Image
    fn config_to_image(config: &ImageConfig) -> Image {
        Image {
            group: config.group.clone(),
            name: config.name.clone(),
            creator: "system".to_string(),
            version: None,
            scaler: ImageScaler::K8s,
            image: Some(format!("thorium/{}", config.name)),
            lifetime: None,
            timeout: Some(3600),
            resources: config.to_resources(),
            spawn_limit: match config.spawn_limit {
                Some(limit) => SpawnLimits::Basic(limit),
                None => SpawnLimits::Unlimited,
            },
            env: HashMap::new(),
            runtime: config.runtime,
            volumes: Vec::new(),
            args: Default::default(),
            modifiers: None,
            description: None,
            security_context: Default::default(),
            used_by: Vec::new(),
            collect_logs: false,
            generator: false,
            dependencies: Default::default(),
            display_type: Default::default(),
            output_collection: Default::default(),
            child_filters: Default::default(),
            clean_up: None,
            kvm: None,
            bans: HashMap::new(),
            network_policies: HashSet::new(),
        }
    }

    /// Build the image list
    pub fn build(self) -> Vec<Image> {
        self.images
    }

    /// Build a map by group then name (using hashbrown HashMap for allocatable compatibility)
    pub fn build_map(self) -> HBHashMap<String, HBHashMap<String, Image>> {
        let mut map: HBHashMap<String, HBHashMap<String, Image>> = HBHashMap::new();
        for image in self.images {
            let group_map = map.entry(image.group.clone()).or_insert_with(HBHashMap::new);
            group_map.insert(image.name.clone(), image);
        }
        map
    }
}

/// Generator for creating user configurations
#[derive(Debug, Default)]
pub struct UserGenerator {
    users: Vec<(String, HashSet<String>)>,
}

impl UserGenerator {
    /// Create a new user generator
    pub fn new() -> Self {
        UserGenerator { users: Vec::new() }
    }

    /// Add a user
    pub fn add(mut self, username: impl Into<String>, groups: Vec<String>) -> Self {
        self.users
            .push((username.into(), groups.into_iter().collect()));
        self
    }

    /// Add users from scenario
    pub fn from_scenario(mut self, scenario: &Scenario) -> Self {
        for config in &scenario.users {
            self.users
                .push((config.username.clone(), config.groups.clone()));
        }
        self
    }

    /// Build a map of username to groups
    pub fn build(self) -> HashMap<String, HashSet<String>> {
        self.users.into_iter().collect()
    }
}

/// Generator for creating cluster configurations
#[derive(Debug, Default)]
pub struct ClusterGenerator {
    clusters: Vec<ClusterConfig>,
}

impl ClusterGenerator {
    /// Create a new cluster generator
    pub fn new() -> Self {
        ClusterGenerator {
            clusters: Vec::new(),
        }
    }

    /// Add a simple single-node cluster
    pub fn add_simple(mut self, name: impl Into<String>, cpu: u64, memory: u64) -> Self {
        let name = name.into();
        self.clusters.push(ClusterConfig {
            name: name.clone(),
            nodes: vec![NodeConfig {
                name: format!("{}-node-0", name),
                cpu,
                memory,
                ephemeral_storage: 131_072,
                worker_slots: 100,
            }],
        });
        self
    }

    /// Add a multi-node cluster
    pub fn add_multi_node(
        mut self,
        name: impl Into<String>,
        node_count: usize,
        cpu_per_node: u64,
        memory_per_node: u64,
    ) -> Self {
        let name = name.into();
        let nodes = (0..node_count)
            .map(|i| NodeConfig {
                name: format!("{}-node-{}", name, i),
                cpu: cpu_per_node,
                memory: memory_per_node,
                ephemeral_storage: 131_072,
                worker_slots: 100,
            })
            .collect();
        self.clusters.push(ClusterConfig {
            name,
            nodes,
        });
        self
    }

    /// Add clusters from scenario
    pub fn from_scenario(mut self, scenario: &Scenario) -> Self {
        self.clusters.extend(scenario.clusters.clone());
        self
    }

    /// Build the cluster list
    pub fn build(self) -> Vec<ClusterConfig> {
        self.clusters
    }
}

/// Generate a complete scenario from parts
pub fn generate_scenario_data(
    scenario: &Scenario,
) -> (
    SystemStats,
    Vec<Deadline>,
    HBHashMap<String, HBHashMap<String, Image>>,
) {
    // Generate stats from events
    let mut stats_gen = StatsGenerator::new();
    for (_, events) in &scenario.events {
        for event in events {
            if let super::scenario::ScheduledEvent::AddDemand {
                user,
                group,
                pipeline,
                stage,
                count,
            } = event
            {
                stats_gen = stats_gen.add_pending_jobs(user, group, pipeline, stage, *count);
            }
        }
    }

    // Use initial stats if provided, otherwise generate from events
    let stats = scenario
        .initial_stats
        .clone()
        .unwrap_or_else(|| stats_gen.build());

    // Generate deadlines from events
    let mut deadline_gen = DeadlineGenerator::new();
    for (_, events) in &scenario.events {
        for event in events {
            if let super::scenario::ScheduledEvent::AddDeadline {
                user,
                group,
                pipeline,
                stage,
                deadline,
                job_id,
                reaction,
            } = event
            {
                deadline_gen.deadlines.push(Deadline {
                    creator: user.clone(),
                    group: group.clone(),
                    pipeline: pipeline.clone(),
                    stage: stage.clone(),
                    deadline: *deadline,
                    job_id: *job_id,
                    reaction: *reaction,
                });
            }
        }
    }

    // Use initial deadlines if provided, otherwise generate from events
    let deadlines = if scenario.initial_deadlines.is_empty() {
        deadline_gen.build()
    } else {
        scenario.initial_deadlines.clone()
    };

    // Generate images
    let images = ImageGenerator::new().from_scenario(scenario).build_map();

    (stats, deadlines, images)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stats_generator() {
        let stats = StatsGenerator::new()
            .add_user_jobs("user1", "group1", "pipeline1", "tool1", 2, 5)
            .add_user_jobs("user2", "group1", "pipeline1", "tool1", 1, 3)
            .build();

        assert_eq!(stats.running, 3);
        assert_eq!(stats.deadlines, 8);
        assert!(stats.groups.contains_key("group1"));
    }

    #[test]
    fn test_deadline_generator() {
        let deadlines = DeadlineGenerator::new()
            .add_relative("user1", "group1", "pipe1", "tool1", Duration::minutes(5))
            .add_urgent("user2", "group1", "pipe1", "tool2")
            .build();

        assert_eq!(deadlines.len(), 2);
        assert!(deadlines[0].deadline > Utc::now());
    }

    #[test]
    fn test_image_generator() {
        let images = ImageGenerator::new()
            .add_simple("group1", "tool1", 1000, 4096, 60.0)
            .add_simple("group1", "tool2", 2000, 8192, 120.0)
            .build_map();

        assert!(images.contains_key("group1"));
        assert_eq!(images["group1"].len(), 2);
        assert_eq!(images["group1"]["tool1"].resources.cpu, 1000);
    }

    #[test]
    fn test_cluster_generator() {
        let clusters = ClusterGenerator::new()
            .add_simple("cluster1", 32000, 65536)
            .add_multi_node("cluster2", 3, 16000, 32768)
            .build();

        assert_eq!(clusters.len(), 2);
        assert_eq!(clusters[0].nodes.len(), 1);
        assert_eq!(clusters[1].nodes.len(), 3);
    }
}
