# Deployments and unsaved edits

The Docker build gives each release a unique `NEXT_DEPLOYMENT_ID`. Next.js detects an older browser tab and loads the new release during navigation. An operator may supply the ID as a Docker build argument instead. Use the same ID for replicas of one release, and a new ID for each release. Outside Docker, set `NEXT_DEPLOYMENT_ID` when running `npm run build`.

Editors write recovery drafts synchronously on each change to `sessionStorage`, scoped by the signed-in user and the edited resource. Keys do not include the release ID. A reload restores the draft and labels it as unsaved. Server validation and authorization still apply when the user saves. Recovery never submits an edit automatically. If saved data changed while the user was away, the editor asks them to review the recovered draft before saving.

A confirmed save clears only the submitted revision. Typing during that request stays recoverable. Validation errors and interrupted requests keep the draft. When browser storage is blocked or full, the editor warns the user and asks the browser to confirm a reload while work remains unsaved.

Planner actions keep one pending course change until the server confirms it. An interrupted action offers Retry and Discard. Retry compares the change with the latest loaded plan first, so a course that was added before the response was lost is not added twice. Pending changes are never applied automatically, and submitted plans remain read-only.

Transcript recovery stores only parsed course review data in the browser tab, never the PDF or raw PDF text. It does not upload the file. Recovery drafts are temporary: they survive reloads and deployments in the same tab, but are not a backup across devices or closed tabs. Drafts from another account are never loaded into the editor.

Keep the existing production database volume and `AUTH_SECRET` across releases. Container replacement must reuse the database, not recreate it. Migrations and the create-only seed run through the existing entrypoint.

This protection begins after the browser loads a release containing the recovery code. A tab still running an earlier release cannot retroactively recover its unsaved component state.

Verification: `npm run typecheck && npm run lint && npm test`, then `npm run e2e` with local Postgres and `DEV_AUTH=true`. Browser tests use only synthetic records and never enable the dev login in production.
