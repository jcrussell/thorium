//! The headers for the cart format

use crate::Error;
use std::io::Write;

/// The length of a standard `CaRT` header
pub const HEADER_LEN: usize = 38;
/// The cart magic number preceding the header
pub static MAGIC_NUM: &[u8; 4] = b"CART";
/// The length of the key used for encryption
pub const KEY_LEN: usize = 16;

/// The mandatory header object for cart
///
/// The optional length will largely be ignored as we do not currently support optional headers.
#[derive(Debug, Clone)]
pub struct Header {
    /// The version of CaRT in use
    pub version: u8,
    /// The key used to encrypt this file
    pub key: Vec<u8>,
    /// The length of the optional header
    pub opt_len: usize,
}

impl Header {
    /// Build the header for this carted file
    ///
    /// # Arguments
    ///
    /// * `key` - The key used by rc4 for encryption
    ///
    /// # Errors
    ///
    /// If the given key is invalid (not exactly 16 bytes long), an error will be returned.
    pub fn new_buffer(key: &[u8], len: usize) -> Result<Vec<u8>, Error> {
        Self::validate_key(key)?;
        // build our header vector of 38 + the length requested
        let mut header: Vec<u8> = vec![0; HEADER_LEN + len];
        // write the header
        Header::write(key, &mut header[..HEADER_LEN])?;
        Ok(header)
    }

    /// Write this header to the start of an already allocated vec
    ///
    /// # Arguments
    ///
    /// * `key` - The key used by rc4 for encryption
    /// * `buff` - The buffer to write our header info to
    ///
    /// # Errors
    ///
    /// If the given key is invalid (not exactly 16 bytes long), an error will be returned.
    ///
    /// Additionally, if any IO errors occur then an error will be returned, and the header
    /// will fail to write. IO errors should only occur if an insufficient buffer is provided.
    pub fn write(key: &[u8], mut buf: &mut [u8]) -> Result<(), Error> {
        Self::validate_key(key)?;
        // create the bincode config; use fixed int encoding to ensure we write 8 bytes
        // when we write `0_u64` instead of just 1 byte
        let config = bincode::config::standard().with_fixed_int_encoding();
        // write the CaRT magic number (4 bytes)
        buf.write_all(MAGIC_NUM)?;
        // write CaRT version 1 (2 bytes)
        let version = b"\x01\x00";
        buf.write_all(version)?;
        // write reserved space (8 bytes)
        bincode::encode_into_std_write(0_u64, &mut buf, config)?;
        // write the encryption key (16 bytes)
        buf.write_all(key)?;
        // hardcode an optional header length of 0 (8 bytes)
        bincode::encode_into_std_write(0_u64, &mut buf, config)?;
        Ok(())
    }

    /// Gets the header from the first 38 bytes of the raw binary
    ///
    /// # Arguments
    ///
    /// * `raw` - The first 38 bytes of the binary containing the header
    ///
    /// # Errors
    ///
    /// If this buffer does not start with the CART magic number then an error will be returned.
    pub fn get(raw: &[u8]) -> Result<Self, Error> {
        // create the bincode config; use fixed int encoding because that's how we write things
        let config = bincode::config::standard().with_fixed_int_encoding();
        // make sure the magic numbers match carts magic number
        Self::validate(raw)?;
        // extract the version number
        let (version, _) = bincode::decode_from_slice(&raw[4..5], config)?;
        // extract the rc4 key
        let key = raw[14..30].to_vec();
        // extract the length of the optional header
        let (opt_len, _) = bincode::decode_from_slice(&raw[30..], config)?;
        Ok(Header {
            version,
            key,
            opt_len,
        })
    }

    pub fn validate(raw: &[u8]) -> Result<(), Error> {
        if raw.len() < 4 {
            return Err(Error::new(
                "Cannot validate Cart file because the given header buffer is empty or too small",
            ));
        } else if raw[..4] != *MAGIC_NUM {
            return Err(Error::new("File does not start with the CART magic number"));
        }
        Ok(())
    }

    /// Checks that the key is valid given CART specifications. The key must be exactly 16
    /// bytes log to be valid.
    ///
    /// # Arguments
    ///
    /// * `key` - The key used for encryption
    ///
    /// # Errors
    ///
    /// If the given key is invalid (not exactly 16 bytes long), an error will be returned.
    pub fn validate_key(key: &[u8]) -> Result<(), Error> {
        if key.len() != KEY_LEN {
            return Err(Error::new(format!(
                "The given key does not have the correct length of {}. Given key length: {}",
                KEY_LEN,
                key.len()
            )));
        }
        Ok(())
    }

    /// Calculate how much of the binary to skip to get past the header
    #[must_use]
    pub fn skip(&self) -> usize {
        // In order to skip the header we have to skip 38 bytes + the optional header size
        HEADER_LEN + self.opt_len
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper to create a valid 16-byte key
    fn valid_key() -> [u8; KEY_LEN] {
        *b"SecretCornIs16!!"
    }

    // ==================== validate_key tests ====================

    #[test]
    fn validate_key_accepts_16_byte_key() {
        let key = valid_key();
        assert!(Header::validate_key(&key).is_ok());
    }

    #[test]
    fn validate_key_rejects_15_byte_key() {
        let key = [0u8; 15];
        let result = Header::validate_key(&key);
        assert!(result.is_err());
    }

    #[test]
    fn validate_key_rejects_17_byte_key() {
        let key = [0u8; 17];
        let result = Header::validate_key(&key);
        assert!(result.is_err());
    }

    #[test]
    fn validate_key_rejects_empty_key() {
        let key: [u8; 0] = [];
        let result = Header::validate_key(&key);
        assert!(result.is_err());
    }

    #[test]
    fn validate_key_error_message_contains_lengths() {
        let key = [0u8; 10];
        let result = Header::validate_key(&key);
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("16"), "Should mention expected length 16");
        assert!(err_msg.contains("10"), "Should mention actual length 10");
    }

    // ==================== validate tests ====================

    #[test]
    fn validate_accepts_cart_magic_number() {
        let mut buf = [0u8; HEADER_LEN];
        buf[..4].copy_from_slice(MAGIC_NUM);
        assert!(Header::validate(&buf).is_ok());
    }

    #[test]
    fn validate_rejects_wrong_magic_number() {
        let mut buf = [0u8; HEADER_LEN];
        buf[..4].copy_from_slice(b"TRAC"); // footer magic, not header
        let result = Header::validate(&buf);
        assert!(result.is_err());
    }

    #[test]
    fn validate_rejects_buffer_too_small() {
        let buf = [0u8; 3];
        let result = Header::validate(&buf);
        assert!(result.is_err());
    }

    #[test]
    fn validate_rejects_empty_buffer() {
        let buf: [u8; 0] = [];
        let result = Header::validate(&buf);
        assert!(result.is_err());
    }

    // ==================== write tests ====================

    #[test]
    fn write_places_magic_number_at_start() {
        let key = valid_key();
        let mut buf = [0u8; HEADER_LEN];
        Header::write(&key, &mut buf).unwrap();
        assert_eq!(&buf[..4], MAGIC_NUM);
    }

    #[test]
    fn write_rejects_invalid_key_length() {
        let key = [0u8; 10];
        let mut buf = [0u8; HEADER_LEN];
        let result = Header::write(&key, &mut buf);
        assert!(result.is_err());
    }

    #[test]
    fn write_fails_with_insufficient_buffer() {
        let key = valid_key();
        let mut buf = [0u8; 10]; // Too small
        let result = Header::write(&key, &mut buf);
        assert!(result.is_err());
    }

    // ==================== new_buffer tests ====================

    #[test]
    fn new_buffer_creates_correct_size() {
        let key = valid_key();
        let extra_len = 100;
        let buf = Header::new_buffer(&key, extra_len).unwrap();
        assert_eq!(buf.len(), HEADER_LEN + extra_len);
    }

    #[test]
    fn new_buffer_writes_header_at_start() {
        let key = valid_key();
        let buf = Header::new_buffer(&key, 100).unwrap();
        assert_eq!(&buf[..4], MAGIC_NUM);
    }

    #[test]
    fn new_buffer_rejects_invalid_key() {
        let key = [0u8; 10];
        let result = Header::new_buffer(&key, 100);
        assert!(result.is_err());
    }

    // ==================== get tests ====================

    #[test]
    fn get_extracts_version() {
        let key = valid_key();
        let mut buf = [0u8; HEADER_LEN];
        Header::write(&key, &mut buf).unwrap();
        let header = Header::get(&buf).unwrap();
        assert_eq!(header.version, 1);
    }

    #[test]
    fn get_extracts_key() {
        let key = valid_key();
        let mut buf = [0u8; HEADER_LEN];
        Header::write(&key, &mut buf).unwrap();
        let header = Header::get(&buf).unwrap();
        assert_eq!(header.key, key.to_vec());
    }

    #[test]
    fn get_extracts_opt_len_as_zero() {
        let key = valid_key();
        let mut buf = [0u8; HEADER_LEN];
        Header::write(&key, &mut buf).unwrap();
        let header = Header::get(&buf).unwrap();
        assert_eq!(header.opt_len, 0);
    }

    #[test]
    fn get_rejects_invalid_magic_number() {
        let mut buf = [0u8; HEADER_LEN];
        buf[..4].copy_from_slice(b"TRAC");
        let result = Header::get(&buf);
        assert!(result.is_err());
    }

    // ==================== round-trip tests ====================

    #[test]
    fn round_trip_write_then_get() {
        let key = valid_key();
        let mut buf = [0u8; HEADER_LEN];
        Header::write(&key, &mut buf).unwrap();
        let header = Header::get(&buf).unwrap();
        assert_eq!(header.version, 1);
        assert_eq!(header.key, key.to_vec());
        assert_eq!(header.opt_len, 0);
    }

    #[test]
    fn round_trip_with_different_keys() {
        let keys = [
            *b"0123456789abcdef",
            *b"fedcba9876543210",
            *b"\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f",
        ];
        for key in keys {
            let mut buf = [0u8; HEADER_LEN];
            Header::write(&key, &mut buf).unwrap();
            let header = Header::get(&buf).unwrap();
            assert_eq!(header.key, key.to_vec());
        }
    }

    // ==================== skip tests ====================

    #[test]
    fn skip_returns_header_len_when_no_opt() {
        let key = valid_key();
        let mut buf = [0u8; HEADER_LEN];
        Header::write(&key, &mut buf).unwrap();
        let header = Header::get(&buf).unwrap();
        assert_eq!(header.skip(), HEADER_LEN);
    }

    #[test]
    fn skip_includes_opt_len() {
        let header = Header {
            version: 1,
            key: valid_key().to_vec(),
            opt_len: 100,
        };
        assert_eq!(header.skip(), HEADER_LEN + 100);
    }
}
