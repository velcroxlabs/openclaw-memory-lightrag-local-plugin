# Advanced Usage & Configuration

This document covers advanced configuration, custom hooks, capture parameters, and integration patterns for the LightRAG memory plugin.

## Table of Contents

- [Advanced Configuration Options](#advanced-configuration-options)
- [Custom Hooks and Event Handlers](#custom-hooks-and-event-handlers)
- [Capture Parameters Explained](#capture-parameters-explained)
- [Integration with Other Plugins](#integration-with-other-plugins)
- [Scripting and Automation Examples](#scripting-and-automation-examples)
- [Multi-Instance Setup](#multi-instance-setup)
- [Performance Tuning](#performance-tuning)

## Advanced Configuration Options

Beyond the basic settings, the plugin supports several advanced parameters that fine‑tune its behavior.

### Full Configuration Schema

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
          // Required
          baseUrl: "http://127.0.0.1:8787",
          apiKey: "your-api-key-here",

          // Core features
          autoIngest: true,          // Automatically capture conversation turns
          autoRecall: true,          // Inject memories before each AI turn
          
          // Recall tuning
          maxRecallResults: 8,       // Maximum snippets per recall (1–20)
          
          // Capture tuning
          captureMode: "all",        // "all" or "everything"
          minCaptureLength: 10,      // Skip text shorter than this
          
          // Diagnostics
          debug: false               // Enable verbose plugin logs
        }
      }
    }
  }
}
```

### Configuration via Environment Variables

You can use OpenClaw's built‑in environment variable substitution:

```json5
{
  plugins: {
    entries: {
      "memory-lightrag-local": {
        config: {
          baseUrl: "${LIGHTRAG_URL:-http://127.0.0.1:8787}",
          apiKey: "${LIGHTRAG_API_KEY}",
          // ...
        }
      }
    }
  }
}
```

Set the variables in your shell or in OpenClaw's environment file (`~/.openclaw/env`).

### Dynamic Configuration Reload

Plugin configuration is cached when the Gateway starts. To apply changes:

```bash
openclaw gateway restart
```

You can verify the active configuration with:

```bash
openclaw plugins info memory-lightrag-local
```

## Custom Hooks and Event Handlers

The plugin exposes several internal hooks that you can extend via OpenClaw's plugin API. Below are examples of how to add custom logic around ingestion and recall.

### Adding Metadata to Ingested Items

You can intercept the `message_received` and `agent_end` events to attach custom metadata (e.g., tags, priority, project identifiers) before ingestion.

**Example: Tagging memories by project**

Create a companion plugin that listens to the same events and enriches the payload:

```typescript
// my-memory-enhancer.ts
export default {
  id: "memory-enhancer",
  register(api) {
    api.on("message_received", async (event, ctx) => {
      // Extract project from channel name or message content
      const project = ctx.channelId?.includes("project-alpha") ? "alpha" : "general";
      
      // Attach metadata to the event object (will be seen by memory plugin)
      event.metadata = { ...event.metadata, project };
    });

    api.on("agent_end", async (event, ctx) => {
      // Similarly tag assistant responses
      event.metadata = { ...event.metadata, project: "alpha" };
    });
  }
};
```

The memory plugin will include `metadata` in the ingested items (stored in LightRAG's `metadata` field). You can later filter or search by this field via the LightRAG API.

### Custom Recall Filtering

To influence which memories are recalled, you can pre‑process the query or inject additional filters.

**Example: Scope recall to a specific conversation thread**

```typescript
api.on("before_agent_start", async (event) => {
  // Force recall only from the current conversation
  const conversationId = event.conversationId;
  if (!conversationId) return;
  
  // Modify the recall query to include a conversation filter
  const originalPrompt = event.prompt;
  event.prompt = `${originalPrompt} [conversation:${conversationId}]`;
  
  // The plugin's recall handler will pass this query to LightRAG
  // LightRAG can be configured to respect the conversationId filter
});
```

### Implementing a Custom Capture Hook

If the default capture logic doesn't fit your needs, you can replace it entirely by disabling `autoIngest` and implementing your own ingestion logic.

**Example: Manual ingestion of selected messages**

```typescript
api.registerTool({
  name: "memory_capture_manual",
  description: "Manually capture a specific message into memory",
  parameters: {
    type: "object",
    properties: {
      text: { type: "string" },
      role: { type: "string", enum: ["user", "assistant"] },
      tags: { type: "array", items: { type: "string" } }
    },
    required: ["text", "role"]
  },
  async execute(_toolCallId, params) {
    const { text, role, tags } = params;
    const client = new AdapterClient(cfg.baseUrl, cfg.apiKey);
    
    await client.ingest({
      conversationId: "manual",
      channel: "tool",
      date: new Date().toISOString().slice(0,10),
      items: [{
        role,
        content: text,
        ts: new Date().toISOString(),
        sender: role,
        metadata: { tags }
      }]
    });
    
    return { ok: true };
  }
});
```

## Capture Parameters Explained

### `captureMode: "all" vs "everything"`

- **`all` (default)**: Strips any previously injected `<lightrag-context>` blocks from the captured text. This avoids infinite recursion where memories contain memories. Use this for typical conversation flows.
- **`everything`**: Captures the raw conversation text including any embedded context blocks. This preserves the exact dialogue but may lead to redundant or self‑referential memories. Useful for debugging or when you want to retain the exact AI output.

**Example of `all` mode:**

```
User: What did we decide about the vacation?
Assistant: <lightrag-context>...</lightrag-context> We decided to go to Hawaii in July.
```

Captured text: `"We decided to go to Hawaii in July."` (context block removed)

**Example of `everything` mode:**

Captured text: `"<lightrag-context>...</lightrag-context> We decided to go to Hawaii in July."`

### `minCaptureLength`

Text shorter than this character count is ignored. This filters out empty messages, single‑word acknowledgments, or system‑generated noise.

**Recommendations:**
- Set to `10` for personal assistants (skip "ok", "thanks").
- Set to `30` for content‑heavy workflows where only substantive messages should be remembered.
- Set to `1` to capture everything (including emoji responses).

### Deduplication Logic

The plugin deduplicates consecutive identical assistant responses within the same conversation. This prevents the same memory from being ingested multiple times if the AI repeats itself.

The deduplication signature is: `conversationId|assistant|text`. If the same assistant text appears again for the same conversation, ingestion is skipped.

## Integration with Other Plugins

### Calendar Plugin – Remembering Events

Combine memory with the calendar plugin to recall past events and schedules.

```typescript
// Example: When a user asks "What's my schedule next week?"
// The memory plugin can recall previous discussions about scheduling,
// while the calendar plugin fetches actual calendar events.
api.registerTool({
  name: "schedule_query",
  async execute(_toolCallId, params) {
    // Step 1: Recall relevant memories about scheduling preferences
    const memories = await memory_search({ query: "schedule preferences", maxResults: 3 });
    
    // Step 2: Fetch actual calendar events
    const events = await calendar_get_events({ days: 7 });
    
    // Combine both sources in the response
    return { memories, events };
  }
});
```

### Web Search Plugin – Augmenting Memories

Use web search results to enrich memories before ingestion.

```typescript
api.on("agent_end", async (event) => {
  // Extract key entities from the assistant's response
  const entities = extractEntities(event.output_text);
  
  // For each entity, fetch a summary from the web
  const summaries = await Promise.all(
    entities.map(entity => 
      web_search({ query: `summary of ${entity}`, count: 1 })
    )
  );
  
  // Append summaries to the memory content
  const enrichedContent = event.output_text + "\n\nRelated:\n" + summaries.join("\n");
  
  // Ingest enriched content
  await client.ingest({
    conversationId: event.conversationId,
    channel: event.channelId,
    date: new Date().toISOString().slice(0,10),
    items: [{
      role: "assistant",
      content: enrichedContent,
      ts: new Date().toISOString(),
      metadata: { entities }
    }]
  });
});
```

## Scripting and Automation Examples

### Bulk Ingest Historical Conversations

If you have exported chat logs (JSON, CSV, plain text), you can bulk‑ingest them using the LightRAG API directly.

**Example using Node.js:**

```javascript
const fs = require('fs');
const { AdapterClient } = require('./adapter-client');

const client = new AdapterClient('http://127.0.0.1:8787', 'your-api-key');

async function ingestHistory(filePath) {
  const logs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  for (const chat of logs) {
    await client.ingest({
      conversationId: `telegram:${chat.chatId}`,
      channel: 'telegram',
      date: chat.date,
      items: chat.messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text,
        ts: msg.timestamp,
        sender: msg.sender
      }))
    });
    console.log(`Ingested ${chat.messages.length} messages from ${chat.date}`);
  }
}

ingestHistory('telegram-export.json');
```

### Periodic Memory Cleanup

Set up a cron job to archive or delete old memories based on a TTL policy.

**Example using the LightRAG inbox API:**

```bash
#!/bin/bash
# archive_old_memories.sh

curl -X POST http://127.0.0.1:8787/adapter/memory/inbox/action \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": 123,
    "action": "archive",
    "note": "Archived by weekly cleanup script"
  }'
```

Schedule with cron:

```
0 3 * * 1 /path/to/archive_old_memories.sh
```

### Export Memories for Analysis

Retrieve all memories and export them to a structured format.

```python
import requests
import json

base_url = "http://127.0.0.1:8787"
api_key = "your-api-key"

# Fetch all inbox items (paginated)
items = []
offset = 0
limit = 100

while True:
    resp = requests.get(
        f"{base_url}/adapter/memory/inbox",
        params={"status": "all", "limit": limit, "offset": offset},
        headers={"x-api-key": api_key}
    )
    batch = resp.json()
    if not batch:
        break
    items.extend(batch)
    offset += limit

with open("memories_export.json", "w") as f:
    json.dump(items, f, indent=2)
```

## Multi‑Instance Setup

For larger deployments, you may want to run multiple LightRAG instances (e.g., one per team or project). The plugin can be configured to switch between instances based on conversation context.

### Configuring Multiple Plugin Entries

OpenClaw allows multiple plugin entries with different names. You can create separate memory plugin instances:

```json5
{
  plugins: {
    slots: {
      memory: "memory-lightrag-team-a"  // Default slot
    },
    entries: {
      "memory-lightrag-team-a": {
        enabled: true,
        config: {
          baseUrl: "http://127.0.0.1:8787",
          apiKey: "key-team-a",
          // ...
        }
      },
      "memory-lightrag-team-b": {
        enabled: true,
        config: {
          baseUrl: "http://127.0.0.1:8788",
          apiKey: "key-team-b",
          // ...
        }
      }
    }
  }
}
```

Then use tool‑calling to switch between them dynamically:

```typescript
api.registerTool({
  name: "switch_memory_context",
  async execute(_toolCallId, params) {
    const { team } = params;
    const pluginName = `memory-lightrag-${team}`;
    
    // Activate the desired plugin slot
    await api.pluginSlots.set("memory", pluginName);
    
    return { switched: team };
  }
});
```

### Load Balancing with a Reverse Proxy

If you have multiple LightRAG servers behind a load balancer, configure the plugin's `baseUrl` to point to the balancer. Ensure session stickiness if conversation‑local consistency is required.

## Performance Tuning

### Reducing Latency

1. **Run LightRAG on the same host** as OpenClaw Gateway (localhost).
2. **Set `maxRecallResults` to the minimum** that provides useful context (e.g., 3–5).
3. **Disable `autoRecall` for high‑frequency channels** and use explicit `memory_search` only when needed.
4. **Use a faster embedding model** in LightRAG (e.g., `all-MiniLM-L6-v2` instead of larger models).

### Scaling Ingestion

1. **Batch ingestion** – Instead of ingesting every turn, accumulate messages and send them in batches every few minutes.
2. **Queue asynchronous ingestion** – Use a background job queue (e.g., Bull, RabbitMQ) to decouple ingestion from conversation flow.
3. **Upgrade LightRAG database** – Switch from SQLite to PostgreSQL for better concurrency.

### Monitoring and Alerts

Enable `debug: true` temporarily to observe ingestion and recall patterns. Monitor the following metrics:

- **Ingestion rate**: messages/second
- **Recall latency**: milliseconds per query
- **Error rate**: failed requests / total requests
- **Memory growth**: documents count over time

You can expose these metrics via LightRAG's `/stats` endpoint and integrate with Prometheus/Grafana.

---

**Next Steps:** Refer to the [README](README.md) for basic setup, [USE_CASES.md](USE_CASES.md) for scenario‑based guidance, and [ERRORS.md](ERRORS.md) for troubleshooting.