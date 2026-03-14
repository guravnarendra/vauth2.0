# 🔍 VAUTH 2.0 — Full Project Audit Report

> **Date:** March 12, 2026  
> **Scope:** Complete backend + frontend code audit  
> **Stack:** Node.js / Express / MongoDB / Firebase RTDB / Socket.IO

---

## Table of Contents

1. [Critical Security Issues](#-critical-security-issues)
2. [Bugs & Errors](#-bugs--errors)
3. [Feature Leakages (Defined but Never Used)](#-feature-leakages-defined-but-never-used)
4. [Missing Features](#-missing-features)
5. [Code Quality Improvements](#-code-quality-improvements)
6. [Staged Update Plan](#-staged-update-plan)
   - [Stage 1 — Static (Landing / No Auth)](#stage-1--static-landing-page--no-auth-required)
   - [Stage 2 — User-Based (Authenticated User)](#stage-2--user-based-authenticated-user-flows)
   - [Stage 3 — Admin-Based (Admin Dashboard)](#stage-3--admin-based-admin-dashboard--management)

---

## 🚨 Critical Security Issues

| # | Issue | File(s) | Severity |
|---|-------|---------|----------|
| 1 | **`.env` committed to Git** — MongoDB URI, Firebase private key, admin password, VPN API key, encryption key are all exposed in plain text inside `.env` which is tracked by Git. | `.env` | 🔴 CRITICAL |
| 2 | **Admin password is `admin123`** — hardcoded weak password compared via plain string in `adminRoutes.js` (no hashing). | `.env`, `adminRoutes.js:45` | 🔴 CRITICAL |
| 3 | **`SESSION_SECRET` is a static string** — should be randomly generated per deployment, not hardcoded. | `.env:16` | 🔴 HIGH |
| 4 | **CORS: `origin: "*"`** on Socket.IO and `origin: true` on Express — allows any domain to make authenticated requests. | `server.js:35, 66` | 🔴 HIGH |
| 5 | **Helmet CSP disabled** — `contentSecurityPolicy: false` removes a major XSS protection layer. | `server.js:61` | 🟡 MEDIUM |
| 6 | **No CSRF protection** — all state-changing POST endpoints lack CSRF tokens. | All routes | 🟡 MEDIUM |
| 7 | **`device_id` stored in `sessionStorage`** on client — visible to any XSS attack on the login page; not validated server-side after login. | `login.html:300`, `2fa.html:342` | 🟡 MEDIUM |
| 8 | **`failedAttempts` Map stored in memory** — resets on server restart, no persistence. Multiple distributed servers would not share this. | `userRoutes.js:9` | 🟡 MEDIUM |
| 9 | **No account lockout** — failed attempts trigger alerts only, never actually lock the account. | `userRoutes.js:406` | 🟡 MEDIUM |
| 10 | **Token generation uses `Math.random()`** — not cryptographically secure; should use `crypto.randomBytes()`. | `firebaseTokenManager.js:78-83` | 🟡 MEDIUM |
| 11 | **`crypto` package listed in `package.json`** — `crypto` is a Node.js built-in. The npm `crypto` package is deprecated and may be malicious. | `package.json:25` | 🟡 MEDIUM |
| 12 | **Auto-delete toggle (`autoDeleteEnabled`) is per-process memory** — resets on restart, not persisted. | `adminRoutes.js:10` | 🟠 LOW |
| 13 | **Encryption uses AES-256-CBC** — landing page claims AES-256-GCM. CBC lacks authentication tag; GCM or using HMAC would be more secure. | `encryption.js:4`, `index.html:238` | 🟡 MEDIUM |
| 14 | **IP Intel endpoint has no authentication** — anyone can query `/api/ip-intel` to check IPs, potentially leaking VPN API usage quota. | `ipIntel.js:6` | 🟠 LOW |

---

## 🐛 Bugs & Errors

| # | Bug | File(s) | Impact |
|---|-----|---------|--------|
| 1 | **`admin-login.html` checks `/api/admin/session-status`** — this route does NOT exist in `adminRoutes.js`. The call will always return a 404/error JSON, never redirect to admin dashboard on re-visit. | `admin-login.html:373`, `adminRoutes.js` | 🔴 Broken |
| 2 | **Token.js overrides Mongoose `.find()`** static — this replaces the built-in Mongoose `find()`, which may break other Mongoose internals or chained queries. | `Token.js:68` | 🟡 Risky |
| 3 | **Dashboard "Logout" button on active sessions** — the non-current sessions show a `<button>` with text "Logout" but no `onclick` handler is attached. Clicking does nothing. | `dashboard.html:494` | 🔴 Broken |
| 4 | **`login.html` uses `usernameInput`/`passwordInput` before declaration** — the variables are declared on lines 318-319 but used on line 275-276 inside the submit handler. Works due to hoisting but is fragile. | `login.html:275-276, 318-319` | 🟠 Minor |
| 5 | **`database.js` calls `Token.createIndexes()`** — but Token model is now proxied to Firebase. Calling `createIndexes()` on a Mongoose model that doesn't actually write to MongoDB collections is pointless. | `database.js:39` | 🟠 Minor |
| 6 | **`2fa.html` token expiry notice says "5 minutes"** — but `.env` has `TOKEN_EXPIRY_SECONDS=60` (1 minute). Misleading to users. | `2fa.html:310`, `.env:20` | 🟡 UX Bug |
| 7 | **`index.html` stats section shows hardcoded "10K+ Active Users"** — completely fake/marketing stats with no dynamic data. | `index.html:184` | 🟠 Minor |
| 8 | **Footer copyright says "© 2024"** — should be 2025/2026 or dynamic. | `index.html:383` | 🟠 Minor |
| 9 | **`download V-Gate` link on login page** points to `/downloads/pc-agent.exe` — this file does not exist in the project, resulting in a 404. | `login.html:246` | 🟡 Broken Link |
| 10 | **Admin sidebar "Last Backup: 2h ago"** — this is hardcoded text, not dynamic. | `admin-dashboard.html:631` | 🟠 Minor |
| 11 | **`Session.createSession()` expires ALL previous active sessions** — even from different devices. This prevents true multi-device support. | `Session.js:48-52` | 🟡 Design Issue |

---

## 🕳️ Feature Leakages (Defined but Never Used)

These models/schemas exist in the codebase but are **never referenced from any route, middleware, or frontend**:

| # | Unused Model | File | Purpose (Inferred) |
|---|-------------|------|---------------------|
| 1 | `ActivityLog` | `models/ActivityLog.js` | Meant to log user/admin actions — **no route writes or reads this collection.** |
| 2 | `BackupLog` | `models/BackupLog.js` | Meant to record backup events — **"Manual Backup" button in admin dashboard has no backend implementation.** |
| 3 | `SecurityLog` | `models/SecurityLog.js` | Meant to persist security events (currently only sent via Socket.IO, never saved to DB). |
| 4 | `SystemMetrics` | `models/SystemMetrics.js` | Meant to store DB health metrics — **admin dashboard shows hardcoded "95% Healthy" and "98% Healthy" instead.** |
| 5 | `UserPreferences` | `models/UserPreferences.js` | Meant to store user settings (dark mode, notifications) — **never referenced from any route.** User model has a `preferences_reference` field that's never populated. |

### Other Unused/Leaking Features

| # | Feature | Details |
|---|---------|---------|
| 6 | **User fields `last_login_device`, `last_login_location`** — defined in `User.js` schema but never populated by any route. | `User.js:41-42` |
| 7 | **User field `failed_attempts_count`** — exists in schema but never incremented; in-memory `failedAttempts` Map is used instead. | `User.js:43-46` |
| 8 | **Session fields `user_agent`, `device_type`, `location_city`** — defined in schema but `createSession()` never populates them. | `Session.js:31-33` |
| 9 | **`express-validator`** — installed but only partially used (login/add-user). Most routes lack input validation. | `package.json:30` |
| 10 | **"Export Activity (CSV)" button** — visible in admin dashboard but the corresponding `admin-dashboard.js` file was not reviewed for backend support, and `adminRoutes.js` has no export endpoint. | `admin-dashboard.html:790` |
| 11 | **"Manual Backup" button** — visible in admin dashboard, no backend backup route implementation exists. | `admin-dashboard.html:792` |
| 12 | **Dark mode toggle** — available in admin UI, but the `UserPreferences` model integration is missing; setting is lost on page reload. | `admin-dashboard.html:791` |
| 13 | **IP Intel VPN/Proxy check** — the endpoint exists (`/api/ip-intel`) but is never called from any frontend page or login flow. | `ipIntel.js` |

---

## 🛠️ Missing Features

| # | Missing Feature | Description |
|---|----------------|-------------|
| 1 | **Password reset / "Forgot Password"** | No user-facing recovery mechanism exists. |
| 2 | **Admin session status endpoint** | `admin-login.html` checks `/api/admin/session-status` which doesn't exist. |
| 3 | **User deletion by admin** | Admin can add users but cannot delete or deactivate them. |
| 4 | **User profile editing** | Users can change password but can't edit name, email, or mobile. |
| 5 | **Audit trail / Activity log viewing** | Models exist but no data is ever saved or displayed. |
| 6 | **Email/notification system** | `UserPreferences` has notification settings but no email service is configured. |
| 7 | **Admin 2FA** | Admin login has no 2FA — only username/password with plain-text comparison. |
| 8 | **Data export (user data)** | No GDPR-friendly data export for users. |
| 9 | **Input sanitization** | No XSS sanitization on user-provided input (name, email, etc.) before encryption. |
| 10 | **Tests** | No test files exist; `npm test` script exits with error. |
| 11 | **API documentation** | No Swagger/OpenAPI docs. |

---

## ✨ Code Quality Improvements

| # | Improvement | Details |
|---|------------|---------|
| 1 | **Add `.gitignore` for `.env`** | `.env` must be excluded from Git. Create `.env.example` with placeholder values. |
| 2 | **Separate admin sessions** | Admin and user sessions share the same cookie store. Use separate session stores or JWT for admin. |
| 3 | **Use `crypto.randomInt()` for token generation** | Replace `Math.random()` with Node.js `crypto.randomInt()` for secure randomness. |
| 4 | **Remove `crypto` from npm dependencies** | It's a Node.js built-in — remove from `package.json`. |
| 5 | **Enable Helmet CSP** | Configure a proper Content Security Policy instead of disabling it entirely. |
| 6 | **Extract inline CSS/JS from HTML** | All 6 HTML pages have massive inline `<style>` and `<script>` blocks. Extract to separate files. |
| 7 | **Create a shared CSS file** | The Tailwind config and custom CSS are copy-pasted across every HTML page. Use a single stylesheet. |
| 8 | **Use a template engine (EJS/Pug)** | Eliminate code duplication across HTML files (nav, footer, styles). |
| 9 | **Add request logging middleware** | Use `morgan` or similar for HTTP request logging. |
| 10 | **Refactor Token model** | The Token Mongoose model has overridden built-in statics (`find`, `countDocuments`) which is an anti-pattern. Create a separate `TokenService` class instead. |
| 11 | **Restrict CORS origins** | Replace `origin: "*"` and `origin: true` with specific allowed domains. |
| 12 | **Add `.env` validation library** | Use `joi` or `envalid` for strict env var validation instead of manual checks. |
| 13 | **Consolidate cleanup intervals** | `server.js` and `adminRoutes.js` both run separate `setInterval` cleanup timers. Consolidate to one. |

---

## 📋 Staged Update Plan

### Stage 1 — Static (Landing Page / No Auth Required)

All fixes for pages that require **no authentication**: `index.html`, `login.html`, `admin-login.html`, `2fa.html`.

| # | Update | Priority | File(s) |
|---|--------|----------|---------|
| 1.1 | **Fix copyright year** in footer | 🟢 Easy | `index.html` |
| 1.2 | **Remove or replace fake stats** ("10K+ Active Users") with real counts or remove section | 🟡 Medium | `index.html` |
| 1.3 | **Fix encryption claim** — change "AES-256-GCM" to "AES-256-CBC" or upgrade actual encryption | 🟡 Medium | `index.html` |
| 1.4 | **Fix or remove V-Gate download link** (`/downloads/pc-agent.exe` → 404) | 🟡 Medium | `login.html` |
| 1.5 | **Fix token expiry message** on 2FA page — update "5 minutes" to match actual `TOKEN_EXPIRY_SECONDS` | 🟡 Medium | `2fa.html` |
| 1.6 | **Extract shared CSS** into a single file and reference across all pages | 🟢 Easy | All HTML |
| 1.7 | **Add meta descriptions & SEO tags** to all pages | 🟢 Easy | All HTML |
| 1.8 | **Add `.gitignore`** — exclude `.env`, `node_modules`, `.DS_Store` | 🔴 Urgent | Root |
| 1.9 | **Create `.env.example`** with placeholder values | 🔴 Urgent | Root |
| 1.10 | **Add proper `<meta>` robots tag** for admin pages | 🟢 Easy | `admin-login.html` |

---

### Stage 2 — User-Based (Authenticated User Flows)

Fixes for **user login → 2FA → dashboard** flow and user-facing API routes.

| # | Update | Priority | File(s) |
|---|--------|----------|---------|
| 2.1 | **Fix session from `sessionStorage` to server-side token** — `device_id` should not be client-side stored | 🔴 High | `login.html`, `2fa.html`, `userRoutes.js` |
| 2.2 | **Wire up active session "Logout" buttons** — add click handler to end individual sessions | 🔴 High | `dashboard.html` |
| 2.3 | **Populate `user_agent`, `device_type`, `location_city`** in sessions | 🟡 Medium | `Session.js`, `userRoutes.js` |
| 2.4 | **Populate `last_login_device`, `last_login_location`** on login | 🟡 Medium | `User.js`, `userRoutes.js` |
| 2.5 | **Add password strength requirements** — currently only `min: 6` for new password | 🟡 Medium | `userRoutes.js` |
| 2.6 | **Add "Confirm new password" field** to password change form | 🟢 Easy | `dashboard.html` |
| 2.7 | **Use `crypto.randomInt()` for token generation** instead of `Math.random()` | 🔴 High | `firebaseTokenManager.js` |
| 2.8 | **Allow user profile editing** (name, email, mobile) | 🟡 Medium | New route + `dashboard.html` |
| 2.9 | **Add user-friendly error pages** (404, 500) instead of JSON responses | 🟡 Medium | `server.js` |
| 2.10 | **Implement `failed_attempts_count`** in DB instead of in-memory Map | 🟡 Medium | `User.js`, `userRoutes.js` |
| 2.11 | **Add account lockout** after N failed attempts (with timed unlock) | 🟡 Medium | `userRoutes.js` |
| 2.12 | **Call IP Intel** during user login to flag VPN/proxy logins | 🟢 Easy | `userRoutes.js`, `ipIntel.js` |
| 2.13 | **Support true multi-device sessions** — don't expire old sessions on new login | 🟡 Medium | `Session.js` |

---

### Stage 3 — Admin-Based (Admin Dashboard & Management)

Fixes for **admin login → admin dashboard** flow and admin management APIs.

| # | Update | Priority | File(s) |
|---|--------|----------|---------|
| 3.1 | **Add `/api/admin/session-status` endpoint** — currently missing (causes 404 on admin login page) | 🔴 High | `adminRoutes.js` |
| 3.2 | **Hash admin password** — store hashed password in `.env` (or use DB-based admin) instead of plain text comparison | 🔴 High | `.env`, `adminRoutes.js` |
| 3.3 | **Add Admin 2FA** — admin login should also require 2FA | 🟡 Medium | `adminRoutes.js`, `admin-login.html` |
| 3.4 | **Implement ActivityLog writing** — save events to DB on login, token verifications, admin actions | 🟡 Medium | `ActivityLog.js`, routes |
| 3.5 | **Implement ActivityLog reading** — admin endpoint to fetch & display activity logs | 🟡 Medium | `adminRoutes.js` |
| 3.6 | **Implement SecurityLog writing** — persist security alerts to DB (currently Socket.IO only) | 🟡 Medium | `SecurityLog.js`, routes |
| 3.7 | **Implement SystemMetrics collection** — replace hardcoded health percentages with real DB metrics | 🟡 Medium | `SystemMetrics.js`, `adminRoutes.js` |
| 3.8 | **Implement backup system** — wire "Manual Backup" button to a real backup route | 🟡 Medium | `BackupLog.js`, `adminRoutes.js` |
| 3.9 | **Implement CSV export** — add endpoint for activity/user data export | 🟡 Medium | `adminRoutes.js` |
| 3.10 | **Add user deletion** — admin ability to delete/deactivate users | 🟡 Medium | `adminRoutes.js` |
| 3.11 | **Persist dark mode preference** — use `UserPreferences` model to save across sessions | 🟢 Easy | `UserPreferences.js`, `adminRoutes.js` |
| 3.12 | **Restrict CORS** — configure specific origins instead of wildcard | 🔴 High | `server.js` |
| 3.13 | **Enable Helmet CSP** — configure proper Content Security Policy | 🟡 Medium | `server.js` |
| 3.14 | **Add CSRF protection** — use `csurf` or similar middleware for state-changing requests | 🟡 Medium | `server.js` |
| 3.15 | **Persist `autoDeleteEnabled`** setting — save to DB or config instead of in-memory | 🟢 Easy | `adminRoutes.js` |
| 3.16 | **Refactor Token model** — remove overridden Mongoose statics, create a `TokenService` class | 🟡 Medium | `Token.js` |
| 3.17 | **Remove `crypto` from npm dependencies** | 🟢 Easy | `package.json` |
| 3.18 | **Add request logging** — integrate `morgan` for HTTP access logs | 🟢 Easy | `server.js`, `package.json` |
| 3.19 | **Add tests** — at least basic endpoint smoke tests | 🟡 Medium | New `tests/` directory |
| 3.20 | **Separate admin and user sessions** — prevent session conflicts between roles | 🟡 Medium | `server.js` |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Critical Security Issues | 14 |
| Bugs & Errors | 11 |
| Unused Models/Features (Leakages) | 13 |
| Missing Features | 11 |
| Code Quality Improvements | 13 |
| **Total Stage 1 Updates (Static)** | **10** |
| **Total Stage 2 Updates (User-Based)** | **13** |
| **Total Stage 3 Updates (Admin-Based)** | **20** |

---

> ⚠️ **Most Urgent Action:** Add `.gitignore` and rotate ALL secrets (MongoDB password, Firebase key, admin password, session secret, encryption key, VPN API key). They are all exposed in the repository.
