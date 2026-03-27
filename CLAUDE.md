# CLAUDE.md

## Mission
Build and improve this project as a production-grade product.
Favor the best realistic solution over the cheapest or fastest one.
Do not produce demos, shortcuts, or partial implementations unless explicitly requested.

## Working Style
- Enter planning mode for any non-trivial task:
  - 3+ meaningful steps
  - architecture or product decisions
  - multiple files or subsystems
  - external tools, research, or MCP usage
  - uncertainty about the correct approach
- Think before coding.
- If assumptions break or evidence changes, stop and re-plan.

## Quality Bar
- Deliver solutions that are robust, maintainable, and production-ready.
- Prefer root-cause fixes over temporary patches.
- For non-trivial changes, pause and ask whether there is a cleaner or more elegant design.
- Avoid overengineering, but do not settle for hacky fixes.

## Subagents
- Use subagents aggressively when they improve result quality.
- Good uses:
  - parallel research
  - architecture comparisons
  - independent debugging hypotheses
  - validation and review
  - broad exploration tasks
- Keep each subagent focused on one clear objective.
- Synthesize results back into a clean main-thread summary.

## Research and Documentation
- Prefer official documentation and primary sources.
- Use web research when documentation, APIs, libraries, or best practices may have changed.
- Use available MCPs such as Context7, shadcn, and Playwright when they improve execution quality.

## Verification Before Completion
Never mark work complete without appropriate validation.
Where relevant:
- run tests
- inspect logs/errors
- verify behavior in browser
- compare before/after behavior
- check failure paths and edge cases

Ask: would a strong staff engineer approve this?

## Browser and End-to-End Validation
For UI or product flows:
- inspect the running app in the browser
- validate critical paths as a real user would
- fix discovered issues before declaring completion

## Project Hygiene
- Keep the repository in a clean, understandable state.
- Make changes with minimal unnecessary surface area.
- Document important decisions and progress in project files when useful.
- Leave the codebase easier to continue from, not messier.

## Task Tracking
For substantial work:
- write and maintain a checkable plan
- track progress as work advances
- record key implementation decisions
- add a short review of what was completed and how it was verified

## Lessons
After a correction or mistake:
- capture the concrete reusable lesson
- phrase it as a rule that would prevent repetition
- keep lessons specific and useful, not generic

## Product Context
This project should feel like a complete professional product, not a prototype.
When implementing from specification files:
- treat them as guidance, not immutable truth
- improve weak or outdated choices
- justify meaningful deviations