# General Rules

- If a change seems large AND you are on an important branch (main, dev, etc.), ask whether to use a git worktree.
- When working in a git worktree, always commit finished work and mention the commit hash.
- When reviewing code, provide a grade from 0–100, ways to improve it, and file paths with line numbers for anything needing human review.
- Always summarize completed changes.

## Written Communication

Use the unslop skill for prose written for people, including progress updates, plans, technical explanations, final responses, and commit messages. Reuse the loaded skill while it remains available in context; reload it when needed.

In code, identifiers, code comments, and technical docs such as AGENTS.md, use the standard technical term (CSRF, ETag, disable, idempotent, retry) even where unslop would pick a plainer word, so readers can search for it.

Use html-communication when visual structure improves understanding, including plans, architecture docs, comparisons, diagrams, reports, timelines, and technical explanations. HTML is preferred for substantial plans, but not required.

## Skill Routing

Load the matching skill's `SKILL.md` before acting.

- All code changes require general-guidelines.
- Frontend design changes require frontend-design as the baseline. For a whole page, an app screen, or a redesign, also load design-taste-frontend; where the two disagree, design-taste-frontend wins. A style skill (gpt-taste, high-end-visual-design, minimalist-ui) runs only when the user asks for its look, one at a time, and replaces design-taste-frontend for that build, because its inspector fails their eyebrows, hairlines, glass, and gradients.
- find-skills: Discover, compare, or install existing skills. Verify source and quality before recommending or installing.
- brandkit: Brand-kit images, identity boards, guideline decks, and visual-world presentations.
- design-taste-frontend: Distinctive landing pages, portfolios, marketing and product sites, and app screens such as dashboards, admin views, and settings. Also use it to redesign, restyle, or review an existing page or app screen while keeping its stack, content, and behavior.
- uncodexify: Small changes inside an existing product UI that has its own design system. New app screens go through design-taste-frontend's app-screen route.
- scroll-craft: Only when the user asks for a scroll-driven or cinematic scroll experience. It replaces design-taste-frontend for that page.
- gpt-taste: Only when the user asks for a motion-heavy, AIDA-structured GSAP page with editorial layouts or experimental art direction.
- high-end-visual-design: Only when the user asks for a soft, premium agency look with deliberate depth and spring motion.
- minimalist-ui: Only when the user asks for restrained editorial minimalism with warm monochrome, flat structure, and muted accents.

## Model Routing

By default, you should always use your jev-delegation skill. Sometimes, you might think it's unnecessary, but this is the default and you should ask the user if it's ok not to use it. If the user requests that you don't use it, use the following:

Suggested routing:
- Default: gpt-6-astra, low.
- Bounded tool-heavy checks: claude-sonnet-5-5, xhigh.
- Ambiguous implementation: Sol, medium.
- Architecture, security, database, or difficult debugging: gpt-6-astra, medium.

Always check the current GPT model:
- gpt-6-astra: only low, medium, or high.
- gpt-6.1-sol: low, medium, high, or xhigh.
- gpt-6.1-terra: only medium, high, or xhigh. Use it only for Explore subagents.
- gpt-6-luna: only xhigh or max.

Use openai-codex/gpt-6.1-terra with xhigh for Explore subagents.

## Subagents

Use these agents only when their trigger applies:

- @architect: Consequential decisions about system/module boundaries, data ownership, public contracts, security architecture, scalability, reliability, or deployment. Keep routine UI and bounded feature planning with the main agent.
- @build-error-resolver: Non-trivial build/type failures where focused diagnosis helps. Keep straightforward failures with the main agent. Make minimal fixes without architectural edits.
- @code-reviewer: MUST BE USED once after implementation and relevant checks for ALL code changes. Default to openai-codex/gpt-6.1-sol with xhigh unless the user specifies otherwise. If it returns `Escalation: REQUIRED`, rerun only affected findings or paths with claude-bridge/claude-opus-5-5 at xhigh. Launch the rerun through JevAgent with `agent`, `model`, and `thinking` set; the Agent tool's `model` parameter cannot override the code-reviewer frontmatter. After fixes, request targeted follow-up only when risk materially changed or a high-severity finding remains. Do not repeat full reviews for mechanical fixes.
- @frontend-builder: REQUIRED for brand-new pages and substantial UI/UX implementation. Keep routine UI planning and small, bounded changes with the main agent. Name in its prompt the design skills it must load, following the routing above. It runs with its own system prompt and does not see these rules.
- @drafter: Building HTML plans, drafts, reports, and comparisons.

## Build and Plan Modes

When building, follow the skill and subagent rules above. Consider refactoring when a change to a single file becomes extremely large.

When planning new features, always ask clarifying questions and suggest improvements. Keep bounded planning with the main agent unless the architect trigger applies. Heavily consider html-communication for presenting the plan.

## Memory Hierarchy

1. Current context is authoritative for the active task.
2. Observational memory preserves continuity within long sessions and across compaction.
3. Hermes stores durable user/project facts, corrections, failures, conventions, and reusable procedures.
4. LLM Wiki stores curated project knowledge, research, architecture, and source-backed documentation.

Use Hermes session/memory search when prior-session context matters. Use LLM Wiki for durable project or research knowledge.

Prefer original repository/code evidence over conflicting memories. Do not duplicate information between systems unless its role changes. Do not store routine transient implementation state in Hermes or Wiki.

## Questions

Use questions liberally during planning and building when instructions are unclear, you have an idea, notice something wrong, or need more information. Always allow the user to supply their own answer.

## TO DO List Management

Keep the todo list updated after each step. Before finishing any run, ensure no items remain in progress, including changes the user rejected.

## File Organization

MANY SMALL FILES > FEW LARGE FILES:

- High cohesion, low coupling.
- Typically 200–400 lines per file; 800 maximum.
- Extract utilities from large components.
- Organize by feature/domain, not by type.

## Error Handling and Input Validation

ALWAYS handle errors comprehensively and provide meaningful error context.

Usually log errors where you catch them. Use the project's existing logger, or `console.error` (or the language's equivalent) when there is none. Include what failed and the IDs or inputs needed to trace it, and leave out secrets and personal data. Skip the log only when you rethrow to a caller that already logs the same detail, so one failure produces one log entry. A caller that logs only a status code doesn't count.

ALWAYS validate user input.

## Code Comments

Write a comment only where a careful reader would otherwise get the code wrong:

- why the code does something surprising, or doesn't do the obvious thing;
- an ordering, timing, or security constraint the code depends on;
- a workaround, and what breaks without it;
- where a magic number comes from;
- the decision behind a choice (plan section, ADR, issue).

Put the comment on the line it explains. Functions get no doc comments: if one needs explaining, rename it or comment the surprising line inside it. A file gets a top comment only when its name and folder don't say what it's for. Never repeat what a name, a type, or the next line already says, and don't label blocks. When unsure, leave it out.

## Code Layout

Inside a function, put a blank line between steps. A step is one of these:

- A value and the check on it, such as `const input = schema.safeParse(body)` and its `if (!input.success) return ...`.
- A run of related assignments or calls.
- A `try` block, a loop, or a multi-line `if`.
- The final `return` after multi-line work.

A comment that starts a step goes right below the blank line. A function of three single-line statements or fewer needs no blank lines, and a block never starts or ends with one.

Ponytail's "one line" and "shortest diff" rules are about how much code you write, not about blank lines or layout.

## Testing Requirements

When the user or AGENTS.md requires formal coverage, include the relevant unit, integration, and E2E tests. Use Playwright for critical user-flow E2E tests.

When TDD is required:
1. Write the test and verify it fails.
2. Write the minimal implementation and verify it passes.
3. Refactor and verify any required coverage target.

When troubleshooting test failures:
1. Use tdd-workflow.
2. Check isolation and verify mocks.
3. Fix the implementation unless the tests are wrong.

## Completion Checklist

Before marking work complete:

- Code is readable and well-named.
- Functions are small and files are focused.
- Nesting does not exceed four levels.
- Errors are handled and user input is validated.
- Comments and blank lines follow the Code Comments and Code Layout rules.
- All required tests pass and required coverage is met.
- No security vulnerabilities remain.
- Performance is acceptable.
- User requirements are met.
