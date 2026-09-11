---
name: close
description: Clean session wrap-up. Use at end of a work session to save important context to memory, summarize what was done, and note pending items for next session.
---

# Close Session

**Announce:** "Closing out — saving context and summarizing."

## Steps

### 1. Review What Happened

Scan the conversation for:
- Decisions made (architecture, approach, tooling choices)
- New information about the user (role, preferences, workflow)
- Feedback given (corrections, confirmations of approach)
- Project state changes (what was built, fixed, deployed)
- Pending items (unfinished work, blockers, next steps)

### 2. Save to Memory

For each piece of context that would help a future session:
- **User insights** → save as `user` type memory
- **Approach feedback** → save as `feedback` type memory
- **Project state/decisions** → save as `project` type memory
- **External resource pointers** → save as `reference` type memory

Skip anything already in memory or derivable from code/git.

### 3. Report to User

Format:

```
## Session Summary

**Done:**
- [Completed items, 1 line each]

**Pending:**
- [Unfinished items with context on where they left off]

**Saved to memory:**
- [List of memories saved, 1 line each]

**Next session pick-up:**
[1-2 sentences on what to start with next time]
```

### 4. No Git Operations

Do not commit, push, or create PRs during close. The user handles git.
