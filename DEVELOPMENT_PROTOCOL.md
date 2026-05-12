# Cross-Platform Development Protocol (macOS + Windows/WSL)

## Goal
Keep local environments consistent and avoid dependency and Expo CLI issues after frequent pulls.

## 1) Team Standard (Required)
- Use the same Node.js version on all machines.
- Use npm only (do not mix npm/yarn/pnpm in this repository).
- Commit `package-lock.json` whenever dependencies change.
- Never commit `node_modules`.
- Keep `.env` values aligned with team expectations.

## 2) Platform Rules

### macOS Developer
- Use Terminal and run all project commands from the project root.
- Do not reuse old `node_modules` after dependency changes.

### Windows Developer (WSL)
- Use WSL for all project work: install, run, debug, and git.
- Keep the repository inside the WSL filesystem (for example, `~/projects/...`).
- Do not install in Windows and run in WSL (or the reverse).

## 3) One-Time Setup (Both)
1. Install Node.js 20 LTS.
2. Verify versions:

```bash
node -v
npm -v
```

3. Install dependencies with lockfile:

```bash
npm ci
```

## 4) Daily Workflow
1. Pull latest changes.
2. Check whether `package.json` or `package-lock.json` changed.
3. If they changed, run the Pull Protocol (Section 5).
4. Start Expo.

## 5) Pull Protocol (Mandatory after dependency changes)

### macOS
```bash
rm -rf node_modules
npm ci
npx expo start --clear
```

### Windows/WSL
```bash
rm -rf node_modules
npm ci
npx expo start --clear
```

## 6) Normal Start
```bash
npm start
```

or

```bash
npx expo start
```

## 7) Recovery Protocol (Only if startup fails)
Use this when Expo still fails after Section 5:

```bash
rm -rf node_modules package-lock.json
npm install
npx expo start --clear
```

## 8) Dependency Change Protocol
When adding/updating/removing packages:
1. Run dependency changes.
2. Run `npm install`.
3. Commit `package.json` and `package-lock.json` together.
4. In the PR message, tell teammate to run Section 5 after pull.

## 9) PR Checklist
- App starts with `npx expo start`.
- `package-lock.json` is included if dependencies changed.
- No `node_modules` tracked.
- Teammate can run without manual fixes.

## 10) Why this protocol prevents errors
The main failure comes from inconsistent local binaries in `node_modules/.bin` after pulls across different environments. Running a clean install (`npm ci`) after dependency changes regenerates correct binaries for each platform and avoids `expo: command not found`.
