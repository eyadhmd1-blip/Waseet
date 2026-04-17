# Waseet — CI/CD Setup Guide
## Android → Firebase App Distribution | iOS → TestFlight

**Build platform:** Codemagic (codemagic.io)  
**Pipeline file:** `codemagic.yaml` (repo root)  
**Estimated setup time:** 45–90 minutes (one-time)

---

## Prerequisites Checklist

Before starting, confirm you have access to:

- [ ] **GitHub account** — to host the code repository
- [ ] **Codemagic account** — codemagic.io (free tier is sufficient for staging)
- [ ] **Firebase account** — console.firebase.google.com (free)
- [ ] **Apple Developer account** — developer.apple.com ($99/year, required for TestFlight)
- [ ] **App Store Connect access** — appstoreconnect.apple.com (included with Developer account)
- [ ] **Android keystore** — for signing the release APK (instructions in §3)

---

## §1 — Push Code to GitHub

### 1.1 Create a GitHub repository

1. Go to **github.com → New repository**
2. Name: `waseet` (or any name you prefer)
3. Set to **Private**
4. Do NOT initialize with README (we already have commits)
5. Click **Create repository**
6. Copy the repository URL (e.g. `https://github.com/eyadhammads/waseet.git`)

### 1.2 Push from your machine

Open a terminal in `C:\Users\e.hammad\Desktop\Waseet` and run:

```bash
git remote add origin https://github.com/YOUR_USERNAME/waseet.git
git branch -M main
git push -u origin main
```

> The repository is already initialized with the initial commit — just push.

---

## §2 — Firebase App Distribution (Android)

### 2.1 Create a Firebase project

1. Go to **console.firebase.google.com**
2. Click **Add project** → name it `waseet-staging`
3. Disable Google Analytics for now (can be enabled later) → **Create project**

### 2.2 Add the Android app

1. Inside the project, click the **Android icon** (Add app)
2. Android package name: `com.waseet.app`
3. App nickname: `Waseet Staging`
4. Download **google-services.json** (needed for push notifications via FCM)
5. Click **Next** through the remaining steps — skip the SDK setup (handled by Expo)

### 2.3 Enable App Distribution

1. In the Firebase console left sidebar → **App Distribution**
2. Click **Get started**
3. Select your Android app
4. Click **Invite testers** → add tester email addresses
5. Optionally create a **group** named `testers` (matches the group name in `codemagic.yaml`)

### 2.4 Get your Firebase App ID

1. Firebase console → **Project settings** (gear icon) → **General**
2. Scroll to **Your apps** → find your Android app
3. Copy the **App ID** — format: `1:XXXXXXXXXX:android:XXXXXXXXXXXXXXXX`
4. Save this — you'll need it in §4 (Codemagic secrets)

### 2.5 Generate a Firebase CI token

Run this on your machine (requires Node.js):

```bash
npx firebase-tools login:ci
```

A browser window opens for authentication. After approving, a token is printed:
```
✔  Success! Use this token to login on a CI server:

1//XXXXXXXXXXXXXXXXXXXXXXXX...
```

Save this token — you'll add it to Codemagic in §4.

### 2.6 Encode google-services.json for Codemagic

```bash
# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\google-services.json")) | clip
# The base64 string is now in your clipboard

# macOS / Linux
base64 -i google-services.json | pbcopy
```

Save this base64 string — it goes into Codemagic as `GOOGLE_SERVICES_JSON`.

---

## §3 — Android Keystore (Release Signing)

Every release APK must be signed with the same keystore. **Never lose this file** — losing the keystore means you can never publish updates to users who installed previous builds.

### Option A — Export from EAS (recommended if you already built with EAS)

```bash
cd mobile
eas credentials --platform android
# Select: Android Keystore → Download
# Save the downloaded .jks file securely
```

### Option B — Generate a new keystore

```bash
keytool -genkey -v \
  -keystore waseet-release.jks \
  -alias waseet \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

You will be prompted for:
- Keystore password → choose a strong password, save it
- Key alias → use `waseet`
- Key password → use the same password as keystore (simpler)
- Distinguished name fields → fill in your details

### Encode keystore for Codemagic

```bash
# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("waseet-release.jks")) | clip

# macOS / Linux
base64 -i waseet-release.jks | pbcopy
```

Save the base64 string — it goes into Codemagic as `CM_KEYSTORE`.

---

## §4 — Set Up Codemagic

### 4.1 Create account and connect GitHub

1. Go to **codemagic.io** → Sign up with GitHub
2. Click **Add application** → **GitHub** → select your `waseet` repository
3. When asked for project type: select **React Native App**
4. Codemagic will detect `codemagic.yaml` automatically

### 4.2 Create environment variable groups

In Codemagic → **Teams** → **Global variables and secrets**, create these groups:

---

#### Group: `android_signing`

| Variable name | Value | Type | Secure |
|---|---|---|---|
| `CM_KEYSTORE` | base64-encoded .jks content (from §3) | String | ✅ Yes |
| `CM_KEYSTORE_PASSWORD` | Your keystore password | String | ✅ Yes |
| `CM_KEY_ALIAS` | `waseet` | String | No |
| `CM_KEY_PASSWORD` | Your key password | String | ✅ Yes |

---

#### Group: `firebase_credentials`

| Variable name | Value | Type | Secure |
|---|---|---|---|
| `FIREBASE_TOKEN` | Token from `firebase login:ci` (§2.5) | String | ✅ Yes |
| `FIREBASE_ANDROID_APP_ID` | Firebase Android App ID (§2.4) | String | No |
| `GOOGLE_SERVICES_JSON` | base64-encoded google-services.json (§2.6) | String | ✅ Yes |

---

#### Group: `app_store_credentials`

| Variable name | Value | Type | Secure |
|---|---|---|---|
| `APP_STORE_CONNECT_ISSUER_ID` | UUID from App Store Connect (§5.3) | String | No |
| `APP_STORE_CONNECT_KEY_IDENTIFIER` | 10-char Key ID (§5.3) | String | No |
| `APP_STORE_CONNECT_PRIVATE_KEY` | Contents of the .p8 file (§5.3) | String | ✅ Yes |
| `APP_STORE_CONNECT_TEAM_ID` | Your 10-char Apple Team ID (§5.1) | String | No |

---

#### Group: `ios_credentials` (optional — for push notifications)

| Variable name | Value | Type | Secure |
|---|---|---|---|
| `GOOGLE_SERVICE_INFO_PLIST` | base64-encoded GoogleService-Info.plist | String | ✅ Yes |

---

### 4.3 Assign groups to your app

1. In Codemagic → your app → **Environment variables**
2. Add all five groups: `android_signing`, `firebase_credentials`, `app_store_credentials`, `ios_credentials`

---

## §5 — Apple TestFlight Setup

### 5.1 Find your Apple Team ID

1. Go to **developer.apple.com → Account → Membership**
2. Copy **Team ID** (10 characters, e.g. `AB12CD34EF`)
3. Open `mobile/ios/ExportOptions.plist` and replace `REPLACE_WITH_YOUR_TEAM_ID` with this value
4. Commit and push the change

### 5.2 Register the app in App Store Connect

1. Go to **appstoreconnect.apple.com**
2. **My Apps → +  (New App)**
3. Platform: **iOS**
4. Name: `Waseet` (or `وسيط`)
5. Primary Language: **Arabic**
6. Bundle ID: `com.waseet.app` ← must match exactly
7. SKU: `waseet-staging` (any unique string)
8. User Access: **Full Access**
9. Click **Create**

### 5.3 Create an App Store Connect API Key

Codemagic uses this key to upload builds without interactive login.

1. App Store Connect → **Users and Access → Integrations → App Store Connect API**
2. Click **+** to generate a new key
3. Name: `Codemagic CI`
4. Access: **Developer** (minimum required for TestFlight upload)
5. Click **Generate**
6. **Download the .p8 file immediately** — it can only be downloaded once
7. Copy and save:
   - **Issuer ID** (UUID at the top of the page)
   - **Key ID** (10-character alphanumeric)
   - The **contents** of the downloaded .p8 file

### 5.4 Add iOS code signing in Codemagic

Codemagic automatically fetches your provisioning profiles from Apple using the API key.

1. Codemagic → **Teams → Code signing identities → iOS**
2. Click **Fetch from Apple Developer Portal**
3. Enter your Apple ID credentials or use the API key
4. Select **Distribution certificate** for `com.waseet.app`
5. Codemagic stores and manages this automatically

### 5.5 Create a TestFlight tester group

1. App Store Connect → your app → **TestFlight**
2. Under **Internal Testing → +**
3. Group name: `Internal Testers` ← must match `codemagic.yaml` exactly
4. Add tester email addresses
5. Testers will receive email invitations to download TestFlight

---

## §6 — Trigger Your First Build

### 6.1 Android build

1. In Codemagic → your app → **Start new build**
2. Select workflow: `android-staging`
3. Select branch: `main`
4. Click **Start build**

Expected duration: **15–25 minutes**

On success:
- Testers in the `testers` Firebase group receive an email with a download link
- You receive a success email at `eyadhmd1@gmail.com`
- The APK artifact is available in Codemagic → Build → Artifacts

### 6.2 iOS build

1. Start new build → workflow: `ios-staging`
2. Select branch: `main`
3. Click **Start build**

Expected duration: **30–50 minutes** (Xcode archive takes longer)

On success:
- Build appears in App Store Connect → TestFlight within minutes
- Testers in `Internal Testers` group receive TestFlight invitation
- You receive a success email

### 6.3 Automatic builds on push (optional)

To trigger builds automatically on every push to `main`:

1. Codemagic → your app → **Triggers**
2. Enable **Push** for branch `main`
3. Select workflows: both `android-staging` and `ios-staging`

---

## §7 — Subsequent Releases

For every new release after initial setup:

```bash
# Make code changes, then:
git add -A
git commit -m "feat: describe your changes"
git push origin main
# Codemagic auto-triggers both builds if §6.3 is configured
# OR manually start builds in Codemagic dashboard
```

Build numbers auto-increment — no manual version bumping needed for staging.

---

## §8 — Troubleshooting

### Android build fails: "Keystore file not found"
- Verify `CM_KEYSTORE` is base64-encoded correctly (no line breaks)
- Check the group `android_signing` is assigned to the app in Codemagic

### Android build fails: "google-services.json missing"
- The build will warn but continue. Push notifications won't work until you add `GOOGLE_SERVICES_JSON`
- This is expected if you haven't set up Firebase FCM yet

### iOS build fails: "No profiles for 'com.waseet.app' were found"
- Complete §5.4 — Codemagic needs to fetch provisioning profiles
- Ensure the bundle ID in App Store Connect matches exactly: `com.waseet.app`

### iOS build fails: "Export options: method was 'app-store' but signingStyle was 'manual'"
- Open `mobile/ios/ExportOptions.plist` and confirm `signingStyle` is `automatic`
- Confirm the Team ID is correct

### Firebase upload fails: "Firebase token is invalid"
- Run `npx firebase-tools login:ci` again to generate a fresh token
- Tokens expire — regenerate every 6 months

### TestFlight upload fails: "Invalid API key"
- Verify the .p8 file contents are pasted correctly (include the `-----BEGIN PRIVATE KEY-----` header/footer)
- Confirm the Key ID and Issuer ID match what's shown in App Store Connect

---

## §9 — Security Reminders

| Item | Status |
|---|---|
| Keystore (.jks) | Stored only in Codemagic secrets — never commit to git |
| google-services.json | Stored only in Codemagic secrets — never commit to git |
| App Store Connect .p8 key | Stored only in Codemagic secrets — downloadable only once |
| Firebase CI token | Stored only in Codemagic secrets |
| Supabase anon key | In `codemagic.yaml` — safe to commit (anon key is public by design) |
| Supabase service role key | NEVER in mobile builds — server-side only |

---

## File Reference

| File | Purpose |
|---|---|
| `codemagic.yaml` | CI/CD pipeline definition (both platforms) |
| `Gemfile` | Ruby dependencies for CocoaPods + xcpretty |
| `mobile/ios/ExportOptions.plist` | iOS archive export configuration |
| `.gitignore` | Excludes secrets, build artifacts, node_modules |
