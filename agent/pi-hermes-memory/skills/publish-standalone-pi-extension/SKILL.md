---
name: "publish-standalone-pi-extension"
description: "Publish a local Pi extension as a dedicated GitHub Pi package without leaking user configuration."
version: 1
created: "2026-09-22"
updated: "2026-09-22"
---
## When to Use
When an extension inside ~/.pi/agent/extensions should become an installable git-backed Pi package.

## Procedure
1. Confirm destination repository, public/private visibility and license explicitly before creating a remote.
2. Read Pi packages.md and extensions.md; ensure package.json has a pi.extensions entry, peerDependencies for Pi core imports, and package files whitelist.
3. Copy only extension source, tests, README and example config to a separate repository. Keep live config, auth, settings and trust files outside the package.
4. Document pi install git:github.com/<owner>/<repo>, prerequisites, API key environment, and a copy-if-absent command for the user-owned config.
5. Run tests, node checks and npm pack --dry-run; inspect staged file names and scan for secrets or machine-specific absolute paths.
6. Commit exact reviewed files, create repository with gh repo create, push main and verify remote visibility and commit. Leave the original Pi checkout's unrelated dirty changes untouched.

## Pitfalls
- Do not `pi install` the new git package into the same Pi installation while the original extension is auto-discovered; it can register duplicate tools.
- A README test command must work from the standalone repository root, not the original ~/.pi tree.
- Only claim package publication after gh repo view verifies remote URL and visibility; npm publication is separate.

## Verification
1. node --test ./*.test.ts passes in the standalone repo.
2. npm pack --dry-run lists no live config or secrets.
3. git status --short is clean in the new repo, and gh repo view confirms expected visibility and branch.