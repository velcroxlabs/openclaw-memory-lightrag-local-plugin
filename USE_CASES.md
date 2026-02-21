# Use Cases

This document outlines practical scenarios where the LightRAG memory plugin adds value, with concrete configuration examples and code snippets.

## 1. Personal Assistant with Long‑Term Memory

**Scenario:** You use OpenClaw as a daily personal assistant across multiple channels (Telegram, Discord, etc.). You want the assistant to remember your preferences, past decisions, and important facts across sessions.

**How the plugin helps:**
- Every conversation turn is automatically ingested into LightRAG.
- When you ask “What did we decide about the vacation last week?”, the plugin recalls the relevant snippet from the memory store and injects it into the AI’s context.
- The assistant can answer with precise references to past conversations.

**Configuration Example:**

```json5
// openclaw.json excerpt
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
          apiKey: "your-personal-key",
          autoIngest: true,
          autoRecall: true,
          maxRecallResults: 5,
          captureMode: "all",
          minCaptureLength: 10,
          debug: false
        }
      }
    }
  }
}
```

**Code Example: Custom Tool for Querying Memory**

Add a custom tool that lets you explicitly search memories with natural language:

```typescript
// In a companion plugin
api.registerTool({
  name: "ask_memory",
  description: "Query your personal memory for past discussions",
  parameters: {
    type: "object",
    properties: {
      question: { type: "string" }
    },
    required: ["question"]
  },
  async execute(_toolCallId, params) {
    const { question } = params;
    // Use the built‑in memory_search tool
    const result = await api.tools.execute("memory_search", {
      query: question,
      maxResults: 5
    });
    // Format the response
    const snippets = result.details?.results?.map(r => r.snippet) || [];
    return {
      content: [{
        type: "text",
        text: snippets.length
          ? `Here’s what I remember:\n${snippets.map(s => `• ${s}`).join('\n')}`
          : "I don't have any relevant memories about that."
      }]
    };
  }
});
```

**Expected Interaction:**

```
User: What did we decide about the vacation last week?
Assistant: <lightrag-context>…</lightrag-context> We decided to go to Hawaii in July, staying at the Grand Wailea for 7 nights.
```

## 2. Team Collaboration Bot

**Scenario:** A shared OpenClaw instance serves a team channel (e.g., Slack). The bot should remember decisions, action items, and shared knowledge.

**How the plugin helps:**
- Ingests messages from all team members.
- Provides semantic search over past discussions (“Find the decision about the Q4 budget”).
- Can be extended with custom metadata (e.g., tagging memories by project).

**Configuration Example:**

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
          baseUrl: "http://team-server:8787",
          apiKey: "team-shared-key",
          autoIngest: true,
          autoRecall: false,          // Disable auto‑recall to avoid noise in busy channels
          maxRecallResults: 10,
          captureMode: "everything",  // Keep full context for auditability
          minCaptureLength: 20,
          debug: true
        }
      }
    }
  }
}
```

**Code Example: Tagging Memories by Project**

Use a companion plugin to attach project tags based on channel names:

```typescript
api.on("message_received", async (event, ctx) => {
  const channel = String(ctx.channelId || "");
  let project = "general";
  if (channel.includes("project-alpha")) project = "alpha";
  if (channel.includes("project-beta")) project = "beta";
  
  // Store the tag in metadata (the memory plugin will ingest it)
  event.metadata = { ...event.metadata, project };
});

api.on("agent_end", async (event, ctx) => {
  const channel = String(ctx.channelId || "");
  let project = "general";
  if (channel.includes("project-alpha")) project = "alpha";
  if (channel.includes("project-beta")) project = "beta";
  
  event.metadata = { ...event.metadata, project };
});
```

**Querying Memories by Project:**

You can then use the LightRAG API directly to filter memories by metadata:

```bash
curl -H "x-api-key: team-shared-key" \
  "http://team-server:8787/query?q=budget&metadata.project=alpha"
```

## 3. Debugging and Support Agent

**Scenario:** OpenClaw is used as a support agent that interacts with users to troubleshoot issues. It needs to recall similar past issues and their solutions.

**How the plugin helps:**
- Ingests support tickets and resolution notes.
- When a new issue is described, the plugin recalls similar past issues and suggests known fixes.
- Reduces repetitive work for human agents.

**Configuration Example:**

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
          apiKey: "support-key",
          autoIngest: true,
          autoRecall: true,
          maxRecallResults: 8,
          captureMode: "all",
          minCaptureLength: 30,      // Skip short messages
          debug: true                // Monitor ingestion during initial setup
        }
      }
    }
  }
}
```

**Code Example: Automatic Solution Suggestion**

Create a tool that searches memory for similar errors and proposes solutions:

```typescript
api.registerTool({
  name: "troubleshoot",
  description: "Search past support issues for similar problems",
  parameters: {
    type: "object",
    properties: {
      error: { type: "string" }
    },
    required: ["error"]
  },
  async execute(_toolCallId, params) {
    const { error } = params;
    const result = await api.tools.execute("memory_search", {
      query: error,
      maxResults: 3
    });
    
    const snippets = result.details?.results?.map(r => r.snippet) || [];
    if (snippets.length === 0) {
      return {
        content: [{
          type: "text",
          text: "No similar past issues found. Please describe the problem in detail."
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: `I found ${snippets.length} similar past issue(s):\n\n${
          snippets.map((s, i) => `${i+1}. ${s}`).join('\n')
        }\n\nTry the solutions mentioned above. If they don't help, please provide more details.`
      }]
    };
  }
});
```

**Example Dialogue:**

```
User: I'm getting "Connection refused" when trying to connect to the database.
Assistant: <lightrag-context>…</lightrag-context> Based on past tickets, this error usually occurs when the database service isn't running. Try running `sudo systemctl start postgresql` and check the logs with `journalctl -u postgresql`.
```

## 4. Content Creation and Research Assistant

**Scenario:** You use OpenClaw to help with research and content creation. You feed it articles, notes, and ideas over time.

**How the plugin helps:**
- Ingests documents, summaries, and ideas.
- When you ask “What have we collected about quantum computing?”, the plugin returns relevant snippets from ingested content.
- Enables a “second brain” that grows with your inputs.

**Configuration Example:**

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
          apiKey: "research-key",
          autoIngest: true,
          autoRecall: true,
          maxRecallResults: 12,      // More context for research
          captureMode: "everything", // Keep full content
          minCaptureLength: 5,
          debug: false
        }
      }
    }
  }
}
```

**Code Example: Bulk Ingest Markdown Files**

Write a script to ingest your existing markdown notes:

```javascript
const fs = require('fs');
const path = require('path');
const { AdapterClient } = require('./adapter-client');

const client = new AdapterClient('http://127.0.0.1:8787', 'research-key');

async function ingestMarkdown(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const title = path.basename(file, '.md');
    
    await client.ingest({
      conversationId: `research:${title}`,
      channel: 'research',
      date: new Date().toISOString().slice(0, 10),
      items: [{
        role: 'assistant',
        content: `# ${title}\n\n${content}`,
        ts: new Date().toISOString(),
        sender: 'researcher',
        metadata: { source: file, type: 'markdown' }
      }]
    });
    
    console.log(`Ingested ${file}`);
  }
}

ingestMarkdown('./research-notes');
```

## 5. Compliance and Audit Trail

**Scenario:** In regulated environments, you need a searchable record of all AI‑assistant interactions.

**How the plugin helps:**
- Every interaction is stored in LightRAG with timestamps and metadata.
- Audit queries can be performed via the LightRAG dashboard or API.
- Memory retention policies can be enforced via LightRAG’s TTL settings.

**Configuration Example:**

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
          baseUrl: "http://audit-server:8787",
          apiKey: "audit-key",
          autoIngest: true,
          autoRecall: false,          // No recall needed for pure audit
          maxRecallResults: 1,
          captureMode: "everything",  // Keep complete, unaltered records
          minCaptureLength: 1,        // Capture everything, even short messages
          debug: false
        }
      }
    }
  }
}
```

**Code Example: Export Audit Logs**

Periodically export memories to a secure archive:

```python
import requests
import json
from datetime import datetime, timedelta

base_url = "http://audit-server:8787"
api_key = "audit-key"

# Fetch memories from the last 30 days
end_date = datetime.now().strftime("%Y-%m-%d")
start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

params = {
    "date": f"{start_date}..{end_date}",
    "status": "all",
    "limit": 1000
}

resp = requests.get(
    f"{base_url}/adapter/memory/inbox",
    params=params,
    headers={"x-api-key": api_key}
)

memories = resp.json()

# Save with encryption (example using age)
with open("audit_log.json", "w") as f:
    json.dump(memories, f, indent=2)

# Encrypt with age (requires age installed)
import subprocess
subprocess.run(["age", "-e", "-r", "age1publickey...", "audit_log.json", "-o", "audit_log.json.age"])
```

## 6. Multi‑Channel Context Sharing

**Scenario:** You interact with OpenClaw via Telegram, Discord, and WhatsApp. You want the assistant to maintain a unified memory across all channels.

**How the plugin helps:**
- The plugin hooks into all channels configured in OpenClaw.
- Memories from one channel are recalled when you talk in another.
- Provides a seamless cross‑channel experience.

**Note:** Channel‑specific metadata (e.g., `channelId`) is stored with each memory, allowing filtered recall if needed.

**Configuration Example:** Use the same plugin configuration across all channels—no special setup required. The plugin automatically distinguishes channels via the `channelId` in the hook context.

**Code Example: Channel‑Aware Memory Search**

Create a tool that searches across all channels or restricts to the current channel:

```typescript
api.registerTool({
  name: "search_memories",
  description: "Search memories, optionally filtered by channel",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string" },
      channel: { type: "string" }
    },
    required: ["query"]
  },
  async execute(_toolCallId, params, ctx) {
    const { query, channel } = params;
    const currentChannel = ctx.channelId;
    
    // Build a query that includes channel filter if requested
    let searchQuery = query;
    if (channel) {
      searchQuery = `${searchQuery} [channel:${channel}]`;
    } else if (currentChannel) {
      // Optionally bias results toward current channel
      searchQuery = `${searchQuery} [channel:${currentChannel}]`;
    }
    
    const result = await api.tools.execute("memory_search", {
      query: searchQuery,
      maxResults: 8
    });
    
    // Format results with channel labels
    const items = result.details?.results || [];
    const formatted = items.map(item => {
      const channel = item.snippet.match(/\[channel:([^\]]+)\]/)?.[1] || 'unknown';
      const text = item.snippet.replace(/\[channel:[^\]]+\]\s*/, '');
      return `[${channel}] ${text}`;
    });
    
    return {
      content: [{
        type: "text",
        text: formatted.length
          ? `Found ${formatted.length} memories:\n${formatted.map(f => `• ${f}`).join('\n')}`
          : "No memories found."
      }]
    };
  }
});
```

## 7. Custom Memory Workflows

**Scenario:** You want to implement custom memory‑lifecycle rules, such as archiving old memories, flagging conflicts, or prioritizing certain types of content.

**How the plugin helps:**
- LightRAG’s backend provides APIs for memory management (review, merge, archive).
- You can build custom dashboards or scripts that interact with those APIs.
- The plugin’s `autoIngest` and `autoRecall` can be complemented with periodic cleanup jobs.

**Example: A cron job that calls LightRAG’s `/api/memories/archive?olderThan=30d` to archive old memories.**

**Code Example: Weekly Memory Maintenance Script**

```bash
#!/bin/bash
# weekly_memory_maintenance.sh

API_KEY="your-key"
BASE_URL="http://127.0.0.1:8787"

# 1. Archive memories older than 30 days
curl -X POST "$BASE_URL/adapter/memory/inbox/action" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": 0,  # Special ID meaning "all matching"
    "action": "archive",
    "note": "Weekly automatic archive",
    "olderThan": 30
  }'

# 2. Merge duplicate memories (simplified example)
# First, fetch pending memories
PENDING=$(curl -s -H "x-api-key: $API_KEY" "$BASE_URL/adapter/memory/inbox?status=pending&limit=100")

echo "$PENDING" | jq -c '.[]' | while read item; do
  id=$(echo "$item" | jq '.id')
  text=$(echo "$item" | jq -r '.text')
  
  # Look for similar memories (simplified)
  SIMILAR=$(curl -s -H "x-api-key: $API_KEY" "$BASE_URL/query?q=${text}&topK=2")
  
  # If similarity score > 0.9, merge
  if [[ $(echo "$SIMILAR" | jq '.contextItems[0].score') -gt 0.9 ]]; then
    targetId=$(echo "$SIMILAR" | jq '.contextItems[0].docId')
    curl -X POST "$BASE_URL/adapter/memory/inbox/action" \
      -H "x-api-key: $API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"itemId\": $id,
        \"action\": \"merge\",
        \"mergeTargetId\": $targetId
      }"
  fi
done

# 3. Export statistics
curl -s -H "x-api-key: $API_KEY" "$BASE_URL/stats" > /var/log/memory_stats.json
```