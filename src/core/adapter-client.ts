export type AdapterContextItem = { text: string; docId?: string };

async function getJson(baseUrl: string, apiKey: string, path: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`request failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function postJson(baseUrl: string, apiKey: string, path: string, body: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`request failed: ${res.status} ${text}`);
  }
  return res.json();
}

export class AdapterClient {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async query(query: string, topK: number, opts?: { conversationId?: string; date?: string }) {
    const result = await postJson(this.baseUrl, this.apiKey, "/adapter/query", {
      query,
      topK,
      ...(opts?.conversationId ? { conversationId: opts.conversationId } : {}),
      ...(opts?.date ? { date: opts.date } : {}),
    });

    const contextItems: AdapterContextItem[] =
      result.contextItems || result.contexts?.map((text: string) => ({ text })) || [];

    return { raw: result, contextItems };
  }

  async get(docId: string) {
    return postJson(this.baseUrl, this.apiKey, "/adapter/get", { docId });
  }

  async ingest(payload: {
    conversationId: string;
    channel: string;
    date: string;
    items: Array<{
      role?: string;
      content: string;
      ts?: string;
      sender?: string;
      messageId?: string;
    }>;
  }) {
    return postJson(this.baseUrl, this.apiKey, "/adapter/ingest", payload);
  }

  async listInbox(params: {
    conversationId?: string;
    date?: string;
    status?: "pending" | "approved" | "merged" | "archived" | "all";
    limit?: number;
    offset?: number;
  } = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    }
    return getJson(this.baseUrl, this.apiKey, `/adapter/memory/inbox${qs.toString() ? `?${qs.toString()}` : ""}`);
  }

  async inboxAction(payload: {
    itemId: number;
    action: "approve" | "merge" | "archive";
    mergeTargetId?: number;
    note?: string;
  }) {
    return postJson(this.baseUrl, this.apiKey, "/adapter/memory/inbox/action", payload);
  }

  async retrievalFeedback(payload: {
    queryId: number;
    itemId?: string;
    helpful: boolean;
    comment?: string;
  }) {
    return postJson(this.baseUrl, this.apiKey, "/adapter/retrieval/feedback", payload);
  }
}
