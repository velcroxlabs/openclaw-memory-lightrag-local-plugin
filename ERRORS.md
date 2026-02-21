# Common Errors & Troubleshooting

This document lists errors you may encounter while using the LightRAG memory plugin, along with diagnostic steps and solutions.

## Plugin fails to load

**Symptoms:**
- Plugin does not appear in `openclaw plugins list`.
- Gateway logs show `Plugin "memory-lightrag-local" failed to load`.

**Possible causes:**

1. **Missing manifest:** `openclaw.plugin.json` not found or invalid.
   - Verify the file exists in the plugin directory.
   - Check JSON syntax: `jq . openclaw.plugin.json`.

2. **TypeScript compilation errors:**
   - Run `npx tsc --noEmit` in the plugin directory to check for TypeScript errors.
   - Ensure all dependencies are installed (`npm install`).

3. **Plugin ID mismatch:**
   - The `id` in `openclaw.plugin.json` must match the directory name or configured entry.

**Solution:**
- Check Gateway logs for detailed error messages.
- Fix any syntax or compilation issues.
- Restart the Gateway.

## 401 Unauthorized on API calls

**Symptoms:**
- Gateway logs show `401 Unauthorized` when plugin tries to call LightRAG server.
- Memory ingestion/recall silently fails.

**Diagnosis:**
- Verify the `apiKey` in plugin config matches the `API_KEY` in LightRAG server’s `.env`.
- Check that the LightRAG server is expecting the key in the `X-API-Key` header (default).

**Solution:**
- Update the plugin config with the correct API key.
- Restart the Gateway.

## Connection refused / ECONNREFUSED

**Symptoms:**
- Logs show `fetch failed: connect ECONNREFUSED 127.0.0.1:8787`.

**Diagnosis:**
- LightRAG server is not running.
- The `baseUrl` is incorrect.

**Solution:**
- Start the LightRAG server: `cd /path/to/openclaw-lightrag-local/server && npm run dev`.
- Verify the server responds: `curl http://127.0.0.1:8787/health`.
- Adjust `baseUrl` if the server runs on a different host/port.

## No such table: vec_chunks

**Symptoms:**
- LightRAG server logs show `SqliteError: no such table: vec_chunks`.
- Ingestion or query endpoints return 500.

**Diagnosis:**
- LightRAG database schema is outdated or missing.

**Solution:**
- Run database migrations: `cd /path/to/openclaw-lightrag-local/server && npm run migrate`.
- If the problem persists, delete the SQLite file (`data/lightrag.db`) and restart the server (this will wipe all existing memories).

## Memory search returns empty results

**Symptoms:**
- `memory_search` tool returns no snippets, even though conversations have been ingested.

**Diagnosis:**
1. **No documents ingested:** Check that `autoIngest` is `true` and that hooks are firing.
2. **Embedding mismatch:** The embedding model used during ingestion differs from the one used for search (unlikely in local setup).
3. **Query too specific:** Try a broader query.

**Debug steps:**
- Enable `debug: true` in plugin config and watch Gateway logs for ingestion events.
- Query LightRAG directly: `curl "http://127.0.0.1:8787/query?q=test"`.
- Browse ingested documents via the LightRAG web dashboard (`http://127.0.0.1:8787`).

## High latency on AI turns

**Symptoms:**
- Each AI turn takes noticeably longer when `autoRecall` is enabled.

**Diagnosis:**
- Recall query to LightRAG server adds network round‑trip + embedding computation time.

**Mitigation:**
- Reduce `maxRecallResults` (default 8).
- Ensure LightRAG server is on the same machine as the Gateway (localhost).
- Consider disabling `autoRecall` for low‑latency channels and using explicit `memory_search` only when needed.

## Plugin config changes not applied

**Symptoms:**
- Changes to `plugins.entries.memory-lightrag-local.config` seem to have no effect.

**Diagnosis:**
- Gateway must be restarted after plugin config changes.

**Solution:**
- Restart the Gateway: `openclaw gateway restart`.
- Verify the config is loaded: `openclaw plugins info memory-lightrag-local`.

## Missing conversation context in recalled memories

**Symptoms:**
- Recalled snippets lack surrounding context (e.g., only a single line).

**Diagnosis:**
- The `captureMode` setting influences how much context is ingested.
- `all` (default) strips injected context blocks; `everything` keeps the raw conversation.

**Solution:**
- Set `captureMode: "everything"` to retain full conversation context.
- Be aware that this may increase storage and recall noise.

## LightRAG server crashes under load

**Symptoms:**
- LightRAG server process dies when many ingestion requests arrive at once.

**Diagnosis:**
- The server may have memory limits or SQLite locking issues.

**Mitigation:**
- Limit concurrent ingestion by adjusting OpenClaw’s hook concurrency (advanced).
- Monitor server resource usage (CPU, memory).
- Consider using a more robust database (PostgreSQL) if scaling beyond personal use.

## Getting help

If you encounter an error not listed here:

1. Check the **Gateway logs** (`journalctl -u openclaw-gateway` or `openclaw gateway logs`).
2. Enable `debug: true` in the plugin config and reproduce the issue.
3. Search the [OpenClaw Discord](https://discord.com/invite/clawd) or open an issue on the GitHub repository.