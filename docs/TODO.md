# Pending Tests, Improvements & Known Limitations

This file tracks missing tests, known gaps, planned enhancements, and technical debt for the LightRAG memory plugin.

## Tests Needed

### Unit Tests (Priority: High)

| Test Module | What to Test | Status | Notes |
|-------------|--------------|--------|-------|
| `adapter-client.ts` | HTTP client error handling (network errors, 4xx/5xx responses), retry logic, timeout handling | Not started | Mock `fetch` with `jest` or `vitest`; simulate network failures |
| `config.ts` | Config schema parsing, default values, validation of `baseUrl`, `apiKey`, numeric bounds, enum values | Not started | Ensure invalid config throws meaningful errors |
| `hooks-capture.ts` | Capture logic for different `captureMode` settings, deduplication, `minCaptureLength` filtering, conversation ID normalization | Not started | Mock `AdapterClient.ingest` and verify payloads |
| `hooks-recall.ts` | Recall injection, context formatting, `maxRecallResults` limiting, error handling when LightRAG fails | Not started | Mock `AdapterClient.query` and verify prepended context |
| `sanitize.ts` | `sanitizeCapturedText` strips context blocks, `extractText` handles various message formats, `normalizeConversationId` canonicalizes IDs | Not started | Edge cases: empty strings, malformed objects, special characters |

### Integration Tests (Priority: Medium)

| Test | Description | Status |
|------|-------------|--------|
| End‑to‑end with mock LightRAG server | Spin up a lightweight mock server that mimics LightRAG API, test full plugin lifecycle | Not started |
| Plugin lifecycle | Load, enable, disable, unload hooks; verify resources cleaned up | Not started |
| Compatibility with OpenClaw Gateway 2026.1+ | Test against actual Gateway versions; ensure SDK APIs are stable | Not started |
| Multi‑channel ingestion | Simulate messages from different channels, verify conversation IDs are isolated | Not started |
| Tool registration | Verify `memory_search`, `memory_inbox_list`, etc. are registered and respond | Not started |

### Performance Tests (Priority: Low)

| Test | Metric | Goal |
|------|--------|------|
| Latency added by `autoIngest` | Milliseconds per ingestion, throughput (messages/second) | < 50ms per ingestion under normal load |
| Latency added by `autoRecall` | Recall query round‑trip + embedding time, impact on AI turn time | < 200ms per recall with local LightRAG |
| Stress test: high‑volume ingestion | Memory usage, CPU, SQLite locking with 1000+ messages in rapid succession | No crashes, graceful degradation |
| Concurrent recalls | Multiple simultaneous recall queries, LightRAG server load | No dropped queries, stable latency |

## Missing Features

### Plugin Features (Priority Order)

1. **Bulk ingestion CLI tool** – Command‑line utility to ingest historical conversation logs (e.g., exported Telegram chats, Slack dumps). Should support JSON, CSV, plain text formats.
2. **Memory pruning hook** – Automatically archive/delete old memories based on configurable TTL (time‑to‑live). Integrate with LightRAG’s retention policies.
3. **Multi‑tenant memory isolation** – Support separate memory stores per user/channel via configurable `namespace` parameter. Requires LightRAG backend support.
4. **Embedding model customization** – Allow choosing different embedding models (via LightRAG server configuration). Plugin should adapt to model‑specific dimensions.
5. **Prometheus metrics** – Expose metrics (ingestion count, recall latency, error rates) for monitoring via OpenClaw’s metrics pipeline.
6. **Memory relevance feedback loop** – Use `memory_feedback` tool results to improve future recall ranking (requires LightRAG server‑side learning).
7. **Semantic clustering of memories** – Group related memories into topics automatically (advanced LightRAG feature).

### Documentation (Priority: Medium)

- **Video tutorial** – Screen recording showing setup, configuration, and typical use.
- **API reference** – Detailed documentation of LightRAG API endpoints used by the plugin (including request/response schemas).
- **Troubleshooting flowchart** – Visual guide for diagnosing common issues (exportable as PNG/PDF).
- **Example configurations** – Real‑world `openclaw.json` snippets for different scales (single user, team, enterprise).
- **Security guide** – Best practices for securing LightRAG server, API keys, and sensitive memories.

### Developer Experience (Priority: Low)

- **Plugin template** – Scaffold for creating new memory plugins (e.g., `create-openclaw-memory-plugin`).
- **TypeScript source maps** – Improve debugging experience in development mode.
- **Live‑reload support** – Hot‑reload plugin changes during development (requires Gateway support).
- **Integration test harness** – Reusable test utilities for simulating OpenClaw hooks and events.

## Known Limitations

### Technical Debt

| Area | Issue | Impact | Mitigation |
|------|-------|--------|------------|
| Error handling | Network errors are logged but not gracefully recovered; plugin may stop ingesting until Gateway restart | Medium | Implement retry with exponential backoff, circuit‑breaker pattern |
| Configuration validation | Relies on OpenClaw’s config validation; custom validation inside plugin is minimal | Low | Add Zod schema validation with detailed error messages |
| Dependency pinning | Plugin depends on specific version of LightRAG local server; breaking API changes require plugin updates | High | Document compatibility matrix, test against multiple LightRAG versions |
| Logging | Debug logs are verbose but not structured; difficult to parse automatically | Low | Adopt structured logging (JSON) when OpenClaw supports it |
| Hook concurrency | No control over concurrent execution of `agent_end` hooks; may overload LightRAG server | Medium | Add configurable concurrency limit or queue |

### Scalability

| Limitation | Description | Workaround |
|------------|-------------|------------|
| SQLite backend | LightRAG local uses SQLite, which may not scale beyond single‑user / small‑team usage (locking, write throughput) | Use PostgreSQL backend (LightRAG feature), run multiple LightRAG instances |
| No clustering | Plugin cannot distribute memory across multiple LightRAG instances | Manual sharding by channel/user, load balancer in front of LightRAG |
| Embedding model size | Default `all-MiniLM-L6-v2` uses ~80MB RAM; larger models require more memory | Choose smaller models, run on GPU‑enabled server |
| No incremental embedding | Re‑embedding entire memory store when model changes | LightRAG may support incremental updates; otherwise re‑ingest all memories |

### Security

| Concern | Description | Recommendation |
|---------|-------------|----------------|
| API key exposure | API key stored in plaintext in `openclaw.json` | Use OpenClaw’s secret management when available, environment variables, vault integration |
| No encryption at rest | LightRAG stores embeddings and text in plain SQLite; sensitive conversations are not encrypted | Encrypt disk volume, use SQLite encryption extensions, store only non‑sensitive data |
| No authentication between plugin and LightRAG | Only API key; no mutual TLS or certificate‑based auth | Deploy LightRAG behind reverse proxy with client certificate authentication |
| Memory leakage across users | Multi‑tenant isolation not implemented; all memories are in same namespace | Use separate LightRAG instances per tenant, or wait for multi‑tenant support |

### Performance Bottlenecks

| Bottleneck | Typical Scenario | Improvement |
|------------|------------------|-------------|
| Network round‑trip | LightRAG server on different host | Colocate Gateway and LightRAG, use localhost or Unix sockets |
| Embedding computation | Recall queries require embedding the query string; CPU‑bound | Use faster embedding model, GPU acceleration, pre‑compute embeddings for common queries |
| SQLite write contention | High‑volume ingestion from multiple channels | Batch writes, increase `busy_timeout`, switch to PostgreSQL |
| Memory context injection | Large `maxRecallResults` inflates prompt size, increasing AI token usage | Limit `maxRecallResults`, trim snippets, compress context |

## Roadmap

### Short‑term (next 1‑2 months)
1. Add unit test suite (coverage > 80%).
2. Implement bulk ingestion CLI tool.
3. Improve error handling with retries and circuit‑breaker pattern.
4. Document advanced usage patterns (USAGE.md).

### Medium‑term (3‑6 months)
1. Support LightRAG’s PostgreSQL backend (when available).
2. Add multi‑tenant isolation (namespace support).
3. Create plugin template and developer guide.
4. Add Prometheus metrics integration.
5. Security review and hardening.

### Long‑term (6+ months)
1. Integrate with OpenClaw’s upcoming memory‑management UI.
2. Support for memory “graph” relationships (linking related memories).
3. Cross‑plugin memory sharing (e.g., with calendar, email plugins).
4. Adaptive recall tuning based on feedback.
5. Offline embedding cache to reduce latency.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on submitting pull requests, reporting issues, and proposing new features.

**Want to help?** Pick an item from the tables above, comment on the relevant GitHub issue, and submit a PR. We welcome contributions of all sizes.