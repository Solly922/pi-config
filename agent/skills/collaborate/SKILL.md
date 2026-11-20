---
name: collaborate
description: Work a task with the collaborator from the other provider named in your instructions' Collaboration section. Each of you forms an independent take, then you merge them. Use for /collaborate or /skill:collaborate.
disable-model-invocation: true
---

# Collaborate

The collaborator is a peer from another provider, there for a perspective you
would not reach alone. Its take is only worth having while it is independent
of yours, and the steps below protect that. You own the result.

Use the collaborator, model, and effort listed in the Collaboration section of
your instructions. If the user names another, use that. If the collaborator is
unavailable, report it and stop instead of substituting.

## 1. Write the brief

State the goal, the relevant paths, the constraints, and what a finished
answer contains. Write the question, and leave your own leaning and any
candidate answer out of it: a collaborator handed a hypothesis returns it
confirmed. End the brief with: "Reply with your approach, the reasons for it,
the alternatives you rejected, and what you are unsure of. Sketch key code in
the reply. Do not modify files."

The brief is done when a reader with no access to this conversation could
start work from it.

## 2. Take independent positions

Launch the collaborator in the background with the brief. In Claude Code or
Codex, use `delegate_task`. In pi, use `JevAgent` with `agent`, `model`, and
`thinking` set so Jev skips its paid routing.

While it runs, work the problem yourself and write your take in a reply to
the user, in the same four parts the brief asks for. Read the collaborator's
result (`task_status`, or `get_subagent_result` in pi) only after your take is
posted.

## 3. Merge

Compare the two takes and tell the user:

- where they agree,
- each point where they differ, which side you chose, and why,
- anything the collaborator raised that you had missed.

Check a disputed factual claim against the code before choosing a side. When a
difference is a judgment call with real cost either way, give the user both
sides in two or three lines with your recommendation and ask.

Merge once. Send the collaborator a follow-up only for a specific question
whose answer would change your choice, as a new launch that carries both
takes. The merge is done when every difference has a decision or a question
to the user.

## 4. Build

Skip this step when the task ends in a plan or an answer.

You implement the merged approach. You may hand the collaborator a slice to
write in the shared checkout: name the files it owns in the launch prompt, and
leave those files alone until it reports back. Then inspect its changes and
test output yourself. The code-reviewer pass still applies to the combined
diff.

## Report

End the final reply with the collaborator's model and effort, and one line on
what its take changed in the outcome. If it changed nothing, say so.
