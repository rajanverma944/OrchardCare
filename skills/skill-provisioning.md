# Skill: Provisioning a new machine (from a fresh clone)

**When:** someone cloned the GitHub repo onto a Windows PC and `tools/` is empty
(it's git-ignored). Goal: portable toolchain + databases, no admin rights.

## Automated

```powershell
powershell -ExecutionPolicy Bypass -File scripts\provision-tools.ps1
```

The script (idempotent — safe to rerun):
1. Downloads to `tools\downloads\`: Node 22 zip, Temurin JDK 21 zip, Android cmdline-tools,
   PostgreSQL 16 binaries zip, (optionally) PortableGit.
2. Extracts each into `tools\<name>` with the layout the scripts expect:
   `tools\node\npm.cmd`, `tools\jdk21\bin\java.exe`, `tools\android-sdk\cmdline-tools\latest`,
   `tools\pgsql\bin\pg_ctl.exe`, `tools\git\bin\git.exe`.
3. Pre-writes Android SDK license files, then installs
   `platform-tools`, `platforms;android-35`, `platforms;android-36`, `build-tools;35.0.0/36.0.0`.
4. Runs `scripts\setup-postgres.ps1` (initdb → start on 5433 → create `orchard` role +
   `orchardcare` / `orchardcare_test` DBs).
5. `npm install` in `backend\` and `mobile\`.
6. Creates `backend\.env` from `.env.example` with a freshly generated JWT secret.
7. Creates the `C:\oc` junction.

## Manual fallback

Install Node 22 LTS, JDK 21, Android cmdline-tools (API 35+36, build-tools 35+36),
PostgreSQL 16, Git — then adjust the paths in the scripts (they read nothing external;
hardcoded under `tools\`). Keep the same layout to avoid editing every script.

## Verify

```powershell
C:\oc\tools\node\node.exe --version      # v22.x
C:\oc\tools\jdk21\bin\java.exe -version  # 21.x
C:\oc\tools\git\bin\git.exe --version
C:\oc\tools\pgsql\bin\pg_ctl.exe -D C:\oc\tools\pgdata status
```

Then: `npm test` in backend (41 green) and one APK build.
