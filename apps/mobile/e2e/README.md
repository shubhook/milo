# Mobile smoke test

A [Maestro](https://maestro.mobile.dev/) flow that signs in, creates a bot, sends a message, and
takes over and releases the bot's computer on an Android emulator or iOS simulator. It is opt-in
and does not run in pull-request CI.

## Setup

1. Install the Maestro CLI and start an emulator or simulator.
2. Run the Milo stack (`pnpm dev`) with a working sandbox provider. Local Docker is enough.
3. Sign up a throwaway test account. Never use a real account.
4. Install the app pointed at your API: `http://10.0.2.2:3100` on Android, `http://127.0.0.1:3100`
   on iOS.

   ```sh
   EXPO_PUBLIC_API_URL=http://10.0.2.2:3100 pnpm --filter @milo/mobile android
   ```

## Run

Pass credentials on the command line so they never land in the repo:

```sh
pnpm --filter @milo/mobile test:e2e -- \
  -e RAKAZO_E2E_EMAIL=mobile-smoke@example.test \
  -e RAKAZO_E2E_PASSWORD='replace-with-the-test-password' \
  -e RAKAZO_E2E_BOT_NAME=MaestroSmoke-001 \
  -e RAKAZO_E2E_MESSAGE=mobile-smoke-message
```

Use a new bot name each run if the database persists. The flow clears the app's local state, not
server-side bots.

## Screenshots

**Actions → mobile Android screenshots → Run workflow** captures light and dark screens from a
seeded fake workspace and publishes them next to the Playwright reports.
