# OpenClaw Memory Plugin: LightRAG Local

This plugin integrates LightRAG local memory backend into OpenClaw, providing semantic search, auto‑ingestion, and recall capabilities.

## Features

- **Semantic memory search** via LightRAG local server.
- **Auto‑ingestion** of conversation content (hooks‑based).
- **Auto‑recall** of relevant memories before each AI turn.
- **Configurable capture modes** (`all` or `everything`).
- **Debug logging** for plugin diagnostics.

## Installation

### Prerequisites

1. A running LightRAG local server (see [LightRAG local](https://github.com/openclaw/openclaw-lightrag-local)).
2. OpenClaw Gateway version 2026.1 or later.

### Install the plugin

```bash
openclaw plugins install -l ./memory-lightrag-local
```

Or from npm (once published):

```bash
openclaw plugins install @openclaw/memory-lightrag-local
```

### Configuration

Add to your `openclaw.json`:

```json5
{
  plugins: {
    slots: {
      memory: "memory-lightrag-local"
    },
    entries: {
      "memory-lightrag-local": {
        enabled: true,
        config: {
          baseUrl: "http://127.0.0.1:8787",
          apiKey: "your-api-key-here",
          autoIngest: true,
          autoRecall: true,
          maxRecallResults: 8,
          captureMode: "all",
          minCaptureLength: 10,
          debug: false
        }
      }
    }
  }
}
```

Restart the Gateway after configuration changes.

### Dependencies

- **LightRAG local server** (v1.x) – provides the memory backend, embedding model, and storage. Must be running and accessible.
- **OpenClaw Gateway 2026.1+** – plugin SDK compatibility.
- **Node.js 18+** (for plugin development only).

Ensure the LightRAG server is configured with the same embedding model for ingestion and recall; changing models requires re‑ingestion of all memories.

## Use Cases

### 1. Personal Assistant with Long‑Term Memory
**Scenario:** Daily personal assistant across multiple channels (Telegram, Discord, etc.) that remembers preferences, past decisions, and important facts across sessions.

**How it works:**
- Every conversation turn is automatically ingested into LightRAG.
- When you ask “What did we decide about the vacation last week?”, the plugin recalls relevant snippets from memory and injects them into the AI’s context.
- The assistant answers with precise references to past conversations.

**Configuration:** `autoIngest: true`, `autoRecall: true`, `maxRecallResults: 5`.

### 2. Team Collaboration Bot
**Scenario:** Shared OpenClaw instance serving a team channel (e.g., Slack) that needs to remember decisions, action items, and shared knowledge.

**How it works:**
- Ingests messages from all team members.
- Provides semantic search over past discussions (“Find the decision about the Q4 budget”).
- Can be extended with custom metadata (e.g., tagging memories by project).

**Considerations:** Ensure LightRAG server is accessible to all team members; set `captureMode: "everything"` to retain full context.

### 3. Debugging and Support Agent
**Scenario:** OpenClaw as a support agent that interacts with users to troubleshoot issues, recalling similar past issues and solutions.

**How it works:**
- Ingests support tickets and resolution notes.
- When a new issue is described, the plugin recalls similar past issues and suggests known fixes.
- Reduces repetitive work for human agents.

**Configuration:** `maxRecallResults: 10` to provide more context; `debug: true` during initial setup.

### Additional Use Cases
For more scenarios (content creation, compliance audit, multi‑channel context sharing, custom memory workflows), see [USE_CASES.md](USE_CASES.md).

## Known Issues & Limitations

### Technical Limitations & Dependencies

| Category | Limitation | Impact | Workaround |
|----------|------------|--------|------------|
| **Authentication** | API key stored in plaintext in `openclaw.json` | Security risk if config file leaked | Use environment variables, OpenClaw secret management (when available) |
| **Server availability** | No automatic retry or circuit‑breaker | Failed operations are dropped, memory gaps | Monitor LightRAG server health, implement external retry logic |
| **Performance** | Ingestion adds HTTP overhead per turn | Latency increase (~50‑200ms per turn) | Batch ingestion, disable `autoIngest` for high‑volume channels |
| **Performance** | Recall adds network + embedding time | AI turn latency increased (~100‑500ms) | Reduce `maxRecallResults`, use localhost, disable `autoRecall` |
| **Scalability** | SQLite backend (default) | Limited concurrent writes, not for large teams | Use LightRAG PostgreSQL backend, shard by channel |
| **Scalability** | No clustering support | Memory not distributed across instances | Manual sharding, load balancer in front of LightRAG |
| **Schema changes** | LightRAG API may evolve | Plugin may break after server upgrade | Pin versions, check compatibility matrix before upgrading |
| **Security** | No encryption at rest | Sensitive conversations stored plaintext | Encrypt disk volume, use SQLite encryption extensions |
| **Error handling** | Network errors not gracefully recovered | Plugin may stop ingesting until Gateway restart | Implement retry logic in custom hooks, monitor logs |
| **Memory management** | No automatic pruning (TTL) | Database grows indefinitely | Use LightRAG's TTL settings, periodic manual cleanup |
| **Multi‑tenant isolation** | Single namespace for all memories | No separation between users/channels | Run separate LightRAG instances per tenant |

### Dependencies & Version Compatibility

- **LightRAG local server v1.x** – Must be running and accessible; compatible with embedding models supported by LightRAG (default: `all-MiniLM-L6-v2`).
- **OpenClaw Gateway 2026.1+** – Plugin uses SDK features introduced in 2026.1.
- **Node.js 18+** (for plugin development only) – Required to build TypeScript source.

**Embedding model consistency:** Changing the embedding model in LightRAG requires re‑ingestion of all existing memories; otherwise, recall quality degrades.

**Network topology:** For lowest latency, run LightRAG server on the same host as OpenClaw Gateway (localhost). Each network hop adds 1‑10ms.

### Performance Characteristics (Typical)

| Operation | Latency (localhost) | Throughput |
|-----------|---------------------|------------|
| Ingestion per message | 20‑100 ms | 10‑50 msg/sec (SQLite) |
| Recall query (top‑8) | 50‑300 ms | 5‑20 queries/sec |
| Embedding computation | 10‑50 ms per query | Depends on model & CPU |

**Note:** Latency scales with message length, embedding model size, and database size.

### Advanced Configuration & Workarounds

For detailed guidance on configuring capture parameters, custom hooks, and scaling strategies, see [USAGE.md](USAGE.md).

## Error Handling

Common error scenarios and how to diagnose them:

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| `401 Unauthorized` | Invalid or missing API key | Verify `apiKey` in plugin config matches the server’s `.env` |
| `Connection refused` | LightRAG server not running | Start the server (`npm run dev` in `openclaw-lightrag-local/server`) |
| `no such table: vec_chunks` | LightRAG database schema mismatch | Run database migrations (`npm run migrate` in the server directory) |
| `Memory search returns empty` | No documents ingested | Check that `autoIngest` is `true` and that hooks are firing (enable `debug` logging) |
| `Plugin fails to load` | Missing manifest, TypeScript errors, plugin ID mismatch | Check Gateway logs, verify `openclaw.plugin.json`, run `npx tsc --noEmit`, ensure dependencies installed |
| `High latency on AI turns` | Recall queries adding network round‑trip + embedding time | Reduce `maxRecallResults`, ensure LightRAG server on localhost, disable `autoRecall` for low‑latency channels |
| `Missing conversation context in recalled memories` | `captureMode` setting strips context | Set `captureMode: "everything"` to retain full conversation context |
| `LightRAG server crashes under load` | SQLite locking issues, memory limits | Monitor server resources, consider PostgreSQL backend for scaling |
| `Plugin config changes not applied` | Gateway not restarted after config changes | Restart Gateway with `openclaw gateway restart` |

## Testing

### Unit tests
Run the plugin’s own test suite (if available):

```bash
cd memory-lightrag-local
npm test
```

### Integration tests
1. Start a local LightRAG server.
2. Configure the plugin with `debug: true`.
3. Send a test message through OpenClaw and verify that ingestion and recall logs appear in the Gateway output.

### Manual verification
- Use the LightRAG web dashboard (`http://127.0.0.1:8787`) to browse ingested documents.
- Query the LightRAG API directly: `curl http://127.0.0.1:8787/query?q=test`.

### Pending Tests
The following tests are planned but not yet implemented:

#### Unit Tests
- `adapter-client.ts`: HTTP client error handling (network errors, 4xx/5xx responses).
- `config.ts`: Config schema parsing and default values.
- `hooks-capture.ts`: Capture logic for different `captureMode` settings.
- `hooks-recall.ts`: Recall injection and context formatting.
- `sanitize.ts`: Sensitive data stripping from captured text.

#### Integration Tests
- End‑to‑end test with a mock LightRAG server.
- Plugin lifecycle (load, enable, disable, unload).
- Compatibility with OpenClaw Gateway 2026.1+.

#### Performance Tests
- Latency added by `autoIngest` and `autoRecall` under typical conversation load.
- Stress test with high‑volume ingestion (1000+ messages).

For the full list of pending improvements, see [TODO.md](TODO.md).

## Roadmap & Missing Features

- [ ] **Bulk ingestion** of historical conversation logs.
- [ ] **Memory pruning** (automatic cleanup of old/low‑relevance memories).
- [ ] **Multi‑tenant support** (separate memory stores per user/channel).
- [ ] **Embedding customization** (allow choosing different embedding models).
- [ ] **Prometheus metrics** for monitoring ingestion/recall rates.

## Versioning

This plugin follows [Semantic Versioning](https://semver.org/). See `CHANGELOG.md` for release notes.

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Write tests for your changes.
4. Submit a pull request with a clear description.

## License

MIT