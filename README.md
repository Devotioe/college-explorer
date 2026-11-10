# Academic Exploration and Learning Roadmap System

An AI-driven curriculum discovery and personalized learning pathway recommendation platform designed to help university students discover, visualize, and plan cross-disciplinary academic journeys.

## Problem Statement

Course selection and academic planning in higher education present several persistent challenges for students:

1. **Unfamiliarity with Domain Terminology**: Students often know what skills or projects they want to pursue (e.g., "build a user-friendly mobile app"), but do not know the exact course titles or department-specific jargon to search for.

2. **Opaque Prerequisites & Course Relationships**: It is difficult for students to visualize the progression between foundational, intermediate, and advanced courses, as well as formal/informal prerequisites.

3. **Fragmented Cross-Departmental Information**: Relevant courses are often scattered across different department websites, syllabi, and course catalog portals.

4. **Uncertain Long-Term Academic Planning**: Elective courses are opened irregularly, making multi-semester planning subject to scheduling conflicts and strict prerequisite constraints.

## Solution & Core Features

Our system leverages Generative AI (GenAI), semantic course retrieval (RAG), and prerequisite dependency graphs to transform how students explore academic options.

* **GenAI-Powered Intent & Semantic Search**: Translates natural language goals (e.g., *"I want to learn app design and UX"*) into underlying academic domains (such as Human-Computer Interaction, Cognitive Psychology, UI/UX, and Software Engineering).

* **Visual Learning Roadmap**: Displays interactive course networks showing foundational dependencies, advanced extensions, and prerequisite requirements.

* **Personalized Recommendations with Explanations**: Suggests relevant courses based on user interests and academic background while providing clear contextual rationales for each recommendation.

* **Feasible Schedule Generator**: Cross-references real-time course offerings and prerequisite rules to output executable, semester-by-semester learning plans.

## Project Scope (MVP Phase 1)

* **Target Audience**:
  * Students exploring academic or career focus areas.
  * Students interested in cross-disciplinary information technology courses.
  * Students seeking to build a structured, multi-semester learning path.

* **Initial Domain Focus**: National Chengchi University (NCCU) — Department of Management Information Systems (MIS) & Department of Computer Science (CS) undergraduate programs.

* **Scope Rationale**: MIS and CS share complementary tech domains, making them an ideal domain for cross-departmental graph mapping while keeping data verification manageable during the MVP stage.

## System Workflow

```
1. User Login & Natural Language Goal Input
   (e.g., "I want to design a user-friendly mobile application.")
              │
              ▼
2. GenAI Intent Analysis
   (Identifies: HCI, UX Research, Psychology, App Dev)
              │
              ▼
3. Course Knowledge Retrieval (DB & Vector Search)
   (Queries real course catalogs & syllabi)
              │
              ▼
4. Learning Roadmap Graph Generation
   (Maps foundational -> intermediate -> advanced courses)
              │
              ▼
5. Personalized Course Plan & Recommendations
   (Outputs structured semester plans with prerequisite validation)
```

## Feasibility & Cost-Benefit Analysis

### Tangible & Intangible Benefits

| Category | Tangible Benefits | Intangible Benefits |
| ----- | ----- | ----- |
| **Search Efficiency** | Significant reduction in time spent cross-referencing syllabi. | Higher discovery rate of cross-departmental electives. |
| **Workload Reduction** | Automates prerequisite checking and schedule conflict detection. | Enhanced clarity and confidence in academic direction. |
| **Student Autonomy** | Replaces manual paper-based planning with saved digital roadmaps. | Fosters self-directed learning and interdisciplinary exploration. |

### Feasibility Assessment

1. **Economic**: Uses cloud-hosted LLM APIs and lightweight DB infrastructure to minimize upfront capital expenditure.

2. **Technical**: Low-risk frontend/backend integration; main technical focus is on prerequisite logic algorithms and RAG retrieval accuracy.

3. **Operational**: Solves a clear, existing pain point (fragmented course systems) with minimal user learning curve.

4. **Legal / Data Compliance**: Utilizes public university course offerings and anonymous student course reviews with privacy safeguards.