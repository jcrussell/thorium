FROM rust:1.87-bookworm

# Install nightly toolchain
RUN rustup default nightly-2025-08-01

# Set RUSTFLAGS for CPU features needed by gxhash
ENV RUSTFLAGS="-C target-feature=+aes,+sse2"

WORKDIR /app
COPY . .

# Run tests for a specific package or the whole workspace
CMD ["cargo", "test", "--workspace"]
