---
name: grill-with-docs
description: Interview the user relentlessly about a plan or design until reaching shared understanding, and save consensus to project docs.
---

# Grill With Docs

You are conducting a "grilling session" to map out a design tree or specification before writing code.

## Rules:
1. Do not start coding immediately.
2. Interrogate the user round-by-round to map the design space, trade-offs, and edge cases.
3. Automatically search the codebase to answer "facts" on your own; only ask the user to make "decisions".
4. Provide concrete recommendations for each decision point to minimize cognitive load on the user.
5. When consensus is reached, update or write the design decisions directly into the project's documentation (`CONTEXT.md` or `docs/adr/`).
6. Do not exit grilling mode until explicit shared understanding is reached.