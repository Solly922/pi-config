# General Rules
If the change seems large AND you are in an important branch (main, dev, etc...) ask the user if you should use a git worktree.
If you are working in a git worktree, always commit once you've finished your work and mention the commit hash to user.
When asked to review code, provide a grade; grade the code changes on a scale of 0-100 with 100 being perfect code and 0 being the worst thing ever written. Provide ways to improve the score. Also, provide files and line numbers that point to code that should be reviewed by a human

## Build Mode
When using build mode follow these rules:
- All code changes require using the general-guidelines skill.
- When making frontend design changes, always use the frontend-design skill.
- Use the @frontend-builder agent for brand-new pages or substantial UI/UX implementation; keep routine UI planning and small, bounded UI changes with the main agent.
- Always use the uncodexify skill (THIS IS VERY IMPORTANT).
- If the change in a single is extrememly large, consider refactoring.

Default to single-agent execution for small, bounded tasks. Before discretionary delegation, identify a concrete benefit from specialization, parallel execution, or context isolation that exceeds the coordination cost. Do not use discretionary delegation for work the main agent can complete directly, duplicate investigation across agents, or parallelize sequential dependencies. Required specialists and independent review are exceptions. Use at most one non-review subagent per task unless multiple tasks are genuinely independent.

Model routing: use Luna max by default, Luna xhigh for bounded tool-heavy checks, Sol medium for ambiguous implementation, and Sol high for architecture, security, database, or difficult debugging. Never use Terra and never use Sol above high. Always check which gpt model you are using. If it's gpt-5.6-sol, the only acceptable reasoning levels are low, medium, high. If it's gpt-5.6-luna, the only acceptable reasoning levels are xhigh and max.

Use these subagents only when their trigger applies:
- @architect - Use only for consequential decisions involving system or module boundaries, data ownership, public contracts, security architecture, scalability, reliability, or deployment. Do not use for routine UI or bounded feature planning merely because the work is a new feature.
- @build-error-resolver - Use for non-trivial build or type failures when focused diagnosis would materially help. Keep straightforward failures with the main agent. The resolver makes minimal fixes and does not perform architectural edits.
- @code-reviewer - MUST BE USED once after implementing and running relevant checks for all code changes. Run it with `openai-codex/gpt-5.6-luna` and `thinking: max` by default. If it returns `Escalation: REQUIRED`, rerun only the affected findings or paths with `openai-codex/gpt-5.6-sol` and `thinking: high`. After fixing findings, request a targeted follow-up only when the fixes materially changed the risk surface or a high-severity finding remains. Do not repeat full reviews for mechanical fixes.
- @frontend-builder - REQUIRED for brand-new pages and substantial UI implementation, but not for routine UI planning or small, bounded UI changes. Keep using the frontend-design skill alongside it for styling direction and visual quality.

Whenever you finish building, always provide a summary of the changes made.

## Plan Mode
Keep bounded feature planning with the main agent. Use the architect subagent only when planning requires a consequential architectural decision across system or module boundaries, data ownership, public contracts, security, scalability, reliability, or deployment. When planning new features, always ask clarifying questions and suggest improvements to the implementation.

### Questions
You have the ability to ask the user questions. This especially helpful when planning. Ask the user questions if the instructions are unclear, you have an idea, you notice wrong, or if you need to ask something. This tool is beneficial is all scenarios, use it liberally. You can also ask questions when building.

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

Use comments often when they add information the code itself cannot express clearly.

- Prefer self-explanatory names and structure over comments
- Comment the why, tradeoff, constraint, or non-obvious behavior
- Do not add comments that merely restate the code when the code is already clear
- It is acceptable to comment what the code is doing when the behavior is not immediately clear
- Add a short comment before complex logic that would otherwise take time to parse
- Keep comments accurate when code changes; stale comments are bugs
- Avoid noisy banner comments and large explanatory blocks unless they are genuinely needed

```typescript
// GOOD: explains the constraint behind the logic
// Keep the retry delay capped to avoid overwhelming the upstream API during outages
const delay = Math.min(baseDelay * 2 ** attempt, MAX_DELAY)

// ALSO GOOD: clarifies non-obvious behavior
// Walk backward to find the most recent committed snapshot for this item
let current = node.previous

// BAD: only restates the code when the code is already clear
// Set delay to the minimum of baseDelay * 2 ** attempt and MAX_DELAY
const delay = Math.min(baseDelay * 2 ** attempt, MAX_DELAY)
```

### Code Quality Checklist

Before marking work complete:
- [ ] Code is readable and well-named
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling
- [ ] No console.log statements
- [ ] No hardcoded values
- [ ] Comments explain why when possible, or clarify non-obvious behavior, and stay in sync with the code

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
