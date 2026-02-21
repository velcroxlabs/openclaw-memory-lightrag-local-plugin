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

## Use Cases

### 1. Long‑term conversation memory
The plugin automatically ingests every conversation turn into LightRAG, building a searchable memory of past interactions. This allows the AI to recall relevant context from previous sessions.

### 2. Semantic search over ingested content
Use the `memory_search` tool (or the built‑in recall) to find related snippets by natural‑language queries.

### 3. Conflict detection and deduplication
LightRAG can identify duplicate or conflicting memories, helping to keep the memory store clean.

### 4. Custom memory lifecycle
Configure TTLs, review states, and archival policies via LightRAG’s own admin UI.

## Known Issues & Limitations

### Authentication
- The plugin requires a valid API key for the LightRAG server. If the key is missing or incorrect, ingestion and recall will fail silently (check Gateway logs).

### Server availability
- If the LightRAG server is down, the plugin will log errors but OpenClaw will continue operating (memory operations will be skipped).

### Performance
- Ingestion adds a small overhead to each conversation turn (HTTP POST to `/ingest`). For high‑volume deployments, consider batching.

### Schema changes
- LightRAG’s API may evolve; this plugin is pinned to a specific version of the LightRAG local server. Check compatibility before upgrading either side.

## Error Handling

Common error scenarios and how to diagnose them:

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| `401 Unauthorized` | Invalid or missing API key | Verify `apiKey` in plugin config matches the server’s `.env` |
| `Connection refused` | LightRAG server not running | Start the server (`npm run dev` in `openclaw-lightrag-local/server`) |
| `no such table: vec_chunks` | LightRAG database schema mismatch | Run database migrations (`npm run migrate` in the server directory) |
| `Memory search returns empty` | No documents ingested | Check that `autoIngest` is `true` and that hooks are firing (enable `debug` logging) |

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