# General Rules
If the change seems large AND you are in an important branch (main, dev, etc...) ask the user if you should use a git worktree.
If you are working in a git worktree, always commit once you've finished your work and mention the commit hash to user.
When asked to review code, provide a grade; grade the code changes on a scale of 0-100 with 100 being perfect code and 0 being the worst thing ever written. Provide ways to improve the score. Also, provide files and line numbers that point to code that should be reviewed by a human

Use the html-communication skill to communicate complex information when visual structure improves understanding. 
Use for plans, architecture docs, codebase maps, comparisons, dashboards, timelines, diagrams, reports, post-mortems,design explorations, and technical explainers.
Use the unslop skill ALWAYS.

## Additional Skill Routing
Load a matching skill's `SKILL.md` before acting. For frontend work, keep `frontend-design` as the baseline and select at most one additional visual-direction skill unless the user explicitly requests a combination. Prefer `redesign-existing-projects` when preserving an existing implementation; otherwise follow the requested visual direction.
- **find-skills** — Use when the user wants to discover, compare, or install an existing skill. Verify a candidate's source and quality before recommending or installing it.
- **brandkit** — Use when generating brand-kit overview images, identity boards, brand-guideline decks, or visual-world presentations.
- **design-taste-frontend** — Use for distinctive landing pages, portfolios, and marketing-site redesigns. Do not use it for dashboards, tables, or multi-step application UI.
- **gpt-taste** — Use only for explicitly motion-heavy, AIDA-structured marketing experiences that call for GSAP, editorial layouts, or experimental art direction.
- **high-end-visual-design** — Use when a website should have a cinematic, premium agency aesthetic with deliberate typography, spacing, depth, and motion.
- **minimalist-ui** — Use when the requested direction is restrained editorial minimalism: warm monochrome, flat structure, muted accents, and no gradients or heavy shadows.
- **redesign-existing-projects** — Use when upgrading an existing site or app while preserving its framework, behavior, and established product constraints.

When using an explore subagent, use meta-ai/muse-spark-1.3-contributor (xhigh)

## Build Mode
When using build mode follow these rules:
- All code changes require using the general-guidelines skill.
- When making frontend design changes, always use the frontend-design skill.
- Use the @frontend-builder agent for brand-new pages or substantial UI/UX implementation; keep routine UI planning and small, bounded UI changes with the main agent.
- If the change in a single is extrememly large, consider refactoring.

Default to single-agent execution for small, bounded tasks. Before discretionary delegation, identify a concrete benefit from specialization, parallel execution, or context isolation that exceeds the coordination cost. Do not use discretionary delegation for work the main agent can complete directly, duplicate investigation across agents, or parallelize sequential dependencies. Required specialists and independent review are exceptions. Use at most one non-review subagent per task unless multiple tasks are genuinely independent.

Model routing: use Sol low by default, Luna xhigh for bounded tool-heavy checks, Sol medium for ambiguous implementation, and Sol high for architecture, security, database, or difficult debugging. Never use Terra and never use Sol above high. Always check which gpt model you are using. If it's gpt-5.6-sol, the only acceptable reasoning levels are low, medium, high. If it's gpt-5.6-luna, the only acceptable reasoning levels are xhigh and max.

Use these subagents only when their trigger applies:
- @architect - Use only for consequential decisions involving system or module boundaries, data ownership, public contracts, security architecture, scalability, reliability, or deployment. Do not use for routine UI or bounded feature planning merely because the work is a new feature.
- @build-error-resolver - Use for non-trivial build or type failures when focused diagnosis would materially help. Keep straightforward failures with the main agent. The resolver makes minimal fixes and does not perform architectural edits.
- @code-reviewer - MUST BE USED once after implementing and running relevant checks for all code changes. Use `meta-ai/muse-spark-1.3-contributor` with `thinking: xhigh` by default unless the user specifies otherwise. If it returns `Escalation: REQUIRED`, rerun only the affected findings or paths with `openai-codex/gpt-5.6-sol` `thinking: xhigh`. After fixing findings, request a targeted follow-up only when the fixes materially changed the risk surface or a high-severity finding remains. Do not repeat full reviews for mechanical fixes.
- @frontend-builder - REQUIRED for brand-new pages and substantial UI implementation, but not for routine UI planning or small, bounded UI changes. Keep using the frontend-design skill alongside it for styling direction and visual quality.

Whenever you finish building, always provide a summary of the changes made.

## Plan Mode
Keep bounded feature planning with the main agent. Use the architect subagent only when planning requires a consequential architectural decision across system or module boundaries, data ownership, public contracts, security, scalability, reliability, or deployment. When planning new features, always ask clarifying questions and suggest improvements to the implementation.
Heavily consider using the html-communication skill for serving your plan to the user. HTML is easier to read and understand for humnas, so it is preferred, but not required.

### Questions
You have the ability to ask the user questions. This especially helpful when planning. Ask the user questions if the instructions are unclear, you have an idea, you notice wrong, or if you need to ask something. This tool is beneficial is all scenarios, use it liberally. You can also ask questions when building. Always allow the option for the user to input their own answer.

### TO DO List management
You have access to a todo list. You need to make sure that you are keeping it up to date after each step. Before you finish any run, ensure that there are no in progress items. If the user rejected some changes, do not leave the task as in progress.

### File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Extract utilities from large components
- Organize by feature/domain, not by type

### Error Handling

ALWAYS handle errors comprehensively:

```typescript
try {
  const result = await riskyOperation()
  return result
} catch (error) {
  console.error('Operation failed:', error)
  throw new Error('Detailed user-friendly message')
}
```

### Input Validation

ALWAYS validate user input:

```typescript
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150)
})

const validated = schema.parse(input)
```

### Code Comments

Use comments often to describe what the code does. Additionally, it should explain WHY the code is written and what it accomplishes. Especially, when it's not immediately clear.
ALWAYS annotate functions, loops, and large codeblocks. Code comments help humans build mental models of the codebase

- Prefer self-explanatory names and structure over comments
- Comment the why, tradeoff, constraint, or non-obvious behavior
- It is acceptable to comment what the code is doing when the behavior is not immediately clear
- Add a short comment before complex logic that would otherwise take time to parse
- Keep comments accurate when code changes; stale comments are bugs
- Avoid noisy banner comments and large explanatory blocks unless they are genuinely needed
- Use comments to explain one-liners, clunky logic, obfuscated logic

```typescript
// GOOD: explains the constraint behind the logic
// Keep the retry delay capped to avoid overwhelming the upstream API during outages
const delay = Math.min(baseDelay * 2 ** attempt, MAX_DELAY)

// ALSO GOOD: clarifies non-obvious behavior
// Walk backward to find the most recent committed snapshot for this item
let current = node.previous
```

### Code Quality Checklist

Before marking work complete:
- [ ] Code is readable and well-named
- [ ] Functions are small
- [ ] Files are focused
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling
- [ ] No console.log statements
- [ ] Comments are well written, easy to understand, and stay in sync with the code

---

## Testing Requirements

### Test Coverage Guidance

When the user or `AGENTS.md` requires formal test coverage, include the relevant test types:
1. **Unit Tests** - Individual functions, utilities, components
2. **Integration Tests** - API endpoints, database operations
3. **E2E Tests** - Critical user flows (Playwright)

### Test-Driven Development

Use this workflow when the user or `AGENTS.md` requires TDD:
1. Write test first (RED)
2. Run test - it should FAIL
3. Write minimal implementation (GREEN)
4. Run test - it should PASS
5. Refactor (IMPROVE)
6. Verify any user- or `AGENTS.md`-specified coverage target

### Troubleshooting Test Failures

1. Use **tdd-workflow** skill
2. Check test isolation
3. Verify mocks are correct
4. Fix implementation, not tests (unless tests are wrong)

---

### Custom Hooks Pattern

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}
```

### Repository Pattern

```typescript
interface Repository<T> {
  findAll(filters?: Filters): Promise<T[]>
  findById(id: string): Promise<T | null>
  create(data: CreateDto): Promise<T>
  update(id: string, data: UpdateDto): Promise<T>
  delete(id: string): Promise<void>
}
```

## Success Metrics

You are successful when:
- All required tests pass and any requested coverage target is met
- No security vulnerabilities
- Code is readable and maintainable
- Performance is acceptable
- User requirements are met
