//! Comprehensive tests for cart-rs streaming functionality

use super::*;
use bytes::Bytes;
use generic_array::typenum::U16;
use std::io::Cursor;
use tokio::io::BufReader;

/// Helper to create a valid 16-byte key as GenericArray
fn test_key() -> GenericArray<u8, U16> {
    GenericArray::clone_from_slice(b"SecretCornIs16!!")
}

/// Helper to create a key from a different value
fn alt_key() -> GenericArray<u8, U16> {
    GenericArray::clone_from_slice(b"AnotherKey12345!")
}

// ==================== CartStream construction tests ====================

#[test]
fn cart_stream_new_accepts_valid_key() {
    let data = Cursor::new(b"test data");
    let key = test_key();
    let result = CartStream::new(BufReader::new(data), &key);
    assert!(result.is_ok());
}

#[test]
fn cart_stream_new_rejects_invalid_key_length() {
    let data = Cursor::new(b"test data");
    let key: GenericArray<u8, generic_array::typenum::U10> =
        GenericArray::clone_from_slice(b"0123456789");
    let result = CartStream::new(BufReader::new(data), &key);
    assert!(result.is_err());
}

// ==================== Shared helpers ====================

/// Cart data and then uncart it, asserting the round-trip produces the original bytes.
async fn assert_cart_round_trip(original: &[u8]) {
    let key = test_key();
    let input = BufReader::new(Cursor::new(original));
    let mut cart_stream = CartStream::new(input, &key).unwrap();
    let mut carted = Vec::new();
    tokio::io::copy(&mut cart_stream, &mut carted).await.unwrap();
    let mut uncart_stream = UncartStream::new(BufReader::new(Cursor::new(carted)));
    let mut uncarted = Vec::new();
    tokio::io::copy(&mut uncart_stream, &mut uncarted).await.unwrap();
    assert_eq!(uncarted, original);
}

/// Cart data and return the raw carted bytes.
async fn cart_data(original: &[u8]) -> Vec<u8> {
    let key = test_key();
    let input = BufReader::new(Cursor::new(original));
    let mut cart_stream = CartStream::new(input, &key).unwrap();
    let mut carted = Vec::new();
    tokio::io::copy(&mut cart_stream, &mut carted).await.unwrap();
    carted
}

// ==================== CartStream round-trip tests ====================

#[tokio::test]
async fn cart_uncart_round_trip_small_file() {
    let original = b"Hello, World! This is a small test file.";
    let carted = cart_data(original).await;
    assert!(carted.len() > header::HEADER_LEN + footer::FOOTER_LEN);
    assert_eq!(&carted[..4], b"CART");
    assert_cart_round_trip(original).await;
}

#[tokio::test]
async fn cart_uncart_round_trip_large_file() {
    let pattern = b"This is a repeating pattern for large file testing.\n";
    let original: Vec<u8> = pattern.repeat(20000);
    assert_cart_round_trip(&original).await;
}

#[tokio::test]
async fn cart_uncart_round_trip_binary_data() {
    let original: Vec<u8> = (0..=255u8).collect::<Vec<_>>().repeat(100);
    assert_cart_round_trip(&original).await;
}

#[tokio::test]
async fn cart_uncart_round_trip_empty_content() {
    let carted = cart_data(b"").await;
    assert!(carted.len() >= header::HEADER_LEN + footer::FOOTER_LEN);
    assert_cart_round_trip(b"").await;
}

#[tokio::test]
async fn cart_uncart_round_trip_single_byte() {
    assert_cart_round_trip(b"X").await;
}

#[tokio::test]
async fn cart_with_different_keys_produces_different_output() {
    let original = b"Same input data";
    let key1 = test_key();
    let key2 = alt_key();

    // Cart with key1
    let input1 = BufReader::new(Cursor::new(original.as_slice()));
    let mut cart_stream1 = CartStream::new(input1, &key1).unwrap();
    let mut carted1 = Vec::new();
    tokio::io::copy(&mut cart_stream1, &mut carted1).await.unwrap();

    // Cart with key2
    let input2 = BufReader::new(Cursor::new(original.as_slice()));
    let mut cart_stream2 = CartStream::new(input2, &key2).unwrap();
    let mut carted2 = Vec::new();
    tokio::io::copy(&mut cart_stream2, &mut carted2).await.unwrap();

    // Headers will be different (different keys stored)
    // Encrypted content will also be different
    assert_ne!(carted1, carted2);
}

// ==================== UncartStream error handling tests ====================

#[tokio::test]
async fn uncart_stream_rejects_empty_input() {
    let empty: &[u8] = b"";
    let mut uncart_stream = UncartStream::new(BufReader::new(Cursor::new(empty)));
    let mut output = Vec::new();
    let result = tokio::io::copy(&mut uncart_stream, &mut output).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn uncart_stream_rejects_malformed_header() {
    // Create data that's too short to be a valid header
    let malformed = b"CAR"; // Only 3 bytes, missing a byte from magic number
    let mut uncart_stream = UncartStream::new(BufReader::new(Cursor::new(malformed.as_slice())));
    let mut output = Vec::new();
    let result = tokio::io::copy(&mut uncart_stream, &mut output).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn uncart_stream_rejects_wrong_magic_number() {
    // Create a 38-byte "header" with wrong magic number
    let mut wrong_magic = [0u8; header::HEADER_LEN];
    wrong_magic[..4].copy_from_slice(b"TRAC"); // Footer magic, not header
    let mut uncart_stream = UncartStream::new(BufReader::new(Cursor::new(wrong_magic.as_slice())));
    let mut output = Vec::new();
    let result = tokio::io::copy(&mut uncart_stream, &mut output).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn uncart_stream_handles_corrupted_data() {
    let original = b"Test data for corruption";
    let key = test_key();

    // Cart the data
    let input = BufReader::new(Cursor::new(original.as_slice()));
    let mut cart_stream = CartStream::new(input, &key).unwrap();
    let mut carted = Vec::new();
    tokio::io::copy(&mut cart_stream, &mut carted).await.unwrap();

    // Corrupt some bytes in the middle of the encrypted section
    if carted.len() > header::HEADER_LEN + 10 {
        carted[header::HEADER_LEN + 5] ^= 0xFF;
        carted[header::HEADER_LEN + 6] ^= 0xFF;
    }

    // Try to uncart - should either fail or produce different output
    let mut uncart_stream = UncartStream::new(BufReader::new(Cursor::new(carted)));
    let mut uncarted = Vec::new();
    let result = tokio::io::copy(&mut uncart_stream, &mut uncarted).await;

    // Either it errors, or the data is different (decryption/decompression failed)
    if result.is_ok() {
        assert_ne!(uncarted, original.to_vec());
    }
}

// ==================== CartStreamManual tests ====================

#[test]
fn cart_stream_manual_new_accepts_valid_key() {
    let key = test_key();
    let result = CartStreamManual::new(&key, 1024);
    assert!(result.is_ok());
}

#[test]
fn cart_stream_manual_ready_starts_at_header_len() {
    let key = test_key();
    let cart = CartStreamManual::new(&key, 1024).unwrap();
    // After creation, ready() returns skip value which starts at HEADER_LEN
    assert_eq!(cart.ready(), header::HEADER_LEN);
}

#[test]
fn cart_stream_manual_finish_before_data_returns_error() {
    let key = test_key();
    let mut cart = CartStreamManual::new(&key, 1024).unwrap();
    // Calling finish without providing any data should error
    let result = cart.finish();
    assert!(result.is_err());
    match result.unwrap_err() {
        Error::FinishBeforeData => (),
        other => panic!("Expected FinishBeforeData, got {:?}", other),
    }
}

#[test]
fn cart_stream_manual_consume_resets_skip() {
    let key = test_key();
    let mut cart = CartStreamManual::new(&key, 1024).unwrap();
    assert_eq!(cart.ready(), header::HEADER_LEN);
    cart.consume();
    assert_eq!(cart.ready(), 0);
}


// ==================== Header/Footer structure tests ====================

#[tokio::test]
async fn carted_file_starts_with_cart_magic() {
    let carted = cart_data(b"test").await;
    assert_eq!(&carted[..4], b"CART");
}

#[tokio::test]
async fn carted_file_ends_with_trac_magic() {
    let carted = cart_data(b"test").await;
    let footer_start = carted.len() - footer::FOOTER_LEN;
    assert_eq!(&carted[footer_start..footer_start + 4], b"TRAC");
}

#[tokio::test]
async fn carted_file_contains_key_in_header() {
    let key = test_key();
    let carted = cart_data(b"test").await;
    let parsed_header = header::Header::get(&carted[..header::HEADER_LEN]).unwrap();
    assert_eq!(parsed_header.key, key.as_slice());
}

// ==================== Error type tests ====================

#[test]
fn error_display_generic() {
    let err = Error::new("test error message");
    let display = format!("{}", err);
    assert!(display.contains("test error message"));
}

#[test]
fn error_display_finish_before_data() {
    let err = Error::FinishBeforeData;
    let display = format!("{}", err);
    assert!(display.contains("FinishBeforeData"));
}

#[test]
fn error_from_io_error() {
    let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
    let err: Error = io_err.into();
    match err {
        Error::IO(_) => (),
        _ => panic!("Expected IO error variant"),
    }
}

// ==================== Edge case tests ====================

#[tokio::test]
async fn cart_uncart_preserves_null_bytes() {
    assert_cart_round_trip(&vec![0u8; 1000]).await;
}

#[tokio::test]
async fn cart_uncart_preserves_high_entropy_data() {
    let original: Vec<u8> = (0..10000).map(|i| ((i * 17 + 31) % 256) as u8).collect();
    assert_cart_round_trip(&original).await;
}

#[tokio::test]
async fn cart_uncart_highly_compressible_data() {
    let original = vec![b'A'; 100000];
    let carted = cart_data(&original).await;
    assert!(carted.len() < original.len() / 10);
    assert_cart_round_trip(&original).await;
}
