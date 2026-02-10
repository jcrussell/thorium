//! Scheduler Simulator Framework
//!
//! This module provides a deterministic testing framework for the Thorium K8s scheduler.
//! It enables testing of scheduling corner cases by mocking external dependencies and
//! controlling time, without requiring real API connections.
//!
//! # Architecture
//!
//! The simulator consists of several key components:
//!
//! - **Scenario**: Defines test scenarios using a builder DSL, including cluster configuration,
//!   users, images, deadlines, and expected outcomes.
//!
//! - **Harness**: Orchestrates simulations using `Allocatable` and `DryRun` directly,
//!   managing virtual time and recording scheduling decisions.
//!
//! - **Generators**: Provides test data generators for creating realistic test scenarios.
//!
//! - **Assertions**: Verification helpers for validating scheduling decisions.
//!
//! - **Scenarios**: Predefined test scenarios covering resource exhaustion, preemption,
//!   fair share, and edge cases.
//!
//! - **Fuzzer**: Property-based testing support with proptest for discovering unknown edge cases.
//!
//! # Example
//!
//! ```rust,ignore
//! use thorium_scaler::simulator::{Scenario, SimulatorHarness};
//!
//! #[test]
//! fn test_preemption_on_deadline() {
//!     let scenario = Scenario::builder("preemption_test")
//!         .cluster("test")
//!             .node("node-1").cpu(8000).memory(16384).done()
//!             .done()
//!         .user("user-low").in_group("group-a").done()
//!         .user("user-high").in_group("group-a").done()
//!         .image("group-a", "heavy-tool").cpu(4000).memory(8192).runtime(300).done()
//!         .expect().worker_spawned_for("heavy-tool", "user-low")
//!         .build();
//!
//!     let mut harness = SimulatorHarness::from_scenario(&scenario);
//!     let result = harness.run();
//!     assert!(result.all_passed(), "Failures: {:?}", result.failures());
//! }
//! ```

mod assertions;
mod fuzzer;
mod generators;
mod harness;
mod scenario;
mod scenarios;

#[cfg(test)]
mod tests;

pub use assertions::{AssertionResult, Expectation, ExpectationBuilder};
pub use fuzzer::{arbitrary_scenario, invariants};
pub use generators::{
    ClusterGenerator, DeadlineGenerator, ImageGenerator, StatsGenerator, UserGenerator,
};
pub use harness::{SchedulingDecision, SimulationResult, SimulatorHarness};
pub use scenario::{
    ClusterConfig, ImageConfig, NodeConfig, Scenario, ScenarioBuilder, ScheduledEvent, UserConfig,
};
pub use scenarios::predefined;

/// Re-export key types from the parent crate for convenience
pub mod prelude {
    pub use super::{
        AssertionResult, ClusterConfig, ClusterGenerator, DeadlineGenerator, Expectation,
        ExpectationBuilder, ImageConfig, ImageGenerator, NodeConfig, ScheduledEvent,
        SchedulingDecision, Scenario, ScenarioBuilder, SimulationResult, SimulatorHarness,
        StatsGenerator, UserConfig, UserGenerator,
    };
}
