# General Rules

- If a change seems large AND you are on an important branch (main, dev, etc.), ask whether to use a git worktree.
- When working in a git worktree, always commit finished work and mention the commit hash.
- When reviewing code, provide a grade from 0–100, ways to improve it, and file paths with line numbers for anything needing human review.
- Always summarize completed changes.

## Written Communication

Use the unslop skill for ALL written communication, including progress updates, plans, technical explanations, and final responses. Reuse the loaded skill while it remains available in context; reload it when needed.

Use html-communication when visual structure improves understanding, including plans, architecture docs, comparisons, diagrams, reports, timelines, and technical explanations. HTML is preferred for substantial plans, but not required.

## Skill Routing

Load the matching skill's `SKILL.md` before acting.

- All code changes require general-guidelines.
- Frontend design changes require frontend-design as the baseline. Select at most one additional visual-direction skill unless the user requests a combination.
- find-skills: Discover, compare, or install existing skills. Verify source and quality before recommending or installing.
- brandkit: Brand-kit images, identity boards, guideline decks, and visual-world presentations.
- design-taste-frontend: Distinctive landing pages, portfolios, and marketing sites. Do not use for dashboards, tables, or multi-step application UI.
- gpt-taste: Only for explicitly motion-heavy, AIDA-structured marketing experiences using GSAP, editorial layouts, or experimental art direction.
- high-end-visual-design: Cinematic, premium agency aesthetics with deliberate typography, spacing, depth, and motion.
- minimalist-ui: Restrained editorial minimalism, warm monochrome, flat structure, muted accents, and no gradients or heavy shadows.
- redesign-existing-projects: Prefer when upgrading an existing site or app while preserving its framework, behavior, and product constraints. Otherwise follow the requested visual direction.

## Model Routing

By default, you should always use your jev-delegation skill. Sometimes, you might think it's unnecessary, but this is the default and you should ask the user if it's ok not to use it. If the user requests that you don't use it, use the following:

Suggested routing:
- Default: gpt-6-astra, low.
- Bounded tool-heavy checks: muse-spark-1.3, xhigh.
- Ambiguous implementation: Sol, medium.
- Architecture, security, database, or difficult debugging: gpt-6-astra, medium.

Never use Terra above high. Always check the current GPT model:
- gpt-6-astra: only low, medium, or high.
- gpt-6-sol: low, medium, high, or xhigh.
- gpt-6-luna: only xhigh or max.

Use meta/muse-spark-1.3-contributor with xhigh for Explore subagents.

## Subagents

Use these agents only when their trigger applies:

- @architect: Consequential decisions about system/module boundaries, data ownership, public contracts, security architecture, scalability, reliability, or deployment. Keep routine UI and bounded feature planning with the main agent.
- @build-error-resolver: Non-trivial build/type failures where focused diagnosis helps. Keep straightforward failures with the main agent. Make minimal fixes without architectural edits.
- @code-reviewer: MUST BE USED once after implementation and relevant checks for ALL code changes. Default to meta/muse-spark-1.3-contributor with xhigh unless the user specifies otherwise. If it returns `Escalation: REQUIRED`, rerun only affected findings or paths with openai-codex/gpt-6-astra at medium. After fixes, request targeted follow-up only when risk materially changed or a high-severity finding remains. Do not repeat full reviews for mechanical fixes.
- @frontend-builder: REQUIRED for brand-new pages and substantial UI/UX implementation. Keep routine UI planning and small, bounded changes with the main agent. Continue using frontend-design for styling and visual quality.
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

ALWAYS validate user input.

## Code Comments

Use comments often to explain what code does, WHY it exists, and what it accomplishes.

ALWAYS annotate functions, loops, and large code blocks.

- Prefer self-explanatory names and structure.
- Explain tradeoffs, constraints, and non-obvious behavior.
- Add a short comment before complex logic.
- Explain one-liners, clunky logic, or obfuscated code when needed.
- Keep comments accurate as code changes.
- Avoid noisy banners and unnecessary explanatory blocks.

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
- No console.log statements remain.
- Comments are clear, useful, and accurate.
- All required tests pass and required coverage is met.
- No security vulnerabilities remain.
- Performance is acceptable.
- User requirements are met.
