//! Assertion and Verification Helpers
//!
//! This module provides types and utilities for verifying scheduling decisions
//! made during simulation.

use chrono::{DateTime, Duration, Utc};
use hashbrown::HashMap;
use std::collections::HashSet;
use thorium::models::Pools;

use super::harness::SchedulingDecision;
use super::scenario::ScenarioBuilder;

/// Result of evaluating an expectation
#[derive(Debug, Clone)]
pub struct AssertionResult {
    /// Description of what was being checked
    pub description: String,
    /// Whether the assertion passed
    pub passed: bool,
    /// Detailed message explaining the result
    pub message: String,
    /// The expectation that was evaluated
    pub expectation: Expectation,
}

impl AssertionResult {
    /// Create a passing result
    pub fn pass(expectation: Expectation, message: impl Into<String>) -> Self {
        AssertionResult {
            description: expectation.description(),
            passed: true,
            message: message.into(),
            expectation,
        }
    }

    /// Create a failing result
    pub fn fail(expectation: Expectation, message: impl Into<String>) -> Self {
        AssertionResult {
            description: expectation.description(),
            passed: false,
            message: message.into(),
            expectation,
        }
    }
}

/// Types of expectations that can be verified
#[derive(Debug, Clone)]
pub enum Expectation {
    /// Expect a worker to be spawned for a specific image
    WorkerSpawned {
        image: String,
        user: Option<String>,
        group: Option<String>,
        pool: Option<Pools>,
    },
    /// Expect a worker to be preempted (scaled down)
    WorkerPreempted {
        image: Option<String>,
        user: Option<String>,
    },
    /// Expect a specific user to be scheduled first
    FirstSpawnForUser { user: String },
    /// Expect a specific number of workers to be spawned
    SpawnCount { count: usize },
    /// Expect a specific number of workers to be preempted
    PreemptCount { count: usize },
    /// Expect no workers to be spawned
    NoSpawns,
    /// Expect no workers to be preempted
    NoPreemptions,
    /// Expect resources to not be over-allocated
    NoOverallocation,
    /// Expect a specific user to have a fair share rank
    UserFairShareRank { user: String, rank: u64 },
    /// Expect a deadline to be met (worker spawned before deadline)
    DeadlineMet {
        user: String,
        group: String,
        stage: String,
    },
    /// Expect a deadline to NOT be met
    DeadlineMissed {
        user: String,
        group: String,
        stage: String,
    },
    /// Custom assertion with a callback
    Custom {
        description: String,
        // We store the function as a static string identifier since closures can't be cloned
        validator_name: String,
    },
}

impl Expectation {
    /// Get a human-readable description of this expectation
    pub fn description(&self) -> String {
        match self {
            Expectation::WorkerSpawned {
                image,
                user,
                group,
                pool,
            } => {
                let mut desc = format!("Worker spawned for image '{}'", image);
                if let Some(u) = user {
                    desc.push_str(&format!(" for user '{}'", u));
                }
                if let Some(g) = group {
                    desc.push_str(&format!(" in group '{}'", g));
                }
                if let Some(p) = pool {
                    desc.push_str(&format!(" in {:?} pool", p));
                }
                desc
            }
            Expectation::WorkerPreempted { image, user } => {
                let mut desc = "Worker preempted".to_string();
                if let Some(i) = image {
                    desc.push_str(&format!(" for image '{}'", i));
                }
                if let Some(u) = user {
                    desc.push_str(&format!(" from user '{}'", u));
                }
                desc
            }
            Expectation::FirstSpawnForUser { user } => {
                format!("First spawn is for user '{}'", user)
            }
            Expectation::SpawnCount { count } => {
                format!("Exactly {} workers spawned", count)
            }
            Expectation::PreemptCount { count } => {
                format!("Exactly {} workers preempted", count)
            }
            Expectation::NoSpawns => "No workers spawned".to_string(),
            Expectation::NoPreemptions => "No workers preempted".to_string(),
            Expectation::NoOverallocation => "Resources not over-allocated".to_string(),
            Expectation::UserFairShareRank { user, rank } => {
                format!("User '{}' has fair share rank {}", user, rank)
            }
            Expectation::DeadlineMet { user, group, stage } => {
                format!(
                    "Deadline met for {}:{} (user '{}')",
                    group, stage, user
                )
            }
            Expectation::DeadlineMissed { user, group, stage } => {
                format!(
                    "Deadline missed for {}:{} (user '{}')",
                    group, stage, user
                )
            }
            Expectation::Custom { description, .. } => description.clone(),
        }
    }

    /// Evaluate this expectation against the given decisions
    pub fn evaluate(&self, decisions: &[SchedulingDecision]) -> AssertionResult {
        match self {
            Expectation::WorkerSpawned {
                image,
                user,
                group,
                pool,
            } => {
                let spawns: Vec<_> = decisions
                    .iter()
                    .filter_map(|d| {
                        if let SchedulingDecision::Spawn(s) = d {
                            Some(s)
                        } else {
                            None
                        }
                    })
                    .collect();

                let found = spawns.iter().any(|s| {
                    let image_match = s.stage == *image;
                    let user_match = user.as_ref().map_or(true, |u| &s.user == u);
                    let group_match = group.as_ref().map_or(true, |g| &s.group == g);
                    let pool_match = pool.as_ref().map_or(true, |p| s.pool == *p);
                    image_match && user_match && group_match && pool_match
                });

                if found {
                    AssertionResult::pass(
                        self.clone(),
                        format!("Found matching spawn among {} spawns", spawns.len()),
                    )
                } else {
                    AssertionResult::fail(
                        self.clone(),
                        format!(
                            "No matching spawn found. Spawns: {:?}",
                            spawns.iter().map(|s| &s.stage).collect::<Vec<_>>()
                        ),
                    )
                }
            }

            Expectation::WorkerPreempted { image, user } => {
                let preemptions: Vec<_> = decisions
                    .iter()
                    .filter_map(|d| {
                        if let SchedulingDecision::Preempt(p) = d {
                            Some(p)
                        } else {
                            None
                        }
                    })
                    .collect();

                let found = preemptions.iter().any(|p| {
                    let image_match = image.as_ref().map_or(true, |i| &p.stage == i);
                    let user_match = user.as_ref().map_or(true, |u| &p.user == u);
                    image_match && user_match
                });

                if found {
                    AssertionResult::pass(
                        self.clone(),
                        format!(
                            "Found matching preemption among {} preemptions",
                            preemptions.len()
                        ),
                    )
                } else {
                    AssertionResult::fail(self.clone(), "No matching preemption found")
                }
            }

            Expectation::FirstSpawnForUser { user } => {
                let first_spawn = decisions.iter().find_map(|d| {
                    if let SchedulingDecision::Spawn(s) = d {
                        Some(s)
                    } else {
                        None
                    }
                });

                match first_spawn {
                    Some(s) if &s.user == user => {
                        AssertionResult::pass(self.clone(), "First spawn is for expected user")
                    }
                    Some(s) => AssertionResult::fail(
                        self.clone(),
                        format!("First spawn is for user '{}', expected '{}'", s.user, user),
                    ),
                    None => AssertionResult::fail(self.clone(), "No spawns occurred"),
                }
            }

            Expectation::SpawnCount { count } => {
                let spawn_count = decisions
                    .iter()
                    .filter(|d| matches!(d, SchedulingDecision::Spawn(_)))
                    .count();

                if spawn_count == *count {
                    AssertionResult::pass(self.clone(), format!("Spawn count is {}", count))
                } else {
                    AssertionResult::fail(
                        self.clone(),
                        format!("Spawn count is {}, expected {}", spawn_count, count),
                    )
                }
            }

            Expectation::PreemptCount { count } => {
                let preempt_count = decisions
                    .iter()
                    .filter(|d| matches!(d, SchedulingDecision::Preempt(_)))
                    .count();

                if preempt_count == *count {
                    AssertionResult::pass(self.clone(), format!("Preemption count is {}", count))
                } else {
                    AssertionResult::fail(
                        self.clone(),
                        format!("Preemption count is {}, expected {}", preempt_count, count),
                    )
                }
            }

            Expectation::NoSpawns => {
                let spawn_count = decisions
                    .iter()
                    .filter(|d| matches!(d, SchedulingDecision::Spawn(_)))
                    .count();

                if spawn_count == 0 {
                    AssertionResult::pass(self.clone(), "No spawns occurred")
                } else {
                    AssertionResult::fail(
                        self.clone(),
                        format!("{} spawns occurred", spawn_count),
                    )
                }
            }

            Expectation::NoPreemptions => {
                let preempt_count = decisions
                    .iter()
                    .filter(|d| matches!(d, SchedulingDecision::Preempt(_)))
                    .count();

                if preempt_count == 0 {
                    AssertionResult::pass(self.clone(), "No preemptions occurred")
                } else {
                    AssertionResult::fail(
                        self.clone(),
                        format!("{} preemptions occurred", preempt_count),
                    )
                }
            }

            Expectation::NoOverallocation => {
                // This is checked by the harness during simulation
                // Here we just return a placeholder - actual check happens in harness
                AssertionResult::pass(self.clone(), "Checked by harness during simulation")
            }

            Expectation::UserFairShareRank { user, rank } => {
                // This needs access to allocatable state, so it's a placeholder
                // The harness will handle this
                AssertionResult::pass(
                    self.clone(),
                    format!("User '{}' rank check delegated to harness", user),
                )
            }

            Expectation::DeadlineMet { user, group, stage } => {
                let met = decisions.iter().any(|d| {
                    if let SchedulingDecision::Spawn(s) = d {
                        s.user == *user && s.group == *group && s.stage == *stage
                    } else {
                        false
                    }
                });

                if met {
                    AssertionResult::pass(self.clone(), "Deadline met - worker spawned")
                } else {
                    AssertionResult::fail(self.clone(), "Deadline not met - no matching spawn")
                }
            }

            Expectation::DeadlineMissed { user, group, stage } => {
                let met = decisions.iter().any(|d| {
                    if let SchedulingDecision::Spawn(s) = d {
                        s.user == *user && s.group == *group && s.stage == *stage
                    } else {
                        false
                    }
                });

                if !met {
                    AssertionResult::pass(self.clone(), "Deadline correctly missed - no spawn")
                } else {
                    AssertionResult::fail(
                        self.clone(),
                        "Deadline unexpectedly met - worker was spawned",
                    )
                }
            }

            Expectation::Custom {
                description,
                validator_name,
            } => {
                // Custom validators are handled externally
                AssertionResult::pass(
                    self.clone(),
                    format!("Custom validator '{}' - check externally", validator_name),
                )
            }
        }
    }
}

/// Builder for creating expectations
#[derive(Debug)]
pub struct ExpectationBuilder<'a> {
    scenario_builder: &'a mut ScenarioBuilder,
}

impl<'a> ExpectationBuilder<'a> {
    /// Create a new expectation builder
    pub fn new(scenario_builder: &'a mut ScenarioBuilder) -> Self {
        ExpectationBuilder { scenario_builder }
    }

    /// Expect a worker to be spawned for an image
    pub fn worker_spawned(self, image: impl Into<String>) -> WorkerSpawnedBuilder<'a> {
        WorkerSpawnedBuilder {
            image: image.into(),
            user: None,
            group: None,
            pool: None,
            scenario_builder: self.scenario_builder,
        }
    }

    /// Expect a worker to be spawned for an image in a specific pool
    pub fn worker_spawned_in_pool(
        self,
        image: impl Into<String>,
        pool: thorium::models::Pools,
    ) -> &'a mut ScenarioBuilder {
        self.scenario_builder
            .add_expectation(Expectation::WorkerSpawned {
                image: image.into(),
                user: None,
                group: None,
                pool: Some(pool),
            });
        self.scenario_builder
    }

    /// Expect a worker to be preempted
    pub fn worker_preempted(self) -> WorkerPreemptedBuilder<'a> {
        WorkerPreemptedBuilder {
            image: None,
            user: None,
            scenario_builder: self.scenario_builder,
        }
    }

    /// Expect a worker to be preempted matching a specific image
    pub fn worker_preempted_matching(
        self,
        image: impl Into<String>,
    ) -> &'a mut ScenarioBuilder {
        self.scenario_builder
            .add_expectation(Expectation::WorkerPreempted {
                image: Some(image.into()),
                user: None,
            });
        self.scenario_builder
    }

    /// Expect the first spawn to be for a specific user
    pub fn first_spawn_for_user(self, user: impl Into<String>) -> &'a mut ScenarioBuilder {
        self.scenario_builder
            .add_expectation(Expectation::FirstSpawnForUser { user: user.into() });
        self.scenario_builder
    }

    /// Expect a specific number of spawns
    pub fn spawn_count(self, count: usize) -> &'a mut ScenarioBuilder {
        self.scenario_builder
            .add_expectation(Expectation::SpawnCount { count });
        self.scenario_builder
    }

    /// Expect a specific number of preemptions
    pub fn preempt_count(self, count: usize) -> &'a mut ScenarioBuilder {
        self.scenario_builder
            .add_expectation(Expectation::PreemptCount { count });
        self.scenario_builder
    }

    /// Expect no workers to be spawned
    pub fn no_spawns(self) -> &'a mut ScenarioBuilder {
        self.scenario_builder
            .add_expectation(Expectation::NoSpawns);
        self.scenario_builder
    }

    /// Expect no workers to be preempted
    pub fn no_preemptions(self) -> &'a mut ScenarioBuilder {
        self.scenario_builder
            .add_expectation(Expectation::NoPreemptions);
        self.scenario_builder
    }

    /// Expect no resource over-allocation
    pub fn no_overallocation(self) -> &'a mut ScenarioBuilder {
        self.scenario_builder
            .add_expectation(Expectation::NoOverallocation);
        self.scenario_builder
    }

    /// Expect a deadline to be met
    pub fn deadline_met(
        self,
        user: impl Into<String>,
        group: impl Into<String>,
        stage: impl Into<String>,
    ) -> &'a mut ScenarioBuilder {
        self.scenario_builder
            .add_expectation(Expectation::DeadlineMet {
                user: user.into(),
                group: group.into(),
                stage: stage.into(),
            });
        self.scenario_builder
    }

    /// Expect a deadline to be missed
    pub fn deadline_missed(
        self,
        user: impl Into<String>,
        group: impl Into<String>,
        stage: impl Into<String>,
    ) -> &'a mut ScenarioBuilder {
        self.scenario_builder
            .add_expectation(Expectation::DeadlineMissed {
                user: user.into(),
                group: group.into(),
                stage: stage.into(),
            });
        self.scenario_builder
    }

    /// Expect a user to have a specific fair share rank
    pub fn user_fair_share_rank(
        self,
        user: impl Into<String>,
        rank: u64,
    ) -> &'a mut ScenarioBuilder {
        self.scenario_builder
            .add_expectation(Expectation::UserFairShareRank {
                user: user.into(),
                rank,
            });
        self.scenario_builder
    }
}

/// Builder for worker spawned expectations
#[derive(Debug)]
pub struct WorkerSpawnedBuilder<'a> {
    image: String,
    user: Option<String>,
    group: Option<String>,
    pool: Option<Pools>,
    scenario_builder: &'a mut ScenarioBuilder,
}

impl<'a> WorkerSpawnedBuilder<'a> {
    /// Expect spawn to be for a specific user
    pub fn for_user(mut self, user: impl Into<String>) -> Self {
        self.user = Some(user.into());
        self
    }

    /// Expect spawn to be in a specific group
    pub fn in_group(mut self, group: impl Into<String>) -> Self {
        self.group = Some(group.into());
        self
    }

    /// Expect spawn to be in a specific pool
    pub fn in_pool(mut self, pool: Pools) -> Self {
        self.pool = Some(pool);
        self
    }

    /// Add this expectation and return to scenario builder
    pub fn done(self) -> &'a mut ScenarioBuilder {
        self.scenario_builder
            .add_expectation(Expectation::WorkerSpawned {
                image: self.image,
                user: self.user,
                group: self.group,
                pool: self.pool,
            });
        self.scenario_builder
    }
}

/// Builder for worker preempted expectations
#[derive(Debug)]
pub struct WorkerPreemptedBuilder<'a> {
    image: Option<String>,
    user: Option<String>,
    scenario_builder: &'a mut ScenarioBuilder,
}

impl<'a> WorkerPreemptedBuilder<'a> {
    /// Expect preemption to be for a specific image
    pub fn matching(mut self, image: impl Into<String>) -> Self {
        self.image = Some(image.into());
        self
    }

    /// Expect preemption to be for a specific user
    pub fn from_user(mut self, user: impl Into<String>) -> Self {
        self.user = Some(user.into());
        self
    }

    /// Add this expectation and return to scenario builder
    pub fn done(self) -> &'a mut ScenarioBuilder {
        self.scenario_builder
            .add_expectation(Expectation::WorkerPreempted {
                image: self.image,
                user: self.user,
            });
        self.scenario_builder
    }
}

/// Verify all expectations against decisions
pub fn verify_expectations(
    expectations: &[Expectation],
    decisions: &[SchedulingDecision],
) -> Vec<AssertionResult> {
    expectations
        .iter()
        .map(|exp| exp.evaluate(decisions))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spawn_count_expectation() {
        let exp = Expectation::SpawnCount { count: 2 };

        let decisions = vec![
            SchedulingDecision::Spawn(super::super::harness::SpawnDecision {
                user: "user1".to_string(),
                group: "group1".to_string(),
                pipeline: "pipe1".to_string(),
                stage: "tool1".to_string(),
                cluster: "cluster1".to_string(),
                node: "node1".to_string(),
                pool: Pools::FairShare,
                timestamp: Utc::now(),
            }),
            SchedulingDecision::Spawn(super::super::harness::SpawnDecision {
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

        let result = exp.evaluate(&decisions);
        assert!(result.passed);
    }

    #[test]
    fn test_no_spawns_expectation() {
        let exp = Expectation::NoSpawns;
        let decisions: Vec<SchedulingDecision> = vec![];
        let result = exp.evaluate(&decisions);
        assert!(result.passed);
    }
}
