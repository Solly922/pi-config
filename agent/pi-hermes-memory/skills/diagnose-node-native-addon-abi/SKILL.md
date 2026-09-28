---
name: "diagnose-node-native-addon-abi"
description: "Diagnose Node native addon load failures after runtime upgrades"
version: 2
created: "2026-08-27"
updated: "2026-09-01"
---
## When to Use
Use when Node reports `Module did not self-register`, `ERR_DLOPEN_FAILED`, or a `NODE_MODULE_VERSION` mismatch for a `.node` addon.

## Procedure
1. Record `node --version`, `node -p process.versions.modules`, and the exact addon path.
2. Inspect the addon's registration symbol with `nm -D addon.node | grep node_register_module_v` and map it to the runtime ABI with the installed `node-abi` package when available.
3. Find the owning dependency with `npm explain <package> --prefix <install-root>`.
4. Rebuild from the dependency root with the same Node executable that runs the host process, then restart the host process.
5. Verify in a fresh Node process by loading the package, exercising one real operation, and checking that the registration symbol now matches `process.versions.modules`.

## Pitfalls
- Do not use `npm rebuild --dry-run --foreground-scripts` as a non-mutating probe. npm may still execute install scripts and replace native binaries.
- A process that already failed to load the old binary can keep a stale dynamic-loader handle. Rebuilding the file may not repair that running process, so restart it.
- Do not pin package installation to a different Node major than the host application when the package has ABI-bound native addons.
- Invoking another runtime's `npm` script by path is not enough when its shebang or lifecycle scripts use `/usr/bin/env node`. Prepend the intended Node `bin` directory to `PATH`, invoke that Node executable with `npm-cli.js`, then verify the addon's registration symbol.
## Verification
1. The addon's `node_register_module_vNNN` symbol matches `process.versions.modules`.
2. A fresh Node process can load the package and complete one real operation.
3. The host application stops emitting the native-addon warning after restart.