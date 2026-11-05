# EaziCart Native — Stories Read-Only Foundation

Date: 2026-11-05. Development only; not deployed.

## Implemented

- Home story rail uses the actual published seller IDs from the cursor feed and /social/stories batch endpoint.
- Expired stories do not appear because the backend filters expired media.
- The native full-screen Story viewer uses the existing /social/stories/:userId API, supports sequential photos, native video playback, progress indicators, previous/next controls, and a storefront shortcut.
- Images play for 5.5 seconds each; video playback uses Expo Video and advances on completion.
- Pause on app background, route blur and user press-and-hold.
- No fake story content, view counts, hearts, product links or backend write operations.

## Verified

Run `pnpm --filter @eazicart/mobile test`, `typecheck`, `lint`, `test:live:read-only`, and Expo iOS/Android exports. Do not treat bundle exports as physical device validation.

## Deferred

Story heart/view endpoints, owner deletion controls, creating stories with the native camera, exact Figma review, iOS/Android device tests, deep-link association, performance profiling and full social features.
