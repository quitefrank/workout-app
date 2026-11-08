# Rest Push Notifications (Parked)

> **Status: parked, not scheduled.** Frank's call, 2026-11-08: a push notification is enough for now; do not build until he picks it up. Turn this into a full task-by-task plan (superpowers:writing-plans) when it starts.

**Goal:** When a rest ends during an active workout, the phone gets a lock screen notification ("Rest's up: Bench Press, set 3 of 4"), so the app can be locked or in the background between sets.

## Why push, not a Live Activity

Investigated 2026-11-08 against Ladder's lock screen (which is actually its Now Playing card, driven by coach audio, not a Live Activity).

- **Live Activity:** native only (ActivityKit, WidgetKit). Needs a Capacitor shell, a Swift widget extension, Xcode (not installed) and a $99/yr Apple Developer account. Safari 27 added nothing for home screen web apps. Revisit only if more native features are wanted (widgets, haptics, HealthKit).
- **Now Playing card via Media Session:** needs audio playing (a silent loop hack); background audio in standalone web apps is unreliable and lock screen artwork is buggy. Rejected.
- **Web push:** supported for home screen web apps on iOS 16.4+, Declarative Web Push since Safari 18.4. Covers the useful part: knowing when to go again.

## Sketch

- **Opt in:** a Settings toggle asks for notification permission (iOS requires a user gesture) and saves the subscription.
- **Keys:** VAPID key pair in Vercel env; `web-push` (npm) sends from the server.
- **Service worker:** a `push` handler via next-pwa's custom worker (`customWorkerSrc`) shows the notification; a tap opens `/workouts/[id]`. Consider Declarative Web Push so the payload shows without the worker.
- **Tables** (new, so grants in the same migration, per CLAUDE.md "Grants"):
  - `push_subscriptions` per user (endpoint, keys, created_at).
  - `scheduled_pushes` per user (workout_id, fire_at, payload, sent_at, cancelled_at).
- **Scheduling:** logging a working set already starts the prescription's rest; the same server action inserts a `scheduled_pushes` row at `now() + rest`. Skip, logging the next set, finishing or discarding the workout cancels it.
- **Sending:** something has to fire within a few seconds of `fire_at`. The app can't time it in the background, so the server does.

## Open questions (decide before building)

1. **Sender precision.** Vercel Hobby cron is daily only. Candidates: Supabase `pg_cron` at a seconds interval with `pg_net` calling a send endpoint, a Supabase Edge Function, or a delayed-message queue (Upstash QStash). Target: within about 5s of rest end.
2. **App in the foreground.** iOS expects every push to show a notification (silent pushes can cost the subscription), so suppress on the server: cancel the push when the screen is open and visible at rest end, or accept a duplicate alert.
3. **Copy and content.** Next exercise and set, or just "Rest's up"? Sound or silent?
4. **Other triggers later?** For example, a reminder for a workout started and left open. Out of scope unless Frank adds it.
