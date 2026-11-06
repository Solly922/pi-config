## Memory Hierarchy

1. Current context is authoritative for the active task.
2. Observational memory preserves continuity within long sessions and across compaction. A shadow pi session records observations and reflections for each native thread, and after Claude Code or Codex compacts, they come back as condensed memories with ids. The `pi` MCP server's `recall` returns the source behind an id.
3. Hermes stores durable user/project facts, corrections, failures, conventions, and reusable procedures. Its tools come from the `pi` MCP server, whose instructions say when to use each one. pi uses the same store, and Hermes also reviews each native thread in the background, as it does in pi.
4. LLM Wiki stores curated project knowledge, research, architecture, and source-backed documentation. Its tools come from the `llm-wiki` MCP server.

Use Hermes memory_search when prior-session context matters. Its session_search covers past pi sessions and native threads; in T3 Code, `t3_thread_search` also searches T3 threads by title and content. Use LLM Wiki for durable project or research knowledge.

Prefer original repository/code evidence over conflicting memories. Do not duplicate information between systems unless its role changes. Do not store routine transient implementation state in Hermes or Wiki.
