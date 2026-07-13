# General Rules
If the change seems large AND you are in an important branch (main, dev, etc...) ask the user if you should use a git worktree.
If you are working in a git worktree, always commit once you've finished your work and mention the commit hash to user.
When asked to review code, provide a grade; grade the code changes on a scale of 0-100 with 100 being perfect code and 0 being the worst thing ever written. Provide ways to improve the score. Also, provide files and line numbers that point to code that should be reviewed by a human
## Build Mode
When using build mode follow these rules:
- All changes require using the general-guidlines skill (use general-guidlines)
- When making front design changes, always use the frontend-design skill
- When drafting UI/UX or building a brand new page, always use the @frontend-builder agent
- Always use the uncodexify skill (THIS IS VERY IMPORTANT)
- If the change in a single is extrememly large, consider refactoring
- Use general-guidlines skill

Use these subagents as directed below; when no specific trigger applies, use them if beneficial to parallize work:
- @architect - Software architecture specialist for system design, scalability, and technical decision-making. Use PROACTIVELY when planning new features, refactoring large systems, or making architectural decisions.
- @build-error-resolver - Build and error resolution specialist. Use PROACTIVELY when build fails or type errors occur. Fixes build/type errors only with minimal diffs, no architectural edits. Focuses on getting the build green quickly.
- @code-reviewer - Expert code review specialist. Proactively reviews code for quality, security, and maintainability. Use immediately after writing or modifying code. MUST BE USED for all code changes.
- @frontend-builder - REQUIRED when drafting UI/UX or creating a brand new page. Also use proactively for substantial new UI implementation. Keep using the frontend-design skill alongside it for styling direction and visual quality.

## Plan Mode
Use the architect skill when planning a bigger project, otherwise ignore. When planning new features, always ask clarifying questions and suggest improvements to the implementation.

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
