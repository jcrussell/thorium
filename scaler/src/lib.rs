//! The scaler responsible for scaling workers for Thorium
#![feature(hash_set_entry)]
#![feature(btree_extract_if)]

mod args;
mod libs;

pub use libs::{Scaler, Spawned};

// these are only for tests
#[cfg(feature = "test-utilities")]
pub use libs::schedulers::dry_run::{DryRun, DryRunNode};

// expose test utilities if that feature is enabled
#[cfg(feature = "test-utilities")]
pub mod test_utilities;

// expose the scheduler simulator framework for testing
#[cfg(feature = "test-utilities")]
pub mod simulator;

// re-export key scheduling types for simulator access
#[cfg(feature = "test-utilities")]
pub use libs::schedulers::{Allocatable, AllocatableUpdate, NodeAllocatableUpdate, NodeResources};

#[cfg(feature = "test-utilities")]
pub use libs::{BanSets, Cache};
