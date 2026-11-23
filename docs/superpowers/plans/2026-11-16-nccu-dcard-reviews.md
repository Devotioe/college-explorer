# NCCU Dcard Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean the existing Dcard dataset into published/quarantine/rejected layers, expose verified reviews in NCCU course details, and generate all-NCCU public-search coverage with an initial cross-department source expansion.

**Architecture:** A deterministic Node pipeline reads the existing SQLite/CSV evidence, normalizes URLs and identities, matches reviews to the canonical NCCU course catalog, and writes inspectable processed JSON plus a quality report. Published rows are bootstrapped into a new D1 table and returned only through the course-detail API. A separate query generator covers all NCCU departments while newly collected public sources enter the same pipeline instead of bypassing validation.

**Tech Stack:** Node 24 (`node:sqlite`), JavaScript/TypeScript, React 19, Vinext/Next API routes, Drizzle ORM, Cloudflare D1, CSS

**Spec:** `docs/superpowers/specs/2026-11-16-nccu-dcard-reviews-design.md`

## Global Constraints

- Only `published` reviews may be returned to ordinary frontend users.
- Store and display short course-focused summaries and source links, never author identity or full article copies.
- Official course catalog matching controls course identity; search prominence does not.
- Subjective Dcard content must not change recommendation scores in this phase.
- Public collection must not bypass login, robots, paywalls, or website safety barriers.
- Empty review coverage is a valid state and must never generate synthetic reviews.
- Do not automatically commit while `app/page.tsx` contains previously uncommitted branding/theme work; verify first and let the user decide the combined commit boundary.

## Review Focus

- Comment-page URLs such as `/p/<id>/b/<n>` normalize to the parent post and do not duplicate it.
- Same-title courses across departments do not publish without teacher, code, department, or semester disambiguation.
- A withdrawn source cannot remain published after a repeat pipeline run.
- Null teacher/semester values do not defeat uniqueness or create duplicate D1 rows.
- Search-only snippets with insufficient course evidence stay quarantined even when their title contains 「修課心得」.

---

### Task 1: Deterministic Dcard cleaning pipeline

**Files:**
- Create: `scripts/process-dcard-reviews.mjs`
- Create: `tests/dcard-review-pipeline.test.mjs`
- Create: `data/dcard/processed/.gitkeep`
- Generate: `data/dcard/processed/published.json`
- Generate: `data/dcard/processed/quarantine.json`
- Generate: `data/dcard/processed/rejected.json`
- Generate: `data/dcard/processed/quality-report.json`

**Interfaces:**
- Consumes: `data/dcard/collector.sqlite3`, review CSV files, `data/course-seed.json`.
- Produces: exported functions `canonicalizeDcardUrl(url)`, `buildCatalogIndex(courses)`, `classifyReview(input, index)`, and CLI-generated processed artifacts.

- [ ] **Step 1: Write failing normalization, deduplication, and classification tests**

Assert that canonical NCCU URLs pass, `/b/<n>` URLs fold to the parent, non-NCCU boards reject, duplicate post/course/teacher/semester rows collapse, exact course+teacher matches publish, ambiguous same-title matches quarantine, missing content quarantines, and withdrawn sources reject.

- [ ] **Step 2: Run tests to verify RED**

Run: `node --test tests/dcard-review-pipeline.test.mjs`
Expected: FAIL because the processor module does not exist.

- [ ] **Step 3: Implement the pure pipeline helpers**

Implement the four exported interfaces. Normalize Unicode, whitespace, full-width punctuation, semester notation, and Dcard URLs. Use deterministic reason codes such as `duplicate_post_review`, `non_nccu_board`, `withdrawn_source`, `ambiguous_course`, `insufficient_content`, and `course_not_found`.

- [ ] **Step 4: Implement the CLI processing pass**

Read SQLite with `node:sqlite`, merge existing course/teacher reviews with source rows, classify every row, and write stable sorted JSON. The quality report must include input rows, unique posts, published/quarantine/rejected counts, reason counts, department coverage, course coverage, and duplicate rate.

- [ ] **Step 5: Verify GREEN and generated invariants**

Run: `node --test tests/dcard-review-pipeline.test.mjs && node scripts/process-dcard-reviews.mjs`
Expected: tests pass; generated published rows all have `courseId`, canonical NCCU URLs, unique composite keys, summaries, and `verificationStatus: "published"`.

### Task 2: D1 storage and course-detail API

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/0004_student_course_reviews.sql`
- Modify: `drizzle/meta/_journal.json`
- Create: `app/api/reviews/bootstrap/route.ts`
- Modify: `app/api/courses/[id]/route.ts`
- Create: `lib/student-reviews.ts`
- Create: `tests/student-reviews.test.mjs`

**Interfaces:**
- Consumes: Task 1 `published.json` rows.
- Produces: `studentCourseReviews` schema; `normalizePublishedReview(row)`; course detail response field `reviews: StudentCourseReview[]`.

- [ ] **Step 1: Write failing mapper and uniqueness tests**

Assert that nullable teacher/semester become stable empty strings for uniqueness, rejected/quarantine rows cannot normalize for insertion, summaries and URLs are length-bounded, and duplicate composite keys produce one insert record.

- [ ] **Step 2: Run mapper tests to verify RED**

Run: `node --experimental-strip-types --test tests/student-reviews.test.mjs`
Expected: FAIL because `lib/student-reviews.ts` does not exist.

- [ ] **Step 3: Add schema and migration**

Create the columns from the spec, foreign-key `course_id` to `courses.id`, index `course_id`, index `verification_status`, and unique composite index `(course_id, source_post_id, teacher, semester)`.

- [ ] **Step 4: Add idempotent review bootstrap**

`GET /api/reviews/bootstrap` reports imported/total/done. `POST` imports bounded batches from `published.json` using upsert semantics and never imports non-published rows.

- [ ] **Step 5: Return published reviews from course details**

Extend `GET /api/courses/[id]` with newest-first reviews filtered to `verification_status = 'published'`; preserve the current course-detail fields.

- [ ] **Step 6: Verify storage/API code**

Run: `node --experimental-strip-types --test tests/student-reviews.test.mjs && npx tsc --noEmit && npm run lint`
Expected: mapper tests, TypeScript, and ESLint pass.

### Task 3: Course-detail review experience

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: Task 2 `reviews` array in the course-detail response.
- Produces: a `學生公開心得` section inside `CourseDetailsModal` with source links and an empty state.

- [ ] **Step 1: Extend frontend review types and fetch flow**

Add `StudentCourseReview` and include `reviews` in `CourseDetail`. Trigger the review bootstrap once before or alongside course-detail loading without blocking the rest of the modal.

- [ ] **Step 2: Render published review cards**

Show count, semester/teacher metadata when present, short summary, an external Dcard link, and the fixed subjective-experience notice. Render no quarantine/rejected state or internal reason codes.

- [ ] **Step 3: Render the empty state and accessible styles**

Use a compact empty message for no reviews. Keep links keyboard accessible, distinguish source metadata without relying on color alone, and support light/dark themes and mobile widths.

- [ ] **Step 4: Run static verification**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all commands exit 0 and the course-detail API route remains in the build output.

### Task 4: All-NCCU query coverage and first public-source expansion

**Files:**
- Create: `scripts/build-nccu-dcard-queries.mjs`
- Create: `tests/nccu-dcard-queries.test.mjs`
- Generate: `data/dcard/all-nccu-search-queries.csv`
- Create or update: `data/dcard/new-public-sources.json`

**Interfaces:**
- Consumes: all NCCU entries in `data/course-seed.json` plus teacher/department data.
- Produces: `buildNccuSearchQueries(courses)` and a deduplicated query inventory; curated source records compatible with Task 1.

- [ ] **Step 1: Write failing query-coverage tests**

Assert every NCCU department has at least one query, generic yearly review queries exist, exact course-title queries are deduplicated, teacher+course queries are emitted only when both exist, and no NTHU course appears.

- [ ] **Step 2: Run query tests to verify RED**

Run: `node --test tests/nccu-dcard-queries.test.mjs`
Expected: FAIL because the generator does not exist.

- [ ] **Step 3: Implement and generate the all-NCCU query inventory**

Generate stable CSV rows containing query kind, department, course code/title, teacher, query text, and search URL. Keep query generation separate from network retrieval.

- [ ] **Step 4: Collect the first cross-department public-source batch**

Use public web search and accessible Dcard pages to add at least eight multi-course or high-signal posts spanning at least six NCCU departments/categories. Store only source URL, post ID, title, observed date, public excerpt needed for matching, and course-focused summaries; retain source links.

- [ ] **Step 5: Re-run the shared cleaning pipeline**

Merge `new-public-sources.json` into Task 1 input, regenerate all processed layers, and verify every new published review meets the same rules as legacy data.

- [ ] **Step 6: Verify query and quality coverage**

Run: `node --test tests/nccu-dcard-queries.test.mjs && node scripts/process-dcard-reviews.mjs`
Expected: query tests pass; report shows all NCCU departments represented in query seeds and at least six departments/categories represented in the new source batch.

### Task 5: End-to-end verification and handoff

**Files:**
- Modify only if evidence identifies a defect: files owned by Tasks 1–4
- Update: `README.md`

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: reproducible data commands, verified site behavior, and documented limitations.

- [ ] **Step 1: Run the complete automated verification set**

Run: `node --test tests/theme.test.mjs tests/dcard-review-pipeline.test.mjs tests/student-reviews.test.mjs tests/nccu-dcard-queries.test.mjs && npx tsc --noEmit && npm run lint && npm run build`
Expected: all tests and commands pass with zero failures.

- [ ] **Step 2: Check processed data invariants directly**

Verify zero duplicate published composite keys, zero non-NCCU published URLs, zero missing course IDs or summaries, and zero quarantine/rejected rows in the bootstrap input.

- [ ] **Step 3: Verify the local website**

Open a政大 course with reviews and one without reviews. Confirm the first shows review cards and source links, the second shows the empty state, and no internal verification state is exposed.

- [ ] **Step 4: Update project documentation**

Document the processing, query-generation, bootstrap, test, and refresh commands; state that Dcard opinions are subjective and do not affect recommendation scoring.

- [ ] **Step 5: Present the reviewed diff and data-quality summary before commit/push**

Report input/output layer counts, coverage, unresolved quarantine volume, new public-source coverage, and modified files. Ask the user whether to combine these changes with the existing branding/theme edits in one commit or split them deliberately.
