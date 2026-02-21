# Common Errors & Troubleshooting

This document lists errors you may encounter while using the LightRAG memory plugin, along with diagnostic steps and solutions.

## Quick‑Reference Table

| Symptom | Likely Cause | Diagnostic Steps | Solution |
|---------|--------------|------------------|----------|
| **Plugin fails to load** | Missing/invalid `openclaw.plugin.json`, TypeScript errors, ID mismatch | Check Gateway logs, run `npx tsc --noEmit`, verify manifest | Fix JSON syntax, install dependencies, ensure plugin ID matches directory name, restart Gateway |
| **401 Unauthorized** | Invalid or missing API key | Verify `apiKey` in config matches LightRAG server’s `.env`, check LightRAG logs for auth failures | Update plugin config with correct API key, restart Gateway |
| **Connection refused (ECONNREFUSED)** | LightRAG server not running, wrong `baseUrl` | `curl http://127.0.0.1:8787/health`, check server process | Start LightRAG server (`npm run dev`), correct `baseUrl` in config, restart Gateway |
| **No such table: vec_chunks** | Database schema outdated | Check LightRAG server logs for SQLite errors | Run migrations (`npm run migrate`), if persists delete `data/lightrag.db` and restart server |
| **Memory search returns empty results** | No documents ingested, embedding mismatch, query too specific | Enable `debug: true`, query LightRAG directly, check ingestion logs | Ensure `autoIngest: true`, verify hooks fire, broaden query, check embedding model consistency |
| **High latency on AI turns** | Recall queries adding network + embedding time | Measure round‑trip with `curl`, check LightRAG server CPU | Reduce `maxRecallResults`, run LightRAG on localhost, disable `autoRecall` for low‑latency channels |
| **Plugin config changes not applied** | Gateway not restarted after config change | `openclaw plugins info memory-lightrag-local` shows old config | Restart Gateway: `openclaw gateway restart` |
| **Missing conversation context in recalled memories** | `captureMode: "all"` strips context blocks | Compare raw conversation vs ingested text | Set `captureMode: "everything"` to retain full context |
| **LightRAG server crashes under load** | SQLite locking, memory limits, high concurrency | Monitor server logs, check CPU/memory usage | Limit concurrent ingestion, upgrade to PostgreSQL, scale server resources |
| **Duplicate memories ingested** | Same assistant response captured multiple times | Check deduplication signature in logs | Plugin deduplicates automatically; ensure `debug` logs show `capture dedupe skip` |
| **Memory ingestion skipping short messages** | `minCaptureLength` filter discarding messages | Check `debug` logs for `capture skip (no eligible text)` | Adjust `minCaptureLength` (default 10) to capture shorter messages |
| **Recall returns irrelevant snippets** | Query too vague, embedding model not tuned | Inspect recalled snippets, test with specific keywords | Improve query specificity, fine‑tune embedding model, adjust `maxRecallResults` |
| **Gateway logs show `fetch failed: network error`** | Intermittent network issues, firewall blocking | Test connectivity with `curl`, check firewall rules | Ensure stable network, allow traffic on LightRAG port, implement retry logic in custom script |
| **LightRAG web dashboard inaccessible** | Server binding to wrong interface, port conflict | `netstat -tulpn | grep 8787`, check server config | Update LightRAG server config to bind to `0.0.0.0` or correct port |
| **Memory inbox actions fail with 404** | Invalid `itemId`, memory already processed | Verify item exists via `GET /adapter/memory/inbox` | Use correct `itemId`, check item status before action |
| **Embedding model fails to load** | Missing model files, insufficient memory | Check LightRAG server logs for embedding errors | Download model manually, increase server memory, choose smaller model |
| **SQLite database locked** | Concurrent writes from multiple processes | Check LightRAG logs for `SQLITE_BUSY` | Use `busy_timeout`, limit concurrent writes, switch to PostgreSQL |
| **Plugin logs `capture skip (no assistant output)`** | Last turn contains only user messages | Review conversation turn structure | Ensure assistant response exists; plugin only ingests turns with assistant output |
| **Memory recall injects too much context** | `maxRecallResults` too high, snippets long | Check length of injected `<lightrag-context>` | Reduce `maxRecallResults`, enable `captureMode: "all"` to trim context blocks |
| **LightRAG server returns 502 Bad Gateway** | Server crashed or proxy misconfigured | Check server process, review reverse proxy config | Restart LightRAG server, fix proxy settings, monitor server health |
| **Plugin fails after OpenClaw upgrade** | Breaking API changes in OpenClaw SDK | Compare plugin SDK version with OpenClaw version | Update plugin to compatible SDK version, check migration notes |
| **Memory not shared across channels** | Different `channelId` leads to separate conversation IDs | Verify `conversationId` normalization across channels | Override `conversationId` in hooks to unify across channels |

## Detailed Troubleshooting Guides

### 1. Plugin fails to load

**Symptoms:**
- Plugin does not appear in `openclaw plugins list`.
- Gateway logs show `Plugin "memory-lightrag-local" failed to load`.

**Diagnosis:**

1. **Check Gateway logs** for the exact error:
   ```bash
   openclaw gateway logs | grep -A 5 -B 5 memory-lightrag-local
   ```

2. **Verify manifest file:**
   ```bash
   cd /path/to/plugin
   jq . openclaw.plugin.json
   ```
   Ensure the `id` field matches the plugin directory name.

3. **Check TypeScript compilation:**
   ```bash
   npx tsc --noEmit
   ```
   Fix any reported errors.

4. **Ensure dependencies are installed:**
   ```bash
   npm install
   ```

**Solution:**
- Fix the underlying issue (syntax, missing files, version mismatch).
- Restart the Gateway: `openclaw gateway restart`.

### 2. 401 Unauthorized on API calls

**Symptoms:**
- Gateway logs show `401 Unauthorized` when plugin tries to call LightRAG server.
- Memory ingestion/recall silently fails.

**Diagnosis:**
- Compare the `apiKey` in your plugin config with the `API_KEY` environment variable in the LightRAG server’s `.env` file.
- Verify the LightRAG server expects the key in the `X-API-Key` header (default).

**Solution:**
- Update the plugin config with the correct API key.
- Restart the Gateway.

**Pro tip:** Use environment variables to avoid hard‑coding keys:
```json5
{
  plugins: {
    entries: {
      "memory-lightrag-local": {
        config: {
          apiKey: "${LIGHTRAG_API_KEY}",
          // ...
        }
      }
    }
  }
}
```

### 3. Connection refused (ECONNREFUSED)

**Symptoms:**
- Logs show `fetch failed: connect ECONNREFUSED 127.0.0.1:8787`.

**Diagnosis:**
1. **Check if LightRAG server is running:**
   ```bash
   curl -v http://127.0.0.1:8787/health 2>&1 | head -20
   ```
2. **Verify the `baseUrl` in plugin config** matches the server’s address and port.
3. **Check for firewall rules** blocking localhost traffic.

**Solution:**
- Start the LightRAG server:
  ```bash
  cd /path/to/openclaw-lightrag-local/server
  npm run dev
  ```
- If the server runs on a different host/port, update `baseUrl`.
- Restart the Gateway after changes.

### 4. No such table: vec_chunks

**Symptoms:**
- LightRAG server logs show `SqliteError: no such table: vec_chunks`.
- Ingestion or query endpoints return 500.

**Diagnosis:**
The database schema is missing or outdated, likely because migrations haven’t been run after an update.

**Solution:**
1. **Run migrations:**
   ```bash
   cd /path/to/openclaw-lightrag-local/server
   npm run migrate
   ```
2. **If the problem persists,** delete the SQLite file and restart the server (this will wipe all existing memories):
   ```bash
   rm data/lightrag.db
   npm run migrate
   npm run dev
   ```
3. **Consider backing up** the database file before deletion.

### 5. Memory search returns empty results

**Symptoms:**
- `memory_search` tool returns no snippets, even though conversations have been ingested.

**Diagnosis Steps:**

1. **Verify ingestion is happening:**
   - Enable `debug: true` in plugin config.
   - Restart Gateway and observe logs for `capture ok` or `inbound ingest ok`.
   - If no ingestion logs appear, check that `autoIngest: true` and hooks are firing.

2. **Query LightRAG directly:**
   ```bash
   curl -H "x-api-key: YOUR_KEY" "http://127.0.0.1:8787/query?q=test"
   ```
   If this returns results, the plugin’s query logic may be at fault.

3. **Check embedding model consistency:**
   - Ensure the same embedding model is used for ingestion and query (default is `all-MiniLM-L6-v2`).
   - If you changed the model, re‑ingest all memories.

4. **Inspect ingested documents:**
   - Visit the LightRAG web dashboard (`http://127.0.0.1:8787`) to browse stored memories.

**Solution:**
- Ensure `autoIngest: true` and that conversation hooks are active.
- Broaden your search query (use more generic terms).
- Re‑ingest historical conversations if embedding model changed.

### 6. High latency on AI turns

**Symptoms:**
- Each AI turn takes noticeably longer when `autoRecall` is enabled.

**Diagnosis:**
- Measure the round‑trip time to LightRAG:
  ```bash
  time curl -H "x-api-key: YOUR_KEY" "http://127.0.0.1:8787/query?q=test" > /dev/null
  ```
- Check LightRAG server CPU usage during recall.

**Mitigation:**
- **Reduce `maxRecallResults`** (default 8) to 3–5.
- **Ensure LightRAG server is on localhost** (network latency minimal).
- **Consider disabling `autoRecall`** for high‑frequency channels and using explicit `memory_search` only when needed.
- **Upgrade LightRAG server hardware** or use a faster embedding model (e.g., `all-MiniLM-L6-v2` is faster than larger models).

### 7. Plugin config changes not applied

**Symptoms:**
- Changes to `plugins.entries.memory-lightrag-local.config` seem to have no effect.

**Diagnosis:**
- The Gateway caches plugin configuration at startup.

**Solution:**
```bash
openclaw gateway restart
```

**Verify:**
```bash
openclaw plugins info memory-lightrag-local
```

### 8. Missing conversation context in recalled memories

**Symptoms:**
- Recalled snippets lack surrounding context (e.g., only a single line).

**Diagnosis:**
- The `captureMode` setting determines whether injected `<lightrag-context>` blocks are stripped.
- `all` (default) removes them; `everything` keeps them.

**Solution:**
- Set `captureMode: "everything"` to retain full conversation context.
- Be aware that this may increase storage and recall noise.

### 9. LightRAG server crashes under load

**Symptoms:**
- LightRAG server process dies when many ingestion requests arrive at once.

**Diagnosis:**
- Check server logs for out‑of‑memory errors or SQLite locking issues.
- Monitor CPU and memory usage during peak loads.

**Mitigation:**
- **Limit concurrent ingestion** by adjusting OpenClaw’s hook concurrency (advanced configuration).
- **Upgrade to PostgreSQL** backend for better concurrency (LightRAG feature).
- **Scale server resources** (RAM, CPU).
- **Implement a queue** (e.g., Redis) to buffer ingestion requests.

### 10. Getting Help

If you encounter an error not listed here:

1. **Check the Gateway logs**:
   ```bash
   journalctl -u openclaw-gateway -n 100
   ```
   or
   ```bash
   openclaw gateway logs
   ```

2. **Enable `debug: true`** in the plugin config, reproduce the issue, and examine the logs.

3. **Search the [OpenClaw Discord](https://discord.com/invite/clawd)** for similar issues.

4. **Open an issue** on the GitHub repository with:
   - OpenClaw version (`openclaw --version`)
   - Plugin version (from `package.json`)
   - LightRAG server version
   - Relevant log excerpts
   - Steps to reproduce