FROM rust:1.87-bookworm

# Install coverage tools
RUN rustup default nightly-2025-08-01
RUN rustup component add llvm-tools-preview
RUN cargo install cargo-llvm-cov

WORKDIR /app
COPY . .

# Run tests with coverage
CMD ["cargo", "llvm-cov", "--workspace", "--html", "--output-dir", "/coverage"]
