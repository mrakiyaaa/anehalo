use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct VaultError {
    pub code: &'static str,
    pub message: String,
}

pub type VaultResult<T> = Result<T, VaultError>;

impl VaultError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn scan_limit() -> Self {
        Self::new(
            "scan-limit",
            "This folder has too many items to be a notes folder",
        )
    }
}

impl From<std::io::Error> for VaultError {
    fn from(error: std::io::Error) -> Self {
        use std::io::ErrorKind;
        match error.kind() {
            _ if matches!(error.raw_os_error(), Some(112 | 28)) => Self::new(
                "disk-full",
                "The disk is full. Free some space and try again.",
            ),
            ErrorKind::NotFound => Self::new(
                "not-found",
                "The folder is missing. Restore it or choose a folder again.",
            ),
            ErrorKind::PermissionDenied => Self::new(
                "permission-denied",
                "Anehalo does not have permission to read or write this folder. Choose another location or check its permissions.",
            ),
            _ if matches!(error.raw_os_error(), Some(206 | 36)) => Self::new(
                "path-too-long",
                "The folder path is too long. Choose a location closer to the drive root.",
            ),
            _ => Self::new(
                "io-error",
                "The folder could not be accessed. Check that it is available and choose a folder again.",
            ),
        }
    }
}
