//! The errors that may occur during backup or restore

use bytecheck::{SliceCheckError, StructCheckError};
use rkyv::validation::{
    owned::OwnedPointerError, validators::DefaultValidatorError, CheckArchiveError,
};
use std::convert::Infallible;

#[derive(Debug)]
pub enum Error {
    /// A generic backup error
    Generic(String),
    /// A Thorium API error
    Thorium(thorium::Error),
    /// A Scylla new session error occured
    ScyllaNewSession(scylla::errors::NewSessionError),
    /// An error preparing a scylla statement
    ScyllaPrepareSatement(scylla::errors::PrepareError),
    /// A Scylla query error occured
    ScyllaQuery(scylla::errors::ExecutionError),
    /// A Scylla paged query error occured
    ScyllaPagedQuery(scylla::errors::PagerExecutionError),
    /// A Scylla next row error occured
    ScyllaNextRow(scylla::client::pager::NextRowError),
    /// A Redis error
    Redis(redis::RedisError),
    /// A tokio join error
    TokioJoin(tokio::task::JoinError),
    /// A kanal send error
    KanalSend(kanal::SendError),
    /// A kanal close error
    KanalClose(kanal::CloseError),
    /// An IO Error
    IO(std::io::Error),
    /// A config error
    Config(config::ConfigError),
    /// A deserialization/conversion error
    Conversion(std::convert::Infallible),
    /// An error from converting a type to a Uuid
    Uuid(uuid::Error),
    /// An error from converting a value with `serde_json`
    SerdeJson(serde_json::Error),
    /// An error from converting a value with `serde_yaml`
    SerdeYaml(serde_yaml::Error),
    /// An s3 error
    S3 {
        code: Option<String>,
        message: Option<String>,
    },
    /// An s3 bytestream error
    S3ByteStream(aws_sdk_s3::primitives::ByteStreamError),
    /// Failed to recieve data from a kanal channel
    KanalRecv(kanal::ReceiveError),
    /// An error with deserializing rkyv data
    RkyvDesererialize(String),
    /// An error from stripping a prefix from a path
    StripPrefix(std::path::StripPrefixError),
    // An error from dialoguer
    Dialoguer(dialoguer::Error),
}

impl Error {
    /// Create a new generic error
    ///
    /// # Arguments
    ///
    /// * `msg` - The error message to use
    pub fn new<T: Into<String>>(msg: T) -> Self {
        Error::Generic(msg.into())
    }
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Generic(err) => write!(f, "{err}"),
            Error::Thorium(err) => write!(f, "Thorium Client Error: {err}"),
            Error::ScyllaNewSession(err) => write!(f, "ScyllaNewSession Error: {err}"),
            Error::ScyllaPrepareSatement(err) => write!(f, "ScyllaPreparedSatement Error: {err}"),
            Error::ScyllaQuery(err) => write!(f, "ScyllaQuery Error: {err}"),
            Error::ScyllaPagedQuery(err) => write!(f, "ScyllaPagedQuery Error: {err}"),
            Error::ScyllaNextRow(err) => write!(f, "ScyllaNextRow Error: {err}"),
            Error::Redis(err) => write!(f, "Redis Error: {err}"),
            Error::TokioJoin(err) => write!(f, "TokioJoin Error: {err}"),
            Error::KanalSend(err) => write!(f, "KanalSend Error: {err}"),
            Error::KanalClose(err) => write!(f, "KanalClose Error: {err}"),
            Error::IO(err) => write!(f, "IO Error: {err}"),
            Error::Config(err) => write!(f, "Config Error: {err}"),
            Error::Conversion(err) => write!(f, "Conversion Error: {err}"),
            Error::Uuid(err) => write!(f, "Uuid Error: {err}"),
            Error::SerdeJson(err) => write!(f, "SerdeJson Error: {err}"),
            Error::SerdeYaml(err) => write!(f, "SerdeYaml Error: {err}"),
            Error::S3 { code, message } => {
                write!(
                    f,
                    "S3 Error {}: {}",
                    code.clone().unwrap_or_default(),
                    message.clone().unwrap_or_default()
                )
            }
            Error::S3ByteStream(err) => write!(f, "S3ByteStream Error: {err}"),
            Error::KanalRecv(err) => write!(f, "KanalRecv Error: {err}"),
            Error::RkyvDesererialize(err) => write!(f, "RkyvDeserialize Error: {err}"),
            Error::StripPrefix(err) => write!(f, "StripPrefix Error: {err}"),
            Error::Dialoguer(err) => write!(f, "Dialoguer: {err}"),
        }
    }
}

impl From<thorium::Error> for Error {
    fn from(error: thorium::Error) -> Self {
        Error::Thorium(error)
    }
}

impl From<scylla::errors::NewSessionError> for Error {
    fn from(error: scylla::errors::NewSessionError) -> Self {
        Error::ScyllaNewSession(error)
    }
}

impl From<scylla::errors::PrepareError> for Error {
    fn from(error: scylla::errors::PrepareError) -> Self {
        Error::ScyllaPrepareSatement(error)
    }
}

impl From<scylla::errors::ExecutionError> for Error {
    fn from(error: scylla::errors::ExecutionError) -> Self {
        Error::ScyllaQuery(error)
    }
}

impl From<scylla::errors::PagerExecutionError> for Error {
    fn from(error: scylla::errors::PagerExecutionError) -> Self {
        Error::ScyllaPagedQuery(error)
    }
}

impl From<scylla::client::pager::NextRowError> for Error {
    fn from(error: scylla::client::pager::NextRowError) -> Self {
        Error::ScyllaNextRow(error)
    }
}

impl From<redis::RedisError> for Error {
    fn from(error: redis::RedisError) -> Self {
        Error::Redis(error)
    }
}

impl From<tokio::task::JoinError> for Error {
    fn from(error: tokio::task::JoinError) -> Self {
        Error::TokioJoin(error)
    }
}

impl From<kanal::SendError> for Error {
    fn from(error: kanal::SendError) -> Self {
        Error::KanalSend(error)
    }
}

impl From<kanal::CloseError> for Error {
    fn from(error: kanal::CloseError) -> Self {
        Error::KanalClose(error)
    }
}

impl From<std::io::Error> for Error {
    fn from(error: std::io::Error) -> Self {
        Error::IO(error)
    }
}

impl From<config::ConfigError> for Error {
    fn from(error: config::ConfigError) -> Self {
        Error::Config(error)
    }
}

impl From<std::convert::Infallible> for Error {
    fn from(error: std::convert::Infallible) -> Self {
        Error::Conversion(error)
    }
}

impl From<uuid::Error> for Error {
    fn from(error: uuid::Error) -> Self {
        Error::Uuid(error)
    }
}

impl From<serde_json::Error> for Error {
    fn from(error: serde_json::Error) -> Self {
        Error::SerdeJson(error)
    }
}

impl From<serde_yaml::Error> for Error {
    fn from(error: serde_yaml::Error) -> Self {
        Error::SerdeYaml(error)
    }
}

impl
    From<
        aws_sdk_s3::error::SdkError<
            aws_sdk_s3::operation::create_multipart_upload::CreateMultipartUploadError,
        >,
    > for Error
{
    fn from(
        error: aws_sdk_s3::error::SdkError<
            aws_sdk_s3::operation::create_multipart_upload::CreateMultipartUploadError,
        >,
    ) -> Self {
        // cast this error into a service error
        let service_error = error.into_service_error();
        // get this errors metadata
        let meta = service_error.meta();
        Error::S3 {
            code: meta.code().map(ToOwned::to_owned),
            message: meta.message().map(ToOwned::to_owned),
        }
    }
}

impl From<aws_sdk_s3::error::SdkError<aws_sdk_s3::operation::upload_part::UploadPartError>>
    for Error
{
    fn from(
        error: aws_sdk_s3::error::SdkError<aws_sdk_s3::operation::upload_part::UploadPartError>,
    ) -> Self {
        // cast this error into a service error
        let service_error = error.into_service_error();
        // get this errors metadata
        let meta = service_error.meta();
        Error::S3 {
            code: meta.code().map(ToOwned::to_owned),
            message: meta.message().map(ToOwned::to_owned),
        }
    }
}

impl
    From<
        aws_sdk_s3::error::SdkError<
            aws_sdk_s3::operation::complete_multipart_upload::CompleteMultipartUploadError,
        >,
    > for Error
{
    fn from(
        error: aws_sdk_s3::error::SdkError<
            aws_sdk_s3::operation::complete_multipart_upload::CompleteMultipartUploadError,
        >,
    ) -> Self {
        // cast this error into a service error
        let service_error = error.into_service_error();
        // get this errors metadata
        let meta = service_error.meta();
        Error::S3 {
            code: meta.code().map(ToOwned::to_owned),
            message: meta.message().map(ToOwned::to_owned),
        }
    }
}

impl
    From<
        aws_sdk_s3::error::SdkError<
            aws_sdk_s3::operation::abort_multipart_upload::AbortMultipartUploadError,
        >,
    > for Error
{
    fn from(
        error: aws_sdk_s3::error::SdkError<
            aws_sdk_s3::operation::abort_multipart_upload::AbortMultipartUploadError,
        >,
    ) -> Self {
        // cast this error into a service error
        let service_error = error.into_service_error();
        // get this errors metadata
        let meta = service_error.meta();
        Error::S3 {
            code: meta.code().map(ToOwned::to_owned),
            message: meta.message().map(ToOwned::to_owned),
        }
    }
}

impl From<aws_sdk_s3::error::SdkError<aws_sdk_s3::operation::get_object::GetObjectError>>
    for Error
{
    fn from(
        error: aws_sdk_s3::error::SdkError<aws_sdk_s3::operation::get_object::GetObjectError>,
    ) -> Self {
        // cast this error into a service error
        let service_error = error.into_service_error();
        // get this errors metadata
        let meta = service_error.meta();
        Error::S3 {
            code: meta.code().map(ToOwned::to_owned),
            message: meta.message().map(ToOwned::to_owned),
        }
    }
}

impl From<aws_sdk_s3::primitives::ByteStreamError> for Error {
    fn from(error: aws_sdk_s3::primitives::ByteStreamError) -> Self {
        Error::S3ByteStream(error)
    }
}

impl From<kanal::ReceiveError> for Error {
    fn from(error: kanal::ReceiveError) -> Self {
        Error::KanalRecv(error)
    }
}

impl
    From<
        CheckArchiveError<
            OwnedPointerError<Infallible, SliceCheckError<StructCheckError>, DefaultValidatorError>,
            DefaultValidatorError,
        >,
    > for Error
{
    fn from(
        error: CheckArchiveError<
            OwnedPointerError<Infallible, SliceCheckError<StructCheckError>, DefaultValidatorError>,
            DefaultValidatorError,
        >,
    ) -> Self {
        Error::RkyvDesererialize(error.to_string())
    }
}

impl From<CheckArchiveError<StructCheckError, DefaultValidatorError>> for Error {
    fn from(error: CheckArchiveError<StructCheckError, DefaultValidatorError>) -> Self {
        Error::RkyvDesererialize(error.to_string())
    }
}

impl From<std::path::StripPrefixError> for Error {
    fn from(error: std::path::StripPrefixError) -> Self {
        Error::StripPrefix(error)
    }
}

impl From<dialoguer::Error> for Error {
    fn from(error: dialoguer::Error) -> Self {
        Error::Dialoguer(error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    // ==================== Error::new tests ====================

    #[test]
    fn error_new_from_str() {
        let err = Error::new("test error");
        match err {
            Error::Generic(msg) => assert_eq!(msg, "test error"),
            _ => panic!("Expected Generic error"),
        }
    }

    #[test]
    fn error_new_empty_string() {
        let err = Error::new("");
        match err {
            Error::Generic(msg) => assert!(msg.is_empty()),
            _ => panic!("Expected Generic error"),
        }
    }

    // ==================== Display tests ====================

    #[test]
    fn display_generic_error() {
        let err = Error::Generic("test message".to_string());
        assert_eq!(format!("{}", err), "test message");
    }

    #[test]
    fn display_s3_error_optional_fields() {
        let cases: Vec<(Option<&str>, Option<&str>, Vec<&str>)> = vec![
            (Some("NoSuchKey"), Some("The key does not exist"), vec!["NoSuchKey", "The key does not exist"]),
            (Some("AccessDenied"), None, vec!["AccessDenied"]),
            (None, Some("Something went wrong"), vec!["Something went wrong"]),
            (None, None, vec![]),
        ];
        for (code, message, expected_substrings) in cases {
            let err = Error::S3 {
                code: code.map(str::to_string),
                message: message.map(str::to_string),
            };
            let display = format!("{}", err);
            for s in expected_substrings {
                assert!(display.contains(s), "Expected '{s}' in '{display}'");
            }
        }
    }

    #[test]
    fn display_rkyv_error() {
        let err = Error::RkyvDesererialize("deserialization failed".to_string());
        let display = format!("{}", err);
        assert!(display.contains("RkyvDeserialize"));
        assert!(display.contains("deserialization failed"));
    }

    // ==================== From implementations tests ====================

    #[test]
    fn from_io_error() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let err: Error = io_err.into();
        match err {
            Error::IO(_) => {}
            _ => panic!("Expected IO error"),
        }
        let display = format!("{}", err);
        assert!(display.contains("IO Error"));
    }

    #[test]
    fn from_uuid_error() {
        let uuid_err = Uuid::try_parse("not-a-uuid").unwrap_err();
        let err: Error = uuid_err.into();
        match err {
            Error::Uuid(_) => {}
            _ => panic!("Expected Uuid error"),
        }
    }

    #[test]
    fn from_serde_json_error() {
        let json_err: serde_json::Error = serde_json::from_str::<String>("invalid").unwrap_err();
        let err: Error = json_err.into();
        match err {
            Error::SerdeJson(_) => {}
            _ => panic!("Expected SerdeJson error"),
        }
    }

    #[test]
    fn from_serde_yaml_error() {
        let yaml_err: serde_yaml::Error = serde_yaml::from_str::<i32>("not: a: number").unwrap_err();
        let err: Error = yaml_err.into();
        match err {
            Error::SerdeYaml(_) => {}
            _ => panic!("Expected SerdeYaml error"),
        }
    }

    #[test]
    fn from_kanal_send_error() {
        // Create a channel and drop receiver to get SendError
        let (tx, _rx) = kanal::bounded::<()>(0);
        drop(_rx);
        let send_result = tx.try_send(());
        if let Err(send_err) = send_result {
            let err: Error = send_err.into();
            match err {
                Error::KanalSend(_) => {}
                _ => panic!("Expected KanalSend error"),
            }
        }
    }

    #[test]
    fn from_kanal_recv_error() {
        // Create a channel and drop sender to get ReceiveError
        let (tx, rx) = kanal::bounded::<()>(0);
        drop(tx);
        let recv_result = rx.try_recv();
        if let Err(recv_err) = recv_result {
            let err: Error = recv_err.into();
            match err {
                Error::KanalRecv(_) => {}
                _ => panic!("Expected KanalRecv error"),
            }
        }
    }

}
