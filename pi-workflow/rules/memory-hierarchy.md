## Memory Hierarchy

1. Current context is authoritative for the active task.
2. Claude Code and Codex compact long sessions themselves.
3. Hermes stores durable user/project facts, corrections, failures, conventions, and reusable procedures. Its tools come from the `pi` MCP server, whose instructions say when to use each one. pi uses the same store.
4. LLM Wiki stores curated project knowledge, research, architecture, and source-backed documentation. Its tools come from the `llm-wiki` MCP server.

Use Hermes memory_search when prior-session context matters. Its session_search covers past pi sessions; in T3 Code, `t3_thread_search` covers Claude and Codex threads. Use LLM Wiki for durable project or research knowledge.

Prefer original repository/code evidence over conflicting memories. Do not duplicate information between systems unless its role changes. Do not store routine transient implementation state in Hermes or Wiki.
