# AlixsBrain Health Connect Sync — Local Proof of Concept

This Android app reads review-relevant Health Connect data and can synchronize canonical daily summaries to the shared External Brain Worker.

## Current boundary

- Reads one user-selected seven-day range.
- Requests read-only access to steps, sleep, exercise, nutrition and available micronutrients, hydration, weight, and resting heart rate.
- Requests historical-read access for later backfill testing, but does not require it for the seven-day proof of concept.
- Displays aggregate values, exercise sessions, missing values, and source-package coverage locally.
- Cloud sync is disabled unless a Worker endpoint and separate device token are supplied at build time.
- It never writes to Health Connect. Automated scheduling and retention compaction are not implemented yet.

Health Connect `1.1.0` is the stable SDK selected for this proof of concept.

See [ROADMAP.md](ROADMAP.md) for completed, next, and deferred milestones.

## Open and run

Android Studio, JDK 21, Android SDK 36, Build Tools 35/36, ADB, and the Gradle 8.13 wrapper are now available on the repository machine. The proof of concept has been compiled and its unit tests have passed.

1. Install the latest stable Android Studio with JDK 17 and Android SDK 36.
2. Open this `apps/health-connect-sync` directory as a project.
3. Allow Android Studio to download Gradle 8.13 and the declared dependencies.
4. Connect the Android phone with USB debugging enabled, or use Android Studio's wireless debugging.
5. Select the `app` configuration and run it on the phone.
6. Tap **Grant read permissions** and approve only the displayed read categories.
7. Select a start date and tap **Read seven days**.
8. Review the local output and source-package coverage.

Cloud sync remains disabled unless both Gradle properties are supplied outside source control, typically in the user-level `gradle.properties` file:

```properties
healthSyncUrl=https://your-worker.example/api/health/daily
healthSyncToken=replace-with-the-separate-device-token
```

With those properties configured, **Sync accessible 30-day backfill** uploads one summary per local calendar day. Retries replace the same device/date/timezone row.

## Command-line verification

With `JAVA_HOME` pointing to Android Studio's bundled JDK and `ANDROID_HOME` pointing to the installed SDK:

```powershell
.\gradlew.bat testDebugUnitTest assembleDebug
```

The debug APK is generated at:

```text
app/build/outputs/apk/debug/app-debug.apk
```

The phone must have a screen lock configured for Health Connect. On Android 14 and newer, Health Connect is part of the system; on Android 13 and lower it may require the separate Health Connect app.

## What to verify on the phone

- Which requested categories Health Connect actually offers for this package.
- Which sources provide steps, sleep, exercise, nutrition, hydration, weight, and resting heart rate.
- Which micronutrients are populated rather than merely supported by the schema.
- Whether Samsung Health or the current logging apps have synchronized recent data into Health Connect.
- Whether historical-read access is available and grantable.
- Whether totals look plausible and avoid duplicate-source inflation.

Do not proceed to cloud synchronization until source coverage and duplicate behavior are understood.
