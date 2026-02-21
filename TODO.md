# Pending Tests & Improvements

This file tracks missing tests, known gaps, and planned enhancements for the plugin.

## Tests Needed

### Unit Tests
- [ ] `adapter-client.ts`: Test HTTP client error handling (network errors, 4xx/5xx responses).
- [ ] `config.ts`: Validate config schema parsing and default values.
- [ ] `hooks-capture.ts`: Verify capture logic for different `captureMode` settings.
- [ ] `hooks-recall.ts`: Test recall injection and context formatting.
- [ ] `sanitize.ts`: Ensure sensitive data (tokens, keys) is stripped from captured text.

### Integration Tests
- [ ] End‑to‑end test with a mock LightRAG server.
- [ ] Test plugin lifecycle (load, enable, disable, unload).
- [ ] Verify compatibility with OpenClaw Gateway 2026.1+.

### Performance Tests
- [ ] Measure latency added by `autoIngest` and `autoRecall` under typical conversation load.
- [ ] Stress test with high‑volume ingestion (1000+ messages).

## Missing Features

### Plugin Features
- [ ] **Bulk ingestion CLI tool**: Command to ingest historical conversation logs (e.g., from exported Telegram chats).
- [ ] **Memory pruning hook**: Automatically archive/delete old memories based on configurable TTL.
- [ ] **Multi‑tenant memory isolation**: Support separate memory stores per user/channel via configurable `namespace` parameter.
- [ ] **Embedding model customization**: Allow choosing different embedding models (via LightRAG server configuration).
- [ ] **Prometheus metrics**: Expose metrics (ingestion count, recall latency, error rates) for monitoring.

### Documentation
- [ ] **Video tutorial**: Screen recording showing setup, configuration, and typical use.
- [ ] **API reference**: Detailed documentation of LightRAG API endpoints used by the plugin.
- [ ] **Troubleshooting flowchart**: Visual guide for diagnosing common issues.

### Developer Experience
- [ ] **Plugin template**: Scaffold for creating new memory plugins (e.g., `create-openclaw-memory-plugin`).
- [ ] **TypeScript source maps**: Improve debugging experience in development mode.
- [ ] **Live‑reload support**: Hot‑reload plugin changes during development (requires Gateway support).

## Known Limitations

### Technical Debt
- **Error handling**: Some network errors are logged but not gracefully recovered; plugin may stop ingesting until Gateway restart.
- **Configuration validation**: The plugin relies on OpenClaw’s config validation; custom validation inside the plugin is minimal.
- **Dependency pinning**: The plugin depends on a specific version of LightRAG local server; breaking API changes will require plugin updates.

### Scalability
- **SQLite backend**: LightRAG local uses SQLite, which may not scale beyond single‑user / small‑team usage.
- **No clustering**: The plugin cannot distribute memory across multiple LightRAG instances.

### Security
- **API key exposure**: The API key is stored in plaintext in `openclaw.json`. Consider integrating with OpenClaw’s secret management.
- **No encryption at rest**: LightRAG stores embeddings and text in plain SQLite; sensitive conversations are not encrypted.

## Roadmap

### Short‑term (next 1‑2 months)
1. Add unit test suite.
2. Implement bulk ingestion CLI.
3. Improve error handling with retries and circuit‑breaker pattern.

### Medium‑term (3‑6 months)
1. Support LightRAG’s upcoming PostgreSQL backend.
2. Add multi‑tenant isolation.
3. Create plugin template and developer guide.

### Long‑term (6+ months)
1. Integrate with OpenClaw’s upcoming memory‑management UI.
2. Support for memory “graph” relationships (linking related memories).
3. Cross‑plugin memory sharing (e.g., with calendar, email plugins).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on submitting pull requests, reporting issues, and proposing new features.