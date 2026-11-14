# Mixed-source Learning Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current parallel learning-map columns with a directed tree that prioritizes official prerequisites and uses clearly labeled semantic suggestions only where official relationships are missing.

**Architecture:** Add a pure learning-tree builder that normalizes prerequisite text, matches OCR/catalog courses, assigns ordered depths, and returns typed nodes and edges. The page consumes that model and renders one responsive SVG tree on desktop plus a vertical staged tree on mobile. The existing D1 catalog endpoint will expose prerequisites already stored in the database.

**Tech Stack:** TypeScript 5.9, React 19, Next/Vinext, CSS, Node 22 built-in test runner

**Spec:** `docs/superpowers/specs/2026-11-15-learning-tree-design.md`

## Global Constraints

- Official prerequisite relationships always take precedence over semantic suggestions.
- Official edges use solid lines; suggested edges use dashed lines and must never be labeled official.
- OCR-completed courses are gray, NCCU courses are blue, and NTHU courses are purple.
- Desktop is left-to-right; mobile is top-to-bottom.
- Do not add a second duplicate map below the hero.
- Do not automatically commit: this repository already contains unrelated user-owned changes.

## Review Focus

- Prerequisite strings containing 「無先修設定」 create no official edge.
- Prerequisite names that do not match the catalog do not create a false official edge.
- Duplicate OCR rows collapse into one completed node.
- Cyclic or contradictory prerequisite data cannot create an infinite traversal.
- Empty transcript or sparse catalog data still produces a readable target tree and upload prompt.

---

### Task 1: Expose and model prerequisite data

**Files:**
- Modify: `app/api/courses/route.ts`
- Modify: `app/page.tsx`
- Create: `lib/learning-tree.ts`
- Test: `tests/learning-tree.test.ts`

**Interfaces:**
- Consumes: D1 `courses.prerequisites`, current `Course`, `ApiCourse`, and `TranscriptRow` shapes.
- Produces: `buildLearningTree(input: LearningTreeInput): LearningTree`, with `LearningTreeNode`, `LearningTreeEdge`, and `LearningTreeStage` exports.

- [ ] **Step 1: Write failing normalization and matching tests**

Add tests asserting: 「無先修設定」 yields no official edge; `[ 經濟學(全學年)(修習且及格)]` matches the catalog title 經濟學; unmatched text yields no official edge; duplicate OCR rows yield one completed node; a two-course cycle terminates and each node appears once.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --experimental-strip-types --test tests/learning-tree.test.ts`
Expected: FAIL because `buildLearningTree` does not exist.

- [ ] **Step 3: Expose `c.prerequisites` in `/api/courses` and preserve it on `Course`**

Add `prerequisites?: string` to `ApiCourse` and `Course`; select it in `app/api/courses/route.ts`; map it in `apiCourseToCourse`.

- [ ] **Step 4: Implement the pure tree builder**

Implement official matching by normalized code/title first. When no official path exists, add suggested edges using course level, numeric sequence markers, shared domains, descriptions, objectives, and fit. Cap the output to one target plus at most eight path nodes and four stages; use visited sets to prevent cycles.

- [ ] **Step 5: Run focused tests**

Run: `node --experimental-strip-types --test tests/learning-tree.test.ts`
Expected: all tests PASS.

### Task 2: Render a real directed learning tree

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/learning-tree.test.ts`

**Interfaces:**
- Consumes: `buildLearningTree(...)` and its typed node/edge/stage output from Task 1.
- Produces: `LearningPathHero` rendered from depth-based stages, with clickable course nodes and source-aware edge styles.

- [ ] **Step 1: Add a failing stage-order test**

Assert that a completed prerequisite is stage 0, a bridge course is stage 1, an advanced course is stage 2, and the selected goal is the final stage; assert official and suggested edge kinds remain distinct.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --experimental-strip-types --test tests/learning-tree.test.ts`
Expected: FAIL on stage ordering.

- [ ] **Step 3: Replace the three-column hero markup**

Build the tree once with `useMemo`. Render nodes by `stage`; render SVG curves from edge endpoints on desktop. Display `官方先修` on solid edges and `建議銜接` on dashed edges. Preserve node click behavior and upload/login fallback.

- [ ] **Step 4: Add responsive tree styling**

Use depth columns with visibly staggered branches on desktop. At `max-width: 720px`, switch to vertical stages with branch indentation and connecting borders; hide only the desktop SVG, not relationship labels.

- [ ] **Step 5: Run focused and static checks**

Run: `node --experimental-strip-types --test tests/learning-tree.test.ts && npx tsc --noEmit && npm run lint`
Expected: tests pass; TypeScript and ESLint exit 0.

### Task 3: Integration verification and regression checks

**Files:**
- Modify only if verification exposes a defect: `app/page.tsx`, `app/globals.css`, `lib/learning-tree.ts`, `tests/learning-tree.test.ts`

**Interfaces:**
- Consumes: completed tree builder and UI from Tasks 1–2.
- Produces: buildable site with unchanged Explore search behavior and a responsive learning tree.

- [ ] **Step 1: Test empty and sparse inputs**

Add assertions that no transcript still returns a goal plus suggested path, and an empty catalog returns a goal-only result without throwing.

- [ ] **Step 2: Run the full learning-tree test file**

Run: `node --experimental-strip-types --test tests/learning-tree.test.ts`
Expected: all tests PASS.

- [ ] **Step 3: Build production output**

Run: `npm run build`
Expected: Vinext build completes and lists `/`, course APIs, transcript APIs, and map APIs.

- [ ] **Step 4: Check the local preview endpoint**

Run: `Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing`
Expected: HTTP 200.

- [ ] **Step 5: Inspect desktop and mobile states when browser preview is available**

Verify Explore retains the search box; Learning Path contains no search box; desktop branches left-to-right; mobile stages top-to-bottom; gray/blue/purple colors and solid/dashed relationship labels remain legible.

