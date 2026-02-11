/// The different types of s3 objects we should track
use std::str::FromStr;

use crate::models::InvalidEnum;

#[derive(Debug, Clone, Copy)]
#[cfg_attr(
    feature = "rkyv-support",
    derive(rkyv::Archive, rkyv::Serialize, rkyv::Deserialize)
)]
#[cfg_attr(
    feature = "rkyv-support",
    archive_attr(derive(Debug, bytecheck::CheckBytes))
)]
#[cfg_attr(feature = "scylla-utils", derive(thorium_derive::ScyllaStoreAsStr))]
pub enum S3Objects {
    /// A sample or file
    File,
    /// A zipped repo
    Repo,
}

impl S3Objects {
    /// Convert our s3 object into a str
    pub fn as_str(&self) -> &'static str {
        match self {
            S3Objects::File => "File",
            S3Objects::Repo => "Repo",
        }
    }
}

// To use the `{}` marker, the trait `fmt::Display` must be implemented
// manually for the type.
impl std::fmt::Display for S3Objects {
    // This trait requires `fmt` with this exact signature.
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            S3Objects::File => write!(f, "File"),
            S3Objects::Repo => write!(f, "Repo"),
        }
    }
}

impl FromStr for S3Objects {
    type Err = InvalidEnum;
    /// Cast a str to an `ImageScaler`
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "File" => Ok(S3Objects::File),
            "Repo" => Ok(S3Objects::Repo),
            _ => Err(InvalidEnum(format!("Unknown enum variant: {s}"))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ==================== S3Objects FromStr tests ====================

    #[test]
    fn s3_objects_from_str_valid_file() {
        let result: Result<S3Objects, _> = "File".parse();
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), S3Objects::File));
    }

    #[test]
    fn s3_objects_from_str_valid_repo() {
        let result: Result<S3Objects, _> = "Repo".parse();
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), S3Objects::Repo));
    }

    #[test]
    fn s3_objects_from_str_invalid_returns_error() {
        let result: Result<S3Objects, _> = "Invalid".parse();
        assert!(result.is_err());
    }

    #[test]
    fn s3_objects_from_str_lowercase_returns_error() {
        let result: Result<S3Objects, _> = "file".parse();
        assert!(result.is_err());
    }

    #[test]
    fn s3_objects_from_str_empty_returns_error() {
        let result: Result<S3Objects, _> = "".parse();
        assert!(result.is_err());
    }

    // ==================== S3Objects Display/as_str tests ====================

    #[test]
    fn s3_objects_as_str_all_variants() {
        assert_eq!(S3Objects::File.as_str(), "File");
        assert_eq!(S3Objects::Repo.as_str(), "Repo");
    }

    #[test]
    fn s3_objects_display_all_variants() {
        assert_eq!(format!("{}", S3Objects::File), "File");
        assert_eq!(format!("{}", S3Objects::Repo), "Repo");
    }

    #[test]
    fn s3_objects_round_trip_all_variants() {
        for obj in [S3Objects::File, S3Objects::Repo] {
            let displayed = obj.to_string();
            let parsed: S3Objects = displayed.parse().unwrap();
            assert_eq!(obj.as_str(), parsed.as_str());
        }
    }
}
