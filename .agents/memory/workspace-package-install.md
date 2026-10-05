---
name: Scoped package installs
description: Dependency installation behavior in this pnpm workspace.
---

When adding a dependency to one workspace package, target that package explicitly with pnpm's workspace filter rather than using the generic Replit package-install callback, which runs `pnpm add` at the workspace root and rejects filter flags.

**Why:** Root-level installs fail in a pnpm workspace or risk adding an app dependency to the wrong package.

**How to apply:** Use `pnpm --filter @workspace/<package> add <dependency>` for app-specific packages; keep the root package for shared tooling only.
