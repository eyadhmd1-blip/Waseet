# Waseet Application — Comprehensive QA Test Cases Report

**Document Version:** 5.0  
**Prepared By:** Senior QA Lead  
**Application:** Waseet (وسيط) — Service Marketplace Platform  
**Platforms:** React Native (iOS/Android), Next.js Admin Portal  
**Backend:** Supabase (PostgreSQL + Edge Functions + Realtime)  
**Date:** 2026-05-14  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Coverage Matrix](#2-coverage-matrix)
3. [AUTH — Authentication & Onboarding](#3-auth--authentication--onboarding)
4. [REQ — Service Request Management](#4-req--service-request-management)
5. [BID — Bid Management](#5-bid--bid-management)
6. [JOB — Job Lifecycle](#6-job--job-lifecycle)
7. [SUB — Subscriptions & Credits](#7-sub--subscriptions--credits)
8. [MSG — Messaging & Chat](#8-msg--messaging--chat)
9. [NTF — Notifications & Push](#9-ntf--notifications--push)
10. [PRO — Provider Profile & Portfolio](#10-pro--provider-profile--portfolio)
11. [CNT — Recurring Contracts](#11-cnt--recurring-contracts)
12. [SPT — Support & Help Center](#12-spt--support--help-center)
13. [ADM — Admin Portal](#13-adm--admin-portal)
14. [SEC — Security Testing](#14-sec--security-testing)
15. [PER — Performance & Load](#15-per--performance--load)
16. [LOC — Localization & RTL](#16-loc--localization--rtl)
17. [Risk Assessment](#17-risk-assessment)
18. [Regression Suite](#18-regression-suite)
19. [Automation Candidates](#19-automation-candidates)
20. [UX — Inline Validation & Error Display](#20-ux--inline-validation--error-display)
21. [CAT — Categories & Service Data](#21-cat--categories--service-data)
22. [OBD — Onboarding Screen Redesign](#22-obd--onboarding-screen-redesign)
23. [VFY — Verify Screen Redesign](#23-vfy--verify-screen-redesign)
24. [REG — Register Screen Redesign](#24-reg--register-screen-redesign)
25. [THME — App-Wide Theme & Visual Redesign](#25-thme--app-wide-theme--visual-redesign)
26. [NCAT — New Service Categories (Water, Cleaning, Gardening)](#26-ncat--new-service-categories-water-cleaning-gardening)
27. [DEMO — Provider Demo Request Card](#27-demo--provider-demo-request-card)
28. [FLAG — Provider Automatic Flagging & Admin Portal](#28-flag--provider-automatic-flagging--admin-portal)
29. [ADMUIX — Admin Portal Visual Redesign](#29-admuix--admin-portal-visual-redesign)
30. [RT — Real-Time Features](#30-rt--real-time-features)
31. [ANTF — Admin Notifications (Email + SMS)](#31-antf--admin-notifications-email--sms)
32. [LIFECYCLE — Automated Lifecycle Notifications](#32-lifecycle--automated-lifecycle-notifications)
33. [NTGTG — Manual Targeted Broadcast (Enhanced Segments)](#33-ntgtg--manual-targeted-broadcast-enhanced-segments)
34. [ACTR — Action Center (Enhanced Smart Alerts)](#34-actr--action-center-enhanced-smart-alerts)
35. [REVT — Revenue Timeline Chart](#35-revt--revenue-timeline-chart)
36. [SDLY — Supply/Demand Analytics Page](#36-sdly--supplydemand-analytics-page)
37. [SYSH — System Health Page](#37-sysh--system-health-page)
38. [BUGFIX — Bug-Fix Regression Suite (v2.6)](#38-bugfix--bug-fix-regression-suite-v26)
39. [BUGFIX2 — Bug-Fix Regression Suite v3.0 (Pass-2)](#39-bugfix2--bug-fix-regression-suite-v30-pass-2)
40. [RPTS — Reports Export Hub (25 Reports)](#40-rpts--reports-export-hub-25-reports)

---

## 1. Executive Summary

### Application Overview
Waseet (وسيط) is a two-sided service marketplace for Jordan, connecting **clients (طالب الخدمة)** who post service requests with **providers (مزود الخدمة)** who bid on those requests. The platform covers 55+ service categories across 11 groups (maintenance, cleaning, technical, health & beauty, events, education, freelance, handicrafts, pets, car services, water services). An **Admin Portal** (Next.js) provides full operational control.

### Key Business Flows
| Flow | Risk Level | Critical |
|------|-----------|---------|
| Phone OTP authentication | HIGH | Yes |
| Request creation → bid → job lifecycle | CRITICAL | Yes |
| Credit deduction on bid submission | CRITICAL | Yes |
| Grace period & provider commitment window | HIGH | Yes |
| Subscription activation via Paddle webhook | HIGH | Yes |
| 6-digit confirmation code for job completion | HIGH | Yes |
| Recurring contract visit scheduling | MEDIUM | Yes |
| Provider reputation tier progression | MEDIUM | No |
| Admin subscription manual activation | HIGH | Yes |

### Test Statistics
| Module | Test Cases | Critical | High | Medium | Low |
|--------|-----------|---------|------|--------|-----|
| AUTH | 28 | 8 | 10 | 7 | 3 |
| REQ | 38 | 10 | 14 | 10 | 4 |
| BID | 36 | 12 | 14 | 7 | 3 |
| JOB | 30 | 12 | 10 | 6 | 2 |
| SUB | 28 | 10 | 10 | 6 | 2 |
| MSG | 20 | 4 | 8 | 6 | 2 |
| NTF | 22 | 6 | 8 | 6 | 2 |
| PRO | 22 | 4 | 8 | 8 | 2 |
| CNT | 28 | 8 | 10 | 8 | 2 |
| SPT | 18 | 4 | 6 | 6 | 2 |
| ADM | 36 | 10 | 14 | 9 | 3 |
| SEC | 28 | 14 | 10 | 4 | 0 |
| PER | 18 | 6 | 8 | 4 | 0 |
| LOC | 14 | 2 | 6 | 4 | 2 |
| UX | 16 | 0 | 8 | 8 | 0 |
| CAT | 6 | 1 | 3 | 2 | 0 |
| NCAT | 13 | 1 | 8 | 4 | 0 |
| OBD | 8 | 0 | 4 | 4 | 0 |
| VFY | 6 | 0 | 3 | 3 | 0 |
| REG | 6 | 0 | 3 | 3 | 0 |
| DEMO | 8 | 0 | 5 | 3 | 0 |
| FLAG | 12 | 2 | 6 | 4 | 0 |
| ADMUIX | 9 | 0 | 5 | 4 | 0 |
| RT | 5 | 1 | 4 | 0 | 0 |
| ANTF | 10 | 2 | 6 | 2 | 0 |
| LIFECYCLE | 12 | 2 | 6 | 4 | 0 |
| NTGTG | 10 | 2 | 5 | 3 | 0 |
| ACTR | 10 | 2 | 4 | 3 | 1 |
| REVT | 6 | 1 | 2 | 2 | 1 |
| SDLY | 8 | 2 | 4 | 2 | 0 |
| SYSH | 8 | 2 | 4 | 2 | 0 |
| BUGFIX | 8 | 5 | 3 | 0 | 0 |
| BUGFIX2 | 13 | 5 | 5 | 3 | 0 |
| RPTS | 22 | 4 | 10 | 6 | 2 |
| **TOTAL** | **558** | **149** | **234** | **144** | **31** |

---

## 2. Coverage Matrix

| Test Type | Modules Covered |
|-----------|----------------|
| Functional Testing | AUTH, REQ, BID, JOB, SUB, MSG, PRO, CNT, SPT, ADM |
| Regression Testing | All modules (Critical + High priority cases) |
| Negative Testing | AUTH, REQ, BID, JOB, SUB, SEC |
| Boundary & Edge Cases | AUTH, BID, SUB, CNT, NTF |
| Security Testing | AUTH, SEC, ADM, API |
| Performance & Load | PER, BID, MSG, NTF |
| API Integration | BID (credits RPC), SUB (Paddle webhook), NTF (Expo push) |
| Role & Permission | AUTH, ADM, SEC |
| Notification & Realtime | NTF, MSG, JOB |
| Payment/Wallet | SUB |
| Localization | LOC, all UI modules |
| UI/UX Alignment | All UI modules |

---

## 3. AUTH — Authentication & Onboarding

### High-Risk Areas
- OTP brute-force (3-attempt limit + 10-min expiry)
- Expired OTP reuse attack
- Duplicate phone registration
- Role assignment immutability post-signup
- SecureStore token persistence across app kills

---

#### AUTH-001
**Name:** Successful new user registration as Client  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** Phone number not registered in `users` table; SMS gateway operational.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open app → tap Register | Registration screen displayed with full_name, phone, role fields |
| 2 | Enter full_name: "أحمد محمد", phone: "+962791234567", role: client | Fields populated correctly |
| 3 | Tap "إرسال رمز التحقق" | OTP SMS sent; verify screen appears; timer starts (10 min) |
| 4 | Enter correct 6-digit OTP | `phone_otps.verified_at` set; `users` row inserted with role='client' |
| 5 | Select city "Amman" | Profile complete; routed to `(client)/index.tsx` home |

**Expected Result:** User row inserted with `phone_verified=true`, `role='client'`. Auth token stored in Expo SecureStore.  
**Automation Candidate:** Yes (Detox E2E)

---

#### AUTH-002
**Name:** Successful new user registration as Provider  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** Unique phone; SMS gateway operational.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Register with role: provider | `users` + `providers` rows created; `providers` row has `is_subscribed=false`, `trial_used=false`, no subscription fields set |
| 2 | Complete registration | Provider routed to `/subscribe` screen with trial plan pre-selected |
| 3 | Provider selects trial, taps "ابدأ مجاناً" | `activate_provider_subscription` RPC fires; `is_subscribed=true`, `subscription_tier='trial'`, `trial_used=true`, 10 credits, 30-day expiry |
| 4 | After trial activation | Provider routed to `/(provider)` dashboard |

**Expected Result:** Both `users` and `providers` rows created atomically. `subscription_tier` remains null until the provider explicitly activates via the subscribe screen.  
**Automation Candidate:** Yes

---

#### AUTH-003
**Name:** OTP expired before entry  
**Priority:** Critical | **Type:** Negative  
**Preconditions:** User requested OTP; wait 11 minutes without entering code.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Wait 11 minutes after OTP sent | Timer shows 00:00 |
| 2 | Enter any 6-digit code | Error: "انتهت صلاحية الرمز. أعد الإرسال." |
| 3 | Check `phone_otps` table | `expires_at` < now(); `verified_at` is null |

**Expected Result:** OTP rejected; user prompted to resend. No session created.  
**Automation Candidate:** Yes (mock time)

---

#### AUTH-004
**Name:** OTP brute-force — 3 wrong attempts  
**Priority:** Critical | **Type:** Security  
**Preconditions:** Valid OTP sent to phone.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter wrong OTP 3 times consecutively | After 3rd failure: account locked for OTP; error displayed |
| 2 | Enter correct OTP (4th attempt) | Still rejected; "تجاوزت عدد المحاولات المسموح بها" |
| 3 | Check `phone_otps.attempts` | = 3 (max) |

**Expected Result:** `attempts >= 3` blocks further verification. Must request new OTP.  
**Automation Candidate:** Yes

---

#### AUTH-005
**Name:** Duplicate phone number registration  
**Priority:** Critical | **Type:** Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Register with phone "+962791234567" (already registered) | After OTP verification: error "هذا الرقم مسجل مسبقاً" |
| 2 | Check `users` table | No duplicate row created |

**Expected Result:** Unique constraint on `users.phone` prevents duplicate. User guided to login.  
**Automation Candidate:** Yes

---

#### AUTH-006
**Name:** Returning user login — correct OTP  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open app → Login | Phone field displayed |
| 2 | Enter registered phone | OTP sent |
| 3 | Enter correct OTP | Routed to correct home based on `users.role` |

**Expected Result:** Session restored. Provider → `(provider)/index.tsx`; Client → `(client)/index.tsx`.

---

#### AUTH-007
**Name:** Login with unregistered phone  
**Priority:** High | **Type:** Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter phone not in `users` table | Error: "هذا الرقم غير مسجل. هل تريد التسجيل؟" with Register CTA |

---

#### AUTH-008
**Name:** Invalid phone format on registration  
**Priority:** High | **Type:** Boundary

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter phone "12345" | Validation error: "رقم الهاتف غير صحيح" |
| 2 | Enter phone "abc" | Same validation error |
| 3 | Enter phone "" | "الرقم مطلوب" |
| 4 | Enter phone "+962791234567" (13 chars) | Accepted |

---

#### AUTH-009
**Name:** Empty full_name on registration  
**Priority:** High | **Type:** Boundary

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Leave full_name blank, submit | "الاسم الكامل مطلوب" |
| 2 | Enter single character | Should reject (min length) |
| 3 | Enter 100+ character name | Trimmed or validation error |

---

#### AUTH-010
**Name:** City selection required before profile complete  
**Priority:** Medium | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Complete OTP verification | City picker shown |
| 2 | Skip without selecting city | Submit blocked; "اختر مدينتك" error |
| 3 | Select from 12 valid cities | Profile saved; home screen loaded |

---

#### AUTH-011
**Name:** App kill & resume — session persistence  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Login as provider | Session active |
| 2 | Force-kill app | — |
| 3 | Reopen app | Directly routed to `(provider)/index.tsx` without re-login |

**Expected Result:** Auth token in Expo SecureStore survives process kill.

---

#### AUTH-012
**Name:** Onboarding shown only once  
**Priority:** Medium | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | First login → onboarding tutorial shown | Navigate all slides |
| 2 | Complete → home | — |
| 3 | Kill & reopen app | No onboarding shown; direct to home |

---

#### AUTH-013
**Name:** Role immutability after registration  
**Priority:** High | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Register as client | `users.role = 'client'` |
| 2 | Attempt to set `role='provider'` via direct Supabase query | RLS policy denies; `users.role` unchanged |

**Expected Result:** Role cannot be changed post-signup without admin intervention. No self-escalation.

---

#### AUTH-014
**Name:** OTP reuse after successful verification  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Use OTP successfully | `verified_at` set |
| 2 | Attempt to reuse same OTP | Rejected: "تم استخدام هذا الرمز مسبقاً" |

---

#### AUTH-015
**Name:** Logout clears session  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Login → go to profile | — |
| 2 | Tap Logout | SecureStore token cleared; Supabase session ended |
| 3 | Navigate to protected route | Redirected to login screen |

---

#### AUTH-016
**Name:** Admin user cannot access mobile app client/provider routes  
**Priority:** Critical | **Type:** Role & Permission

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Login with `role='admin'` on mobile app | Mobile app checks role; redirected to admin screen or shows error |

---

#### AUTH-017 – AUTH-028 (Additional Auth Cases)

| ID | Name | Priority | Type |
|----|------|---------|------|
| AUTH-017 | Phone with country code variations (+962, 00962, 0) | Medium | Boundary |
| AUTH-018 | SMS delivery failure — resend OTP CTA visible | High | Negative |
| AUTH-019 | Concurrent login from two devices — last token wins | Medium | Functional |
| AUTH-020 | Profile photo upload on registration — valid/invalid formats | Medium | Functional |
| AUTH-021 | Profile photo > 5MB rejected | Medium | Boundary |
| AUTH-022 | Very long bio on provider profile — character limit enforced | Low | Boundary |
| AUTH-023 | Phone number with spaces/dashes ("+962 79 123 4567") | Medium | Boundary |
| AUTH-024 | Deep link from OTP SMS opens app directly | Medium | Functional |
| AUTH-025 | Network offline during OTP request — error shown, retry offered | High | Negative |
| AUTH-026 | Network offline during registration submit | High | Negative |
| AUTH-027 | Provider registration — categories selection (multi-select) | High | Functional |
| AUTH-028 | Provider registration — no categories selected (submit blocked) | Medium | Negative |

---

## 4. REQ — Service Request Management

### High-Risk Areas
- AI price suggestion call failing silently
- Image upload to Supabase Storage — size/format/CORS
- Urgent request premium % calculation
- Request expiry auto-cancel (24h for urgent)
- Status transitions (open→reviewing→in_progress→completed)

---

#### REQ-001
**Name:** Create standard service request — full happy path  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** Logged in as client; network available; at least one category active.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap "طلب جديد" | new-request.tsx opens — step 1: category selection |
| 2 | Select category "plumbing" | Step 2: request details |
| 3 | Enter title: "إصلاح تسرب مياه في المطبخ" (min 10 chars ✓) | — |
| 4 | Enter description: "يوجد تسرب تحت الحوض يحتاج استبدال..." (min 20 chars ✓) | — |
| 5 | Select city "Amman", district "خلدا" | — |
| 6 | Upload 2 images (< 5MB each, JPEG) | Images preview shown; uploaded to Supabase Storage |
| 7 | Review AI price suggestion | `ai_suggested_price_min`/`max` displayed |
| 8 | Submit | `requests` row inserted; `status='open'`; `views_count=0` |

**Expected Result:** Request visible in client's request list. Providers in same city+category notified.  
**Automation Candidate:** Yes

---

#### REQ-002
**Name:** Request title below minimum length  
**Priority:** High | **Type:** Boundary/Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter title "إصلاح" (5 chars) | Submit blocked; "العنوان يجب أن يكون 10 أحرف على الأقل" |
| 2 | Enter title with exactly 10 chars | Accepted |

---

#### REQ-003
**Name:** Request description below minimum length  
**Priority:** High | **Type:** Boundary/Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter description with 19 chars | Submit blocked; validation error |
| 2 | Enter exactly 20 chars | Accepted |

---

#### REQ-004
**Name:** Upload 4 images (exceeds limit)  
**Priority:** High | **Type:** Boundary

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Attempt to upload 4th image | CTA disabled or error: "الحد الأقصى 3 صور" |

---

#### REQ-005
**Name:** Upload image > 5MB  
**Priority:** High | **Type:** Boundary

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Select image file > 5MB | Error: "حجم الصورة يجب أن يكون أقل من 5MB" |
| 2 | Check `requests.image_urls` | No URL added |

---

#### REQ-006
**Name:** Upload invalid file type (PDF instead of image)  
**Priority:** Medium | **Type:** Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Attempt to upload .pdf file | Rejected: "نوع الملف غير مدعوم" |

---

#### REQ-007
**Name:** AI price suggestion API failure  
**Priority:** High | **Type:** Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create request for category without AI support | AI price fields remain null; no error shown to user; submission proceeds normally |
| 2 | Create request while `ai-price-suggest` edge function is down | Request submits without AI price; non-blocking error logged |

---

#### REQ-008
**Name:** Create urgent request  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** Client logged in; category supports urgent.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Select "طلب عاجل" option | urgent-request.tsx loads |
| 2 | Submit request | `is_urgent=true`; `urgent_premium_pct` set (20–50%); `urgent_expires_at = now() + 24h` |
| 3 | Providers notified | Special urgent push notification sent |

---

#### REQ-009
**Name:** Urgent request auto-expires after 24h with no bids  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create urgent request | `urgent_expires_at` set |
| 2 | Wait 24h without any bids | `status` transitions to 'expired'; `notify-no-bids` function fires |
| 3 | Check client notification | "لم يتلقَ طلبك أي عروض. جرب تعديل التفاصيل" |

---

#### REQ-010
**Name:** View own requests list — filtering and status  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to `(client)/requests.tsx` | All client requests listed |
| 2 | Filter by status "open" | Only open requests shown |
| 3 | Filter by status "completed" | Only completed requests shown |

---

#### REQ-011
**Name:** Request detail — bid count visible to client  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open request-detail.tsx for request with 3 bids | `bids_count=3` displayed; bids listed (amount, provider name, note) |

---

#### REQ-012
**Name:** Request with no city selected — submit blocked  
**Priority:** High | **Type:** Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Fill all fields except city | Submit button disabled or inline error: "اختر المدينة" |

---

#### REQ-013
**Name:** Request cancelled by client  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open an 'open' or 'reviewing' request | Cancel option available |
| 2 | Confirm cancellation with reason | `status='cancelled'`; `cancelled_reason` saved; pending bids auto-rejected |

---

#### REQ-014
**Name:** Client cannot cancel in_progress job request  
**Priority:** High | **Type:** Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open request with `status='in_progress'` | Cancel option disabled or shows "لا يمكن إلغاء طلب قيد التنفيذ" |

---

#### REQ-015
**Name:** Views count increments on request open  
**Priority:** Low | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider opens request detail | `requests.views_count` incremented by 1 |
| 2 | Same provider opens again | Should not double-count (debounce expected) |

---

#### REQ-016
**Name:** Request detail for expired request — no bid allowed  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider opens an expired request | Bid button absent or disabled; "انتهت صلاحية هذا الطلب" shown |

---

#### REQ-017
**Name:** Create recurring service request  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open recurring-request.tsx | Frequency selector (weekly/biweekly/monthly) shown |
| 2 | Select frequency: monthly, duration: 6 months | Correct fields populated |
| 3 | Select preferred_day: Tuesday, preferred_time_window: morning | — |
| 4 | Submit | `recurring_contracts` row inserted with `status='bidding'` |

---

#### REQ-018
**Name:** Courier request — pickup and dropoff fields required  
**Priority:** Medium | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Select category "courier" | Pickup address + dropoff address fields appear |
| 2 | Submit without pickup | Validation error |
| 3 | Fill both fields and submit | Request created with courier-specific data |

---

#### REQ-019 – REQ-038 (Additional Request Cases)

| ID | Name | Priority | Type |
|----|------|---------|------|
| REQ-019 | Request submitted while offline — queued or error shown | High | Negative |
| REQ-020 | Client edits open request (update title/description) | Medium | Functional |
| REQ-021 | Client cannot edit request once status is reviewing | Medium | Negative |
| REQ-022 | Request with only whitespace in title | High | Negative |
| REQ-023 | Request with only whitespace in description | High | Negative |
| REQ-024 | AI price suggestion shows loading state | Low | UI/UX |
| REQ-025 | Category picker — all 50 categories load with correct icons | Medium | Functional |
| REQ-026 | Category picker — inactive category not shown | Medium | Functional |
| REQ-027 | Request image order preserved after submit | Low | Functional |
| REQ-028 | Request status transition: open→reviewing (on first bid) | High | Functional |
| REQ-029 | Request status transition: reviewing→in_progress (on acceptance) | Critical | Functional |
| REQ-030 | Request status transition: in_progress→completed (after rating) | Critical | Functional |
| REQ-031 | Max bids per request (if `max_bids` set) — additional bids rejected | High | Boundary |
| REQ-032 | `bidding_ends_at` enforced — bids after deadline rejected | High | Boundary |
| REQ-033 | Client cannot see other clients' requests | Critical | Security |
| REQ-034 | Request with injected SQL in title | Critical | Security |
| REQ-035 | Request with XSS in description | Critical | Security |
| REQ-036 | Request with 3000-char description (max boundary) | Medium | Boundary |
| REQ-037 | Newly posted request appears on provider home feed immediately | High | Realtime |
| REQ-038 | Client request list pagination — 20+ requests | Medium | Performance |

---

## 5. BID — Bid Management

### High-Risk Areas
- Atomic credit deduction via `submit_bid_with_credits()` RPC
- 24-hour rejection cooldown enforcement
- Premium tier 5 concurrent pending bid cap
- Unsubscribed provider bid attempt
- Bid price vs. category min/max limits

---

#### BID-001
**Name:** Provider submits bid — normal request, credit deduction  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** Provider subscribed (basic tier, 20 credits); request is 'open'; provider hasn't bid before.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider opens request-detail.tsx | "قدم عرضاً" button visible |
| 2 | Enter amount: 35 JOD, note: "لدي خبرة 5 سنوات" | — |
| 3 | Submit bid | `bids` row inserted; `status='pending'`; `credit_cost=1` |
| 4 | Check `providers.subscription_credits` | Decreased by 1 (from 20 → 19) |
| 5 | Client receives push notification | "حصلت على عرض جديد من [Provider Name]" |

**Expected Result:** Bid + credit deduction are atomic — both succeed or both roll back.  
**Automation Candidate:** Yes (critical regression)

---

#### BID-002
**Name:** Provider bids on urgent request — 2 credits deducted  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider (20 credits) bids on urgent request | `credit_cost=2`; credits: 20 → 18 |

---

#### BID-003
**Name:** Provider bids on recurring contract — 3 credits deducted  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider (20 credits) bids on contract bid | `credit_cost=3`; credits: 20 → 17 |

---

#### BID-004
**Name:** Provider with 0 credits attempts to bid  
**Priority:** Critical | **Type:** Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider with 0 credits opens request | Bid button disabled or shows "رصيدك غير كافٍ" |
| 2 | Attempt via API directly | `submit_bid_with_credits()` RPC rejects with credit insufficient error |
| 3 | Check `providers.subscription_credits` | Unchanged (0) |

**Expected Result:** No bid created; credits not changed to negative.  
**Automation Candidate:** Yes

---

#### BID-005
**Name:** Unsubscribed provider attempts to bid  
**Priority:** Critical | **Type:** Security/Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider with `is_subscribed=false` opens request | Bid button shows "اشترك للتقديم" |
| 2 | Attempt to force-POST bid via API | RPC checks subscription; bid rejected |

---

#### BID-006
**Name:** 24-hour cooldown after bid rejection from same client  
**Priority:** Critical | **Type:** Business Rule

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider submits bid; client rejects it | `bids.status='rejected'`; `rejected_at` stamped |
| 2 | Provider tries to bid on same client's new request within 24h | Bid blocked: "لا يمكن التقديم على طلبات هذا العميل خلال 24 ساعة من الرفض" |
| 3 | Attempt after 24h | Bid allowed normally |

**Expected Result:** Cooldown scoped to (provider_id, client_id) pair within 30-day window.  
**Automation Candidate:** Yes (mock time)

---

#### BID-007
**Name:** Premium tier — 5 concurrent pending bids cap  
**Priority:** Critical | **Type:** Boundary

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Premium provider has 5 bids in 'pending' status | `active_bid_count = 5` |
| 2 | Attempt 6th bid | Blocked: "وصلت للحد الأقصى من العروض النشطة (5)" |
| 3 | One bid gets accepted/rejected | `active_bid_count = 4` |
| 4 | Submit 6th bid | Succeeds |

---

#### BID-008
**Name:** Provider withdraws pending bid  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider has pending bid | Status shown as 'pending' |
| 2 | Provider taps "سحب العرض" | `bids.status='withdrawn'`; credits refunded? (verify business rule) |

**Note:** Verify if credits are refunded on withdrawal — this is a critical business rule to confirm.

---

#### BID-009
**Name:** Bid amount below category minimum  
**Priority:** High | **Type:** Boundary

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Category "electrical" has min_bid=15 JOD | — |
| 2 | Provider enters bid amount: 10 JOD | Error: "الحد الأدنى للعرض هو 15 د.أ" |
| 3 | Enter exactly 15 JOD | Accepted |

---

#### BID-010
**Name:** Bid amount above category maximum  
**Priority:** High | **Type:** Boundary

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Category "cleaning" has max_bid=200 JOD | — |
| 2 | Provider enters 201 JOD | Error: "الحد الأقصى للعرض هو 200 د.أ" |
| 3 | Enter exactly 200 JOD | Accepted |

---

#### BID-011
**Name:** Client accepts bid — job created  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client opens request with 3 bids | Bids listed with amounts and provider details |
| 2 | Client taps "قبول" on first bid | Confirmation dialog shown |
| 3 | Confirm acceptance | `jobs` row created; `bids.status='accepted'`; other bids → 'rejected' |
| 4 | Request status | `requests.status='in_progress'` |
| 5 | Provider notified | Push: "تم قبول عرضك!" |

**Expected Result:** Atomic — job created + bids updated + request status updated together.  
**Automation Candidate:** Yes

---

#### BID-012
**Name:** Client rejects specific bid  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client rejects provider's bid | `bids.status='rejected'`; rejection cooldown starts for that provider |
| 2 | Provider notified | Push: "تم رفض عرضك" |

---

#### BID-013
**Name:** Provider bids 0 or negative amount  
**Priority:** High | **Type:** Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter bid amount: 0 | Error: "يجب أن يكون العرض أكبر من صفر" |
| 2 | Enter bid amount: -5 | Same error |

---

#### BID-014
**Name:** Provider bids on own request (if provider is also client)  
**Priority:** High | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider (who also has client role) views own request | Bid button absent or blocked with error |

---

#### BID-015
**Name:** Concurrent bid submissions — credit race condition  
**Priority:** Critical | **Type:** Concurrency

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider has exactly 1 credit | — |
| 2 | Simultaneously submit two bids | Only one bid succeeds; second fails with "رصيد غير كافٍ" |
| 3 | Check credits | Exactly 0 (not -1) |

**Expected Result:** `submit_bid_with_credits()` uses row-level locking to prevent race.  
**Automation Candidate:** Yes (concurrent API calls test)

---

#### BID-016
**Name:** Trial provider bid — credits from trial allotment  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider activates trial (10 credits) | `subscription_tier='trial'`, credits=10 |
| 2 | Submit 10 normal bids | All succeed; credits → 0 |
| 3 | Submit 11th bid | Blocked: credit insufficient |

---

#### BID-017
**Name:** Bid note with XSS content  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Submit bid with note: `<script>alert(1)</script>` | Note stored as plain text; not executed in client's bid list |

---

#### BID-018 – BID-036 (Additional Bid Cases)

| ID | Name | Priority | Type |
|----|------|---------|------|
| BID-018 | Provider bid rejection rate tracked over 30-day window | High | Functional |
| BID-019 | High rejection rate affects provider search ranking | Medium | Functional |
| BID-020 | Bid with very long note (> 500 chars) | Medium | Boundary |
| BID-021 | Provider bid on completed request | High | Negative |
| BID-022 | Provider bid on cancelled request | High | Negative |
| BID-023 | Two providers bid same amount — both shown to client | Medium | Functional |
| BID-024 | Provider profile card shown within bid detail | Medium | UI/UX |
| BID-025 | Bid list sorted by: amount (asc/desc), provider score | Medium | Functional |
| BID-026 | Bid submission offline — queued or error | High | Negative |
| BID-027 | Provider views own bid history | Low | Functional |
| BID-028 | Bonus credits used only after base credits exhausted | High | Functional |
| BID-029 | Bid on inactive category | High | Negative |
| BID-030 | Client sees bid count without seeing bid amounts until reviewing | Medium | Business Rule |
| BID-031 | Provider cannot see other providers' bid amounts | Critical | Security |
| BID-032 | Bid with non-JOD currency (if supported) | Low | Functional |
| BID-033 | Provider submits duplicate bid on same request | High | Negative |
| BID-034 | Smart retract modal shows when provider retracts active bids | Medium | UI/UX |
| BID-035 | Active-bids indicator count on provider dashboard | Medium | Functional |
| BID-036 | Tier-based concurrent bid caps enforced per subscription tier | Critical | Functional |

---

## 6. JOB — Job Lifecycle

### High-Risk Areas
- Grace period timer (1 min): client undo window
- Provider commitment deadline (5 min urgent / 15 min normal)
- 6-digit confirmation code: generation, delivery, expiry, and fraud
- Rating submission — affects provider score and reputation tier
- Job status machine correctness

---

#### JOB-001
**Name:** Grace period — client undoes acceptance within 1 minute  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client accepts bid | Job created; `client_grace_expires_at = now() + 1min`; grace-period.tsx shown |
| 2 | Within 60 seconds, client taps "تراجع" | Job deleted/cancelled; bid status → 'pending' again; request → 'reviewing' |
| 3 | Provider NOT notified | Provider commitment timer never started |

**Expected Result:** Clean rollback. No orphan jobs.  
**Automation Candidate:** Yes (mock time)

---

#### JOB-002
**Name:** Grace period expires — provider commitment timer starts  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client accepts bid for normal request | Grace period starts (1 min) |
| 2 | Grace period expires without undo | `provider_commit_deadline = grace_expires + 15min` |
| 3 | Provider receives commitment notification | "يرجى التأكيد على القبول خلال 15 دقيقة" |

---

#### JOB-003
**Name:** Provider commits to job within deadline  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider receives commitment notification | provider-confirm.tsx opens |
| 2 | Taps "قبول التنفيذ" | `provider_committed_at = now()`; `provider_declined = false` |
| 3 | Client receives 6-digit confirmation code | `confirm_code` (6 digits); `confirm_code_exp = now() + 24h` |

---

#### JOB-004
**Name:** Provider declines job commitment  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider taps "رفض" on commitment screen | `provider_declined = true` |
| 2 | Job status | Job cancelled; request → back to 'reviewing' |
| 3 | Refund logic | Credits refunded to provider (verify business rule) |
| 4 | Client notified | "انسحب مزود الخدمة. يمكنك قبول عرض آخر" |

---

#### JOB-005
**Name:** Provider misses commitment deadline — auto-decline  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | `provider_commit_deadline` passes without action | System auto-sets `provider_declined=true` |
| 2 | `send-delayed-commit-notifications` edge function fires | Client notified: "لم يستجب مزود الخدمة في الوقت المحدد" |
| 3 | Request | Returned to 'reviewing'; other bids can be accepted |

---

#### JOB-006
**Name:** Client uses confirmation code — job marked complete  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider provides 6-digit code verbally | — |
| 2 | Client enters correct code in app | `confirmed_by_client = true`; `confirmed_at = now()` |
| 3 | Job status | `jobs.status='completed'` |
| 4 | Rating screen shown | Both client and provider prompted to rate |

---

#### JOB-007
**Name:** Wrong confirmation code entry  
**Priority:** High | **Type:** Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client enters wrong 6-digit code | Error: "الرمز غير صحيح. حاول مرة أخرى" |
| 2 | Enter wrong code 5 times | Consider rate limiting / lockout |
| 3 | Job status | Remains 'active'; no false completion |

---

#### JOB-008
**Name:** Confirmation code expires after 24 hours  
**Priority:** High | **Type:** Boundary

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider commits; code generated | `confirm_code_exp = now() + 24h` |
| 2 | 25 hours pass; client enters code | Error: "انتهت صلاحية رمز التأكيد. اتصل بالدعم" |

---

#### JOB-009
**Name:** Client rating submission — 5 stars  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Job completed; rate-job.tsx shown | 1–5 star picker + optional review text |
| 2 | Select 5 stars, enter review | `jobs.client_rating=5`; `jobs.client_review` saved |
| 3 | Provider score updated | `providers.score` recalculated (rolling average) |
| 4 | Loyalty milestone check | If `lifetime_jobs` hits 10/25/50/100, tier upgraded |

---

#### JOB-010
**Name:** Provider rating submission — provider rates client  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Job completed | Provider prompted to rate client |
| 2 | Submit 4 stars | `jobs.provider_rating=4` saved |

---

#### JOB-011
**Name:** Rating not submitted — job still marked complete  
**Priority:** Medium | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client skips rating | Job remains 'completed'; `client_rating = null` |
| 2 | Provider not penalized | Score unchanged |

---

#### JOB-012
**Name:** Loyalty tier upgrade at 10 jobs  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider completes 10th job | `providers.reputation_tier` changes: 'new' → 'rising' |
| 2 | 20% discount unlocked | `loyalty_events` row inserted (`event_type='credits_tier'`, `reward_value=20`) |
| 3 | Applied at next subscription renewal | `providers.win_discount_pct` or loyalty discount tracked |

---

#### JOB-013
**Name:** Loyalty tier upgrade at 25 jobs — verified badge  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider completes 25th job | `reputation_tier` = 'trusted'; `badge_verified = true` |
| 2 | 30% discount added to loyalty_events | Verified badge shown on profile |

---

#### JOB-014
**Name:** Job dispute — status set to 'disputed'  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client refuses to confirm or reports issue | Mechanism to open dispute available |
| 2 | Admin reviews dispute | `jobs.status='disputed'` |
| 3 | Admin resolves | Status → 'completed' or 'cancelled' with notes |

---

#### JOB-015
**Name:** Concurrent confirmation code submission (two devices)  
**Priority:** High | **Type:** Concurrency

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client logged in on two devices | — |
| 2 | Both enter correct code simultaneously | Job marked complete once; no double-completion |

---

#### JOB-016
**Name:** Provider commitment deadline — urgent (5 min) vs normal (15 min)  
**Priority:** Critical | **Type:** Boundary

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Accept bid on urgent request | `provider_commit_deadline = grace_expires + 5min` |
| 2 | Accept bid on normal request | `provider_commit_deadline = grace_expires + 15min` |

---

#### JOB-017 – JOB-030 (Additional Job Cases)

| ID | Name | Priority | Type |
|----|------|---------|------|
| JOB-017 | `lifetime_jobs` increments correctly after completion | Critical | Functional |
| JOB-018 | Job list shows only current user's jobs | Critical | Security |
| JOB-019 | Completed job appears in client's history | High | Functional |
| JOB-020 | Completed job appears in provider's job history | High | Functional |
| JOB-021 | Cancel job with cancellation reason — logged in `cancellation_log` | High | Functional |
| JOB-022 | Job chat becomes read-only after completion | Medium | Functional |
| JOB-023 | Confirm code shown only after provider commits | High | Security |
| JOB-024 | Client rating displayed on provider public profile | High | Functional |
| JOB-025 | Provider 5-star rating triggers loyalty bonus credit event | High | Functional |
| JOB-026 | Job with no rating after 7 days — auto-nudge notification | Medium | Functional |
| JOB-027 | Win discount recalculated after each job (+3%, cap 15%) | High | Functional |
| JOB-028 | Job detail shows both parties' names and contact info | Medium | Functional |
| JOB-029 | Confirmation code cannot be reused after successful confirm | Critical | Security |
| JOB-030 | Provider score does not go below 0 with bad ratings | Low | Boundary |
| JOB-031 | Grace period — زر "طلباتي" مخفي أثناء العد النشط | High | Regression |
| JOB-032 | رمز التأكيد يظهر تلقائياً لطالب الخدمة عبر Realtime | Critical | Regression |

---

#### JOB-031
**Name:** Grace period — زر "طلباتي" مخفي أثناء العد النشط  
**Priority:** High | **Type:** Regression  
**Fixes:** gap — العميل يغادر نافذة الإلغاء دون أن يعرف بفقدانها  
**Preconditions:** عميل قبل عرضاً لأول مرة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | العميل يقبل العرض | شاشة grace-period تظهر مع العد التنازلي |
| 2 | العد النشط (secondsLeft > 0) | زر "طلباتي" **غير موجود** في الشاشة |
| 3 | العد ينتهي (locked) | زر "طلباتي" **يظهر** |
| 4 | المقدم يلتزم (confirmed) | زر "طلباتي" **يظهر** |
| 5 | المقدم يرفض | Alert يظهر + زر للانتقال لطلباتي |

**Regression:** قبل الإصلاح كان العميل يضغط "طلباتي" أثناء العد وتُمسح الشاشة من الـ stack نهائياً فيفقد حق الإلغاء.  
**Automation Candidate:** Yes

---

#### JOB-032
**Name:** رمز التأكيد يظهر تلقائياً لطالب الخدمة عبر Realtime  
**Priority:** Critical | **Type:** Regression  
**Fixes:** جدول `jobs` لم يكن في `supabase_realtime` publication  
**Preconditions:** طلب في حالة `in_progress`؛ العميل على شاشة تفاصيل الطلب

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | العميل يفتح تفاصيل الطلب (in_progress) | تظهر رسالة "العمل جارٍ، انتظر رمز التأكيد" |
| 2 | مقدم الخدمة يضغط "أنجزت العمل ✓" | رمز 6 أرقام يظهر **تلقائياً** على شاشة العميل دون refresh |
| 3 | العميل يعطي الرمز للمقدم | المقدم يدخله في الـ modal |
| 4 | العميل يفتح الشاشة بعد توليد الرمز (لا Realtime مطلوب) | الرمز يظهر من load() مباشرة |
| 5 | العميل يسحب للأسفل (pull-to-refresh) | الرمز يظهر (fallback بدون Realtime) |

**Regression:** قبل الإصلاح لم يكن `jobs` في Realtime publication فكان الـ subscription لا يُطلَق أبداً.  
**Automation Candidate:** No (يحتاج Realtime environment حقيقي)

---

## 7. SUB — Subscriptions & Credits

### High-Risk Areas
- Paddle webhook atomic update (subscription_ends + credits)
- Trial used flag preventing second trial
- Credit reset on renewal
- Manual CliQ activation by admin
- Win discount application at renewal

---

#### SUB-001
**Name:** Provider activates trial subscription  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** Provider with `trial_used=false`; `is_subscribed=false`.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to subscribe.tsx | "تجربة مجانية" option shown (10 credits, free) |
| 2 | Activate trial | `subscription_tier='trial'`; `subscription_credits=10`; `is_subscribed=true`; `trial_used=true` |
| 3 | Verify trial period | Typically 30 days or until credits exhausted |

**Automation Candidate:** Yes

---

#### SUB-002
**Name:** Trial cannot be activated twice  
**Priority:** Critical | **Type:** Business Rule

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider with `trial_used=true` opens subscribe screen | "تجربة مجانية" option disabled or hidden |
| 2 | Attempt via API | Rejected: "تم استخدام الفترة التجريبية مسبقاً" |

---

#### SUB-003
**Name:** Paddle webhook — basic tier activation  
**Priority:** Critical | **Type:** API Integration

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider selects Basic (5 JOD) on subscribe.tsx | Redirected to Paddle payment |
| 2 | Payment completes | `paddle-webhook` edge function fires |
| 3 | Webhook payload processed | `subscriptions` row inserted; `providers.is_subscribed=true`; `subscription_tier='basic'`; `subscription_credits=20`; `subscription_ends` = now() + 30 days |
| 4 | Provider can now bid | Credits available |

**Expected Result:** Webhook idempotent — duplicate Paddle events don't double-apply credits.  
**Automation Candidate:** Yes (webhook replay test)

---

#### SUB-004
**Name:** Paddle webhook — duplicate event (idempotency)  
**Priority:** Critical | **Type:** API Integration

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Same `paddle_txn_id` webhook arrives twice | Second event processed with no-op; credits NOT doubled |
| 2 | Check `subscriptions` table | Single row per transaction |

---

#### SUB-005
**Name:** Credit reset on subscription renewal  
**Priority:** Critical | **Type:** Business Rule

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider (basic, 3 credits remaining) renews | Credits reset to 20 (basic allotment); old credits discarded |
| 2 | Check `providers.subscription_credits` | = 20 |

---

#### SUB-006
**Name:** Tier upgrade — Basic to Pro  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider upgrades from Basic to Pro mid-cycle | `subscription_tier='pro'`; `subscription_credits=50` |
| 2 | Remaining basic credits | Discarded or prorated (verify business rule) |

---

#### SUB-007
**Name:** Premium tier — unlimited bids enforced  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider on premium tier with `is_unlimited=true` | Bid button never shows credit warning |
| 2 | Submit 100 bids | All accepted without credit check |

---

#### SUB-008
**Name:** Subscription expiry — bids blocked  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | `subscription_ends` in the past | `is_subscribed` auto-set to false (via scheduler or check) |
| 2 | Provider attempts to bid | Blocked: "اشتراكك انتهى. جدد للاستمرار" |

---

#### SUB-009
**Name:** Subscription expiry notification — 3 days before  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | `subscription_ends = now() + 3 days` | `notify-subscription-expiry` fires |
| 2 | Provider receives push | "اشتراكك ينتهي خلال 3 أيام. جدد الآن" |

---

#### SUB-010
**Name:** Win discount applied at renewal  
**Priority:** High | **Type:** Business Rule

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider completed 5 jobs — `win_discount_pct = 15%` (cap) | — |
| 2 | Renewal payment | 15% discount applied to plan price in Paddle |
| 3 | Post-renewal | `win_discount_pct` reset to 0 |

---

#### SUB-011
**Name:** Admin manually activates subscription (CliQ payment)  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** Admin portal access; valid provider ID.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Admin calls `activate_provider_subscription(provider_id, 'pro', 1)` | `providers.subscription_tier='pro'`; credits=50; `subscription_ends = now()+30days`; `subscriptions` row inserted |
| 2 | Audit log | Admin action recorded in `audit` table |

---

#### SUB-012
**Name:** Loyalty milestone — free month at 50 jobs  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider completes 50th job | `loyalty_events` row: `event_type='credits_milestone'` |
| 2 | Next renewal | One month free applied |

---

#### SUB-013 – SUB-028 (Additional Subscription Cases)

| ID | Name | Priority | Type |
|----|------|---------|------|
| SUB-013 | Bonus credits separate from subscription credits | High | Functional |
| SUB-014 | Bonus credits not reset on renewal | High | Business Rule |
| SUB-015 | Subscription tier shown correctly on provider dashboard | Medium | UI/UX |
| SUB-016 | subscribe.tsx Paddle link opens in browser/webview | Medium | Functional |
| SUB-017 | Paddle webhook signature verification | Critical | Security |
| SUB-018 | Invalid Paddle webhook payload (no txn_id) | High | Negative |
| SUB-019 | Subscription expiry check on each bid attempt | Critical | Functional |
| SUB-020 | Trial provider shown upgrade CTA on credit exhaustion | Medium | UI/UX |
| SUB-021 | Credits shown in real-time after bid submission | High | Realtime |
| SUB-022 | Credits shown in real-time after subscription activation | High | Realtime |
| SUB-023 | Downgrade from Premium to Basic — credits capped at 20 | High | Business Rule |
| SUB-024 | Provider views subscription history | Low | Functional |
| SUB-025 | Concurrent Paddle webhooks for same provider | High | Concurrency |
| SUB-026 | Subscription plan prices displayed correctly (5/12/22 JOD) | Medium | UI/UX |
| SUB-027 | Arabic localization of subscription screen | Medium | Localization |
| SUB-028 | Provider with expired subscription cannot see active bid count | Medium | Functional |
| SUB-029 | New provider registration routes to subscribe screen (trial pre-selected) | Critical | Functional |
| SUB-030 | New provider backs out of subscribe screen — limited mode, no crash | High | Negative |
| SUB-031 | New provider selects trial on subscribe screen — activates successfully | Critical | Functional |
| SUB-032 | New provider selects paid plan on subscribe screen — support ticket created | Critical | Functional |
| SUB-033 | subscribe.tsx back button from registration context returns to login | Low | UI/UX |
| SUB-034 | New provider selects paid plan → gets 10 bridge credits → lands in /(provider) | Critical | Functional |
| SUB-035 | Existing subscribed provider upgrades → still routed to support-thread (no bridge credits) | High | Functional |
| SUB-036 | Provider opens app after paid plan request → sees pending payment modal once per session | High | UI/UX |
| SUB-037 | Pending payment modal "عرض المحادثة" button navigates to correct support thread | High | Functional |
| SUB-038 | Admin sends reply in support thread → provider receives push notification | Critical | Functional |
| SUB-039 | Admin sends reply → in-app notification row created in notifications table | High | Functional |
| SUB-040 | Auto-welcome bot message on ticket creation does NOT trigger push/in-app notification | High | Regression |
| SUB-041 | Admin activates paid plan → bridge trial overridden → credits updated to plan amount | Critical | Functional |

---

## 8. MSG — Messaging & Chat

### High-Risk Areas
- Media upload (images, videos, audio) to Supabase Storage
- Real-time delivery via Supabase Realtime subscriptions
- Message read status sync across devices
- Location sharing — coordinate accuracy
- Profile card sharing within chat

---

#### MSG-001
**Name:** Send text message in job chat  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** Active job exists; both parties authenticated.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client opens chat.tsx for active job | Message thread loads |
| 2 | Type "السلام عليكم" and send | `messages` row: `msg_type='text'`; `content='السلام عليكم'`; `is_read=false` |
| 3 | Provider receives message in real-time | Message appears without refresh |

**Automation Candidate:** Yes

---

#### MSG-002
**Name:** Send image in chat  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap image icon → select JPEG < 5MB | Image uploaded to Supabase Storage |
| 2 | Message sent | `msg_type='image'`; `image_url` set to Storage URL |
| 3 | Recipient sees image in chat | Image rendered; tap to expand |

---

#### MSG-003
**Name:** Send audio message  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Hold record button → speak → release | Audio captured; `duration_ms` measured |
| 2 | Message sent | `msg_type='audio'`; `audio_url` set; `duration_ms` stored |
| 3 | Recipient sees audio bubble with duration | Playback works |

---

#### MSG-004
**Name:** Send location  
**Priority:** Medium | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap location icon | GPS permission requested |
| 2 | Share location | `msg_type='location'`; `latitude` & `longitude` & `label` stored |
| 3 | Recipient sees map pin | Tap opens Maps |

---

#### MSG-005
**Name:** Send profile card  
**Priority:** Medium | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider shares their profile card in chat | `msg_type='profile_card'`; `shared_provider_id` set |
| 2 | Client sees profile card | Tap opens `provider-profile.tsx` |

---

#### MSG-006
**Name:** Message read status — `is_read` toggle  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider sends message; client hasn't opened chat | `is_read=false` |
| 2 | Client opens chat | `is_read=true` for all received messages |
| 3 | Provider sees read indicator | Double-tick or similar indicator |

---

#### MSG-007
**Name:** Chat real-time delivery via Supabase Realtime  
**Priority:** Critical | **Type:** Realtime

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Both parties have chat open | — |
| 2 | Client sends message | Appears on provider's screen < 2 seconds (without refresh) |

**Automation Candidate:** Yes (latency measurement)

---

#### MSG-008
**Name:** Send empty text message  
**Priority:** High | **Type:** Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Tap send with empty text field | Send button disabled or no message sent |

---

#### MSG-009
**Name:** Send text with XSS content  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Send `<script>alert(1)</script>` in chat | Stored as plain text; not executed in recipient's view |

---

#### MSG-010
**Name:** Chat not accessible without active job  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Attempt to open chat for `job_id` not belonging to current user | RLS policy denies; 403 or empty result |

---

#### MSG-011
**Name:** Upload video file > 50MB  
**Priority:** High | **Type:** Boundary

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Attempt to send video > 50MB | Error: "حجم الفيديو كبير جداً" |

---

#### MSG-012 – MSG-020 (Additional Message Cases)

| ID | Name | Priority | Type |
|----|------|---------|------|
| MSG-012 | System message auto-sent on job status change | Medium | Functional |
| MSG-013 | Chat history loads pagination (50+ messages) | Medium | Performance |
| MSG-014 | Image thumbnail shown before full load | Low | UI/UX |
| MSG-015 | Audio playback stops when another audio starts | Low | UI/UX |
| MSG-016 | Provider sends location with GPS disabled — error shown | High | Negative |
| MSG-017 | Network loss mid-send — message queued, retry on reconnect | High | Negative |
| MSG-018 | Unread message badge on messages tab — count accurate | Medium | Functional |
| MSG-019 | Deleted job — chat thread becomes inaccessible | High | Functional |
| MSG-020 | Message with 2000+ characters (long Arabic text) | Medium | Boundary |

---

## 9. NTF — Notifications & Push

### High-Risk Areas
- Expo push token registration across devices
- Quiet hours enforcement (10 PM – 8 AM default)
- Max-per-week limit not exceeded
- New bid notification delivered within 60 seconds
- Notification open → deep link navigation

---

#### NTF-001
**Name:** New bid notification delivered to client  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** Client has valid Expo push token in `push_tokens`.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider submits bid on client's request | `notify-client-new-bid` edge function fires |
| 2 | Client device receives push | Title: "عرض جديد على طلبك"; body: provider name + amount |
| 3 | Client taps notification | Deep-links to request-detail.tsx |

**Automation Candidate:** Yes

---

#### NTF-002
**Name:** New request notification to relevant providers  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client posts request in "plumbing", city "Amman" | `notify-new-request` fires |
| 2 | All subscribed providers in plumbing + Amman notified | Push delivered within 60s |
| 3 | Providers in different city or category | NOT notified |

---

#### NTF-003
**Name:** Quiet hours — push suppressed  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | User has quiet_hour_start=22 (10 PM), quiet_hour_end=8 (8 AM) | — |
| 2 | New bid arrives at 11 PM local time | Push NOT sent to device |
| 3 | At 8:01 AM next day | Queued or in-app notification shows |

---

#### NTF-004
**Name:** Max-per-week limit enforced  
**Priority:** High | **Type:** Boundary

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | User has max_per_week=5 | — |
| 2 | 5 notifications already sent this week | 6th event → push suppressed |
| 3 | New week starts | Counter resets; notifications resume |

---

#### NTF-005
**Name:** User disables all notifications  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | `notification_preferences.enabled=false` | — |
| 2 | Any event triggers | No push sent to device |
| 3 | In-app notification log | Still recorded in `notifications` table |

---

#### NTF-006
**Name:** Notification inbox — all unread marked read  
**Priority:** Medium | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open notification-inbox.tsx with 5 unread | All shown with unread indicator |
| 2 | Tap "تحديد الكل كمقروء" | All `notifications.is_read=true` |
| 3 | Badge counter on tab | Resets to 0 |

---

#### NTF-007
**Name:** Push token registration on new device  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | User logs in on new device | `push_tokens` row inserted with new token + device_id |
| 2 | Both devices receive notifications | — |

---

#### NTF-008
**Name:** Stale push token — Expo delivery failure  
**Priority:** High | **Type:** Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Push token invalid (app uninstalled then reinstalled) | Expo returns DeviceNotRegistered error |
| 2 | System response | Stale token removed from `push_tokens` |

---

#### NTF-009
**Name:** Job confirmation notification with confirmation code  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider commits to job | `send-confirm-notification` fires |
| 2 | Client receives push | Deep link to job confirmation screen |
| 3 | Confirm code displayed in app | 6-digit code shown |

---

#### NTF-010
**Name:** Subscription expiry warning — 3 days before  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | `notification-engine` scheduler runs | Checks all providers with `subscription_ends` within 3 days |
| 2 | Each matching provider notified | Push: "اشتراكك ينتهي قريباً" |

---

#### NTF-011 – NTF-022 (Additional Notification Cases)

| ID | Name | Priority | Type |
|----|------|---------|------|
| NTF-011 | Job rated notification to provider | High | Functional |
| NTF-012 | No-bids notification to client after 24h | High | Functional |
| NTF-013 | Urgent request notification priority (marked urgent in OS) | High | Functional |
| NTF-014 | Notification preferences screen — UI reflects saved settings | Medium | UI/UX |
| NTF-015 | A/B variant tracked in notification_log | Low | Functional |
| NTF-016 | Notification opened_at tracked on tap | Medium | Functional |
| NTF-017 | converted_at tracked on action after notification | Medium | Functional |
| NTF-018 | Admin broadcasts notification to all users | High | Functional |
| NTF-019 | Admin broadcasts to providers only segment | High | Functional |
| NTF-020 | Notification body truncated at OS level (> 100 chars) | Low | UI/UX |
| NTF-021 | Notification badge count accurate on iOS (App Badge) | Medium | Functional |
| NTF-022 | Background notification wake — app in background receives | High | Functional |

---

## 10. PRO — Provider Profile & Portfolio

### High-Risk Areas
- Public profile link sharing (`p/[username]`) — unauthenticated access
- Portfolio image before/after pair alignment
- Verified badge display after 25 jobs
- Profile view count (debounce to prevent inflation)
- Portfolio video upload size and codec

---

#### PRO-001
**Name:** Provider views own profile — all stats correct  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider opens `(provider)/profile.tsx` | `score`, `lifetime_jobs`, `subscription_tier`, `reputation_tier` displayed |
| 2 | Verify tier badge | Correct tier label shown in Arabic |
| 3 | Verify verified badge | Only if `badge_verified=true` (25+ jobs) |

---

#### PRO-002
**Name:** Client views provider public profile  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client taps provider name in bid list | provider-profile.tsx opens |
| 2 | Check fields shown | bio, categories, score, ratings count, portfolio, verified badge |
| 3 | Client's own contact info | NOT shown to other clients (privacy) |

---

#### PRO-003
**Name:** Public provider profile link (unauthenticated)  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider shares profile link: `/p/[username]` | Opens in browser without login |
| 2 | Content shown | bio, categories, portfolio, ratings |
| 3 | Sensitive data | NOT exposed (phone, email, exact location) |

---

#### PRO-004
**Name:** Provider adds portfolio item — single image  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open portfolio-add.tsx | Type selector: single/before_after/video |
| 2 | Select single; upload JPEG; add title_ar and description_ar; pick category | — |
| 3 | Submit | `portfolio_items` row: `item_type='single'`; `media_urls[0]` = Storage URL |

---

#### PRO-005
**Name:** Provider adds before/after portfolio item  
**Priority:** Medium | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Select before_after type | Two upload slots shown |
| 2 | Upload before image and after image | `media_urls` = [before_url, after_url] |
| 3 | Submit | Side-by-side view in portfolio |

---

#### PRO-006
**Name:** Portfolio item missing title — rejected  
**Priority:** Medium | **Type:** Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Submit portfolio item without `title_ar` | Error: "أضف عنواناً للعمل" |

---

#### PRO-007
**Name:** Portfolio video — valid MP4 upload  
**Priority:** Medium | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Select video type; upload valid .mp4 < 50MB | `item_type='video'`; `video_url` set |
| 2 | View in portfolio | Video playback works |

---

#### PRO-008
**Name:** Portfolio video > 50MB — rejected  
**Priority:** Medium | **Type:** Boundary

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Upload .mp4 > 50MB | Error: "حجم الفيديو يجب أن يكون أقل من 50MB" |

---

#### PRO-009
**Name:** `show_public=false` — profile not accessible via link  
**Priority:** High | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider sets `show_public=false` | — |
| 2 | Access `/p/[username]` | 404 or "الملف الشخصي غير متاح" |

---

#### PRO-010
**Name:** Provider saves client  
**Priority:** Medium | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client taps "حفظ" on provider profile | `saved_providers` row: `client_id, provider_id, note?` |
| 2 | View saved providers list | Provider appears in `(client)/saved-providers.tsx` |

---

#### PRO-011
**Name:** Provider score calculation — weighted average  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider has 3 jobs: ratings 5, 4, 3 | `score = (5+4+3)/3 = 4.00` |
| 2 | Complete 4th job: rating 2 | `score = (5+4+3+2)/4 = 3.50` |

---

#### PRO-012 – PRO-022 (Additional Profile Cases)

| ID | Name | Priority | Type |
|----|------|---------|------|
| PRO-012 | Verified badge shown in bid list and provider search | High | UI/UX |
| PRO-013 | Provider availability toggle (is_available) | Medium | Functional |
| PRO-014 | Provider categories update — bids filtered by new categories | High | Functional |
| PRO-015 | profile_views incremented each time public profile opened | Medium | Functional |
| PRO-016 | Portfolio views_count incremented on item view | Low | Functional |
| PRO-017 | Provider share profile — channel tracked in share_events | Low | Functional |
| PRO-018 | Delete portfolio item | Medium | Functional |
| PRO-019 | Portfolio limited to 20 items (verify business rule) | Medium | Boundary |
| PRO-020 | Provider bio > 500 chars — truncated or rejected | Medium | Boundary |
| PRO-021 | Provider profile photo custom crop (4:3 aspect) | Medium | Functional |
| PRO-022 | Provider dashboard analytics — daily stats accuracy | Medium | Functional |

---

#### PRO-023 – PRO-029 (Avatar Tier Ring — Category Icon Design)

| ID | Name | Priority | Type |
|----|------|---------|------|
| PRO-023 | Trial provider → header avatar shows dashed gray ring + category emoji | High | UI/UX |
| PRO-024 | Basic subscription → avatar ring is solid blue (2px) | High | UI/UX |
| PRO-025 | Pro subscription → avatar ring is solid amber (2.5px) | High | UI/UX |
| PRO-026 | Premium subscription → avatar ring is solid purple (3px) + continuous pulse glow | High | UI/UX |
| PRO-027 | Provider with no categories set → avatar shows fallback emoji 🛠️ | Medium | Edge Case |
| PRO-028 | Client header avatar shows initials circle (unchanged, no tier ring) | High | Regression |
| PRO-029 | Ripple pulse animation fires once on mount for both provider and client header | Low | UI/UX |

---

## 11. CNT — Recurring Contracts

### High-Risk Areas
- Visit scheduling logic (preferred_day + frequency calculation)
- Contract bid credit cost (3 credits)
- Pause/resume contract — visit rescheduling
- Contract completion after all visits done
- Contract bid multiple providers competing

---

#### CNT-001
**Name:** Client creates weekly recurring contract  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open recurring-request.tsx | Form shown |
| 2 | Select frequency=weekly, duration=3 months, preferred_day=Sunday, preferred_time_window=morning | — |
| 3 | Submit | `recurring_contracts` row: `status='bidding'`; `total_visits = 4×3 = 12` (4/month × 3 months) |

---

#### CNT-002
**Name:** Provider bids on contract — 3 credits deducted  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Subscribed provider views contract and bids 25 JOD/visit | `contract_bids` row; `credit_cost=3`; credits -3 |
| 2 | Client notified | Push: "عرض جديد على عقدك الدوري" |

---

#### CNT-003
**Name:** Client accepts contract bid — contract activated  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client selects provider bid | `recurring_contracts.status='active'`; `provider_id` set; `starts_at=now()` |
| 2 | `contract_visits` auto-generated | 12 rows created for weekly contract (3 months × 4 visits) |
| 3 | Provider notified | Push: "تم قبول عرضك على العقد الدوري" |

---

#### CNT-004
**Name:** Visit completed and rated  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider completes visit | `contract_visits.status='completed'`; `completed_at=now()` |
| 2 | Client rates visit 4 stars | `client_rating=4`; `client_note` optional |
| 3 | `completed_visits` count | Incremented by 1 |

---

#### CNT-005
**Name:** Visit postponed  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client postpones scheduled visit | `contract_visits.status='postponed'`; `postponed_to` date set |
| 2 | New visit scheduled | New row in `contract_visits` with updated date |

---

#### CNT-006
**Name:** Contract paused — visit scheduling halted  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client pauses contract | `status='paused'` |
| 2 | No new visits scheduled | Upcoming visits remain in `scheduled` status until resume |

---

#### CNT-007
**Name:** Contract resumed after pause  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client resumes paused contract | `status='active'` |
| 2 | Visit schedule adjusted | Remaining visits rescheduled from resume date |

---

#### CNT-008
**Name:** Contract cancelled mid-term  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client cancels active contract | `status='cancelled'`; `cancelled_log` updated |
| 2 | Upcoming visits | Marked as missed or removed |
| 3 | Provider notified | Push: "تم إلغاء العقد الدوري" |

---

#### CNT-009
**Name:** Contract auto-completes after all visits done  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Last visit completed | `completed_visits = total_visits` |
| 2 | System | `status='completed'`; `ends_at` set |

---

#### CNT-010
**Name:** Biweekly contract — correct visit count  
**Priority:** High | **Type:** Boundary

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Biweekly, 6-month duration | `total_visits = 2×6 = 12` |
| 2 | Monthly, 12-month duration | `total_visits = 1×12 = 12` |
| 3 | Weekly, 12-month duration | `total_visits = 4×12 = 48` |

---

#### CNT-011
**Name:** Invalid duration_months value  
**Priority:** High | **Type:** Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Attempt to submit with duration_months=5 | Error: "المدة يجب أن تكون 3 أو 6 أو 12 شهراً" |
| 2 | Submit with duration_months=0 | Same error |

---

#### CNT-012
**Name:** Preferred day — boundary values  
**Priority:** Medium | **Type:** Boundary

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | preferred_day=0 (Sunday) | Valid |
| 2 | preferred_day=6 (Saturday) | Valid |
| 3 | preferred_day=7 | Rejected: "يوم غير صحيح" |
| 4 | preferred_day=-1 | Rejected |

---

#### CNT-013 – CNT-028 (Additional Contract Cases)

| ID | Name | Priority | Type |
|----|------|---------|------|
| CNT-013 | Multiple providers bid on same contract | Medium | Functional |
| CNT-014 | Contract bid note max length | Low | Boundary |
| CNT-015 | Unsubscribed provider bids on contract — blocked | Critical | Security |
| CNT-016 | Client cannot accept bid after contract already active | High | Negative |
| CNT-017 | Contract visit marked missed if not completed | High | Functional |
| CNT-018 | Contract detail shows visit history and upcoming | Medium | Functional |
| CNT-019 | Contract bid withdrawal before acceptance | Medium | Functional |
| CNT-020 | Contract in bidding status for > 7 days — admin alert | Medium | Functional |
| CNT-021 | visit status transitions: scheduled→completed, scheduled→postponed, scheduled→missed | High | Functional |
| CNT-022 | Provider unavailable for a visit — reschedule flow | Medium | Functional |
| CNT-023 | Contract with notes field — max 1000 chars | Low | Boundary |
| CNT-024 | Contract chat linked to contract (not job) | Medium | Functional |
| CNT-025 | Contract appears in both client and provider contract lists | High | Functional |
| CNT-026 | Contract bid credit cost scales correctly per tier | Critical | Functional |
| CNT-027 | Client rates individual visits — contract overall rating aggregated | Medium | Functional |
| CNT-028 | Contract deleted when in bidding state with no bids for 30 days | Low | Functional |

---

## 12. SPT — Support & Help Center

### High-Risk Areas
- Attachment upload (PDF/image/video) to tickets
- Ticket resolution rating
- Admin assignment and response time
- FAQ search relevance
- Urgent vs normal priority routing

---

#### SPT-001
**Name:** Client creates support ticket  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open support-new.tsx | Category picker + priority + subject + body |
| 2 | Select category: payment, priority: urgent | — |
| 3 | Enter subject and body | — |
| 4 | Submit | `support_tickets` row: `status='open'`; `opened_at=now()` |

---

#### SPT-002
**Name:** Ticket attachment — image upload  
**Priority:** Medium | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Attach image to ticket message | `support_messages.attachment_url` set; `attachment_type='image'` |

---

#### SPT-003
**Name:** Admin replies to ticket  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Admin opens ticket in admin portal | support/[id].tsx loaded |
| 2 | Admin types reply and sends | `support_messages` row: `is_admin=true`; `sender_id=null` (or admin id) |
| 3 | User notified | Push: "ردّ الدعم على طلبك" |

---

#### SPT-004
**Name:** Ticket resolved — user rates resolution  
**Priority:** Medium | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Admin marks ticket 'resolved' | `status='resolved'`; `resolved_at=now()` |
| 2 | User sees rating prompt | 1–5 stars + note |
| 3 | Submit rating | `support_tickets.rating=4`; `rating_note` saved |

---

#### SPT-005
**Name:** Ticket category: all 6 valid values  
**Priority:** Medium | **Type:** Boundary

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Submit ticket for each category: payment, order, provider, account, contract, other | All create valid tickets |
| 2 | Submit with unknown category | Rejected by form or API |

---

#### SPT-006
**Name:** FAQ search — relevant results  
**Priority:** Medium | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open help-center.tsx | FAQ list shown |
| 2 | Search "اشتراك" | FAQ items with matching question/answer shown |
| 3 | Search with no matches | "لا توجد نتائج" message |

---

#### SPT-007
**Name:** Create ticket without subject  
**Priority:** Medium | **Type:** Negative

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Submit ticket with empty subject | Error: "الموضوع مطلوب" |

---

#### SPT-008
**Name:** Ticket history visible to ticket owner only  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client A views Client B's ticket via API | RLS policy blocks; 0 results returned |

---

#### SPT-009 – SPT-018 (Additional Support Cases)

| ID | Name | Priority | Type |
|----|------|---------|------|
| SPT-009 | Admin assigns ticket to specific admin | Medium | Functional |
| SPT-010 | Admin uses canned response | Medium | Functional |
| SPT-011 | Ticket status transitions: open→in_review→resolved→closed | High | Functional |
| SPT-012 | Urgent ticket sorted to top of admin queue | High | Functional |
| SPT-013 | Closed ticket cannot receive new messages | Medium | Negative |
| SPT-014 | User receives notification on each admin reply | High | Functional |
| SPT-015 | Attachment PDF download in admin portal | Medium | Functional |
| SPT-016 | Admin views all tickets (admin_all_tickets RLS policy) | Critical | Security |
| SPT-017 | FAQ inactive items not shown to users | Medium | Functional |
| SPT-018 | Support ticket plan_tier recorded correctly | Low | Functional |

---

## 13. ADM — Admin Portal

### High-Risk Areas
- Admin authentication — no mobile OTP; separate auth flow
- Provider suspension — cascading effects on active jobs/bids
- Category min/max changes — affecting live bids
- Audit log completeness
- Notification broadcast to large segments

---

#### ADM-001
**Name:** Admin login  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to admin/login | Login form shown |
| 2 | Enter admin credentials | Authenticated; `users.role='admin'` verified |
| 3 | Non-admin credentials | Access denied |

---

#### ADM-002
**Name:** Admin dashboard — KPIs accurate  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open admin `/` | KPIs shown: total users, providers, requests, active jobs |
| 2 | Compare with direct DB counts | Values match within 5-minute cache window |

---

#### ADM-003
**Name:** Admin suspends provider  
**Priority:** Critical | **Type:** Functional
**Note:** For the corresponding unsuspend flow, see ADM-037.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Find provider in /providers list | — |
| 2 | Tap Suspend | `users.role` or status flagged; `is_subscribed=false`? |
| 3 | Provider attempts login | Blocked or shown suspension notice |
| 4 | Active bids | Auto-withdrawn? (verify business rule) |
| 5 | Audit log | `audit` table records admin_id, action, target, timestamp |

---

#### ADM-004
**Name:** Admin manually activates subscription after CliQ payment  
**Priority:** Critical | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Admin finds provider in /providers | — |
| 2 | Select "تفعيل اشتراك" → choose Pro, 1 month | Calls `admin_activate_subscription()` RPC |
| 3 | Provider credentials | `subscription_tier='pro'`; credits=50; `subscription_ends` set |
| 4 | Audit log | Action logged |

---

#### ADM-005
**Name:** Admin sets category bid limits  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to /category-limits | Category list with current min/max |
| 2 | Update "electrical" min=15, max=500 JOD | POST to /api/category-limits |
| 3 | Provider tries to bid 10 JOD on electrical | App rejects with min limit error |

---

#### ADM-006
**Name:** Admin disables a service category  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to /categories | Category list |
| 2 | Toggle "gardening" to inactive | `service_categories.is_active=false` |
| 3 | Client opens category picker | "gardening" not shown |
| 4 | Existing requests in gardening | Not affected |

---

#### ADM-007
**Name:** Admin views and resolves abuse report  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to /abuse-reports | Pending reports listed |
| 2 | Open report: type=fake_bid | Reporter, reported user, request details shown |
| 3 | Set status=resolved, add admin_notes | `reports.status='resolved'`; `reviewed_at=now()` |
| 4 | Audit log | Recorded |

---

#### ADM-008
**Name:** Admin broadcasts notification to all users  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to /notifications → Create broadcast | Target: all, message body entered |
| 2 | Send | Push sent to all `push_tokens`; `notification_log` entries created |
| 3 | Admin cannot send to > 10,000 users without rate limit check | System queues in batches |

---

#### ADM-009
**Name:** Admin cannot access another admin's audit actions  
**Priority:** High | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Admin A views /audit | Only all admins' combined audit shown (full audit access) |

---

#### ADM-010
**Name:** Non-admin cannot access admin portal routes  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Authenticated provider attempts to access /admin/providers | 403 or redirect to login |
| 2 | Unauthenticated user | Redirected to /admin/login |

---

#### ADM-011
**Name:** Admin views cancellation patterns  
**Priority:** Medium | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to /cancellations | List of cancelled jobs: who_cancelled, reason_code, date |
| 2 | Filter by provider or reason | Filtered results |

---

#### ADM-012
**Name:** Admin manages recurring contract — pause  
**Priority:** Medium | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to /contracts → find active contract | — |
| 2 | Admin pauses contract | `status='paused'`; audit log updated |

---

#### ADM-013
**Name:** Admin updates platform settings  
**Priority:** High | **Type:** Functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to /settings | Configurable values: grace period, credit costs, etc. |
| 2 | Update grace period from 60s to 90s | Setting saved; subsequent jobs use 90s grace |

---

#### ADM-014
**Name:** Admin audit log — immutable entries  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Admin performs action | Audit entry created |
| 2 | Attempt to delete audit entry via API | RLS denies; no DELETE policy on audit table |

---

#### ADM-015 – ADM-036 (Additional Admin Cases)

| ID | Name | Priority | Type |
|----|------|---------|------|
| ADM-015 | Admin views provider subscription history | Medium | Functional |
| ADM-016 | Admin search providers by name/phone | High | Functional |
| ADM-017 | Admin filters requests by status, city, category | High | Functional |
| ADM-018 | Admin views request detail + all bids | High | Functional |
| ADM-019 | Admin re-triggers request matching | Medium | Functional |
| ADM-020 | Admin adds FAQ item | Medium | Functional |
| ADM-021 | Admin edits FAQ item | Medium | Functional |
| ADM-022 | Admin deletes inactive FAQ | Medium | Functional |
| ADM-023 | Admin views analytics/reports dashboard | Medium | Functional |
| ADM-024 | Admin impersonates provider to debug issue | High | Security |
| ADM-025 | Admin portal session timeout | High | Security |
| ADM-026 | Admin rate limited on bulk actions (e.g., send 1000 notifications) | High | Performance |
| ADM-027 | Admin creates new service category with icon | Medium | Functional |
| ADM-028 | Admin changes category sort_order | Low | Functional |
| ADM-029 | Admin verifies provider badge manually | High | Functional |
| ADM-030 | Admin disputes: transition job to disputed and resolve | High | Functional |
| ADM-031 | Admin portal — responsive on 1280px width | Medium | UI/UX |
| ADM-032 | Admin portal — RTL layout for Arabic content | Medium | Localization |
| ADM-033 | Admin exports data (if CSV export feature present) | Low | Functional |
| ADM-034 | Admin login attempt from new IP — alert (if MFA present) | High | Security |
| ADM-035 | Admin portal down for maintenance — graceful error page | Low | Functional |
| ADM-036 | Admin portal API calls use service role key (not anon key) | Critical | Security |
| ADM-037 | Admin unsuspends provider — push notification delivered using correct userId | High | Functional |

---

## 14. SEC — Security Testing

### Scope
RLS (Row-Level Security), injection attacks, authorization bypass, token security, API rate limiting, data exposure.

---

#### SEC-001
**Name:** Horizontal privilege escalation — client reads another client's requests  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client A authenticates; knows Client B's request_id | — |
| 2 | GET `/rest/v1/requests?id=eq.[B's request_id]` with A's token | Returns 0 rows (RLS blocks) |

---

#### SEC-002
**Name:** Provider reads client messages from unrelated job  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider X accesses messages for job_id where X is not provider | 0 rows returned; RLS enforcement |

---

#### SEC-003
**Name:** Client self-escalation via profile update  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | PATCH `/rest/v1/users` setting `role='admin'` | RLS denies field update; role unchanged |

---

#### SEC-004
**Name:** Provider modifies another provider's credits  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Provider A PATCHes `/rest/v1/providers?id=eq.[B's id]` setting credits=1000 | RLS: only own record updatable; denied |

---

#### SEC-005
**Name:** SQL injection in request title  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Submit title: `'; DROP TABLE requests; --` | Parameterized queries used by Supabase SDK; SQL injected as literal string; no execution |

---

#### SEC-006
**Name:** XSS in bid note rendered in admin portal  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Submit bid note: `<img src=x onerror=alert(1)>` | Admin portal (Next.js) renders as escaped text; no script execution |

---

#### SEC-007
**Name:** JWT token tampering  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Modify JWT payload (e.g., change `sub` to another user's UUID) | Supabase rejects: signature invalid; 401 |

---

#### SEC-008
**Name:** Expired JWT token still used  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Use expired access token | 401 Unauthorized; refresh token flow triggered |

---

#### SEC-009
**Name:** API rate limiting on OTP send  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Send OTP request 10 times in 1 minute from same IP | Rate limit engaged after threshold; 429 Too Many Requests |

---

#### SEC-010
**Name:** Paddle webhook without valid signature  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | POST to `/paddle-webhook` with forged payload | Signature verification fails; 401; subscription NOT activated |

---

#### SEC-011
**Name:** Direct bid submission bypassing credit check  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | POST bid directly to `/rest/v1/bids` (bypassing `submit_bid_with_credits` RPC) | If INSERT policy exists without credit check, bid created without deduction — VULNERABILITY |
| 2 | Verify | `bids` table INSERT policy must require `submit_bid_with_credits` RPC |

---

#### SEC-012
**Name:** Public provider page exposes PII  
**Priority:** High | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Unauthenticated user fetches `/provider-page` function | Returns: bio, categories, score, portfolio — NOT phone, email, location |

---

#### SEC-013
**Name:** Supabase anon key exposed in mobile bundle  
**Priority:** High | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Extract mobile app bundle; search for anon key | Key present (expected for Supabase) — verify RLS policies compensate; no service_role key embedded |

---

#### SEC-014
**Name:** IDOR on job cancellation  
**Priority:** Critical | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client A attempts to cancel Client B's job | RLS denies; only job participants can cancel |

---

#### SEC-015
**Name:** Concurrent grace period undo + provider commit  
**Priority:** High | **Type:** Concurrency/Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client undo and provider commit arrive simultaneously | Atomic transaction; one wins consistently; no half-state |

---

#### SEC-016
**Name:** Mass enumeration of provider usernames  
**Priority:** Medium | **Type:** Security

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Sequential requests to `/p/[username]` with guessed usernames | Rate limit after N requests; no enumeration without throttle |

---

#### SEC-017 – SEC-028 (Additional Security Cases)

| ID | Name | Priority | Type |
|----|------|---------|------|
| SEC-017 | File upload — path traversal in filename | Critical | Security |
| SEC-018 | Audio/video content moderation (malicious file disguised as media) | High | Security |
| SEC-019 | Admin portal CSRF protection | High | Security |
| SEC-020 | Supabase Storage bucket policies — private vs public | Critical | Security |
| SEC-021 | OTP timing attack — response time reveals valid phone | Medium | Security |
| SEC-022 | Provider bid amount injection (negative/float overflow) | High | Security |
| SEC-023 | Phone number enumeration via OTP endpoint timing | Medium | Security |
| SEC-024 | Admin session remains after logout | High | Security |
| SEC-025 | Support ticket attachment — script file disguised as PDF | Critical | Security |
| SEC-026 | User report IDOR — read another user's report | High | Security |
| SEC-027 | Notification dispatch — send to arbitrary user IDs | Critical | Security |
| SEC-028 | Contract bid injection — price = 0 or negative | High | Security |

---

## 15. PER — Performance & Load

### Targets
- Home feed load: < 2 seconds
- Bid submission (credit deduction RPC): < 500ms p95
- Push notification delivery: < 60 seconds
- Admin dashboard KPIs: < 3 seconds
- Chat message delivery (realtime): < 2 seconds

---

#### PER-001
**Name:** Provider home feed — 100 concurrent users  
**Priority:** Critical | **Type:** Performance

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Simulate 100 providers loading home feed simultaneously | P95 response < 2s; no 5xx errors |
| 2 | Monitor Supabase connection pool | Not exhausted |

---

#### PER-002
**Name:** Bid submission RPC under load — credit deduction race  
**Priority:** Critical | **Type:** Performance/Concurrency

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | 50 providers simultaneously submit bids on 50 different requests | All RPCs complete < 500ms p95 |
| 2 | Each provider has exactly 1 credit | Each loses exactly 1 credit; no negative balances |

---

#### PER-003
**Name:** Client request list with 100+ requests  
**Priority:** High | **Type:** Performance

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Client with 100 historical requests opens requests.tsx | List renders < 2s with virtual scroll |
| 2 | Scroll to bottom | No jank; pagination loads correctly |

---

#### PER-004
**Name:** Chat with 500+ messages  
**Priority:** High | **Type:** Performance

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open chat.tsx with 500 messages | Paginated load; oldest messages not loaded until scroll up |
| 2 | Scroll to top | History loads in batches < 1s per batch |

---

#### PER-005
**Name:** Push notification broadcast to 10,000 providers  
**Priority:** High | **Type:** Performance

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Admin broadcasts notification to all providers | Processed in batches; Expo rate limits respected |
| 2 | Delivery time | All delivered within 5 minutes |

---

#### PER-006
**Name:** Supabase Realtime — 200 concurrent chat sessions  
**Priority:** High | **Type:** Performance

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | 200 pairs of client+provider have open chat | Supabase Realtime channel capacity not exceeded |
| 2 | Message delivery | < 2s for all sessions |

---

#### PER-007
**Name:** Image upload performance — 3 images × 4MB each  
**Priority:** High | **Type:** Performance

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Upload 3 × 4MB images on slow 4G connection (10Mbps) | Upload completes within 15s; progress bar shown |
| 2 | Upload fails mid-way | Partial upload cleaned up; retry offered |

---

#### PER-008
**Name:** Admin dashboard with 50,000 users  
**Priority:** High | **Type:** Performance

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open admin `/` with 50k users in DB | KPIs computed < 3s (indexed count queries) |

---

#### PER-009
**Name:** k6 load test — bid flow  
**Priority:** Critical | **Type:** Performance

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Run k6 script: 100 VUs × 5 min, bid submission flow | Error rate < 1%; p99 < 1s; no DB connection exhaustion |

**Reference:** Supabase Production Requirements memory (k6 results on file).

---

#### PER-010 – PER-018 (Additional Performance Cases)

| ID | Name | Priority | Type |
|----|------|---------|------|
| PER-010 | Provider search — 1000 providers, filter by city + category | High | Performance |
| PER-011 | Notification engine scheduler — handles 10k events/hour | High | Performance |
| PER-012 | Contract visit auto-scheduling — 1000 contracts at midnight | High | Performance |
| PER-013 | OTP send rate — 500 concurrent OTP requests | High | Performance |
| PER-014 | App cold start time — < 3s on mid-range Android | Medium | Performance |
| PER-015 | App memory usage — < 250MB after 30 min session | Medium | Performance |
| PER-016 | Admin portal login response < 1s | Medium | Performance |
| PER-017 | Supabase Edge Function cold start < 2s | Medium | Performance |
| PER-018 | Database index verification — requests by (client_id, status) | High | Performance |

---

## 16. LOC — Localization & RTL

### Scope
Arabic (ar) primary language with RTL layout; English (en) optional. All text from `i18next` translation files. RTL enforced via React Native's `I18nManager`.

---

#### LOC-001
**Name:** All screens render Arabic text correctly  
**Priority:** Critical | **Type:** Localization

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Set device language to Arabic | App uses `ar` translations |
| 2 | Navigate through all major screens | No missing translation keys (no English fallback text visible) |
| 3 | Check for truncated Arabic text | All UI elements accommodate longer Arabic strings |

---

#### LOC-002
**Name:** RTL layout — all screens  
**Priority:** Critical | **Type:** Localization

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | App in Arabic mode | `I18nManager.isRTL = true` |
| 2 | Check navigation arrows | Back arrows point right; forward arrows point left |
| 3 | Check form fields | Aligned right; text flows right-to-left |
| 4 | Check bid list | Provider names right-aligned; amounts left-aligned (numeric) |

---

#### LOC-003
**Name:** Category names displayed in Arabic  
**Priority:** High | **Type:** Localization

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open category picker | `service_categories.name_ar` shown; not `name_en` |
| 2 | Check group headers | `group_ar` shown |

---

#### LOC-004
**Name:** Error messages in Arabic  
**Priority:** High | **Type:** Localization

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Trigger any validation error | Error message in Arabic; no English error |
| 2 | Network error | "خطأ في الاتصال. تحقق من اتصالك بالإنترنت" (Arabic) |

---

#### LOC-005
**Name:** Date and time formatting — Arabic locale  
**Priority:** High | **Type:** Localization

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | View job created_at in Arabic mode | Date formatted per Arabic convention (day/month/year or Hijri?) |
| 2 | Check time in notification | 24h or 12h as per locale standard |

---

#### LOC-006
**Name:** Currency display — JOD  
**Priority:** High | **Type:** Localization

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Bid amount displayed | "35 د.أ" (Arabic JOD abbreviation) or "35 JOD" |
| 2 | Consistent across all screens | Same format everywhere |

---

#### LOC-007
**Name:** Number formatting (Arabic-Indic numerals)  
**Priority:** Medium | **Type:** Localization

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | View bid amount, credit count, ratings in Arabic mode | Arabic-Indic numerals (٠١٢٣٤) if per locale requirement, or Western numerals (design decision) |

---

#### LOC-008
**Name:** Portfolio title_ar and description_ar in RTL  
**Priority:** Medium | **Type:** Localization

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | View portfolio item | Arabic title flows RTL; no text collision with image |

---

#### LOC-009
**Name:** Support ticket — Arabic body text  
**Priority:** Medium | **Type:** Localization

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create ticket with Arabic body | Text direction correct; RTL enforced in textarea |
| 2 | Admin portal shows Arabic text correctly | Next.js portal renders Arabic RTL in ticket thread |

---

#### LOC-010
**Name:** Push notification body in Arabic  
**Priority:** High | **Type:** Localization

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | All push notification templates | Body text in Arabic |
| 2 | OS notification shade | Arabic text displays without corruption |

---

#### LOC-011 – LOC-014 (Additional Localization Cases)

| ID | Name | Priority | Type |
|----|------|---------|------|
| LOC-011 | Onboarding slides — all text in Arabic; RTL layout | High | Localization |
| LOC-012 | English fallback text not visible in production build | High | Localization |
| LOC-013 | City names in Arabic (عمّان, الزرقاء, إربد...) | Medium | Localization |
| LOC-014 | Admin portal — category group names in Arabic | Low | Localization |
| LOC-015 | Tier labels (trial/basic/pro/premium) display in English when app language = EN — provider profile + saved-providers screen | High | Localization |
| LOC-016 | Provider feed greeting ("صباح الخير" / "Good Morning") switches correctly on language toggle | High | Localization |
| LOC-017 | Error hints in new-request, urgent-request, support-new, portfolio-add screens — all show English text when app language = EN | High | Localization |
| LOC-018 | Saved providers count label shows "X saved providers" in EN and "X مقدم محفوظ" in AR | Medium | Localization |

---

## 17. Risk Assessment

### Critical Risk Areas

| Risk | Affected Area | Likelihood | Impact | Mitigation |
|------|--------------|-----------|--------|-----------|
| Credit deduction race condition | BID-015 | Medium | Critical | Row-level locking in `submit_bid_with_credits` RPC |
| Paddle webhook replay attack | SUB-004 | Low | Critical | Idempotency check on `paddle_txn_id` |
| JWT token misuse (provider accessing client data) | SEC-001–SEC-004 | Medium | Critical | RLS policies on all tables |
| Grace period timer drift (client/server clock skew) | JOB-001 | Low | High | Server-side timer; do not trust client clock |
| OTP brute-force | AUTH-004 | High | Critical | 3-attempt limit + lockout |
| Provider commitment deadline race | JOB-005 | Medium | High | Server-side deadline check; auto-decline job |
| Confirmation code replay | JOB-029 | Low | High | Single-use code; mark used after confirm |
| Push token staleness | NTF-008 | Medium | Medium | Expo DeviceNotRegistered cleanup |
| Image upload to wrong bucket | SEC-020 | Low | High | Supabase bucket policies: private for chat, public for portfolio |
| Admin portal not enforcing RLS | ADM-036 | Low | Critical | Admin uses service_role key; audit log required |

### High-Risk Areas by Module

| Module | High-Risk Scenarios |
|--------|-------------------|
| AUTH | OTP brute-force, duplicate phone, session persistence |
| BID | Credit race condition, unsubscribed bypass, 24h cooldown |
| JOB | Grace/commitment timers, confirmation code security |
| SUB | Paddle webhook integrity, trial re-use, credit reset |
| SEC | RLS bypass, XSS in admin, JWT tampering |
| ADM | Service role key security, audit immutability |
| PER | DB connection pool under load, push broadcast scale |

---

## 18. Regression Suite

### Critical Regression Pack (Run on every release)

These 30 test cases must pass before any production deployment:

| # | Test Case ID | Description |
|---|-------------|-------------|
| 1 | AUTH-001 | New client registration |
| 2 | AUTH-002 | New provider registration |
| 3 | AUTH-003 | OTP expiry |
| 4 | AUTH-004 | OTP brute-force block |
| 5 | REQ-001 | Create standard request |
| 6 | REQ-008 | Create urgent request |
| 7 | BID-001 | Bid submission + credit deduction |
| 8 | BID-004 | Zero credits → bid blocked |
| 9 | BID-006 | 24h rejection cooldown |
| 10 | BID-011 | Client accepts bid → job created |
| 11 | BID-015 | Concurrent bid credit race |
| 12 | JOB-001 | Grace period undo |
| 13 | JOB-003 | Provider commits in time |
| 14 | JOB-005 | Provider missed deadline → auto-decline |
| 15 | JOB-006 | Confirmation code → job complete |
| 16 | JOB-007 | Wrong confirmation code rejected |
| 17 | JOB-009 | Rating → provider score update |
| 18 | JOB-012 | Loyalty tier upgrade at 10 jobs |
| 19 | SUB-001 | Trial activation |
| 20 | SUB-002 | Trial cannot be used twice |
| 21 | SUB-003 | Paddle webhook → subscription active |
| 22 | SUB-004 | Paddle webhook idempotency |
| 23 | SUB-008 | Expired subscription → bids blocked |
| 24 | SUB-011 | Admin manual subscription activation |
| 25 | SEC-001 | RLS: client cannot read other clients' requests |
| 26 | SEC-004 | RLS: provider cannot modify another's credits |
| 27 | SEC-010 | Paddle webhook signature verification |
| 28 | SEC-011 | Bid bypass credit check attempt |
| 29 | MSG-007 | Realtime chat delivery |
| 30 | NTF-001 | New bid notification delivered |

### Smoke Test Pack (Run on every PR merge — 5 min target)

| # | Test Case | Area |
|---|----------|------|
| 1 | AUTH-001 | Login/register |
| 2 | REQ-001 | Create request |
| 3 | BID-001 | Submit bid |
| 4 | BID-011 | Accept bid |
| 5 | JOB-003 | Provider commit |
| 6 | SUB-003 | Paddle webhook |
| 7 | SEC-001 | RLS baseline |

---

## 19. Automation Candidates

### Tier 1 — Must Automate (High ROI, deterministic)

| Test ID | Tool | Reason |
|---------|------|--------|
| AUTH-001–005 | Detox E2E | Login/register — runs on every build |
| BID-001, BID-004, BID-015 | Jest + Supabase test client | Credit deduction is business-critical; race condition detectable |
| SUB-003, SUB-004 | Jest + mock Paddle | Webhook replay + idempotency — catches edge cases |
| JOB-001, JOB-005 | Jest + mock time | Timer logic — clock manipulation testable |
| JOB-006, JOB-007 | Detox E2E | Confirmation code flow |
| SEC-001–SEC-004 | Supabase RLS test suite (pgTAP or JS) | RLS is the security backbone; 100% coverage needed |
| SEC-010, SEC-011 | Jest + supertest | Webhook security + bid bypass attempt |
| PER-001, PER-009 | k6 | Load test bid flow on staging |
| MSG-007 | Playwright + Supabase Realtime | Chat delivery latency assertion |

### Tier 2 — Should Automate (Medium ROI)

| Test ID | Tool | Reason |
|---------|------|--------|
| REQ-001–REQ-007 | Detox E2E | Request creation is the entry point to all flows |
| NTF-001–NTF-003 | Jest + Expo push mock | Notification delivery chain |
| CNT-001–CNT-004 | Jest integration | Contract creation + visit scheduling |
| ADM-003, ADM-004, ADM-011 | Playwright (admin portal) | Admin operations affect provider status |
| LOC-001, LOC-002 | Detox + screenshot diff | RTL layout regression |

### Tier 3 — Manual Only (Low ROI or non-deterministic)

| Test ID | Reason |
|---------|--------|
| UI/UX tests (visual alignment, Arabic fonts) | Requires visual inspection |
| PER-007 (image upload on slow connection) | Environment-dependent |
| SEC-021 (OTP timing attack) | Requires network analysis tools |
| LOC-005 (date format cultural correctness) | Cultural judgment required |
| JOB-014 (dispute resolution) | Workflow-based; admin judgment |

### Suggested Test Infrastructure

```
Framework:       Jest (unit + integration)
E2E Mobile:      Detox (React Native)
E2E Web/Admin:   Playwright
DB/RLS:          pgTAP or Supabase JS test client
Load Testing:    k6 (scripts per k6 memory file)
API Testing:     supertest (Edge Functions)
Visual Regression: Percy or Chromatic
CI Trigger:      GitHub Actions on PR + nightly
Test DB:         Supabase staging project (isolated)
```

---

## 20. UX — Inline Validation & Error Display

### High-Risk Areas
- أزرار النماذج الرئيسية تُقبل الضغط بدون بيانات وتُظهر خطأ مفهوم
- رسائل الخطأ تختفي فور تصحيح البيانات (لا تبقى بعد الإدخال)
- الأزرار لا تبقى معطّلة بشكل صامت — المستخدم يعرف دائماً ماذا ينقصه

---

#### UX-001
**Name:** urgent-request — وصف أقل من 10 أحرف عند الضغط على مراجعة  
**Priority:** High | **Type:** Functional / UX  
**Preconditions:** المستخدم على شاشة الطلب العاجل، اختار تصنيفاً.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اضغط "مراجعة وتأكيد" بدون كتابة وصف | رسالة خطأ حمراء تظهر أسفل حقل الوصف، الشاشة لا تتقدم |
| 2 | ابدأ الكتابة في حقل الوصف | تختفي رسالة الخطأ فوراً |
| 3 | أكمل 10 أحرف أو أكثر ثم اضغط | يتقدم إلى شاشة التأكيد بشكل طبيعي |

**Expected Result:** لا Alert popup، رسالة خطأ مضمّنة باللغة العربية، العداد يظهر "X / 10 أحرف كحد أدنى".  
**Automation Candidate:** No

---

#### UX-002
**Name:** new-request — ضغط "التالي" بدون عنوان  
**Priority:** High | **Type:** Functional / UX  
**Preconditions:** المستخدم اختار تصنيفاً، في الخطوة 2.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اترك حقل العنوان فارغاً واضغط "التالي" | رسالة خطأ حمراء تحت حقل العنوان، border أحمر على الحقل |
| 2 | أدخل عنواناً | تختفي الرسالة والـ border الأحمر فوراً |
| 3 | أكمل بقية الحقول واضغط "التالي" | ينتقل إلى الخطوة 3 |

**Expected Result:** لا Alert، رسالة مضمّنة، border الحقل يتحول أحمر.  
**Automation Candidate:** No

---

#### UX-003
**Name:** new-request — وصف أقل من 20 حرفاً  
**Priority:** High | **Type:** Functional / UX  
**Preconditions:** المستخدم في الخطوة 2، أدخل عنواناً صحيحاً.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | أدخل وصفاً أقل من 20 حرفاً واضغط "التالي" | رسالة خطأ تحت حقل الوصف، العداد يتحول "X / 20 أحرف كحد أدنى" |
| 2 | أضف أحرفاً حتى تتجاوز 20 | تختفي الرسالة، العداد يعود "X/500" |

**Expected Result:** العداد يوضح الحد الأدنى المطلوب وليس الحد الأقصى فقط.  
**Automation Candidate:** No

---

#### UX-004
**Name:** new-request — ضغط "التالي" بدون اختيار مدينة  
**Priority:** High | **Type:** Functional / UX  
**Preconditions:** الخطوة 2، العنوان والوصف صحيحان.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اضغط "التالي" بدون اختيار مدينة | رسالة خطأ أسفل قائمة المدن |
| 2 | اختر مدينة | تختفي الرسالة فوراً |
| 3 | اضغط "التالي" | ينتقل إلى الخطوة 3 |

**Expected Result:** رسالة واضحة مضمّنة، لا Alert.  
**Automation Candidate:** No

---

#### UX-005
**Name:** support-new — إرسال بدون اختيار نوع المشكلة  
**Priority:** High | **Type:** Functional / UX  
**Preconditions:** شاشة تذكرة الدعم مفتوحة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اضغط "إرسال" بدون اختيار نوع المشكلة | رسالة خطأ أسفل شبكة الأنواع |
| 2 | اختر نوعاً | تختفي الرسالة |
| 3 | أكمل الموضوع والوصف ثم أرسل | يُرسل بنجاح |

**Expected Result:** لا Alert، المستخدم يفهم ماذا ينقصه.  
**Automation Candidate:** No

---

#### UX-006
**Name:** support-new — موضوع أقل من 5 أحرف  
**Priority:** Medium | **Type:** Functional / UX  
**Preconditions:** اختار نوع المشكلة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | أدخل موضوعاً من حرفين واضغط "إرسال" | رسالة خطأ تحت حقل الموضوع، العداد يظهر "X / 5 أحرف كحد أدنى" |
| 2 | أضف أحرفاً تصل 5 | تختفي الرسالة |

**Expected Result:** العداد يوضح الحد الأدنى، رسالة خطأ عربية مضمّنة.  
**Automation Candidate:** No

---

#### UX-007
**Name:** login — ضغط "إرسال الرمز" بدون رقم الهاتف  
**Priority:** High | **Type:** Functional / UX  
**Preconditions:** شاشة تسجيل الدخول.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اضغط "إرسال الرمز" بدون أي إدخال | رسالة خطأ حمراء تحت حقل الهاتف، لا طلب شبكة يُرسَل |
| 2 | ابدأ الكتابة في الحقل | تختفي الرسالة فوراً |
| 3 | أدخل رقماً غير أردني | Alert (هذا مقبول — التحقق من التنسيق) |

**Expected Result:** الحقل الفارغ → رسالة مضمّنة. رقم خاطئ → Alert (مقبول).  
**Automation Candidate:** No

---

#### UX-008
**Name:** register — إنشاء حساب بدون اسم أو مدينة  
**Priority:** High | **Type:** Functional / UX  
**Preconditions:** المستخدم اجتاز OTP، في شاشة إكمال التسجيل.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اضغط "إنشاء حساب" بدون أي إدخال | رسالتا خطأ: إحداها تحت حقل الاسم، وأخرى تحت المدن |
| 2 | أدخل الاسم فقط ثم اضغط | تختفي رسالة الاسم، تبقى رسالة المدينة |
| 3 | اختر مدينة ثم اضغط | يُكمل التسجيل |

**Expected Result:** كل حقل له رسالة خطأ مستقلة، تختفي حسب الإدخال.  
**Automation Candidate:** No

---

#### UX-009
**Name:** provider bid modal — إرسال عرض بدون مبلغ  
**Priority:** High | **Type:** Functional / UX  
**Preconditions:** مزوّد مشترك، فتح مودال البيد على طلب.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اضغط "إرسال العرض" بدون إدخال مبلغ | رسالة خطأ حمراء تحت حقل المبلغ، border أحمر على الحقل |
| 2 | أدخل مبلغاً | تختفي الرسالة |
| 3 | اضغط "إرسال العرض" | يُرسل العرض بنجاح |

**Expected Result:** لا Alert، لا يُرسَل أي طلب شبكة عند المبلغ الفارغ.  
**Automation Candidate:** No  
**ملاحظة:** كرر الاختبار على مودال العقد (Contract Bid) ومودال الـ Demo Bid.

---

#### UX-010
**Name:** portfolio-add — "التالي" في الخطوة 1 بدون اختيار نوع  
**Priority:** Medium | **Type:** Functional / UX  
**Preconditions:** شاشة إضافة عمل في المعرض، الخطوة 1.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اضغط "التالي" بدون اختيار نوع العمل | رسالة خطأ حمراء أسفل البطاقات، الشاشة تبقى في الخطوة 1 |
| 2 | اختر نوعاً | تختفي الرسالة |
| 3 | اضغط "التالي" | ينتقل إلى الخطوة 2 |

**Expected Result:** لا disabled صامت، رسالة عربية واضحة.  
**Automation Candidate:** No

---

#### UX-011
**Name:** portfolio-add — "التالي" في الخطوة 2 بدون رفع صورة  
**Priority:** Medium | **Type:** Functional / UX  
**Preconditions:** اختار نوع "صورة واحدة"، في الخطوة 2.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اضغط "التالي" بدون رفع أي صورة | رسالة خطأ "يرجى رفع صورة للمتابعة" |
| 2 | ارفع صورة | تختفي الرسالة |
| 3 | اضغط "التالي" | ينتقل إلى الخطوة 3 |

**Expected Result:** الرسالة تختفي فور تأكيد الصورة في مودال المعاينة.  
**Automation Candidate:** No  
**ملاحظة:** كرر مع "قبل وبعد" (يجب رفع الاثنتين) و"فيديو".

---

#### UX-012
**Name:** rate-job — إرسال تقييم بدون اختيار نجمة  
**Priority:** High | **Type:** Functional / UX  
**Preconditions:** شاشة تقييم المزوّد، الوظيفة مكتملة ومؤكدة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اضغط "إرسال التقييم" بدون الضغط على أي نجمة | رسالة خطأ حمراء تحت النجوم |
| 2 | اضغط على نجمة | تختفي الرسالة فوراً |
| 3 | اضغط "إرسال التقييم" | يُرسَل التقييم |

**Expected Result:** لا Alert، الزر يعمل دائماً، الخطأ يظهر مضمّناً.  
**Automation Candidate:** No

---

#### UX-013
**Name:** chat — إرسال بلاغ بدون اختيار السبب  
**Priority:** Medium | **Type:** Functional / UX  
**Preconditions:** شاشة المحادثة، فتح مودال البلاغ.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | في مودال البلاغ، اضغط "إرسال" بدون اختيار سبب | رسالة خطأ حمراء فوق أزرار الإرسال/الإلغاء |
| 2 | اختر سبباً | تختفي الرسالة |
| 3 | اضغط "إرسال" | يُرسَل البلاغ |

**Expected Result:** لا disabled صامت، رسالة عربية مضمّنة داخل المودال.  
**Automation Candidate:** No  
**ملاحظة:** كرر نفس الاختبار في شاشة `request-detail.tsx`.

---

#### UX-014
**Name:** provider profile — حفظ المدينة بدون اختيار  
**Priority:** Medium | **Type:** Functional / UX  
**Preconditions:** مزوّد مفتوح ملف شخصي، فتح مودال تغيير المدينة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اضغط "حفظ" في رأس المودال بدون اختيار مدينة | رسالة خطأ حمراء تظهر داخل المودال أسفل العنوان الفرعي |
| 2 | اختر مدينة | تختفي الرسالة |
| 3 | اضغط "حفظ" | يُحفظ ويُغلق المودال |

**Expected Result:** زر "حفظ" يظل قابلاً للضغط، الرسالة تظهر مضمّنة.  
**Automation Candidate:** No

---

#### UX-015
**Name:** verify OTP — ضغط "تحقق" بأقل من 6 أرقام  
**Priority:** High | **Type:** Functional / UX  
**Preconditions:** شاشة إدخال OTP، أُرسل الرمز.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | أدخل 3 أرقام فقط ثم اضغط "تحقق" | رسالة خطأ "يرجى إدخال الرمز المكون من 6 أرقام كاملاً" |
| 2 | أكمل الأرقام الـ 6 | تختفي الرسالة |
| 3 | اضغط "تحقق" | يتحقق من الرمز ويُكمل |

**Expected Result:** الزر لا يُرسل أي طلب شبكة عند الرمز الناقص.  
**Automation Candidate:** No

---

#### UX-016 — General Regression: سلوك الأزرار بعد الإصلاح
**Name:** التحقق الشامل من اختفاء رسائل الخطأ عند الإدخال الصحيح  
**Priority:** High | **Type:** Regression  
**Preconditions:** ينطبق على جميع الشاشات في UX-001 → UX-015.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | أحدث خطأ في أي شاشة (اضغط بدون بيانات) | رسالة خطأ تظهر مضمّنة |
| 2 | أدخل البيانات الصحيحة | رسالة الخطأ تختفي فوراً دون الحاجة للضغط مجدداً |
| 3 | أكمل وأرسل | العملية تنفَّذ بنجاح |
| 4 | تحقق: لا توجد رسائل خطأ متبقية بعد النجاح | لا رسائل خطأ على الشاشة بعد الإرسال |

**Expected Result:** كل رسائل الخطأ reactive — تظهر عند الحاجة وتختفي فور التصحيح.  
**Automation Candidate:** No

---

---

## 21. CAT — Categories & Service Data

### High-Risk Areas
- خدمات جديدة تظهر تحت المجموعة الصحيحة مع الأيقونة الصحيحة
- النصوص التوضيحية (Placeholders) تُعرض باللغتين بشكل صحيح

---

#### CAT-001
**Name:** تحقق من ظهور "دراي كلين" تحت مجموعة تنظيف ونقل  
**Priority:** High | **Type:** Functional  
**Preconditions:** المستخدم على شاشة إنشاء طلب جديد، الخطوة 1 (اختيار التصنيف).

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح مجموعة "تنظيف ونقل" | تظهر الخدمات: تنظيف منزلي، نقل عفش، توصيل، دراي كلين، غسيل سجاد |
| 2 | تحقق من بطاقة "دراي كلين" | تعرض الأيقونة 👔 والاسم العربي "دراي كلين" |
| 3 | اختر "دراي كلين" | يُحدَّد التصنيف ويتقدم إلى الخطوة التالية |

**Expected Result:** الخدمة مرتّبة بعد "توصيل طرود" وقبل "غسيل سجاد"، الأيقونة 👔 تظهر بوضوح.  
**Automation Candidate:** No

---

#### CAT-002
**Name:** تحقق من ظهور "غسيل سجاد" تحت مجموعة تنظيف ونقل  
**Priority:** High | **Type:** Functional  
**Preconditions:** المستخدم على شاشة إنشاء طلب جديد، الخطوة 1 (اختيار التصنيف).

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح مجموعة "تنظيف ونقل" | تظهر الخدمات الخمس كاملة |
| 2 | تحقق من بطاقة "غسيل سجاد" | تعرض الأيقونة 🧹 والاسم العربي "غسيل سجاد" |
| 3 | اختر "غسيل سجاد" | يُحدَّد التصنيف ويتقدم إلى الخطوة التالية |

**Expected Result:** "غسيل سجاد" هي آخر خدمة في مجموعة تنظيف ونقل، الأيقونة 🧹 تظهر بوضوح.  
**Automation Candidate:** No

---

#### CAT-003
**Name:** Placeholder نص "دراي كلين" في نموذج الطلب  
**Priority:** Medium | **Type:** Functional / UX  
**Preconditions:** المستخدم اختار تصنيف "دراي كلين"، وصل إلى حقلَي العنوان والوصف.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افحص placeholder حقل العنوان | "مثال: تنظيف بدلة رسمية وعباءة" (عربي) |
| 2 | بدّل اللغة إلى الإنجليزية | "e.g. Dry clean a formal suit and abaya" |
| 3 | افحص placeholder حقل الوصف (عربي) | "حدد عدد القطع ونوع الملابس وهل تحتاج استلاماً وتوصيلاً" |

**Expected Result:** النصوص التوضيحية مناسبة للخدمة وتتغير مع اللغة.  
**Automation Candidate:** No

---

#### CAT-004
**Name:** Placeholder نص "غسيل سجاد" في نموذج الطلب  
**Priority:** Medium | **Type:** Functional / UX  
**Preconditions:** المستخدم اختار تصنيف "غسيل سجاد"، وصل إلى حقلَي العنوان والوصف.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افحص placeholder حقل العنوان | "مثال: غسيل سجادتين في غرفة المعيشة" (عربي) |
| 2 | بدّل اللغة إلى الإنجليزية | "e.g. Wash 2 carpets from the living room" |
| 3 | افحص placeholder حقل الوصف (عربي) | "أذكر عدد السجاد ومقاساتها التقريبية وهل تريد استلاماً وتوصيلاً" |

**Expected Result:** النصوص التوضيحية مناسبة للخدمة وتتغير مع اللغة.  
**Automation Candidate:** No

---

#### CAT-005
**Name:** Master Visibility Check — التحقق من ظهور جميع الـ 55 خدمة في التطبيق  
**Priority:** Critical | **Type:** Functional / Data Integrity  
**Preconditions:** اتصال بـ Supabase متاح؛ client مسجّل دخول ويصل لشاشة "طلب جديد".

> **⚠️ قاعدة ثابتة:** عند إضافة أي خدمة جديدة للتطبيق، يجب إضافة سطر جديد لجداول الخطوة 2 أدناه، وتحديث العدد الكلي في هذه الحالة والـ Expected Result.

**الخطوة 1 — DB Consistency (استعلام SQL):**

```sql
SELECT slug, name_ar, group_slug, is_active
FROM service_categories
WHERE is_active = true
ORDER BY group_slug, sort_order;
```

النتيجة المتوقعة: **55 صفاً** نشطاً موزعة على **11 مجموعة**.

---

**الخطوة 2 — UI Visibility (تحقق يدوي في التطبيق):**

افتح شاشة "طلب جديد" ← الخطوة 1 (اختيار التصنيف) وتحقق من وجود كل خدمة:

**صيانة المنازل (15 خدمة)**

| # | الخدمة | Slug | ✓/✗ |
|---|--------|------|-----|
| 1 | كهرباء | `electrical` | |
| 2 | سباكة | `plumbing` | |
| 3 | تكييف وتبريد | `ac_repair` | |
| 4 | نجارة | `carpentry` | |
| 5 | دهان وديكور | `painting` | |
| 6 | إصلاح أجهزة منزلية | `appliance_repair` | |
| 7 | بليط وأرضيات | `tiling` | |
| 8 | قصارة وتشطيب | `plastering` | |
| 9 | حدادة ولحام | `ironwork` | |
| 10 | ألمنيوم | `aluminum` | |
| 11 | تنجيد وإصلاح أثاث | `upholstery` | |
| 12 | جبصين وديكور داخلي | `gypsum` | |
| 13 | أعمال بناء وترميم | `renovation` | |
| 14 | زجاج ومرايا | `glass` | |
| 15 | تنسيق الحدائق والبستنة | `gardening` | |

**تنظيف ونقل (5 خدمات)**

| # | الخدمة | Slug | ✓/✗ |
|---|--------|------|-----|
| 16 | تنظيف منزلي | `cleaning` | |
| 17 | نقل عفش وتوصيل | `moving` | |
| 18 | توصيل طرود وبضائع | `courier` | |
| 19 | دراي كلين | `dry_cleaning` | |
| 20 | غسيل سجاد | `carpet_washing` | |

**الخدمات الفنية (6 خدمات)**

| # | الخدمة | Slug | ✓/✗ |
|---|--------|------|-----|
| 21 | شبكات وإنترنت | `networking` | |
| 22 | كاميرات مراقبة | `cctv` | |
| 23 | أنظمة الطاقة الشمسية | `solar` | |
| 24 | إنذار وأنظمة حريق | `alarm_fire` | |
| 25 | إلكترونيات وأجهزة | `electronics` | |
| 26 | صيانة حاسوب وطابعات | `computer_repair` | |

**الصحة والعناية (4 خدمات)**

| # | الخدمة | Slug | ✓/✗ |
|---|--------|------|-----|
| 27 | حجامة ومساج | `cupping_massage` | |
| 28 | تمريض وعناية منزلية | `home_nursing` | |
| 29 | تجميل نسائي منزلي | `beauty_women` | |
| 30 | حلاقة رجالية منزلية | `beauty_men` | |

**المناسبات والفعاليات (3 خدمات)**

| # | الخدمة | Slug | ✓/✗ |
|---|--------|------|-----|
| 31 | تصوير فوتوغرافي وفيديو | `photography` | |
| 32 | حلويات وكيك مناسبات | `pastry_cakes` | |
| 33 | تنسيق وتزيين مناسبات | `event_decor` | |

**تعليم وتدريب (2 خدمة)**

| # | الخدمة | Slug | ✓/✗ |
|---|--------|------|-----|
| 34 | تدريس خصوصي | `tutoring` | |
| 35 | تعليم قرآن وتجويد | `quran_teaching` | |

**تصميم وأعمال حرة (5 خدمات)**

| # | الخدمة | Slug | ✓/✗ |
|---|--------|------|-----|
| 36 | تصميم جرافيك | `design` | |
| 37 | تصميم مواقع وتطبيقات | `web_design` | |
| 38 | تسويق رقمي وسوشيال ميديا | `digital_marketing` | |
| 39 | كتابة وترجمة | `writing_translation` | |
| 40 | محاسبة وأعمال مالية | `accounting` | |

**الحِرَف اليدوية والتقليدية (3 خدمات)**

| # | الخدمة | Slug | ✓/✗ |
|---|--------|------|-----|
| 41 | خياطة وتفصيل | `tailoring` | |
| 42 | تطريز وأعمال يدوية | `embroidery` | |
| 43 | صناعة وإصلاح أحذية | `shoemaking` | |

**الحيوانات الأليفة (3 خدمات)**

| # | الخدمة | Slug | ✓/✗ |
|---|--------|------|-----|
| 44 | تجميل ورعاية الحيوانات | `pet_grooming` | |
| 45 | تدريب الحيوانات | `pet_training` | |
| 46 | بيطري منزلي | `vet_home` | |

**صيانة السيارات (6 خدمات)**

| # | الخدمة | Slug | ✓/✗ |
|---|--------|------|-----|
| 47 | إصلاح السيارات | `car_repair` | |
| 48 | كهرباء السيارات | `car_electrical` | |
| 49 | إطارات وتغيير زيت | `car_tires` | |
| 50 | تكييف السيارات | `car_ac` | |
| 51 | هيكل ودهان السيارات | `car_bodywork` | |
| 52 | غسيل وتلميع السيارات | `car_cleaning` | |
| 53 | إكسسوارات وزينة السيارات | `car_accessories` | |

**خدمات المياه (3 خدمات)**

| # | الخدمة | Slug | ✓/✗ |
|---|--------|------|-----|
| 54 | تنك مياه صالحة للشرب | `water_tank` | |
| 55 | صهريج مياه عادمة | `sewage_tanker` | |
| 56 | تنظيف وتعقيم الخزانات | `tank_cleaning` | |

---

**Expected Result:** جميع الـ 56 خدمة ظاهرة في التطبيق ومطابقة للـ DB. أي خدمة مفقودة تُسجَّل Bug فوراً مع تحديد موقع المشكلة: DB أم i18n أم categories.ts.  
**Automation Candidate:** Yes (الخطوة 1 — DB query) / No (الخطوة 2 — UI)

---

#### CAT-006
**Name:** Home Screen — التحقق من ظهور جميع مجموعات الخدمات الـ 11 في الشاشة الرئيسية  
**Priority:** High | **Type:** Functional  
**Preconditions:** client مسجّل دخول، الشاشة الرئيسية محمّلة.

> **⚠️ قاعدة ثابتة:** عند إضافة مجموعة خدمات جديدة، يجب تحديث 4 قوائم في `(client)/index.tsx`: `GROUP_COLORS` + `GROUP_EMOJI` + `GROUP_SHORT_AR` + `DISPLAY_ORDER`. بدون هذا التحديث لن تظهر المجموعة في الشاشة الرئيسية حتى لو كانت في DB و categories.ts.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح الشاشة الرئيسية | شريط التصنيفات الأفقي ظاهر |
| 2 | تصفّح شريط المجموعات كاملاً | تظهر 11 مجموعة بالترتيب أدناه |
| 3 | اضغط على كل مجموعة | تتغير قائمة الخدمات تحتها بشكل صحيح |
| 4 | تحقق من الأيقونة والاسم لكل مجموعة | مطابقة للجدول أدناه |

**قائمة المجموعات المطلوبة في الشاشة الرئيسية:**

| # | المجموعة | الـ Slug | الأيقونة | اللون | ظاهرة ✓/✗ |
|---|----------|---------|---------|------|-----------|
| 1 | صيانة المنازل | `maintenance` | 🔧 | أزرق | |
| 2 | صيانة السيارات | `car_services` | 🚗 | أحمر | |
| 3 | تنظيف ونقل | `cleaning` | ✨ | أخضر | |
| 4 | الخدمات الفنية | `technical` | 💻 | سماوي | |
| 5 | المناسبات | `events` | 🎉 | برتقالي | |
| 6 | تعليم | `education` | 📚 | بنفسجي | |
| 7 | تصميم وأعمال | `freelance` | ✏️ | ذهبي | |
| 8 | صحة وعناية | `health_beauty` | 💆 | وردي | |
| 9 | الحِرَف | `handicrafts` | 🧵 | أخضر فاتح | |
| 10 | الحيوانات | `pets` | 🐾 | بنفسجي فاتح | |
| 11 | خدمات المياه | `water_services` | 🚰 | أزرق سماوي | |

**Expected Result:** جميع الـ 11 مجموعة ظاهرة مع أيقوناتها وألوانها الصحيحة. الضغط على أي مجموعة يعرض خدماتها في الشبكة أدناه.  
**Automation Candidate:** No

---

## 22. OBD — Onboarding Screen Redesign

### High-Risk Areas
- شاشة اختيار الدور تعرض الشخصيات بشكل صحيح على مختلف أحجام الشاشات
- الـ Gradient والألوان تتبدل صحيحاً بين Light/Dark
- الخطوات 2–5 تبقى كما هي بدون تأثر

---

#### OBD-001
**Name:** عرض شخصية طالب الخدمة (seated client) في البطاقة اليسرى  
**Priority:** High | **Type:** Functional / Visual  
**Preconditions:** مستخدم جديد يفتح شاشة الـ Onboarding للمرة الأولى.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح شاشة Onboarding (مستخدم جديد) | تظهر شاشة Step 1 بخلفية كريمية دافئة مع LinearGradient |
| 2 | افحص البطاقة اليسرى "أنا طالب خدمة" | تعرض شخصية الشاب الجالس (الـ hoodie الأصفر) بوضوح |
| 3 | تأكد من الحد الذهبي والـ checkmark | البطاقة محددة افتراضياً بحد ذهبي وعلامة ✓ |

**Expected Result:** الشخصية مقصوصة صحيحاً من الـ sprite sheet، لا قطع في الصورة.  
**Automation Candidate:** No

---

#### OBD-002
**Name:** عرض شخصية مزود الخدمة (provider tablet) في البطاقة اليمنى  
**Priority:** High | **Type:** Functional / Visual  
**Preconditions:** شاشة Step 1 مفتوحة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افحص البطاقة اليمنى "أنا مزود خدمة" | تعرض شخصية المزود بالأوفرول الأزرق يحمل التابلت |
| 2 | اضغط على البطاقة اليمنى | تُحدَّد بحد أزرق وـ checkmark أزرق |
| 3 | تحقق أن البطاقة اليسرى تُلغى تحديدها | الحد الذهبي يختفي من بطاقة العميل |

**Expected Result:** التبديل بين البطاقتين سلس، الشخصية الصحيحة في كل بطاقة.  
**Automation Candidate:** No

---

#### OBD-003
**Name:** زر "ابدأ الآن" يتقدم إلى الخطوة 2 حسب الدور المختار  
**Priority:** High | **Type:** Functional  
**Preconditions:** Step 1 مفتوحة، اختار دور.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اختر "أنا طالب خدمة" ثم اضغط "ابدأ الآن 🚀" | ينتقل إلى Step 2 (إدخال الاسم والمدينة) |
| 2 | عد وابدأ من جديد، اختر "أنا مزود خدمة" ثم "ابدأ الآن" | ينتقل إلى Step 2 (نفس الخطوة لكن مع حقل البايو) |
| 3 | تحقق أن progress bar يُعرض في Step 2 | شريط التقدم يظهر في الخطوات التالية |

**Expected Result:** الدور المختار ينعكس صحيحاً على مسار الخطوات (client: 2 خطوات، provider: 4 خطوات).  
**Automation Candidate:** No

---

#### OBD-004
**Name:** التحقق من الـ Social Proof Row (+12,000 مستخدم)  
**Priority:** Medium | **Type:** Visual / UX  
**Preconditions:** شاشة Step 1.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افحص الصف فوق البطاقات | 3 دوائر ألوان متداخلة + ★★★★★ + نص "+12,000 مستخدم يثقون بنا" |
| 2 | تحقق في RTL (عربي) | الصف يعكس اتجاهه بشكل صحيح |
| 3 | تحقق في Dark Mode | الألوان تتكيف مع خلفية داكنة |

**Expected Result:** الـ Social proof مرئي ومقروء في جميع الحالات.  
**Automation Candidate:** No

---

#### OBD-005
**Name:** Trust Badges تظهر على الشاشات الكبيرة وتختفي على الصغيرة  
**Priority:** Medium | **Type:** Responsive  
**Preconditions:** Step 1 على أجهزة مختلفة الحجم.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح Step 1 على جهاز بشاشة أكبر من 700pt (مثل iPhone 14) | تظهر Trust Badges: آمن وموثوق / بدون تعقيد / دعم 24/7 |
| 2 | افتح على جهاز بشاشة أصغر من 700pt (مثل iPhone SE) | التصنيفات الثلاثة مخفية لتوفير المساحة |
| 3 | تأكد أن زر "ابدأ الآن" مرئي دائماً في كلا الحالتين | الزر لا يختفي أبداً |

**Expected Result:** Layout responsive — لا overflow، لا قطع في المحتوى.  
**Automation Candidate:** No

---

#### OBD-006
**Name:** Dark Mode — LinearGradient والبطاقات  
**Priority:** Medium | **Type:** Visual  
**Preconditions:** الجهاز في وضع Dark Mode.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فعّل Dark Mode وافتح Onboarding | الخلفية داكنة دافئة (dark gradient)، ليست بيضاء أو كريمية |
| 2 | افحص البطاقتين | خلفية داكنة مع حدود ملونة (ذهبي/أزرق عند التحديد) |
| 3 | افحص منطقة الشخصية في البطاقة | خلفية الشخصية تستخدم `colors.surface` بدل الأبيض |

**Expected Result:** Dark Mode متسق مع باقي التطبيق، لا ألوان بيضاء صارخة.  
**Automation Candidate:** No

---

#### OBD-007
**Name:** الخطوات 2–5 لا تتأثر بعد التعديل  
**Priority:** High | **Type:** Regression  
**Preconditions:** مستخدم يكمل Onboarding كاملاً.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اضغط "ابدأ الآن" من Step 1 | ينتقل إلى Step 2 مع progress bar |
| 2 | أكمل Step 2 (الاسم والمدينة) | ينتقل طبيعياً |
| 3 | لـ Provider: أكمل Step 3 (التخصصات) و Step 4 (الخطة) | كل الخطوات تعمل بدون تغيير |
| 4 | أكمل التسجيل | ينتهي بشاشة "Done" ويتوجه للتطبيق |

**Expected Result:** كل المنطق الموجود (handleSubmit، notifyRoleUpdate، trial activation) يعمل بشكل كامل.  
**Automation Candidate:** No

---

#### OBD-008
**Name:** Regression — زر الرجوع في الخطوات 2+ لا يعود للتصميم القديم  
**Priority:** High | **Type:** Regression  
**Preconditions:** مستخدم في Step 2.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | من Step 2، اضغط زر الرجوع "←" | يرجع إلى Step 1 بالتصميم الجديد (LinearGradient + شخصيات) |
| 2 | الدور المختار سابقاً محفوظ | البطاقة المحددة تبقى محددة |
| 3 | اضغط "ابدأ الآن" مجدداً | يتقدم إلى Step 2 بسلاسة |

**Expected Result:** التنقل ذهاباً وإياباً يعمل بشكل صحيح مع التصميم الجديد.  
**Automation Candidate:** No

---

---

## 23. VFY — Verify Screen Redesign

#### VFY-001
**Name:** LinearGradient background يظهر بشكل صحيح  
**Priority:** High | **Type:** Visual  
**Preconditions:** المستخدم انتقل من شاشة Login إلى Verify.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح شاشة Verify (Light Mode) | خلفية LinearGradient من #FDF6E3 إلى #FFFBF8 |
| 2 | بدّل إلى Dark Mode | الخلفية تتغير إلى colors.bg → #1A1407 |
| 3 | قارن مع شاشة Login | نفس التدرج اللوني المتطابق |

**Expected Result:** التصميم متسق مع منظومة الألوان الجديدة في الوضعين.  
**Automation Candidate:** No

---

#### VFY-002
**Name:** عرض رقم الهاتف في الـ Phone Badge  
**Priority:** High | **Type:** Functional  
**Preconditions:** المستخدم أدخل 0791234567 في Login وانتقل إلى Verify.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | لاحظ الـ Phone Badge تحت العنوان | يعرض +9627912345 67 بخط ذهبي fontWeight 700 |
| 2 | تحقق من اللون | لون ACCENT #C9A84C |
| 3 | تحقق من حدود البطاقة | borderColor rgba(201,168,76,0.35) في Light |

**Expected Result:** رقم الهاتف معروض بوضوح في بادج مميز.  
**Automation Candidate:** No

---

#### VFY-003
**Name:** مربعات OTP — الحالات الثلاث (فارغ / ممتلئ / خطأ)  
**Priority:** High | **Type:** Functional  
**Preconditions:** شاشة Verify مفتوحة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | المربعات فارغة | حدود خفيفة rgba(201,168,76,0.25)، خلفية شفافة |
| 2 | اكتب رقماً في المربع الأول | المربع يصبح borderColor #C9A84C + خلفية ذهبية خفيفة |
| 3 | اضغط زر "تحقق" مع مربعات ناقصة | جميع المربعات تأخذ borderColor #EF4444 + رسالة خطأ |

**Expected Result:** الـ OTP Card يعكس الحالة بشكل بصري واضح.  
**Automation Candidate:** No

---

#### VFY-004
**Name:** التنقل التلقائي بين مربعات OTP  
**Priority:** Medium | **Type:** Functional  
**Preconditions:** شاشة Verify مفتوحة، لوحة المفاتيح ظاهرة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اكتب رقماً في المربع الأول | التركيز ينتقل تلقائياً إلى المربع الثاني |
| 2 | احذف رقماً من المربع الثالث | التركيز يرجع إلى المربع الثاني |
| 3 | اكتب 6 أرقام متتالية | التركيز ينتهي عند المربع السادس |

**Expected Result:** التنقل التلقائي يعمل بسلاسة في الاتجاهين.  
**Automation Candidate:** No

---

#### VFY-005
**Name:** Countdown Badge + زر إعادة الإرسال  
**Priority:** Medium | **Type:** Functional  
**Preconditions:** شاشة Verify مفتوحة حديثاً.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | لاحظ منطقة الـ Resend مباشرة | يظهر CountdownBadge "⏱ إعادة الإرسال بعد 0:60" |
| 2 | انتظر 60 ثانية | يختفي الـ Badge ويظهر زر "📨 إعادة إرسال الرمز" |
| 3 | اضغط زر إعادة الإرسال | يُرسل OTP جديد، العداد يبدأ من 0:60 من جديد |

**Expected Result:** منطقة الـ Countdown تتبدل بين Badge والزر بشكل صحيح.  
**Automation Candidate:** No

---

#### VFY-006
**Name:** Regression — كامل منطق التحقق محفوظ بعد التصميم  
**Priority:** Medium | **Type:** Regression  
**Preconditions:** حساب اختبار صالح بـ OTP معروف.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | أدخل OTP خاطئ واضغط تحقق | Alert بـ auth.wrongCode، المربعات تُصفَّر |
| 2 | أدخل OTP صحيح واضغط تحقق | ينتقل إلى /(client) أو /(auth)/onboarding حسب الحالة |
| 3 | اختبر حساباً موقوفاً | Alert بـ auth.accountSuspended، يبقى في شاشة Verify |

**Expected Result:** منطق handleVerify يعمل بالضبط كما قبل التصميم.  
**Automation Candidate:** No

---

---

## 24. REG — Register Screen Redesign

#### REG-001
**Name:** LinearGradient + Logo يظهران في شاشة التسجيل  
**Priority:** High | **Type:** Visual  
**Preconditions:** مستخدم جديد أكمل التحقق من OTP ووصل إلى شاشة التسجيل.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح شاشة Register (Light Mode) | خلفية LinearGradient #FDF6E3 → #FFFBF8، لوجو 64×64 في الأعلى |
| 2 | بدّل إلى Dark Mode | التدرج يتغير إلى colors.bg → #1A1407 |
| 3 | تحقق من العنوان | "✨ أكمل تسجيلك" بخط 800 bold مركزي |

**Expected Result:** التصميم متسق مع منظومة الألوان الجديدة.  
**Automation Candidate:** No

---

#### REG-002
**Name:** بطاقات اختيار الدور — Selection Banner  
**Priority:** High | **Type:** Functional  
**Preconditions:** شاشة Register مفتوحة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | لاحظ بطاقتَي الدور في الحالة الافتراضية | بطاقة "طالب الخدمة" محددة (بانر ذهبي "✓ تم الاختيار")، بطاقة "مزود الخدمة" رمادية |
| 2 | اضغط بطاقة "مزود الخدمة" | البانر يتحول إلى أزرق "✓ تم الاختيار"، البطاقة السابقة ترجع رمادية |
| 3 | يظهر شارة التجربة المجانية | "🎁 تجربة مجانية 30 يوم + 10 رصيد ترحيبي" بلون أزرق |

**Expected Result:** اختيار الدور واضح بصرياً مع تغذية راجعة فورية.  
**Automation Candidate:** No

---

#### REG-003
**Name:** شارة التجربة المجانية — تظهر وتختفي حسب الدور  
**Priority:** Medium | **Type:** Functional  
**Preconditions:** شاشة Register مفتوحة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | الدور الافتراضي "طالب الخدمة" | شارة التجربة المجانية مخفية |
| 2 | اضغط "مزود الخدمة" | شارة "🎁 تجربة مجانية 30 يوم" تظهر |
| 3 | اضغط "طالب الخدمة" مجدداً | الشارة تختفي |

**Expected Result:** الشارة تظهر فقط لـ provider.  
**Automation Candidate:** No

---

#### REG-004
**Name:** Input Card الاسم — التحقق من الحقل الفارغ  
**Priority:** High | **Type:** Functional  
**Preconditions:** شاشة Register مفتوحة، حقل الاسم فارغ.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اترك حقل الاسم فارغاً واضغط "إنشاء الحساب" | حد البطاقة يتحول إلى أحمر #EF4444، رسالة "⚠️ يرجى إدخال اسمك الكامل" |
| 2 | اكتب اسماً | الحد يعود لللون الذهبي، الرسالة تختفي |
| 3 | تحقق من شكل Input Card | خلفية بيضاء/شفافة، حد ذهبي 1.5px، label "الاسم الكامل" بذهبي |

**Expected Result:** التحقق يعمل مع التصميم الجديد.  
**Automation Candidate:** No

---

#### REG-005
**Name:** City Chips — الاختيار والتصميم  
**Priority:** Medium | **Type:** Functional  
**Preconditions:** شاشة Register مفتوحة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | لاحظ قائمة المدن الأفقية | chips بحد رمادي خفيف، قابلة للتمرير |
| 2 | اضغط "عمّان" | الـ chip يصبح borderColor #C9A84C + خلفية ذهبية خفيفة + نص ذهبي bold |
| 3 | اضغط "إنشاء الحساب" بدون اختيار مدينة | رسالة "⚠️ يرجى اختيار مدينتك" |

**Expected Result:** اختيار المدينة واضح ومميز بصرياً.  
**Automation Candidate:** No

---

#### REG-006
**Name:** Regression — منطق التسجيل الكامل محفوظ بعد التصميم  
**Priority:** Medium | **Type:** Regression  
**Preconditions:** حساب اختبار، OTP تم التحقق منه.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | سجّل كـ "طالب خدمة" باسم ومدينة | ينتقل إلى /(client) |
| 2 | سجّل كـ "مزود خدمة" | ينتقل إلى /(provider)، يُنشأ صف في providers بـ trial |
| 3 | سجّل برقم هاتف مكرر | Alert بـ auth.phoneAlreadyRegistered مع خيار الذهاب لـ Login |

**Expected Result:** handleRegister يعمل بالضبط كما قبل التصميم.  
**Automation Candidate:** No

---

---

## 25. THME — App-Wide Theme & Visual Redesign

**Scope:** تغطية التصميم المحدّث بـ LinearGradient + نظام ألوان ذهبي (#C9A84C) على جميع الشاشات.  
**Screens affected:** verify-phone، help-center، portfolio، portfolio-add، subscribe، urgent-request، support، support-new، notification-settings، notification-inbox، provider/profile، provider/index، rate-job، provider-profile، contract-detail، request-detail، chat.

---

#### THME-001
**Name:** LinearGradient — Light Mode Background  
**Priority:** High | **Type:** Visual  
**Preconditions:** الجهاز في Light Mode، الشاشة المطلوبة مفتوحة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح أي شاشة محدّثة (مثل request-detail، chat، portfolio-add) في Light Mode | الخلفية تُظهر تدرجاً من #FDF6E3 إلى #FFFBF8 بدلاً من لون صلب |
| 2 | تمرير المحتوى | التدرج ثابت كخلفية، المحتوى يتمرر فوقه |
| 3 | قارن مع شاشة غير محدّثة | الشاشات المحدّثة أكثر دفئاً ووضوحاً |

**Expected Result:** التدرج الذهبي الفاتح يظهر في Light Mode على جميع الشاشات المحدّثة.  
**Automation Candidate:** No

---

#### THME-002
**Name:** LinearGradient — Dark Mode Background  
**Priority:** High | **Type:** Visual  
**Preconditions:** الجهاز في Dark Mode.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فعّل Dark Mode على الجهاز | التدرج يتحول من colors.bg إلى #1A1407 |
| 2 | تنقّل بين شاشات مختلفة (chat, subscribe, provider feed) | التدرج يظهر في جميعها بألوان الـ Dark Mode |
| 3 | قارن البطاقات في Dark Mode | حدود البطاقات تستخدم colors.border (رمادي/أبيض شفاف) |

**Expected Result:** التدرج الداكن يظهر في Dark Mode بدون تضارب ألوان.  
**Automation Candidate:** No

---

#### THME-003
**Name:** بطاقات — حد ذهبي في Light Mode  
**Priority:** Medium | **Type:** Visual  
**Preconditions:** Light Mode، أي شاشة تحتوي بطاقات.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح request-detail | بطاقة الطلب لها حد بلون rgba(201,168,76,0.20) |
| 2 | افتح chat | فقاعات الرسائل الواردة لها حد rgba(201,168,76,0.15) |
| 3 | افتح portfolio-add | بطاقات نوع العمل لها حد rgba(201,168,76,0.20) |

**Expected Result:** جميع البطاقات في Light Mode تستخدم الحد الذهبي الخفيف.  
**Automation Candidate:** No

---

#### THME-004
**Name:** Regression — منطق Chat محفوظ بعد التصميم  
**Priority:** Critical | **Type:** Regression  
**Preconditions:** job نشط، شاشة chat مفتوحة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | أرسل رسالة نصية | الرسالة تُضاف فورياً (optimistic) وتنتقل إلى DB |
| 2 | أرسل موقعك الحالي | فقاعة الموقع تظهر مع إحداثيات وزر "فتح الخريطة" |
| 3 | اضغط طويلاً على زر المايكروفون > أرسل | رسالة صوتية تُرسل بعد التوقف |
| 4 | افتح الشاشة في Dark Mode | التدرج الداكن يظهر خلف القائمة فقط، شريط الإدخال يبقى بلون colors.surface |

**Expected Result:** جميع وظائف الدردشة تعمل كما قبل التصميم، والتدرج يظهر في منطقة الرسائل فقط.  
**Automation Candidate:** No

---

#### THME-005
**Name:** Regression — request-detail منطق قبول العروض محفوظ  
**Priority:** Critical | **Type:** Regression  
**Preconditions:** طلب مفتوح مع عروض pending.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح request-detail | التدرج يظهر خلف ScrollView |
| 2 | اضغط "قبول" على عرض | Modal التأكيد يظهر (خارج LinearGradient) |
| 3 | أكّد القبول | ينتقل إلى grace-period، العروض الأخرى تُرفض |
| 4 | تحقق من modal الإبلاغ | يعمل بشكل مستقل عن LinearGradient |

**Expected Result:** منطق قبول العروض يعمل بالضبط كما قبل التصميم.  
**Automation Candidate:** No

---

#### THME-006
**Name:** Regression — portfolio-add رفع الصور محفوظ  
**Priority:** High | **Type:** Regression  
**Preconditions:** provider مسجّل، شاشة portfolio-add مفتوحة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اختر نوع "صورة واحدة" | بطاقة الاختيار تتحول للون الذهبي، خطوة 2 متاحة |
| 2 | اضغط "التالي" بدون اختيار صورة | رسالة ⚠️ تظهر |
| 3 | ارفع صورة > أكّد في نافذة المعاينة | الصورة تُقتطع 4:3 وترفع |
| 4 | أكمل الخطوة 3 واضغط "نشر" | العنصر يُضاف إلى portfolio |
| 5 | تحقق من SuccessModal | يظهر داخل LinearGradient بشكل صحيح |

**Expected Result:** تدفق رفع المحفظة كامل بدون أي تراجع.  
**Automation Candidate:** No

---

#### THME-007
**Name:** Regression — شاشة verify-phone التدرج يغطي الشاشة الكاملة  
**Priority:** Medium | **Type:** Visual + Regression  
**Preconditions:** شاشة verify-phone مفتوحة (بعد إدخال الهاتف).

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | لاحظ شاشة verify-phone | LinearGradient يُغطي الشاشة كاملةً (لا AppHeader) |
| 2 | أدخل 6 أرقام OTP | حقل الإدخال يُجمعها، زر التحقق يُفعَّل |
| 3 | أدخل OTP خاطئاً | رسالة خطأ تظهر |
| 4 | أدخل OTP صحيحاً | ينتقل إلى register أو الصفحة الرئيسية |

**Expected Result:** شاشة OTP تعمل كالمعتاد، التدرج يظهر خلف المحتوى.  
**Automation Candidate:** No

---

#### THME-008
**Name:** Regression — subscribe اشتراك كامل  
**Priority:** High | **Type:** Regression  
**Preconditions:** provider بدون اشتراك.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح subscribe | LinearGradient خلف ScrollView + قسم CTA |
| 2 | اضغط على خطة | بطاقة الخطة تتحول للون الذهبي |
| 3 | اضغط "اشترك الآن" | ينتقل إلى Paddle checkout |
| 4 | تحقق من FAQs | قابلة للطي/فتح بشكل طبيعي |

**Expected Result:** تدفق الاشتراك يعمل كما قبل التصميم.  
**Automation Candidate:** No

---

#### THME-009
**Name:** Regression — notification-inbox وnotification-settings  
**Priority:** Medium | **Type:** Regression  
**Preconditions:** حساب مع إشعارات.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح notification-inbox | LinearGradient خلف FlatList |
| 2 | اضغط على إشعار | ينتقل إلى الصفحة المرتبطة |
| 3 | افتح notification-settings | LinearGradient خلف Animated.ScrollView |
| 4 | عطّل نوع إشعار ثم أعده | الحالة تُحفظ في DB |

**Expected Result:** الإشعارات تعمل بالكامل مع التصميم الجديد.  
**Automation Candidate:** No

---

#### THME-010
**Name:** Regression — help-center وsupport وsupport-new  
**Priority:** Medium | **Type:** Regression  
**Preconditions:** أي مستخدم مسجّل.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح help-center | LinearGradient من الجذر (لا AppHeader خارجي) |
| 2 | افتح support | بطاقات الإجراءات بحد ذهبي في Light Mode |
| 3 | افتح support-new > اختر فئة > اكتب موضوعاً ورسالة > أرسل | التذكرة تُرسل بنجاح |

**Expected Result:** وظائف الدعم تعمل بلا تراجع.  
**Automation Candidate:** No

---

#### THME-011
**Name:** Regression — contract-detail وprovider-profile وrate-job  
**Priority:** Medium | **Type:** Regression  
**Preconditions:** عقد نشط، provider profile متاح.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح contract-detail | LinearGradient خلف ScrollView، statusBadge بحد ذهبي |
| 2 | افتح provider-profile | LinearGradient بعد AppHeader، heroCard بحد ذهبي |
| 3 | افتح rate-job > اختر 5 نجوم > أرسل | التقييم يُحفظ ويظهر في الملف الشخصي |

**Expected Result:** وظائف هذه الشاشات محفوظة مع التصميم الجديد.  
**Automation Candidate:** No

---

#### THME-012
**Name:** Regression — portfolio وprovider feed وurgent-request  
**Priority:** Medium | **Type:** Regression  
**Preconditions:** provider لديه ملف كامل.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح portfolio | LinearGradient خلف FlatList، صور تُفتح في Lightbox |
| 2 | افتح provider/index (feed) | LinearGradient بعد ProviderSubHeader، البطاقات بحد ذهبي |
| 3 | افتح urgent-request > أكمل الطلب | الطلب يُرسل كـ is_urgent=true |

**Expected Result:** وظائف هذه الشاشات كاملة مع التصميم المحدّث.  
**Automation Candidate:** No

---

---

## 26. NCAT — New Service Categories (Water, Cleaning, Gardening)

### Scope
التحقق من أن الخدمات الجديدة المضافة (خدمات المياه × 3، دراي كلين، غسيل سجاد، تنسيق الحدائق) ظاهرة وقابلة للاستخدام الكامل في التطبيق بعد إضافتها للـ DB وملفات الترجمة.

### High-Risk Areas
- slugs موجودة في DB (`service_categories`) وليس فقط في الـ fallback المحلي
- مجموعة `water_services` تظهر كمجموعة مستقلة في قائمة التصنيفات
- placeholder توجيهي صحيح عند إنشاء الطلب لكل خدمة
- Provider يستطيع تسجيل نفسه تحت الخدمات الجديدة

---

#### NCAT-001
**Name:** DB consistency — جميع الـ slugs الجديدة موجودة ونشطة في قاعدة البيانات  
**Priority:** Critical | **Type:** Functional/Data Integrity  
**Preconditions:** الاتصال بـ Supabase متاح.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | استعلم `SELECT slug, is_active FROM service_categories WHERE slug IN ('water_tank','sewage_tanker','tank_cleaning','dry_cleaning','carpet_washing','gardening')` | 6 صفوف مُرجَعة |
| 2 | تحقق من `is_active` لكل صف | جميعها `true` |
| 3 | تحقق من `group_slug` لكل صف | water_tank/sewage_tanker/tank_cleaning → `water_services`؛ dry_cleaning/carpet_washing → `cleaning`؛ gardening → `maintenance` |

**Expected Result:** 6 slugs موجودة ونشطة بـ group_slug صحيح.  
**Automation Candidate:** Yes

---

#### NCAT-002
**Name:** مجموعة "خدمات المياه" ظاهرة في قائمة التصنيفات  
**Priority:** High | **Type:** Functional  
**Preconditions:** client أو provider مسجّل دخول.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح شاشة "طلب جديد" أو قائمة التصنيفات | قائمة المجموعات تظهر |
| 2 | تصفّح المجموعات | مجموعة "خدمات المياه" موجودة كمجموعة مستقلة |
| 3 | اضغط على المجموعة | تظهر 3 خدمات: تنك مياه صالحة للشرب، صهريج مياه عادمة، تنظيف وتعقيم الخزانات |
| 4 | تحقق من الأيقونات | 🚰 لتنك المياه، 🚛 للصهريج، 🛢️ لتنظيف الخزانات |

**Expected Result:** المجموعة وخدماتها الثلاث ظاهرة بأيقونات صحيحة.  
**Automation Candidate:** No

---

#### NCAT-003
**Name:** إنشاء طلب "تنك مياه صالحة للشرب" بنجاح  
**Priority:** High | **Type:** Functional  
**Preconditions:** client مسجّل دخول؛ لا يوجد طلب مفتوح في نفس التصنيف.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح "طلب جديد" | شاشة الطلب تفتح |
| 2 | اختر تصنيف "تنك مياه صالحة للشرب" | الـ placeholder يظهر: "مثال: تنك مياه 2 متر مكعب" |
| 3 | أدخل عنواناً ووصفاً واختر المدينة | الحقول تقبل الإدخال |
| 4 | اضغط "إرسال الطلب" | الطلب يُحفظ بـ `category_slug = 'water_tank'` |
| 5 | تحقق من قائمة الطلبات | الطلب ظاهر بالتصنيف الصحيح |

**Expected Result:** الطلب يُنشأ بـ slug صحيح ويظهر في القائمة.  
**Automation Candidate:** No

---

#### NCAT-004
**Name:** إنشاء طلب "صهريج مياه عادمة" بنجاح  
**Priority:** High | **Type:** Functional  
**Preconditions:** client مسجّل دخول؛ لا يوجد طلب مفتوح في نفس التصنيف.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اختر تصنيف "صهريج مياه عادمة" | الـ placeholder يظهر: "مثال: تفريغ صهريج صرف صحي" |
| 2 | أكمل الطلب وأرسله | الطلب يُحفظ بـ `category_slug = 'sewage_tanker'` |
| 3 | تحقق من DB | صف في `requests` بـ slug صحيح |

**Expected Result:** الطلب يُنشأ بشكل صحيح.  
**Automation Candidate:** No

---

#### NCAT-005
**Name:** إنشاء طلب "تنظيف وتعقيم الخزانات" بنجاح  
**Priority:** High | **Type:** Functional  
**Preconditions:** client مسجّل دخول؛ لا يوجد طلب مفتوح في نفس التصنيف.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اختر تصنيف "تنظيف وتعقيم الخزانات" | الـ placeholder يظهر: "مثال: تنظيف وتعقيم خزان مياه سطح المنزل" |
| 2 | أكمل الطلب وأرسله | الطلب يُحفظ بـ `category_slug = 'tank_cleaning'` |

**Expected Result:** الطلب يُنشأ بشكل صحيح.  
**Automation Candidate:** No

---

#### NCAT-006
**Name:** إنشاء طلب "دراي كلين" بنجاح  
**Priority:** High | **Type:** Functional  
**Preconditions:** client مسجّل دخول؛ لا يوجد طلب مفتوح في نفس التصنيف.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اختر مجموعة "تنظيف ونقل" | الخدمات تظهر بما فيها "دراي كلين" |
| 2 | اختر "دراي كلين" | الـ placeholder يظهر: "مثال: تنظيف بدلة رسمية وعباءة" |
| 3 | أكمل الطلب وأرسله | الطلب يُحفظ بـ `category_slug = 'dry_cleaning'` |

**Expected Result:** الطلب يُنشأ بشكل صحيح تحت مجموعة تنظيف ونقل.  
**Automation Candidate:** No

---

#### NCAT-007
**Name:** إنشاء طلب "غسيل سجاد" بنجاح  
**Priority:** High | **Type:** Functional  
**Preconditions:** client مسجّل دخول؛ لا يوجد طلب مفتوح في نفس التصنيف.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اختر "غسيل سجاد" من مجموعة تنظيف ونقل | الـ placeholder: "مثال: غسيل سجادتين في غرفة المعيشة" |
| 2 | أكمل الطلب وأرسله | الطلب يُحفظ بـ `category_slug = 'carpet_washing'` |

**Expected Result:** الطلب يُنشأ بشكل صحيح.  
**Automation Candidate:** No

---

#### NCAT-008
**Name:** إنشاء طلب "تنسيق الحدائق والبستنة" بنجاح  
**Priority:** High | **Type:** Functional  
**Preconditions:** client مسجّل دخول؛ لا يوجد طلب مفتوح في نفس التصنيف.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اختر "تنسيق الحدائق والبستنة" من مجموعة صيانة المنازل | الـ placeholder: "مثال: تنسيق حديقة منزلية وزراعة نباتات" |
| 2 | أكمل الطلب وأرسله | الطلب يُحفظ بـ `category_slug = 'gardening'` |

**Expected Result:** الطلب يُنشأ بشكل صحيح تحت مجموعة صيانة المنازل.  
**Automation Candidate:** No

---

#### NCAT-009
**Name:** Provider — تسجيل تخصص في خدمات المياه  
**Priority:** Medium | **Type:** Functional  
**Preconditions:** provider مسجّل دخول؛ لديه اشتراك نشط.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح ملف المزود > إدارة التخصصات | قائمة التصنيفات تظهر |
| 2 | ابحث عن "خدمات المياه" أو "تنك مياه" | التصنيفات الثلاثة ظاهرة |
| 3 | اضف "تنك مياه صالحة للشرب" كتخصص | يُحفظ في `provider_categories` |
| 4 | أرسل طلب عميل بتصنيف `water_tank` | Provider يتلقى إشعار الطلب الجديد |

**Expected Result:** Provider يستطيع التخصص في خدمات المياه ويتلقى الطلبات.  
**Automation Candidate:** No

---

#### NCAT-010
**Name:** Placeholder توجيهي — التحقق من ظهوره لكل خدمة جديدة  
**Priority:** Medium | **Type:** UX  
**Preconditions:** client في شاشة "طلب جديد".

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اختر `water_tank` | حقل العنوان placeholder: "مثال: تنك مياه 2 متر مكعب" |
| 2 | اختر `sewage_tanker` | "مثال: تفريغ صهريج صرف صحي" |
| 3 | اختر `tank_cleaning` | "مثال: تنظيف وتعقيم خزان مياه سطح المنزل" |
| 4 | اختر `dry_cleaning` | "مثال: تنظيف بدلة رسمية وعباءة" |
| 5 | اختر `carpet_washing` | "مثال: غسيل سجادتين في غرفة المعيشة" |
| 6 | اختر `gardening` | "مثال: تنسيق حديقة منزلية وزراعة نباتات" |

**Expected Result:** كل خدمة تُظهر placeholder مخصصاً وليس النص الافتراضي العام.  
**Automation Candidate:** No

---

#### NCAT-011
**Name:** تعدد اللغات — أسماء الخدمات الجديدة باللغتين  
**Priority:** Medium | **Type:** Localization  
**Preconditions:** التطبيق مُثبَّت بالعربية ثم يُغيَّر للإنجليزية.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اللغة عربية — افتح قائمة التصنيفات | "خدمات المياه"، "تنك مياه صالحة للشرب"، "صهريج مياه عادمة"، "تنظيف وتعقيم الخزانات"، "دراي كلين"، "غسيل سجاد"، "تنسيق الحدائق والبستنة" |
| 2 | غيّر اللغة للإنجليزية | "Water Services"، "Drinking Water Tank"، "Sewage Tanker"، "Water Tank Cleaning"، "Dry Cleaning"، "Carpet Washing"، "Landscaping & Gardening" |
| 3 | تحقق من عدم ظهور أي slug خام (مثل `water_tank`) | لا يوجد |

**Expected Result:** الترجمة صحيحة بالكاملة باللغتين بدون slugs خام.  
**Automation Candidate:** No

---

#### NCAT-012
**Name:** حد الطلب الواحد — category limit لا ينطبق عبر الخدمات الجديدة  
**Priority:** Medium | **Type:** Boundary  
**Preconditions:** client لديه طلب مفتوح في `water_tank`.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | حاول فتح طلب ثانٍ بنفس التصنيف `water_tank` | رسالة خطأ: "لديك طلب مفتوح في هذا التصنيف" |
| 2 | حاول فتح طلب في `sewage_tanker` (تصنيف مختلف) | الطلب يُقبل بدون خطأ |
| 3 | حاول فتح طلب في `dry_cleaning` | الطلب يُقبل بدون خطأ |

**Expected Result:** الحد يُطبَّق على مستوى التصنيف وليس المجموعة.  
**Automation Candidate:** No

---

#### NCAT-013
**Name:** إكسسوارات وزينة السيارات — ظهور التصنيف ونشر طلب  
**Priority:** High | **Type:** Functional  
**Preconditions:** مستخدم مسجّل كـ client.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تحقق في DB: `SELECT slug FROM service_categories WHERE slug = 'car_accessories'` | صف واحد مرجَع |
| 2 | افتح "طلب جديد" — تصنيف "صيانة السيارات" | "إكسسوارات وزينة السيارات" ظاهرة في القائمة مع أيقونة 🏎️ |
| 3 | اختر التصنيف وأكمل الطلب | Placeholder يظهر: "مثال: تركيب تلميح زجاجي وإضاءة LED داخلية" |
| 4 | انشر الطلب | الطلب يُنشر بنجاح بتصنيف `car_accessories` |
| 5 | افتح شاشة البحث/الرئيسية — مزود تخصصه `car_accessories` | يرى الطلب في الفيد |
| 6 | تحقق من الاسم العربي في كل شاشة (الرئيسية، تفاصيل الطلب، البطاقة) | "إكسسوارات وزينة السيارات" — لا يوجد slug خام |

**Expected Result:** الخدمة ظاهرة ومشغّلة في الـ 3 مصادر (DB + i18n + categories.ts).  
**Automation Candidate:** No

---

---

## 27. DEMO — Provider Demo Request Card

> شاشة المزود الجديد — بطاقة الطلب التجريبي (onboarding demo request card)

---

#### DEMO-001
**Name:** عرض اسم التصنيف بالعربية بدلاً من الـ slug الخام  
**Priority:** High | **Type:** Functional / Regression  
**Preconditions:** مزود جديد سجّل للتو ودخل شاشة الرئيسية. بطاقة الطلب التجريبي ظاهرة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | انظر إلى قسم معلومات التصنيف في بطاقة الطلب التجريبي | يظهر اسم عربي مثل "سباكة" أو "كهرباء" أو "تنظيف" |
| 2 | تحقق من عدم ظهور slug خام مثل `plumbing` أو `electrical` | لا يوجد slug خام |
| 3 | كرر على أجهزة مختلفة (iOS/Android) | النتيجة مطابقة |

**Expected Result:** اسم التصنيف يظهر دائماً بالعربية من `name_ar`، وليس الـ slug.  
**Automation Candidate:** No  
**Regression Trigger:** أي تعديل على `DemoRequestCard` أو `getCategoryBySlug`.

---

#### DEMO-002
**Name:** أيقونة التصنيف تظهر صحيحاً في بطاقة الطلب التجريبي  
**Priority:** Medium | **Type:** Functional  
**Preconditions:** بطاقة الطلب التجريبي ظاهرة مع تصنيف محدد.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | لاحظ الأيقونة بجانب اسم التصنيف | تظهر أيقونة ذات صلة (مثل 🚿 لسباكة، ⚡ لكهرباء) |
| 2 | تحقق أن الأيقونة ليست 🔧 (fallback) لتصنيف معروف | لا يظهر 🔧 إلا إذا كان التصنيف غير موجود في ICON_MAP |
| 3 | افحص تصنيفات متعددة بإعادة تسجيل مزودين جدد | كل تصنيف يُظهر أيقونته الصحيحة |

**Expected Result:** الأيقونة مطابقة لـ `ICON_MAP[category.icon]`.  
**Automation Candidate:** No

---

#### DEMO-003
**Name:** خلفية بطاقة الطلب التجريبي تتبع ثيم التطبيق (light/dark)  
**Priority:** High | **Type:** Visual / Regression  
**Preconditions:** مزود جديد، بطاقة الطلب التجريبي ظاهرة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | شغّل التطبيق في الوضع الفاتح (Light Mode) | بطاقة الطلب التجريبي بخلفية فاتحة دافئة (`colors.surface`) |
| 2 | شغّل التطبيق في الوضع الداكن (Dark Mode) | بطاقة الطلب التجريبي بخلفية داكنة تنسجم مع الخلفية العامة |
| 3 | تحقق من غياب الخلفية البحرية الداكنة `#1E1B4B` في أي وضع | لا يوجد |
| 4 | تحقق أن الحدود (border) بلون indigo `#6366F1` يميز البطاقة بوضوح | Border ظاهر وواضح |

**Expected Result:** البطاقة تتكيف مع ثيم التطبيق في الوضعين.  
**Automation Candidate:** No  
**Regression Trigger:** أي تعديل على `createDemoStyles` أو `DEMO_DIM/DEMO_BORDER`.

---

#### DEMO-004
**Name:** نص "فهمت، إخفاء نهائياً" مقروء في الوضعين  
**Priority:** Medium | **Type:** Accessibility / Visual  
**Preconditions:** بطاقة الطلب التجريبي ظاهرة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | في Light Mode — انظر إلى زر التجاهل (skip) | النص مقروء بتباين كافٍ على الخلفية الفاتحة |
| 2 | في Dark Mode — انظر إلى نفس الزر | النص مقروء بتباين كافٍ على الخلفية الداكنة |
| 3 | تحقق أن اللون ليس `#475569` ثابتاً (hardcoded) | اللون يتبع `colors.textSecondary` |

**Expected Result:** نص التجاهل مقروء في كلا الوضعين بدون hardcoded color.  
**Automation Candidate:** No

---

#### DEMO-005
**Name:** الطلب التجريبي يطابق تخصص المزود المسجّل  
**Priority:** High | **Type:** Onboarding Quality / Functional  
**Preconditions:** مزود جديد تخصصه "كهرباء" (`electrical`).

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | أكمل تسجيل المزود بتصنيف "كهرباء" | يُنشأ demo request تلقائياً |
| 2 | انتظر ساعة واحدة ثم افتح التطبيق | بطاقة الطلب التجريبي تظهر بطلب من تصنيف "كهرباء" |
| 3 | كرر بتسجيل مزود تخصصه "سباكة" | الطلب التجريبي عن "سباكة" |
| 4 | كرر بتسجيل مزود تخصصه "تكييف" | الطلب التجريبي عن "تكييف" |
| 5 | كرر بمزود تخصصه تصنيف نادر غير موجود في قاعدة demo_requests | يظهر طلب تجريبي عشوائي (fallback) بدون عطل |

**Expected Result:** الطلب التجريبي يطابق تخصص المزود في ≥ 90% من الحالات. تصنيفات ليس لها template → fallback عشوائي.  
**Automation Candidate:** No  
**Regression Trigger:** أي تعديل على `init_provider_demo` في migration 081.

---

#### DEMO-006
**Name:** نص صندوق المعلومات (info box) مقروء في Light Mode  
**Priority:** High | **Type:** Accessibility / Visual  
**Preconditions:** Light Mode مفعّل، بطاقة الطلب التجريبي ظاهرة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | انظر إلى صندوق المعلومات "ℹ️" | خلفية `colors.surfaceAlt` (فاتحة دافئة) |
| 2 | اقرأ النص داخل الصندوق | النص بلون indigo `DEMO_BORDER #4338CA` — مقروء على خلفية فاتحة |
| 3 | اقرأ سطر "✓ مجاني بالكامل" | لون أخضر داكن `#16A34A` — مقروء |

**Expected Result:** كل النصوص داخل صندوق المعلومات مقروءة في Light Mode.  
**Automation Candidate:** No

---

#### DEMO-007
**Name:** نص صندوق المعلومات (info box) مقروء في Dark Mode  
**Priority:** High | **Type:** Accessibility / Visual  
**Preconditions:** Dark Mode مفعّل، بطاقة الطلب التجريبي ظاهرة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | انظر إلى صندوق المعلومات "ℹ️" | خلفية `colors.surfaceAlt` (داكنة) |
| 2 | اقرأ النص داخل الصندوق | النص بلون lavender `#A5B4FC` — مقروء على خلفية داكنة |
| 3 | اقرأ سطر "✓ مجاني بالكامل" | لون أخضر فاتح `#6EE7B7` — مقروء |

**Expected Result:** كل النصوص داخل صندوق المعلومات مقروءة في Dark Mode.  
**Automation Candidate:** No

---

#### DEMO-008
**Name:** حالة "تم تقديم العرض" تظهر صحيحاً بعد الإرسال  
**Priority:** Medium | **Type:** Functional / Visual  
**Preconditions:** مزود جديد، بطاقة الطلب التجريبي ظاهرة.

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اضغط "قدّم عرض تجريبي" | يفتح modal إدخال السعر |
| 2 | أدخل مبلغاً واضغط إرسال | تظهر بطاقة "حالة مكتملة" (completed state) |
| 3 | تحقق من ألوان البطاقة المكتملة في Light Mode | خلفية `colors.surface`، نص بلون أخضر داكن `#16A34A` |
| 4 | تحقق من ألوان البطاقة المكتملة في Dark Mode | خلفية `colors.surface`، نص بلون أخضر فاتح `#6EE7B7` |
| 5 | تحقق أن النص ليس مختفياً (لون على خلفية مشابهة) | كل النصوص مرئية |

**Expected Result:** حالة "مكتملة" مقروءة وجميلة في كلا الوضعين.  
**Automation Candidate:** No

---

## 28. FLAG — Provider Automatic Flagging & Admin Portal

### Overview
نظام المراقبة التلقائية للمزودين: DB triggers + cron + admin portal page.

---

#### FLAG-001
**Name:** DB trigger — تحديث التقييم يُطلق الفحص  
**Priority:** Critical | **Type:** Backend / Integration  
**Preconditions:** مزود لديه وظيفتان مكتملتان بتقييم < 2.5

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اضبط `client_rating = 1` على وظيفة مكتملة | تُطلق trigger `trg_flag_on_rating` |
| 2 | تحقق من `provider_flags` | سجل جديد بـ `reason = 'low_rating'` و `reviewed = false` |
| 3 | تحقق من `providers.is_flagged` | = `true` |
| 4 | تحقق من `providers.flag_count` | زاد بمقدار 1 |

**Expected Result:** بلاغ `low_rating` يُنشأ تلقائياً عند استيفاء الشرط.  
**Automation Candidate:** Yes

---

#### FLAG-002
**Name:** DB trigger — رفض العرض يُطلق الفحص  
**Priority:** Critical | **Type:** Backend / Integration  
**Preconditions:** مزود لديه 5+ عروض، نسبة رفض > 60%

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | غيّر حالة العرض إلى `rejected` | تُطلق trigger `trg_flag_on_bid_rejected` |
| 2 | تحقق من `provider_flags` | سجل `high_rejection` إذا استوفى الشرط |
| 3 | لا يتجاوز 60% | لا يُنشأ بلاغ |

**Expected Result:** بلاغ `high_rejection` يُنشأ فقط عند تجاوز الحد.  
**Automation Candidate:** Yes

---

#### FLAG-003
**Name:** DB trigger — تقديم شكوى يُطلق الفحص  
**Priority:** Critical | **Type:** Backend / Integration  
**Preconditions:** 3 مستخدمون مختلفون قدّموا شكوى ضد مزود

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | أدرج صف في `reports` يستهدف المزود | تُطلق trigger `trg_flag_on_report` |
| 2 | عدد الشاكين = 3 | سجل `complaints` يُنشأ |
| 3 | عدد الشاكين < 3 | لا بلاغ |
| 4 | المُبلَّغ عنه عميل وليس مزوداً | لا بلاغ |

**Expected Result:** بلاغ `complaints` يُنشأ عند 3 شاكين مختلفين فقط.  
**Automation Candidate:** Yes

---

#### FLAG-004
**Name:** pg_cron — فحص التخلي عن الوظيفة كل ساعة  
**Priority:** High | **Type:** Backend / Scheduled  
**Preconditions:** وظيفة بحالة `active` منذ 72+ ساعة بدون `confirmed_at`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | شغّل `SELECT check_job_abandonment()` | يمسح الوظائف المتروكة |
| 2 | تحقق من `provider_flags` | سجل `job_abandonment` يُنشأ |
| 3 | شغّل الدالة مرة ثانية | لا يُنشأ سجل مكرر (per-job dedup) |
| 4 | تحقق من `details->>'job_id'` | يطابق الوظيفة الصحيحة |

**Expected Result:** كل وظيفة متروكة تُنشئ بلاغاً واحداً فقط.  
**Automation Candidate:** Yes

---

#### FLAG-005
**Name:** flag_provider — عدم تكرار البلاغ غير المراجع  
**Priority:** High | **Type:** Backend / Logic  
**Preconditions:** بلاغ `low_rating` غير مراجع موجود مسبقاً

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | استدعِ `flag_provider(provider_id, 'low_rating', ...)` | لا يُنشأ سجل جديد |
| 2 | راجع البلاغ الأول وامسحه | يُنشأ بلاغ جديد عند الاستدعاء التالي |

**Expected Result:** لا يتراكم نفس نوع البلاغ ما لم يُراجَع السابق.  
**Automation Candidate:** Yes

---

#### FLAG-006
**Name:** Admin portal — صفحة /provider-flags تُحمّل البلاغات  
**Priority:** Critical | **Type:** Admin UI / Functional  
**Preconditions:** مزود واحد على الأقل لديه بلاغ غير مراجع

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح `/provider-flags` في المتصفح | الصفحة تُحمّل |
| 2 | تحقق من Stats | 4 بطاقات إحصاء: قيد المراجعة / تحذير / إيقاف / تبرئة |
| 3 | تحقق من قائمة البلاغات | اسم المزود + نوع البلاغ + التفاصيل ظاهرة |
| 4 | فلترة "الكل" | تظهر البلاغات المراجعة أيضاً |

**Expected Result:** الصفحة تعرض البلاغات بشكل صحيح مع الفلاتر.  
**Automation Candidate:** No

---

#### FLAG-007
**Name:** Admin modal — اتخاذ قرار (تحذير)  
**Priority:** Critical | **Type:** Admin UI / Functional  
**Preconditions:** بلاغ غير مراجع ظاهر في الصفحة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اضغط "اتخاذ قرار" | يفتح modal |
| 2 | اختر "تحذير" | يتحدد بالون أصفر/برتقالي |
| 3 | اضغط "تأكيد" بدون ملاحظة | رسالة خطأ "ملاحظة الإدارة مطلوبة" |
| 4 | أدخل ملاحظة واضغط "تأكيد" | modal يُغلق، البلاغ يختفي من قائمة المراجعة |
| 5 | تحقق من `provider_flags` | `reviewed = true`, `action_taken = 'warned'` |
| 6 | تحقق من `providers.is_flagged` | إذا لا يوجد بلاغ آخر = `false` |

**Expected Result:** قرار "تحذير" يُسجَّل ويُنشئ إشعاراً للمزود.  
**Automation Candidate:** No

---

#### FLAG-008
**Name:** Admin modal — اتخاذ قرار (إيقاف مؤقت)  
**Priority:** Critical | **Type:** Admin UI / Functional  
**Preconditions:** بلاغ غير مراجع + مزود نشط

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح modal + اختر "إيقاف مؤقت" + أدخل ملاحظة | زر تأكيد يظهر باللون الأحمر |
| 2 | اضغط "تأكيد: إيقاف مؤقت" | يُنفَّذ القرار |
| 3 | تحقق من `providers.is_active` | = `false` |
| 4 | تحقق من `providers.suspended_at` | قيمة timestamp مضبوطة |
| 5 | تحقق من `provider_flags.action_taken` | = `'suspended'` |

**Expected Result:** الإيقاف يُطبَّق فورياً على المزود.  
**Automation Candidate:** No

---

#### FLAG-009
**Name:** Admin modal — اتخاذ قرار (تبرئة)  
**Priority:** High | **Type:** Admin UI / Functional  
**Preconditions:** بلاغ غير مراجع

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح modal + اختر "تبرئة" + أدخل ملاحظة | زر تأكيد أخضر |
| 2 | اضغط "تأكيد" | البلاغ يُوسَم مراجَع |
| 3 | تحقق من `action_taken` | = `'cleared'` |
| 4 | لا يُرسَل push notification للمزود عند التبرئة | صحيح — لا إشعار |

**Expected Result:** تبرئة هادئة بدون إشعار للمزود.  
**Automation Candidate:** No

---

#### FLAG-010
**Name:** Sidebar badge — يظهر العدد الصحيح  
**Priority:** High | **Type:** Admin UI / Visual  
**Preconditions:** بلاغات غير مراجعة موجودة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح أي صفحة في الأدمن | badge أحمر يظهر بجانب "مراقبة المزودين" في الـ sidebar |
| 2 | العدد = عدد البلاغات غير المراجعة | صحيح |
| 3 | راجِع جميع البلاغات | badge يختفي |
| 4 | تحقق بعد 30 ثانية بدون reload | badge يتحدث تلقائياً (polling كل 30s) |

**Expected Result:** Badge يعكس الحالة الحية في الوقت الفعلي.  
**Automation Candidate:** No

---

#### FLAG-011
**Name:** resolve_provider_flag — recalculates is_flagged  
**Priority:** High | **Type:** Backend / Logic  
**Preconditions:** مزود لديه بلاغان غير مراجعَين

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | راجِع البلاغ الأول | `providers.is_flagged` لا يزال `true` |
| 2 | راجِع البلاغ الثاني | `providers.is_flagged` = `false` |

**Expected Result:** `is_flagged` يتحدث بدقة بناءً على البلاغات المتبقية.  
**Automation Candidate:** Yes

---

#### FLAG-012
**Name:** get_unreviewed_flags_count — يعيد العدد الصحيح  
**Priority:** Medium | **Type:** Backend / API  
**Preconditions:** عدد محدد من البلاغات غير المراجعة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | استدعِ `SELECT get_unreviewed_flags_count()` | يطابق COUNT الفعلي |
| 2 | استدعِ `GET /api/flags/count` من المتصفح بدون session | 401 Unauthorized |
| 3 | استدعِ `GET /api/flags/count` مع session صالحة | `{ "count": N }` |

**Expected Result:** API يعيد العدد الصحيح ويحمي بالجلسة.  
**Automation Candidate:** Yes

---

---

## 29. ADMUIX — Admin Portal Visual Redesign

### Overview
التصميم الجديد للبوابة: نظام ألوان بنفسجي، Sidebar محسّن، TopBar كامل، Dashboard بمكونات SVG.

---

#### ADMUIX-001
**Name:** نظام الألوان البنفسجي يُطبَّق على كل الصفحات  
**Priority:** High | **Type:** Visual / UI  
**Preconditions:** تسجيل دخول للبوابة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح البوابة في المتصفح | الخلفية `#06040F` (بنفسجي عميق) |
| 2 | تحقق من لون الـ cards | `#0C091D` مع border بنفسجي خفيف |
| 3 | تنقل بين الصفحات المختلفة | نفس نظام الألوان في كل الصفحات |
| 4 | تحقق من الـ scrollbar | لون بنفسجي بدلاً من الرمادي |

**Expected Result:** نظام ألوان متسق في جميع الصفحات.  
**Automation Candidate:** No

---

#### ADMUIX-002
**Name:** Sidebar — icon pills ملوّنة + active state بنفسجي  
**Priority:** High | **Type:** Visual / UI  
**Preconditions:** تسجيل دخول

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تحقق من كل عنصر في الـ Sidebar | أيقونة في حلقة ملوّنة (كل عنصر بلون مختلف) |
| 2 | اضغط على "لوحة التحكم" | الـ active state بنفسجي مع border وdot |
| 3 | اضغط على "المزودون" | active state بنفسجي — inactive items رمادية |
| 4 | تحقق من بلوك المستخدم في footer | صورة + اسم + زر الخروج ظاهر |
| 5 | تحقق من الـ pulse dot بجانب اللوغو | نقطة خضراء متحركة ظاهرة |

**Expected Result:** Sidebar بصري احترافي مع تمييز واضح للصفحة النشطة.  
**Automation Candidate:** No

---

#### ADMUIX-003
**Name:** TopBar — بحث + عنوان الصفحة + معلومات المستخدم  
**Priority:** Medium | **Type:** Visual / UI  
**Preconditions:** تسجيل دخول

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تحقق من TopBar في الصفحة الرئيسية | أيقونة الصفحة + "لوحة التحكم" + التاريخ |
| 2 | انتقل لصفحة "المزودون" | العنوان يتغير إلى "إدارة المزودين" |
| 3 | تحقق من search bar | placeholder + اختصار ⌘K ظاهر |
| 4 | تحقق من avatar المستخدم | دائرة amber + "Eyad Admin" |

**Expected Result:** TopBar يعرض المعلومات الصحيحة لكل صفحة.  
**Automation Candidate:** No

---

#### ADMUIX-004
**Name:** Hero Section — ترحيب شخصي + AI Insight + أزرار سريعة  
**Priority:** High | **Type:** Visual / Functional  
**Preconditions:** تسجيل دخول، الوصول للصفحة الرئيسية

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح الصفحة الرئيسية | "مرحباً بك، إياد" مع gradient بنفسجي |
| 2 | تحقق من بطاقة AI Insight | نص ديناميكي يعكس عدد المستخدمين الجدد الفعلي |
| 3 | تحقق من الـ mini sparkline في AI card | خط بياني ذهبي ظاهر |
| 4 | اضغط "+ إنشاء طلب" | ينتقل لصفحة الطلبات `/requests` |
| 5 | اضغط "إضافة مزود" | ينتقل لصفحة المزودين `/providers` |
| 6 | اضغط "عرض التقارير" | ينتقل لصفحة التقارير `/reports` |

**Expected Result:** Hero section جذاب وظيفي مع تنقل صحيح.  
**Automation Candidate:** No

---

#### ADMUIX-005
**Name:** بطاقات KPI — أيقونات ملوّنة + trend badges + sparklines  
**Priority:** High | **Type:** Visual / Data  
**Preconditions:** بيانات موجودة في DB

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تحقق من 8 بطاقات KPI | كل بطاقة بأيقونة ملوّنة مختلفة |
| 2 | تحقق من الأرقام | تطابق البيانات الفعلية من Supabase |
| 3 | تحقق من trend badge | سهم ↑ أخضر عند وجود نمو |
| 4 | تحقق من sparkline SVG | خط بياني خفيف أسفل كل بطاقة |
| 5 | hover على بطاقة | border يتوهج بنفسجياً |

**Expected Result:** 8 بطاقات تعرض بيانات حقيقية بتصميم احترافي.  
**Automation Candidate:** No

---

#### ADMUIX-006
**Name:** Donut Chart — يعرض توزيع الطلبات ببيانات حقيقية  
**Priority:** High | **Type:** Visual / Data  
**Preconditions:** طلبات بحالات مختلفة موجودة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تحقق من Donut Chart | أقواس ملوّنة تمثل: مفتوح/نشط/مكتمل/أخرى |
| 2 | تحقق من Legend | 4 عناصر مع النسبة المئوية والعدد |
| 3 | تحقق من مجموع الأرقام | يساوي `totalRequests` الفعلي |
| 4 | DB فارغ (totalRequests = 0) | رسالة "لا توجد بيانات" بدلاً من Chart |
| 5 | تحقق من النص المركزي في الدائرة | العدد الإجمالي الصحيح |

**Expected Result:** Donut Chart دقيق ويعكس البيانات الحقيقية.  
**Automation Candidate:** No

---

#### ADMUIX-007
**Name:** Area Chart — معدل الإنجاز ينتهي بالقيمة الفعلية  
**Priority:** Medium | **Type:** Visual / Data  
**Preconditions:** وظائف مكتملة موجودة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تحقق من Area Chart | منحنى 30 يوم مع gradient بنفسجي |
| 2 | تحقق من الرقم الكبير | يساوي `completionRate` المحسوب فعلياً |
| 3 | النقطة الأخيرة في المنحنى | تحتوي على dot + glow بنفسجي |
| 4 | تسميات المحور الزمني | "اليوم" / "قبل 15 يوم" / "قبل 30 يوم" |

**Expected Result:** Chart بصري مع رقم الإنجاز الفعلي في البطاقة.  
**Automation Candidate:** No

---

#### ADMUIX-008
**Name:** Smart Alerts Panel — يعرض تنبيهات حقيقية  
**Priority:** Critical | **Type:** Functional / Data  
**Preconditions:** بيانات متنوعة في DB

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | طلبات طارئة نشطة موجودة | "🚨 X طلب طارئ نشط" باللون الأحمر |
| 2 | طلبات متوقفة +48 ساعة موجودة | "⚠️ X طلب بدون عروض +48 ساعة" |
| 3 | حسابات موقوفة موجودة | "🚫 X حساب مستخدم موقوف" |
| 4 | لا توجد تنبيهات | "✅ لا تنبيهات — النظام يعمل بشكل سليم" |
| 5 | اضغط على أي تنبيه | ينتقل للصفحة المرتبطة |
| 6 | تحقق من status indicators في الأسفل | "Supabase متصل" و "Expo Push نشط" |

**Expected Result:** Panel يعرض تنبيهات حقيقية وقابلة للنقر.  
**Automation Candidate:** No

---

#### ADMUIX-009
**Name:** Flags Badge في Sidebar يتحدث كل 30 ثانية  
**Priority:** High | **Type:** Functional / Realtime  
**Preconditions:** بلاغات غير مراجعة موجودة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح البوابة — بلاغات موجودة | badge أحمر بجانب "مراقبة المزودين" |
| 2 | راجِع جميع البلاغات | badge يختفي خلال 30 ثانية |
| 3 | تحقق من عدم الحاجة لـ Refresh | يتحدث تلقائياً بدون إعادة تحميل |

**Expected Result:** Badge يعكس الحالة الحقيقية تلقائياً.  
**Automation Candidate:** No

---

## 30. RT — Real-Time Features

### Overview
اختبار جميع الخصائص التي تعتمد على Supabase Realtime في التطبيق.

---

#### RT-001
**Name:** العروض تظهر فوراً على شاشة الطلب دون pull-to-refresh  
**Priority:** Critical | **Type:** Realtime / Functional  
**Preconditions:** جهازان — عميل على شاشة request-detail، مزود جاهز للتقديم

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | العميل يفتح طلباً بحالة `open` | شاشة تفاصيل الطلب مفتوحة |
| 2 | المزود يرسل عرضاً على نفس الطلب | بطاقة العرض تظهر فوراً على شاشة العميل |
| 3 | العميل لم يتحرك أو يسحب للأعلى | العرض وصل بدون أي فعل من العميل |
| 4 | تحقق من بيانات العرض | اسم المزود + السعر + التقييم صحيح |
| 5 | مزود ثانٍ يرسل عرضاً | يظهر العرض الثاني فوراً أيضاً |

**Expected Result:** كل عرض جديد يظهر فورياً بدون تدخل من العميل.  
**Automation Candidate:** No

---

#### RT-002
**Name:** لا تكرار في العروض بعد وصول Realtime + عودة للشاشة  
**Priority:** High | **Type:** Realtime / Data Integrity  
**Preconditions:** العميل على شاشة طلب مفتوح

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | مزود يرسل عرضاً | يظهر العرض فوراً عبر Realtime |
| 2 | العميل يغادر الشاشة ويعود | العرض يظهر مرة واحدة فقط (لا تكرار) |
| 3 | تحقق من عدد العروض | يطابق العدد الفعلي في DB |

**Expected Result:** deduplication guard يمنع العرض مرتين.  
**Automation Candidate:** No

---

#### RT-003
**Name:** Channel لا يعمل للطلبات المكتملة أو الملغاة  
**Priority:** High | **Type:** Realtime / Scope  
**Preconditions:** طلب بحالة `completed` أو `cancelled`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح طلباً بحالة `completed` | شاشة التفاصيل تفتح |
| 2 | تحقق من Supabase channels (DevTools) | لا يوجد channel `bids:${id}` مفتوح |
| 3 | افتح طلباً بحالة `cancelled` | نفس النتيجة — لا channel مفتوح |
| 4 | افتح طلباً بحالة `open` | channel `bids:${id}` مفتوح ونشط |

**Expected Result:** Channel يعمل فقط للحالات التي تقبل عروضاً.  
**Automation Candidate:** No

---

#### RT-004
**Name:** Channel يُغلق عند مغادرة الشاشة  
**Priority:** High | **Type:** Realtime / Memory Leak  
**Preconditions:** طلب مفتوح

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح request-detail لطلب `open` | channel `bids:${id}` نشط |
| 2 | اضغط "رجوع" للخروج من الشاشة | channel يُغلق فوراً (cleanup) |
| 3 | افتح طلباً مختلفاً | channel جديد بـ id مختلف يفتح |
| 4 | تأكد لا يوجد channel قديم | الـ channel السابق لم يبقَ مفتوحاً |

**Expected Result:** لا memory leaks — كل channel يُغلق عند unmount.  
**Automation Candidate:** No

---

#### RT-005
**Name:** التحقق من باقي الخصائص Realtime الموجودة مسبقاً  
**Priority:** Critical | **Type:** Realtime / Regression  
**Preconditions:** جهازان لكل اختبار

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | مزود يرسل رسالة في الشات | تظهر للعميل فوراً دون refresh ✅ |
| 2 | عميل يقبل عرض | يصل للمزود فوراً (job INSERT) ✅ |
| 3 | مزود يضع كود التأكيد | يظهر للعميل فوراً ✅ |
| 4 | مزود يؤكد خلال Grace Period | شاشة العميل تتقدم تلقائياً ✅ |
| 5 | Admin يعدّل رصيد مزود | رصيد المزود يتحدث في التطبيق فوراً ✅ |
| 6 | notification جديد | badge العدد يزيد فوراً ✅ |

**Expected Result:** جميع الخصائص Realtime تعمل بدون انقطاع.  
**Automation Candidate:** No

---

---

## 31. ANTF — Admin Notifications (Email + SMS)

**الوصف:** نظام إشعارات الأدمن — 9 أنواع عبر Resend (إيميل) و Unifonic (SMS)  
**الملفات:** `supabase/functions/notify-admin/index.ts` · `supabase/migrations/084_admin_notifications.sql`

---

#### ANTF-001
**Name:** إشعار CliQ — إيميل + SMS عند طلب دفع جديد  
**Priority:** Critical | **Type:** Notification / Financial  
**Preconditions:** المزود يختار باقة مدفوعة، RESEND_API_KEY + ADMIN_EMAIL + ADMIN_PHONE مضبوطة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | مزود يختار باقة "Pro" ويضغط "اشترك الآن" | تُنشأ تذكرة دعم بـ `category='payment'` |
| 2 | DB trigger `trg_notify_admin_cliq_payment` يُطلق | `invoke_notify_admin('cliq_payment', ...)` يُستدعى |
| 3 | Edge Function `notify-admin` تُستدعى | ترسل إيميل + SMS للأدمن |
| 4 | تحقق من صندوق البريد | إيميل بعنوان "💳 طلب دفع CliQ جديد — Pro (12 د.أ)" يصل خلال دقيقة |
| 5 | تحقق من هاتف الأدمن | SMS يصل: "وسيط 💳: طلب CliQ من [اسم]..." |
| 6 | محتوى الإيميل | يحتوي اسم المزود، الهاتف، اسم الباقة، المبلغ، رابط التذكرة |

**Expected Result:** إيميل + SMS يصلان فورياً عند كل طلب CliQ.  
**Automation Candidate:** No

---

#### ANTF-002
**Name:** إشعار تذكرة طارئة — إيميل + SMS  
**Priority:** Critical | **Type:** Notification / Support  
**Preconditions:** مستخدم يفتح تذكرة بـ `priority='urgent'` (غير Payment)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | عميل يفتح تذكرة دعم طارئة بفئة "حساب" | تُنشأ التذكرة |
| 2 | Trigger يُطلق | `notify-admin` يُستدعى بـ `urgent_ticket` |
| 3 | الأدمن يتلقى إيميل + SMS | بعنوان "🚨 تذكرة دعم طارئة" |
| 4 | CliQ payment لا يُطلق urgent_ticket | الـ trigger يتحقق: `category != 'payment'` |

**Expected Result:** فصل صحيح: Payment يُطلق ANTF-001، الطارئة الأخرى تُطلق ANTF-002.  
**Automation Candidate:** No

---

#### ANTF-003
**Name:** إشعار بلاغ خطير — إيميل فوري (abusive / no_show)  
**Priority:** Critical | **Type:** Notification / Safety  
**Preconditions:** مستخدم يقدم بلاغاً من نوع `abusive` أو `no_show`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | عميل يبلغ عن مزود بنوع `abusive` | RPC `submit_report` يُدرج في `reports` |
| 2 | Trigger `trg_notify_admin_abuse_critical` يُطلق | Edge Function تُستدعى |
| 3 | الأدمن يتلقى إيميل | يحتوي اسم المُبلَّغ عنه، المُبلِّغ، النوع، الوصف |
| 4 | بلاغ `spam` أو `fake_bid` | لا يُطلق هذا الـ trigger (يذهب لـ ANTF-008) |

**Expected Result:** فقط abusive و no_show تُرسل فوراً.  
**Automation Candidate:** No

---

#### ANTF-004
**Name:** إشعار علم مزود جديد — إيميل فوري  
**Priority:** High | **Type:** Notification / Quality  
**Preconditions:** trigger `trg_flag_on_rating` أو `trg_flag_on_bid_rejected` يُطلق علماً جديداً

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | عميل يقيّم مزوداً بـ 1 نجمة (avg < 2.5) | `flag_provider` يُدرج في `provider_flags` |
| 2 | Trigger `trg_notify_admin_provider_flag` يُطلق | Email يُرسل للأدمن |
| 3 | الإيميل يحتوي | اسم المزود، الهاتف، السبب (low_rating)، التفاصيل (avg_rating, rated_jobs) |
| 4 | نفس المزود يحصل على علم ثانٍ لنفس السبب | `flag_provider` تتجاهله (dedup guard) — لا إيميل مكرر |

**Expected Result:** إيميل واحد لكل علم جديد فريد.  
**Automation Candidate:** No

---

#### ANTF-005
**Name:** إشعار إلغاءات متكررة — إيميل فوري  
**Priority:** High | **Type:** Notification / Abuse Prevention  
**Preconditions:** مستخدم يصل لـ 3 إلغاءات في الشهر

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | مستخدم يلغي 3 مهام في الشهر الجاري | `fn_check_cancellation_abuse` يُدرج في `admin_alerts` |
| 2 | Trigger `trg_notify_admin_cancellation_abuse` يُطلق | Email يُرسل للأدمن |
| 3 | الإيميل يحتوي | اسم المستخدم، الهاتف، العدد، الشهر |
| 4 | إلغاء رابع نفس الشهر | لا trigger ثانٍ (fn_check_cancellation_abuse تُطلق عند count=3 فقط) |

**Expected Result:** إيميل واحد عند بلوغ الحد.  
**Automation Candidate:** No

---

#### ANTF-006
**Name:** إشعار طلب طارئ بدون عروض +2h — إيميل (cron كل 30 دقيقة)  
**Priority:** High | **Type:** Notification / Operations  
**Preconditions:** طلب طارئ `is_urgent=true` مفتوح منذ أكثر من ساعتين بدون عروض

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | pg_cron يُطلق `urgent_no_bids` كل 30 دقيقة | Edge Function تبحث عن طلبات مؤهلة |
| 2 | يوجد طلب طارئ منذ 2.5h بدون عروض | يُضمَّن في الإيميل |
| 3 | إيميل يُرسل للأدمن | جدول يحتوي العنوان، المدينة، عدد الساعات |
| 4 | `admin_urgency_notified_at` يُحدَّث | الطلب لا يُعاد إرساله في الدورة التالية |
| 5 | طلب طارئ منذ 1.5h | لا يُضمَّن (شرط 2h لم يُستوَفَ بعد) |

**Expected Result:** الأدمن يعرف عن الطلبات الطارئة الراكدة دون إرسال مكرر.  
**Automation Candidate:** No

---

#### ANTF-007
**Name:** تجميع تذاكر الدعم العادية — إيميل كل ساعة  
**Priority:** Medium | **Type:** Notification / Support  
**Preconditions:** تذاكر دعم جديدة بـ `priority='normal'`، `category != 'payment'`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | 3 تذاكر دعم عادية تُفتح خلال ساعة | كلها بـ `admin_notified_at = null` |
| 2 | pg_cron يُطلق `normal_tickets` | Edge Function تجمعها في إيميل واحد |
| 3 | إيميل يُرسل: "3 تذاكر دعم جديدة" | جدول بالمستخدمين والمواضيع والفئات |
| 4 | `admin_notified_at` يُحدَّث على الـ 3 | لا تُعاد في الساعة التالية |
| 5 | لا تذاكر جديدة | لا إيميل يُرسل |

**Expected Result:** تجميع ذكي يمنع إيميلاً لكل تذكرة.  
**Automation Candidate:** No

---

#### ANTF-008
**Name:** تجميع البلاغات الاعتيادية — إيميل كل ساعتين  
**Priority:** Medium | **Type:** Notification / Safety  
**Preconditions:** بلاغات جديدة من نوع `spam`، `fake_bid`، أو `other`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | 5 بلاغات spam تُقدَّم خلال ساعتين | كلها `admin_notified_at = null` |
| 2 | pg_cron يُطلق `reports_batch` | Edge Function تجمعها |
| 3 | إيميل: "5 بلاغات جديدة تستحق المراجعة" | جدول بالمُبلَّغ عنهم والأنواع |
| 4 | `admin_notified_at` يُحدَّث | لا تكرار |

**Expected Result:** تجميع صحيح لـ spam/fake_bid/other فقط.  
**Automation Candidate:** No

---

#### ANTF-009
**Name:** الملخص اليومي — إيميل في 8:00 صباحاً (توقيت عمّان)  
**Priority:** Medium | **Type:** Notification / Digest  
**Preconditions:** pg_cron مضبوط على 05:00 UTC (= 08:00 عمّان)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | الساعة 05:00 UTC | cron يُطلق `daily_digest` |
| 2 | Edge Function تحسب المقاييس | عملاء جدد، مزودون، طلبات، مهام مكتملة في آخر 24h |
| 3 | إيميل يُرسل | جدولان: "النشاط — آخر 24 ساعة" و"يحتاج انتباهاً" |
| 4 | يوم بدون نشاط | الإيميل يُرسل بأصفار (لا يتوقف) |
| 5 | الأرقام الحمراء | تذاكر مفتوحة، أعلام معلقة، بلاغات معلقة، طلبات طارئة نشطة |

**Expected Result:** الأدمن يبدأ يومه بصورة كاملة عن المنصة.  
**Automation Candidate:** No

---

#### ANTF-010
**Name:** مقاومة الفشل — Missing Secrets لا تُوقف النظام  
**Priority:** High | **Type:** Resilience  
**Preconditions:** أحد الـ secrets غير مضبوط

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | RESEND_API_KEY فارغ | الـ function تُسجل warning وتعود بدون خطأ |
| 2 | ADMIN_PHONE فارغ | SMS يُتخطى، الإيميل يُرسل بشكل طبيعي |
| 3 | supabase_url غير مضبوط في DB | `invoke_notify_admin` تُطلق RAISE WARNING فقط |
| 4 | Resend API يُرجع 4xx | الخطأ يُسجَّل في logs — لا crash في العملية الرئيسية |

**Expected Result:** الإشعارات non-blocking — فشلها لا يؤثر على المستخدم أو DB.  
**Automation Candidate:** No

---

---

## 32. LIFECYCLE — Automated Lifecycle Notifications

### High-Risk Areas
- Tracking columns must prevent duplicate sends (at-most-once delivery)
- `update_last_seen()` must be called by the app on launch to power the reengagement query
- Bilingual copy (AR/EN) must match the user's `lang` preference

---

#### LIFECYCLE-001
**Name:** مزود جديد لم يقدّم أي عرض — تنبيه بعد 48 ساعة  
**Priority:** Critical | **Type:** Functional / Automation  
**Preconditions:** مزود جديد مسجّل منذ 50 ساعة، لم يقدّم أي عرض حتى الآن، `bid_reminder_sent_at IS NULL`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | cron يُطلق notify-lifecycle في 06:00 UTC | `_lc_bid_reminder_targets()` تُرجع المزود |
| 2 | `bid_reminder_sent_at` يُحدَّث قبل الإرسال | لا تكرار حتى لو فشل الإرسال |
| 3 | Expo push يُرسَل إلى token المزود | العنوان: "💼 قدّم عرضك الأول!" (أو EN بحسب lang) |
| 4 | إشعار in-app يُضاف إلى notifications | screen = `providerFeed` |

**Expected Result:** المزود يتلقى تنبيهاً واحداً بالضبط بعد 48–72 ساعة من التسجيل.  
**Automation Candidate:** No

---

#### LIFECYCLE-002
**Name:** مزود قدّم عرضاً خلال الـ 48 ساعة — لا تنبيه  
**Priority:** High | **Type:** Negative  
**Preconditions:** مزود مسجّل منذ 50 ساعة، لديه عرض واحد على الأقل في جدول `bids`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | cron يُطلق notify-lifecycle | `_lc_bid_reminder_targets()` تستثني المزود (NOT EXISTS bids) |
| 2 | لا push، لا in-app، لا تحديث للعمود | المزود لا يتلقى أي شيء |

**Expected Result:** المزودون النشطون لا يُزعجون بتنبيهات غير ضرورية.  
**Automation Candidate:** No

---

#### LIFECYCLE-003
**Name:** عميل جديد لم ينشر طلباً — تنبيه بعد 24 ساعة  
**Priority:** Critical | **Type:** Functional / Automation  
**Preconditions:** عميل مسجّل منذ 30 ساعة، لا طلبات له، `client_onboarding_sent_at IS NULL`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | cron يُطلق notify-lifecycle | `_lc_client_onboarding_targets()` تُرجع العميل |
| 2 | `client_onboarding_sent_at` يُحدَّث | حماية من التكرار |
| 3 | Expo push يُرسَل | "🔧 أنشئ طلبك الأول!" |
| 4 | in-app في notifications | screen = `newRequest` |

**Expected Result:** العميل يتلقى تذكيراً لطيفاً بعد أول 24 ساعة بدون نشاط.  
**Automation Candidate:** No

---

#### LIFECYCLE-004
**Name:** عميل نشر طلباً — لا تنبيه  
**Priority:** High | **Type:** Negative  
**Preconditions:** عميل مسجّل منذ 30 ساعة، لديه طلب واحد في `requests`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | cron يُطلق notify-lifecycle | العميل مستثنى من `_lc_client_onboarding_targets()` |
| 2 | لا شيء يُرسَل | |

**Expected Result:** العملاء النشطون لا يتلقون تنبيه الـ onboarding.  
**Automation Candidate:** No

---

#### LIFECYCLE-005
**Name:** مهمة مكتملة بدون تقييم — تذكير للعميل بعد 24 ساعة  
**Priority:** High | **Type:** Functional / Automation  
**Preconditions:** مهمة `status='completed'`، `confirmed_at` منذ 30 ساعة، `client_rating IS NULL`، `rating_reminder_sent_at IS NULL`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | cron يُطلق notify-lifecycle | `_lc_rating_reminder_targets()` تُرجع المهمة |
| 2 | `rating_reminder_sent_at` يُحدَّث على jobs | |
| 3 | push للعميل | "⭐ قيّم مزوّد الخدمة" |
| 4 | in-app يحتوي metadata: { job_id } | screen = `jobDetail` |

**Expected Result:** العميل يُذكَّر بالتقييم مرة واحدة فقط.  
**Automation Candidate:** No

---

#### LIFECYCLE-006
**Name:** مهمة مقيّمة — لا تذكير بالتقييم  
**Priority:** High | **Type:** Negative  
**Preconditions:** مهمة مكتملة منذ 30 ساعة، `client_rating IS NOT NULL`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | cron يُطلق notify-lifecycle | المهمة مستثناة من `_lc_rating_reminder_targets()` |
| 2 | لا شيء يُرسَل | |

**Expected Result:** لا تنبيهات مكررة للمهام المقيّمة.  
**Automation Candidate:** No

---

#### LIFECYCLE-007
**Name:** مزود جديد بدون بورتفوليو — تذكير بعد 7 أيام  
**Priority:** High | **Type:** Functional / Automation  
**Preconditions:** مزود مسجّل منذ 9 أيام، لا صفوف في `portfolio_items`، `portfolio_reminder_sent_at IS NULL`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | cron يُطلق notify-lifecycle | `_lc_portfolio_reminder_targets()` تُرجع المزود |
| 2 | `portfolio_reminder_sent_at` يُحدَّث | |
| 3 | push للمزود | "📸 أضف نماذج من أعمالك" |
| 4 | in-app | screen = `providerProfile` |

**Expected Result:** المزود يُحفَّز على بناء بورتفوليو بعد أسبوع واحد.  
**Automation Candidate:** No

---

#### LIFECYCLE-008
**Name:** مستخدم خامل 21 يوماً — رسالة إعادة تفعيل  
**Priority:** High | **Type:** Functional / Automation  
**Preconditions:** مستخدم (عميل أو مزود)، `COALESCE(last_seen_at, created_at) < NOW() - 21 days`، `reengagement_sent_at IS NULL`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | cron يُطلق notify-lifecycle | `_lc_reengagement_targets()` تُرجع المستخدم |
| 2 | `reengagement_sent_at` يُحدَّث | |
| 3 | push مخصص بحسب الدور | مزود: "👋 طلبات جديدة بانتظارك!" — عميل: "👋 تحتاج خدمة؟ نحن هنا!" |
| 4 | in-app | screen = `home` |

**Expected Result:** رسائل إعادة التفعيل مناسبة لدور المستخدم ولغته.  
**Automation Candidate:** No

---

#### LIFECYCLE-009
**Name:** update_last_seen() تُحدّث العمود عند فتح التطبيق  
**Priority:** Medium | **Type:** Functional  
**Preconditions:** مستخدم مصادق، التطبيق مفتوح حديثاً

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | التطبيق يستدعي `update_last_seen()` عند التهيئة | `users.last_seen_at = NOW()` للمستخدم الحالي |
| 2 | استدعاء ثاني بعد ساعة | القيمة تُحدَّث مجدداً |
| 3 | محاولة تحديث مستخدم آخر | SECURITY DEFINER يمنعه — يؤثر على `auth.uid()` فقط |

**Expected Result:** `last_seen_at` يعكس آخر نشاط حقيقي للمستخدم.  
**Automation Candidate:** No

---

#### LIFECYCLE-010
**Name:** tracking columns تمنع التكرار  
**Priority:** High | **Type:** Resilience  
**Preconditions:** جميع الـ tracking columns مُعيّنة لمستخدم ما

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | cron يُطلق notify-lifecycle ثانية | كل query تستثني المستخدمين الذين لديهم tracking column مُعيّن |
| 2 | لا إرسال مكرر لأي من الـ 5 أحداث | |
| 3 | الأعمدة لا تُعاد إلى NULL تلقائياً | لا خطر من إعادة الإرسال بسبب reset |

**Expected Result:** كل مستخدم يتلقى كل نوع من الإشعارات مرة واحدة بالضبط.  
**Automation Candidate:** No

---

#### LIFECYCLE-011
**Name:** مستخدم بدون push token — in-app فقط  
**Priority:** Medium | **Type:** Edge Case  
**Preconditions:** مستخدم مؤهل للتنبيه، لا سجل له في `push_tokens`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | cron يُطلق notify-lifecycle | token = NULL في نتيجة query |
| 2 | لا push يُرسَل (filter على `r.token`) | |
| 3 | in-app يُدرج بشكل طبيعي | المستخدم يراه عند عودته للتطبيق |
| 4 | tracking column يُحدَّث | لا تكرار |

**Expected Result:** الغياب عن push لا يمنع الإشعار in-app.  
**Automation Candidate:** No

---

#### LIFECYCLE-012
**Name:** cron يومي 06:00 UTC — جدولة صحيحة  
**Priority:** Medium | **Type:** Infrastructure  
**Preconditions:** pg_cron مُفعَّل، `app.settings.supabase_url` مضبوط

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تحقق من `cron.job` في Supabase Dashboard | يظهر `notify-lifecycle-daily` بجدول `0 6 * * *` |
| 2 | `app.settings.supabase_url` غير مضبوط | `_invoke_notify_lifecycle()` تُطلق RAISE WARNING وتعود بهدوء |
| 3 | Edge Function تُرجع 200 | response: `{ ok: true, results: [...] }` |
| 4 | فحص logs في Supabase Dashboard | كل handler يظهر مع عدد الصفوف المُرسَلة |

**Expected Result:** الـ cron يعمل يومياً بدون تدخل يدوي، ويُسجّل نتائج كل handler.  
**Automation Candidate:** No

---

---

## 33. NTGTG — Manual Targeted Broadcast (Enhanced Segments)

### High-Risk Areas
- `estimateAudience` must match the actual IDs sent in `sendBroadcast` (same `resolveSegmentIds`)
- Zero-audience guard: الإرسال مُعطَّل عند العدد = 0
- تصفية المدينة: مُفعَّلة فقط للقطاعات التي تدعمها

---

#### NTGTG-001
**Name:** تقدير الجمهور — يتحدث تلقائياً عند تغيير القطاع  
**Priority:** High | **Type:** Functional / UI  
**Preconditions:** صفحة الإشعارات مفتوحة في لوحة الأدمن

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | الأدمن يختار "منتهو الاشتراك — أقل من 30 يوم" | بعد 400ms يظهر العدد: "X مستخدم" |
| 2 | يغيّر إلى "مشتركون بلا بورتفوليو" | العدد يتحدث |
| 3 | يغيّر المدينة | العدد يتحدث مجدداً |
| 4 | لا مستخدمون في القطاع | العدد يظهر بالأحمر: "0 مستخدم" |

**Expected Result:** الأدمن يعرف حجم الجمهور قبل الإرسال.  
**Automation Candidate:** No

---

#### NTGTG-002
**Name:** حماية الإرسال الفارغ — زر معطَّل عند 0 مستخدمين  
**Priority:** Critical | **Type:** Negative  
**Preconditions:** قطاع يُرجع 0 مستخدمين (مثلاً مدينة بلا مزودين جدد)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | estimate = 0 | زر "إرسال الإشعار" يصبح معطَّلاً (opacity-40) |
| 2 | محاولة النقر على الزر | لا شيء يحدث (disabled) |
| 3 | إدخال عنوان ونص ثم الضغط على Enter | رسالة: "لا يوجد مستخدمون في هذا القطاع" |

**Expected Result:** لا يمكن إرسال إشعار فارغ الجمهور.  
**Automation Candidate:** No

---

#### NTGTG-003
**Name:** قطاع "منتهو الاشتراك" — المدى الزمني صحيح  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** مزودون بـ `subscription_ends` في نطاقات مختلفة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | قطاع "منتهو الاشتراك — أقل من 30 يوم" | يشمل فقط من `subscription_ends` بين اليوم - 30 يوم واليوم |
| 2 | قطاع "خاملون 31-90 يوم" | يشمل فقط من `subscription_ends` بين اليوم - 90 يوم واليوم - 30 يوم |
| 3 | مزود بـ `subscription_ends = NULL` | لا يظهر في أي من القطاعين |
| 4 | مزود `is_subscribed = true` | لا يظهر في قطاعي الانتهاء |

**Expected Result:** الفصل الزمني بين القطاعين دقيق ولا تداخل.  
**Automation Candidate:** No

---

#### NTGTG-004
**Name:** قطاع "مشتركون بلا بورتفوليو" — الفلتر صحيح  
**Priority:** High | **Type:** Functional  
**Preconditions:** مزودون مشتركون — بعضهم لديه portfolio_items والبعض لا

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اختيار "مشتركون بلا بورتفوليو" | يظهر فقط من `is_subscribed=true` ولا سجلات في `portfolio_items` |
| 2 | مزود أضاف عنصراً واحداً في البورتفوليو | لا يظهر في القطاع |
| 3 | مزود غير مشترك بلا بورتفوليو | لا يظهر (القطاع للمشتركين فقط) |

**Expected Result:** الجمهور المستهدف هم المشتركون الذين يحتاجون تحفيزاً لإضافة بورتفوليو.  
**Automation Candidate:** No

---

#### NTGTG-005
**Name:** قطاع "غير نشطين" — يعتمد على last_seen_at مع fallback لـ created_at  
**Priority:** High | **Type:** Functional  
**Preconditions:** مستخدمون بحالات مختلفة لـ last_seen_at

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | مستخدم بـ `last_seen_at = NULL` و `created_at` قبل 22 يوماً | يظهر في القطاع |
| 2 | مستخدم بـ `last_seen_at` قبل 22 يوماً | يظهر في القطاع |
| 3 | مستخدم بـ `last_seen_at` قبل 10 أيام | لا يظهر |
| 4 | مستخدم بدور `admin` | لا يظهر (القطاع لـ client/provider فقط) |

**Expected Result:** الفلترة الثنائية (NULL + تاريخ قديم) تعمل بدون تكرار في النتائج.  
**Automation Candidate:** No

---

#### NTGTG-006
**Name:** تصفية المدينة — مُفعَّلة فقط للقطاعات الداعمة  
**Priority:** High | **Type:** UI / Functional  
**Preconditions:** صفحة الإشعارات مفتوحة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اختيار "مشتركون بلا بورتفوليو" | dropdown المدينة يصبح معطَّلاً (opacity-40) |
| 2 | اختيار "مزودون جدد" | dropdown المدينة يصبح مفعَّلاً |
| 3 | اختيار مدينة "إربد" مع "مزودون جدد" | estimateAudience يُرسَل بـ city="إربد" |
| 4 | التبديل لقطاع لا يدعم المدينة | city تُصفَّر تلقائياً |

**Expected Result:** فلتر المدينة لا يظهر في الـ payload للقطاعات غير الداعمة.  
**Automation Candidate:** No

---

#### NTGTG-007
**Name:** إرسال ناجح — in-app + push لكل المستهدفين  
**Priority:** High | **Type:** Integration  
**Preconditions:** قطاع يملك مستخدمين، بعضهم لديهم push_tokens

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | الأدمن يملأ العنوان والنص ويضغط "إرسال" | `sendBroadcast` يستدعي `resolveSegmentIds` |
| 2 | rows تُدرج في `notifications` | كل مستخدم في القطاع يحصل على سجل in-app |
| 3 | Expo push يُرسَل | فقط للمستخدمين الذين لديهم push_token |
| 4 | النتيجة تظهر في الـ form | "تم الإرسال — X مستخدم مستهدف" + عدد الـ tokens |
| 5 | سجل في `admin_audit_log` | action=broadcast_notification، metadata يحتوي segment + sent |

**Expected Result:** الإرسال يصل لجميع المستهدفين، السجل يحتفظ بالتفاصيل للمراجعة.  
**Automation Candidate:** No

---

#### NTGTG-008
**Name:** سجل البث — يعرض الفئات الجديدة بأسمائها العربية  
**Priority:** Medium | **Type:** UI  
**Preconditions:** إرسال سابق بكل قطاع جديد

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | إرسال بقطاع "منتهو الاشتراك" | السجل يظهر "منتهو الاشتراك (≤30 يوم)" |
| 2 | إرسال قديم بقطاع "subscribed_providers" | يظهر "المشتركون" |
| 3 | سجل قديم بـ `meta.users` بدلاً من `meta.sent` | العدد يظهر بشكل صحيح (fallback يعمل) |

**Expected Result:** كل القطاعات تُعرض بأسماء مقروءة في سجل البث.  
**Automation Candidate:** No

---

#### NTGTG-009
**Name:** الأمان — requireAdminSession في كلا الـ server actions  
**Priority:** Medium | **Type:** Security  
**Preconditions:** طلب مباشر لـ server action بدون session

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | استدعاء `estimateAudience` بدون session | يُرجع خطأ 401 أو يُعيد redirect |
| 2 | استدعاء `sendBroadcast` بدون session | نفس الحماية |
| 3 | session صالحة | الاستدعاء يمر بشكل طبيعي |

**Expected Result:** لا يمكن لأي مستخدم غير مصادق الوصول لهذه الوظائف.  
**Automation Candidate:** No

---

#### NTGTG-010
**Name:** debounce — لا طلبات مكثفة عند التغيير السريع  
**Priority:** Medium | **Type:** Performance / UX  
**Preconditions:** الأدمن يتنقل بسرعة بين القطاعات

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تغيير القطاع 5 مرات في أقل من 400ms | طلب واحد فقط يُرسَل (الأخير) |
| 2 | تغيير نهائي والانتظار 500ms | العدد يظهر بعد 400ms من آخر تغيير |
| 3 | تغيير القطاع أثناء طلب جارٍ | الطلب القديم يُلغى ولا يُحدِّث الحالة |

**Expected Result:** UI مستجيب بدون ضغط غير ضروري على الـ server actions.  
**Automation Candidate:** No

---

---

## 34. ACTR — Action Center (Enhanced Smart Alerts)

> صفحة لوحة التحكم: قسم "التنبيهات الذكية" — 4 فحوصات أمان جديدة مرتبة حسب الخطورة

---

#### ACTR-001
**Name:** تنبيه حمراء — بلاغات خطيرة معلقة  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** يوجد سجل في `reports` بحالة `pending` و `report_type` = `abusive` أو `no_show`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فتح لوحة التحكم | تنبيه أحمر 🚩 يظهر بعدد البلاغات |
| 2 | الضغط على التنبيه | التوجه إلى `/abuse-reports` |
| 3 | خلفية التنبيه | `rgba(239,68,68,0.07)` — أحمر خفيف |

**Expected Result:** التنبيه يظهر فقط عندما `pendingCriticalReports > 0`.  
**Automation Candidate:** No

---

#### ACTR-002
**Name:** تنبيه حمراء — تذاكر دعم عاجلة  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** يوجد سجل في `support_tickets` بأولوية `urgent` وحالة `open`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فتح لوحة التحكم | تنبيه 🎫 يظهر بعدد التذاكر |
| 2 | عدم وجود تذاكر عاجلة | التنبيه لا يظهر |
| 3 | الضغط على التنبيه | التوجه إلى `/support` |

**Expected Result:** التنبيه مشروط بـ `urgentTickets > 0`.  
**Automation Candidate:** No

---

#### ACTR-003
**Name:** تنبيه عنبري — أعلام مزودين غير مراجَعة  
**Priority:** High | **Type:** Functional  
**Preconditions:** يوجد سجل في `provider_flags` بـ `reviewed = false`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فتح لوحة التحكم | تنبيه 🏴 عنبري بالعدد |
| 2 | الضغط | التوجه إلى `/provider-flags` |
| 3 | مراجعة كل الأعلام | التنبيه يختفي |

**Expected Result:** `unreviewedFlags` يُحسب من `provider_flags WHERE reviewed = false`.  
**Automation Candidate:** No

---

#### ACTR-004
**Name:** تنبيه عنبري — طلبات راكدة 48+ ساعة  
**Priority:** High | **Type:** Functional  
**Preconditions:** طلب مفتوح منذ أكثر من 48 ساعة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فتح لوحة التحكم | تنبيه ⏳ بعدد الطلبات الراكدة |
| 2 | الضغط | التوجه إلى `/requests` |
| 3 | لا طلبات راكدة | التنبيه لا يظهر |

**Expected Result:** يستخدم بيانات `alertStalled` من query الرئيسية (status=open + created_at < now-2days).  
**Automation Candidate:** No

---

#### ACTR-005
**Name:** تنبيه أصفر — اشتراكات تنتهي خلال 7 أيام  
**Priority:** High | **Type:** Functional  
**Preconditions:** مزود مشترك مع `subscription_ends` < اليوم + 7 أيام

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فتح لوحة التحكم | تنبيه ⏰ بالعدد |
| 2 | الاشتراك ينتهي بعد 8 أيام | لا تنبيه |
| 3 | الضغط | التوجه إلى `/providers` |

**Expected Result:** `expiringSubscriptions` = مزودين بـ `is_subscribed=true` وتنتهي اشتراكاتهم بين الآن و+7 أيام.  
**Automation Candidate:** No

---

#### ACTR-006
**Name:** ترتيب التنبيهات حسب الخطورة  
**Priority:** High | **Type:** Functional  
**Preconditions:** وجود تنبيهات من كل درجات الخطورة معاً

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | عدة أنواع من التنبيهات معاً | التنبيهات الحمراء أعلاً، ثم عنبرية، ثم زرقاء |
| 2 | لا تنبيهات | رسالة خضراء ✅ واحدة فقط |
| 3 | البادج في العنوان | يعرض إجمالي عدد التنبيهات |

**Expected Result:** الترتيب: Critical (red) → Warning (amber) → Info (blue) → OK (green).  
**Automation Candidate:** No

---

#### ACTR-007
**Name:** لا تنبيهات — حالة النظام السليم  
**Priority:** Medium | **Type:** UX  
**Preconditions:** كل المتغيرات = 0

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فتح لوحة التحكم بنظام نظيف | رسالة ✅ خضراء واحدة |
| 2 | عنوان قسم التنبيهات | بادج أخضر صغير بدلاً من عداد |
| 3 | الخلفية | `rgba(16,185,129,0.07)` خضراء خفيفة |

**Expected Result:** `alerts` array يحتوي على عنصر واحد فقط (OK).  
**Automation Candidate:** No

---

#### ACTR-008
**Name:** خلفية كل تنبيه تعكس لون خطورته  
**Priority:** Medium | **Type:** Visual  
**Preconditions:** وجود تنبيهات مختلطة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تنبيه أحمر | خلفية `rgba(239,68,68,...)` |
| 2 | تنبيه عنبري | خلفية `rgba(245,158,11,...)` |
| 3 | تنبيه أزرق | خلفية `rgba(59,130,246,...)` |

**Expected Result:** `alert.bg` dynamic — لا خلفية موحدة لكل التنبيهات.  
**Automation Candidate:** No

---

#### ACTR-009
**Name:** الاستعلامات الأربعة الجديدة تُنفَّذ دون أخطاء  
**Priority:** Medium | **Type:** Integration  
**Preconditions:** قاعدة بيانات متصلة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تحميل الداشبورد | لا أخطاء في console من الاستعلامات الجديدة |
| 2 | الجداول `support_tickets`, `reports`, `provider_flags` | تُرجع count صحيحاً |
| 3 | جدول `providers` مع فلتر انتهاء الاشتراك | count صحيح |

**Expected Result:** كل 20 استعلام في `Promise.all` تنجح.  
**Automation Candidate:** No

---

#### ACTR-010
**Name:** fallback عند فشل قاعدة البيانات  
**Priority:** Low | **Type:** Error Handling  
**Preconditions:** قاعدة البيانات غير متصلة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فشل `getDashboardData()` | `EMPTY` يُرجع مع `_error: true` |
| 2 | عرض الداشبورد | رسالة خطأ بنر أحمر في الأعلى |
| 3 | قسم التنبيهات | لا تنبيهات (كلها 0) |

**Expected Result:** النظام يعمل دون تعطل عند فشل الاستعلامات.  
**Automation Candidate:** No

---

## 35. REVT — Revenue Timeline Chart

> صفحة التقارير: مخطط الإيراد الشهري — آخر 6 أشهر

---

#### REVT-001
**Name:** عرض 6 أشهر بالتسلسل الصحيح  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** مزودون مشتركون في الأشهر الـ 6 الماضية

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فتح صفحة التقارير | 6 أعمدة تمثل الأشهر من الأقدم للأحدث |
| 2 | تسميات الأشهر | بالعربية (مثل: يناير، فبراير...) مع السنة |
| 3 | الشهر الحالي | العمود الأخير يمثل الشهر الحالي |

**Expected Result:** `revenueTimeline` = 6 عناصر مرتبة chronologically.  
**Automation Candidate:** No

---

#### REVT-002
**Name:** ارتفاع الأعمدة يتناسب مع الإيراد  
**Priority:** High | **Type:** Visual  
**Preconditions:** اشتراكات بقيم مختلفة في أشهر مختلفة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | شهر بإيراد مرتفع | عمود أطول من شهر بإيراد أدنى |
| 2 | شهر بدون إيراد | عمود شاحب بأدنى ارتفاع (2%) |
| 3 | شهر بأعلى إيراد | عمود بارتفاع 100% |

**Expected Result:** `heightPct = (rev / maxTimelineRev) * 100`, min = 2%.  
**Automation Candidate:** No

---

#### REVT-003
**Name:** حالة فارغة عند عدم وجود اشتراكات  
**Priority:** High | **Type:** Edge Case  
**Preconditions:** لا مزودون مشتركون في آخر 6 أشهر

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فتح صفحة التقارير | رسالة "لا توجد بيانات اشتراك بعد" |
| 2 | لا أعمدة تظهر | chart container مخفي |

**Expected Result:** `revenueTimeline.every(m => m.rev === 0)` → empty state.  
**Automation Candidate:** No

---

#### REVT-004
**Name:** مبلغ الإيراد الحالي يتطابق مع KPI card  
**Priority:** Medium | **Type:** Data Consistency  
**Preconditions:** اشتراكات نشطة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | قراءة KPI "إيراد الاشتراكات / شهر" | قيمة X |
| 2 | النظر إلى عنوان Revenue Timeline | يظهر نفس القيمة X |
| 3 | مقارنة الأرقام | متطابقة |

**Expected Result:** كلاهما يستخدم `fmtMoney(monthlyRevenue)` — نفس المصدر.  
**Automation Candidate:** No

---

#### REVT-005
**Name:** تنسيق المبالغ بالدينار الأردني  
**Priority:** Medium | **Type:** Localization  
**Preconditions:** اشتراكات بقيم مختلفة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | قيمة إيراد = 25 | تظهر كـ "25 د.أ" |
| 2 | قيمة = 0 | العمود الشاحب لا يعرض مبلغاً |

**Expected Result:** `fmtMoney()` صحيح على كل الأعمدة.  
**Automation Candidate:** No

---

#### REVT-006
**Name:** مزود خرج الاشتراك ويُعاد الاشتراك — يُحسب في الشهر الصحيح  
**Priority:** Low | **Type:** Edge Case  
**Preconditions:** مزود انضم في شهر ماضٍ ومشترك حالياً

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | مزود `created_at` = قبل 3 أشهر | يظهر في عمود الشهر الثالث |
| 2 | لا يُحسب في الشهر الحالي | العمود الحالي لا يزيد بسببه |

**Expected Result:** التجميع حسب `created_at` (شهر الانضمام) وليس `subscription_ends`.  
**Automation Candidate:** No

---

## 36. SDLY — Supply/Demand Analytics Page

> صفحة `/analytics`: تحليل العرض والطلب حسب المدينة والفئة

---

#### SDLY-001
**Name:** العرض (مزودون) مُجمَّع صحيحاً حسب المدينة  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** مزودون موزعون على مدن مختلفة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فتح `/analytics` | البار الأزرق لكل مدينة يعكس عدد مزوديها |
| 2 | إضافة مزود جديد في عمّان | عمود عمّان يزيد بـ 1 |
| 3 | مدينة بمزودين=0 | لا شريط أزرق |

**Expected Result:** `citySupply` يُحسب من `providers.user(city)`.  
**Automation Candidate:** No

---

#### SDLY-002
**Name:** الطلب (طلبات مفتوحة) مُجمَّع صحيحاً حسب المدينة  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** طلبات مفتوحة بمدن مختلفة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فتح `/analytics` | البار الأصفر لكل مدينة يعكس عدد طلباتها المفتوحة |
| 2 | إغلاق طلب في مدينة | البار ينخفض |
| 3 | طلبات بحالة غير open | لا تُحتسب |

**Expected Result:** `cityDemand` يُحسب من `requests WHERE status='open'`.  
**Automation Candidate:** No

---

#### SDLY-003
**Name:** بادج "نقص" يظهر عند demand > supply * 1.5  
**Priority:** High | **Type:** Functional  
**Preconditions:** مدينة بطلبات أكثر من 1.5 ضعف عدد مزوديها

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | مدينة: 2 مزود، 4 طلب (4 > 2*1.5=3) | بادج ⚠️ نقص يظهر |
| 2 | مدينة: 2 مزود، 3 طلب (3 = 1.5*2) | لا بادج |
| 3 | المدينة تظهر في قسم "مدن بها نقص" | نعم |

**Expected Result:** منطق `demand > supply * 1.5`.  
**Automation Candidate:** No

---

#### SDLY-004
**Name:** فئة بـ demand > supply تحصل على بادج "طلب عالٍ"  
**Priority:** High | **Type:** Functional  
**Preconditions:** فئة بطلبات مفتوحة أكثر من مزودين

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فئة كهرباء: 3 مزود، 5 طلبات | بادج 🔥 يظهر |
| 2 | فئة بـ supply >= demand | لا بادج |
| 3 | الفئة تظهر في "فئات ذات طلب مرتفع" | نعم |

**Expected Result:** `demand > supply` يُشغّل badge + summary row.  
**Automation Candidate:** No

---

#### SDLY-005
**Name:** `categories` array في providers تُحتسب لكل عنصر  
**Priority:** High | **Type:** Functional  
**Preconditions:** مزود يخدم 3 فئات مختلفة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | مزود بـ `categories = ['electrical', 'plumbing', 'cleaning']` | يُحتسب في 3 فئات مختلفة |
| 2 | فئة لا يخدمها أحد | عمود أزرق = 0 أو الفئة لا تظهر |

**Expected Result:** `catSupply[cat]++` لكل slug في `p.categories`.  
**Automation Candidate:** No

---

#### SDLY-006
**Name:** KPI cards تعرض الأرقام الصحيحة  
**Priority:** High | **Type:** Functional  
**Preconditions:** بيانات حية

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | بطاقة "إجمالي المزودين" | تساوي count في لوحة التحكم |
| 2 | بطاقة "طلبات مفتوحة" | تساوي openRequests في الداشبورد |
| 3 | "نسبة الطلب / العرض" | = openRequests / providers (تنسيق Xx) |

**Expected Result:** الأرقام مأخوذة من نفس الجداول بشكل مباشر.  
**Automation Candidate:** No

---

#### SDLY-007
**Name:** قسم "مدن بها نقص" و"فئات ذات طلب مرتفع" متطابقان مع الرسوم  
**Priority:** Medium | **Type:** Consistency  
**Preconditions:** وجود حالات نقص وطلب عالٍ

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | مدينة مُعلَّمة بـ ⚠️ في الرسم | تظهر في قسم "مدن بها نقص" |
| 2 | فئة مُعلَّمة بـ 🔥 | تظهر في "فئات ذات طلب مرتفع" |
| 3 | لا نقص في أي مدينة | رسالة ✅ في القسم |

**Expected Result:** كلا القسمين يستخدم نفس البيانات `cityData` و `catData`.  
**Automation Candidate:** No

---

#### SDLY-008
**Name:** الصفحة تعمل مع بيانات فارغة (لا مزودين / لا طلبات)  
**Priority:** Medium | **Type:** Edge Case  
**Preconditions:** قاعدة بيانات جديدة فارغة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فتح `/analytics` بلا بيانات | رسالة "لا توجد بيانات بعد" في كل قسم |
| 2 | KPI cards | تعرض 0 بدون أخطاء |
| 3 | نسبة الطلب/العرض | تعرض "—" (providers = 0) |

**Expected Result:** لا أخطاء JS، كل الأقسام تعرض empty states.  
**Automation Candidate:** No

---

## 37. SYSH — System Health Page

> صفحة `/system`: مراقبة المهام المجدولة والخدمات

---

#### SYSH-001
**Name:** قائمة pg_cron تُعرض عبر `admin_cron_status()`  
**Priority:** Critical | **Type:** Integration  
**Preconditions:** migration 086 مطبّق وpg_cron مُفعَّل

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فتح `/system` | قائمة بكل المهام المجدولة من pg_cron |
| 2 | اسم المهمة | يظهر `jobname` بوضوح |
| 3 | الجدول الزمني | يظهر `schedule` (مثل `0 6 * * *`) |

**Expected Result:** `supabaseAdmin.rpc('admin_cron_status')` تُرجع البيانات دون خطأ.  
**Automation Candidate:** No

---

#### SYSH-002
**Name:** مهمة فاشلة تُظهر تسليط أحمر ورسالة الخطأ  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** مهمة pg_cron آخر تشغيل فيها `status = 'failed'`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | مهمة فاشلة | خلفية حمراء خفيفة على السطر |
| 2 | `last_error` | تظهر رسالة الخطأ تحت اسم المهمة |
| 3 | بادج حالة | نص "فشل" أحمر |

**Expected Result:** `STATUS_META['failed']` → `dot: 'bg-red-400'`, خلفية `rgba(239,68,68,0.04)`.  
**Automation Candidate:** No

---

#### SYSH-003
**Name:** عداد رموز Push صحيح  
**Priority:** High | **Type:** Functional  
**Preconditions:** مستخدمون بـ push tokens مسجلة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فتح `/system` | بطاقة "أجهزة Push نشطة" بالعدد الصحيح |
| 2 | مستخدم يُلغي تسجيل token | العداد ينخفض بـ 1 |
| 3 | لا tokens | العداد = 0 |

**Expected Result:** count من `push_tokens` table.  
**Automation Candidate:** No

---

#### SYSH-004
**Name:** معدل القراءة محسوب صحيحاً (7 أيام)  
**Priority:** High | **Type:** Functional  
**Preconditions:** إشعارات مقروءة وغير مقروءة في آخر 7 أيام

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | 100 إشعار، 60 مقروء | معدل = 60% |
| 2 | 0 إشعارات | معدل = 0% (لا قسمة على صفر) |
| 3 | 100% مقروء | شريط أخضر كامل |

**Expected Result:** `readRate = Math.round((readNotifs / totalNotifs) * 100)`.  
**Automation Candidate:** No

---

#### SYSH-005
**Name:** لون شريط القراءة يتغير حسب العتبة  
**Priority:** High | **Type:** Visual  
**Preconditions:** معدلات قراءة مختلفة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | معدل >= 70% | شريط أخضر |
| 2 | معدل 40-69% | شريط عنبري |
| 3 | معدل < 40% | شريط أحمر |

**Expected Result:** `linear-gradient` يتغير بحسب `readRate` threshold.  
**Automation Candidate:** No

---

#### SYSH-006
**Name:** عدد الاشتراكات المنتهية يتطابق مع الداشبورد  
**Priority:** High | **Type:** Data Consistency  
**Preconditions:** اشتراكات تنتهي خلال 7 أيام

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | بطاقة "اشتراكات تنتهي" في `/system` | نفس القيمة في بطاقة الداشبورد |
| 2 | مزود تنتهي اشتراكاته خلال 8 أيام | لا يُحتسب |
| 3 | لون البطاقة | أصفر إذا > 0، رمادي إذا = 0 |

**Expected Result:** نفس query المستخدم في الداشبورد (7-day window).  
**Automation Candidate:** No

---

#### SYSH-007
**Name:** البادج الرئيسي (سليم / تنبيه) يعكس حالة pg_cron  
**Priority:** Medium | **Type:** Functional  
**Preconditions:** مهام pg_cron بحالات مختلفة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | كل المهام نجحت | بادج أخضر "النظام سليم" |
| 2 | مهمة واحدة فاشلة | بادج أحمر "تنبيه: راجع الأخطاء" |
| 3 | لا مهام مجدولة بعد | بادج أخضر (لا فشل) |

**Expected Result:** `allCronOk = cronJobs.every(j => j.last_status === 'succeeded' || !j.last_status)`.  
**Automation Candidate:** No

---

#### SYSH-008
**Name:** فشل `admin_cron_status()` لا يكسر الصفحة  
**Priority:** Medium | **Type:** Error Handling  
**Preconditions:** `cron` schema غير متاح أو migration 086 لم يُطبَّق

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | RPC يُرجع خطأ | `cronErr = true`, `cronJobs = []` |
| 2 | قسم المهام | رسالة "تعذّر الاتصال بـ cron schema" |
| 3 | باقي الصفحة | تعمل بشكل طبيعي (push tokens، read rate) |

**Expected Result:** كل metric مستقل — فشل RPC لا يؤثر على بقية البيانات.  
**Automation Candidate:** No

---

---

## 38. BUGFIX — Bug-Fix Regression Suite (v2.6)

> حالات اختبار الانحدار لجميع الإصلاحات المُطبَّقة في جلسة 2026-05-12.  
> كل حالة تتحقق من أن الإصلاح يعمل **وأنه لم يُحدث تأثيرات جانبية**.

### High-Risk Areas
- التحقق من هوية الخدمات الداخلية (BUG-C01/C02)
- منع الشرط التنافسي في قبول العروض (BUG-C04)
- تشغيل دورة انتهاء الالتزام (BUG-C05)
- تتبع الخسائر المتتالية بعد إصلاح bid_credits (BUG-C06)
- مقارنة كود التأكيد بطريقة آمنة (BUG-C10)
- الكشف الصحيح عن أخطاء Expo (BUG-H04)

---

#### BUGFIX-001
**Name:** notify-lifecycle يرفض الطلبات غير المصرّح بها  
**Fixes:** BUG-C01 | **Priority:** Critical | **Type:** Security  
**Preconditions:** Edge Function مُنشَّرة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | استدعاء `notify-lifecycle` بدون `Authorization` header | HTTP 401 `{"error":"unauthorized"}` |
| 2 | استدعاء بـ `Authorization: Bearer wrong_key` | HTTP 401 |
| 3 | استدعاء بـ `Authorization: Bearer <service_role_key>` | HTTP 200 `{"ok":true,...}` |
| 4 | pg_cron يستدعي الدالة يومياً بالمفتاح الصحيح | الإشعارات تُرسَل بشكل طبيعي |

**Regression:** لا يجب أن يتأثر إرسال إشعارات lifecycle الاعتيادية.  
**Automation Candidate:** Yes

---

#### BUGFIX-002
**Name:** notify-admin يرفض الطلبات غير المصرّح بها  
**Fixes:** BUG-C02 | **Priority:** Critical | **Type:** Security  
**Preconditions:** Edge Function مُنشَّرة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | POST بدون header | HTTP 401 |
| 2 | POST بمفتاح خاطئ | HTTP 401 |
| 3 | trigger قاعدة البيانات يُطلق `cliq_payment` بمفتاح service_role | الإيميل والSMS يُرسَلان |
| 4 | pg_cron يُطلق `daily_digest` بالمفتاح الصحيح | الملخص اليومي يُرسَل |

**Regression:** جميع أحداث notify-admin الـ 9 لا تزال تعمل عبر الـ triggers.  
**Automation Candidate:** Yes

---

#### BUGFIX-003
**Name:** accept_bid لا يقبل نفس الطلب مرتين بشكل متزامن  
**Fixes:** BUG-C04 | **Priority:** Critical | **Type:** Concurrency  
**Preconditions:** طلب مفتوح بعرضَين على الأقل

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | عميلان يستدعيان `accept_bid` لنفس الطلب في نفس اللحظة | عملية واحدة فقط تنجح، الأخرى تُرجع `not_authorized_or_request_closed` |
| 2 | التحقق من جدول `jobs` | صف واحد فقط لهذا الطلب |
| 3 | حالة الطلب | `in_progress` لا `open` |
| 4 | قبول عرض آخر على نفس الطلب | `not_authorized_or_request_closed` |

**Regression:** قبول العروض الاعتيادي (غير متزامن) يعمل كالمعتاد.  
**Automation Candidate:** Yes (concurrent test with pgbench)

---

#### BUGFIX-004
**Name:** sweep_expired_job_commitments يُشغَّل كل دقيقة  
**Fixes:** BUG-C05 | **Priority:** Critical | **Type:** Cron  
**Preconditions:** migration 087 مُطبَّق

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | التحقق من جدول `cron.job` | مهمة `sweep-commitment-expiry` موجودة بجدول `* * * * *` |
| 2 | إنشاء job نشط تجاوز `provider_commit_deadline` | بعد دقيقة: حالة الـ job = `cancelled` |
| 3 | عروض الطلب المرتبط | تعود إلى `pending` |
| 4 | حالة الطلب | تعود إلى `open` |

**Regression:** Jobs التي التزم بها المقدم خلال المهلة لا تتأثر.  
**Automation Candidate:** No

---

#### BUGFIX-005
**Name:** تتبع الخسائر المتتالية يعمل بعد إصلاح bid_credits  
**Fixes:** BUG-C06 | **Priority:** Critical | **Type:** Functional  
**Preconditions:** مقدم non-premium لديه عروض مقبولة سابقة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | رفض عرض المقدم (تحديث status = rejected) | `consecutive_losses` يزيد بمقدار 1 |
| 2 | `bid_rejection_rate` | تُحسَب وتُحدَّث صحيحاً |
| 3 | رفض 7 عروض متتالية | `bonus_credits` يزيد بمقدار 1 (مكافأة المثابرة) |
| 4 | قبول عرض بعد السلسلة | `consecutive_losses` يُعاد إلى 0 |

**Regression:** لا تُضاف رصيد مزدوج ولا يختفي.  
**Automation Candidate:** Yes

---

#### BUGFIX-006
**Name:** استرداد الرصيد عند إلغاء الطلب يُوزَّع بين المحفظتين صحيحاً  
**Fixes:** BUG-H01 | **Priority:** High | **Type:** Functional  
**Preconditions:** مقدم قدّم عرضاً باستخدام subscription_credits وbonus_credits معاً

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | العرض يكلف 3 رصيد (2 subscription + 1 bonus) `bonus_credits_used=1` | يُسجَّل صحيحاً في bids |
| 2 | العميل يُلغي الطلب | trigger `refund_bids_on_cancel` يُطلَق |
| 3 | subscription_credits المقدم | يزيد بمقدار 2 (وليس 3) |
| 4 | bonus_credits المقدم | يزيد بمقدار 1 |

**Regression:** إلغاء طلب بعروض من مقدمين premium لا يغير أرصدتهم.  
**Automation Candidate:** Yes

---

#### BUGFIX-007
**Name:** مقارنة كود تأكيد الوظيفة مقاومة للـ timing attack  
**Fixes:** BUG-C10 | **Priority:** Critical | **Type:** Security  
**Preconditions:** job نشط بـ confirm_code مُولَّد

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | إرسال كود صحيح | `{"success": true}`, حالة الـ job = `completed` |
| 2 | إرسال كود خاطئ بنفس الطول | `{"error":"wrong_code"}`, `confirm_attempts` يزيد |
| 3 | إرسال كود أقصر أو أطول | `{"error":"wrong_code"}` (no short-circuit leak) |
| 4 | قياس وقت الاستجابة للكودين الصحيح والخاطئ | الفرق < 5ms (زمن متساوٍ) |

**Regression:** الـ lockout بعد 5 محاولات خاطئة لا يزال يعمل.  
**Automation Candidate:** Yes

---

#### BUGFIX-008
**Name:** أخطاء Expo على مستوى الـ ticket تُسجَّل في الـ logs  
**Fixes:** BUG-H04 | **Priority:** High | **Type:** Error Handling  
**Preconditions:** رمز push منتهي الصلاحية في قاعدة البيانات

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Expo يُرجع `{"status":"error","details":{"error":"DeviceNotRegistered"}}` | Edge Function log يحتوي `[bid-rejected] Expo ticket error:` |
| 2 | `sent` counter | لا يُحتسَب الـ ticket الفاشل ضمن العداد |
| 3 | HTTP 200 من Expo مع أخطاء في الـ body | يُعالَج بشكل صحيح (لا يُحتسَب كنجاح كامل) |
| 4 | HTTP 4xx من Expo | يُسجَّل في log ويستمر البـ batch التالي |

**Regression:** الإشعارات الناجحة (status=ok) تُحتسَب كالمعتاد.  
**Automation Candidate:** No

---

---

## 39. BUGFIX2 — Bug-Fix Regression Suite v3.0 (Pass-2)

### Overview
13 regression cases covering the 13 bugs fixed in migration 088 and the edge-function / admin-portal patches applied in Pass-2.

---

#### BUGFIX2-001
**Name:** استعلام admin provider-flags يعمل بعد إصلاح الأعمدة المفقودة  
**Fixes:** NC-02 | **Priority:** Critical | **Type:** Admin Portal  
**Preconditions:** migration 088 مُطبَّق؛ يوجد provider_flag واحد على الأقل

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح `/provider-flags` في الأدمن بورتال | الصفحة تُحمَّل بدون خطأ (لا `column providers.display_name does not exist`) |
| 2 | تحقق من عرض اسم المقدم | `full_name` من جدول `users` يظهر صحيحاً |
| 3 | تحقق من عرض رقم الهاتف | `phone` من جدول `users` يظهر صحيحاً |
| 4 | تحقق من عرض المدينة | `city` من جدول `users` يظهر بجانب رقم الهاتف |
| 5 | تحقق من `flag_count` و`reputation_tier` | يُعرَضان من جدول `providers` صحيحاً |

**Regression:** عداد البلاغات وفلاتر المراجعة تعمل كالمعتاد.  
**Automation Candidate:** No

---

#### BUGFIX2-002
**Name:** renotify_providers لا يتعطل بسبب p.city  
**Fixes:** NC-01 | **Priority:** Critical | **Type:** Cron / DB  
**Preconditions:** يوجد طلب مفتوح منذ أكثر من ساعتين وأقل من 48 ساعة بدون عروض

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تشغيل `SELECT renotify_providers_for_stale_requests()` يدوياً | لا يُرجع خطأ `column p.city does not exist` |
| 2 | مزود لديه `city` يطابق المدينة في `users` وليس في `providers` | يستقبل إشعاراً في الـ notifications inbox |
| 3 | مزود مدينته تختلف عن مدينة الطلب | لا يستقبل إشعاراً |
| 4 | بعد التشغيل: حقل `provider_renotified_at` في الطلب | يُحدَّث إلى NOW() (idempotency) |

**Regression:** `expire_stale_requests` يعمل كالمعتاد.  
**Automation Candidate:** No

---

#### BUGFIX2-003
**Name:** undo_accept_bid مع FOR UPDATE يمنع race condition  
**Fixes:** NC-03 | **Priority:** Critical | **Type:** Concurrency  
**Preconditions:** job نشط بـ grace period نشطة، المقدم لم يلتزم بعد

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | إرسال `undo_accept_bid` و`provider_commit_job` في نفس اللحظة | إحداهما تنجح والأخرى تفشل — لا حالة نصفية |
| 2 | إذا نجح `provider_commit_job` أولاً | `undo_accept_bid` يُرجع `provider_already_committed` |
| 3 | إذا نجح `undo_accept_bid` أولاً | Job يُلغى؛ `provider_commit_job` يُرجع `job_not_active` |

**Regression:** Grace period المنتهية لا تزال ترفض الـ undo.  
**Automation Candidate:** Yes

---

#### BUGFIX2-004
**Name:** undo_accept_bid يُعيد فقط العروض المرفوضة ويمسح rejected_at  
**Fixes:** NC-05 | **Priority:** Critical | **Type:** Functional  
**Preconditions:** طلب لديه ثلاثة عروض (P1 مقبول، P2 مرفوض، P3 في حالة غير pending قبل الـ accept)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | العميل يقبل عرض P1 | P2 يصبح `rejected` مع `rejected_at` محدد |
| 2 | العميل ينفذ `undo_accept_bid` خلال فترة السماح | P1 يعود إلى `pending` مع `rejected_at = NULL` |
| 3 | P2 يعود إلى `pending` | `rejected_at = NULL` (لا كولداون كاذب لمدة 24 ساعة) |
| 4 | P2 يحاول تقديم عرض على نفس العميل فوراً | لا تظهر رسالة `COOLDOWN_ACTIVE` |
| 5 | طلب الخدمة | يعود إلى `open` |

**Regression:** عرض تم سحبه (`withdrawn`) — إن وُجد — لا يُعاد إلى `pending`.  
**Automation Candidate:** Yes

---

#### BUGFIX2-005
**Name:** كولداون 24 ساعة لا يُطبَّق على الطلبات الملغاة/المنتهية  
**Fixes:** NC-04 | **Priority:** Critical | **Type:** Functional  
**Preconditions:** مقدم لديه عرض مرفوض على طلب **ملغى** خلال آخر 24 ساعة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | طلب العميل يُلغى بعد رفض عرض المقدم | `bids.rejected_at` محدد |
| 2 | نفس العميل ينشر طلباً جديداً | الطلب الجديد يظهر للمقدم |
| 3 | المقدم يحاول تقديم عرض على الطلب الجديد | `submit_bid_with_credits` لا يُرجع `COOLDOWN_ACTIVE` |
| 4 | المقدم يُقدّم عرضاً على طلب آخر بنفس العميل | العرض يُقبَل (طالما الطلب القديم ملغى/منتهٍ) |

**Regression:** الكولداون لا يزال يُطبَّق عند رفض العرض على طلب نشط.  
**Automation Candidate:** Yes

---

#### BUGFIX2-006
**Name:** send_otp يولّد رمزاً بـ CSPRNG  
**Fixes:** NH-01 | **Priority:** High | **Type:** Security  
**Preconditions:** migration 088 مُطبَّق

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | قراءة دالة `send_otp` في DB | جسم الدالة يحتوي `gen_random_bytes` وليس `RANDOM()` |
| 2 | طلب 1000 OTP لأرقام مختلفة | توزيع الأرقام عشوائي (لا أنماط متكررة في فئة معينة) |
| 3 | التحقق من تطبيق الـ rate limit | لا يزال: 60 ثانية بين الإرسالات، 5 رسائل/يوم |

**Regression:** كل وظائف send_otp الأخرى (daily cap, cooldown, expire old) تعمل كالمعتاد.  
**Automation Candidate:** Yes

---

#### BUGFIX2-007
**Name:** verify_otp يستخدم مقارنة صريحة عبر متغير  
**Fixes:** NH-02 | **Priority:** High | **Type:** Security  
**Preconditions:** OTP صالح في قاعدة البيانات

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | قراءة دالة `verify_otp` في DB | المقارنة تُنفَّذ عبر `v_stored_code IS DISTINCT FROM p_code` (لا inline subquery) |
| 2 | إرسال رمز صحيح | `{"success": true}` |
| 3 | إرسال رمز خاطئ | `{"success": false, "error": "WRONG_CODE"}` |
| 4 | عداد المحاولات | يزيد لكلا الحالتين قبل المقارنة |

**Regression:** حد المحاولات (5) ومسح verified_at يعملان كالمعتاد.  
**Automation Candidate:** Yes

---

#### BUGFIX2-008
**Name:** cancel_job يرفض إلغاء العميل بعد التزام المقدم  
**Fixes:** NH-03 | **Priority:** High | **Type:** Functional  
**Preconditions:** job نشط، المقدم التزم (`provider_committed_at IS NOT NULL`)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | العميل يستدعي `cancel_job` بعد `provider_committed_at` | `{"success": false, "error": "PROVIDER_COMMITTED"}` |
| 2 | حالة الـ job | لا تتغير (لا تزال `active`) |
| 3 | المقدم يستدعي `cancel_job` على نفس الـ job | ينجح (المقدم مسموح له بالإلغاء) |
| 4 | المقدم لم يلتزم بعد (`provider_committed_at IS NULL`) | العميل يستطيع الإلغاء بشكل طبيعي |

**Regression:** سجل الإلغاء (`cancellation_log`) يُكتَب عند الإلغاء المسموح به.  
**Automation Candidate:** Yes

---

#### BUGFIX2-009
**Name:** verify-otp edge function تجد المستخدم رقم 1001+  
**Fixes:** NH-04 | **Priority:** High | **Type:** Functional  
**Preconditions:** قاعدة بيانات تحتوي أكثر من 1000 مستخدم؛ المستخدم المستهدف ليس له صف في `users`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | قراءة كود `verify-otp/index.ts` | لا يوجد `listUsers({ perPage: 1000 })`؛ يُستخدَم `rpc("lookup_auth_user_by_phone_or_email")` |
| 2 | محاولة تسجيل دخول لمستخدم auth موجود بدون صف users (incomplete onboarding) | Edge function تجد المستخدم عبر الـ RPC |
| 3 | تحقق من الـ RPC `lookup_auth_user_by_phone_or_email` | موجود في DB؛ يُرجع `auth_user_id, auth_email, auth_phone` |
| 4 | بعد الإصلاح | يُكمَل تسجيل الدخول بدون خطأ `USER_ERROR` |

**Regression:** المسار الطبيعي (مستخدم موجود في users) لا يتأثر.  
**Automation Candidate:** No

---

#### BUGFIX2-010
**Name:** fn_check_cancellation_abuse يُنبّه على الإلغاء الرابع وما بعده  
**Fixes:** NH-05 | **Priority:** High | **Type:** Admin / Abuse  
**Preconditions:** مستخدم ألغى 3 وظائف هذا الشهر

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | المستخدم يُلغي وظيفة رابعة | تُضاف تنبيه في `admin_alerts` مع `count=4` |
| 2 | وظيفة خامسة | تنبيه آخر بـ `count=5` |
| 3 | بالسابق (قبل الإصلاح) | فقط الثالثة تولّد تنبيهاً؛ الرابعة والخامسة تُهمَل |
| 4 | رسالة التنبيه | تحتوي العدد الصحيح (4 أو 5...) |

**Regression:** التنبيه على الثالثة لا يزال يعمل.  
**Automation Candidate:** Yes

---

#### BUGFIX2-011
**Name:** boost_bid يعمل بأمان مع SET search_path  
**Fixes:** NM-01 | **Priority:** Medium | **Type:** Security / Functional  
**Preconditions:** provider مشترك لديه بيد بحالة pending

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | قراءة تعريف `boost_bid` في DB | يحتوي `SET search_path = public, pg_catalog` |
| 2 | استدعاء `boost_bid` بـ bid_id صالح | `{"success": true, "boost_expires_at": "..."}` |
| 3 | بعد ساعتين | `is_boosted` يبقى `true` حتى انتهاء `boost_expires_at` |
| 4 | محاولة boost ثانٍ على نفس الـ bid | `{"error": "ALREADY_BOOSTED"}` |

**Regression:** الـ credits تُخصَم مرة واحدة فقط.  
**Automation Candidate:** Yes

---

#### BUGFIX2-012
**Name:** cleanup_expired_otps يعمل يومياً ويُنظّف phone_otps  
**Fixes:** NM-02 | **Priority:** Medium | **Type:** Cron  
**Preconditions:** migration 088 مُطبَّق

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | التحقق من جدول `cron.job` | مهمة `cleanup-expired-otps` موجودة بجدول `0 4 * * *` |
| 2 | إضافة صفوف `phone_otps` منتهية الصلاحية بأكثر من يوم | بعد تشغيل `cleanup_expired_otps()` يدوياً: الصفوف تُحذَف |
| 3 | OTPs منتهية الصلاحية منذ أقل من يوم | لا تُحذَف |
| 4 | OTPs مُتحقَّق منها حديثاً | لا تُحذَف |

**Regression:** OTPs النشطة ضمن الساعة لا تُمس.  
**Automation Candidate:** Yes

---

#### BUGFIX2-013
**Name:** invoke_notify_no_bids و invoke_send_delayed_commit_notifications تحتويان SET search_path  
**Fixes:** NM-03 | **Priority:** Medium | **Type:** Security  
**Preconditions:** migration 088 مُطبَّق

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | قراءة `invoke_notify_no_bids` في DB | يحتوي `SET search_path = public, pg_catalog` |
| 2 | قراءة `invoke_send_delayed_commit_notifications` في DB | يحتوي `SET search_path = public, pg_catalog` |
| 3 | تشغيل `invoke_notify_no_bids()` مع app.settings مُهيأة | يُرسِل HTTP POST للدالة الحافة بدون خطأ |
| 4 | تشغيل `invoke_send_delayed_commit_notifications()` | يُرسِل HTTP POST صحيحاً |

**Regression:** الـ pg_cron schedules للدالتين لا تزال نشطة.  
**Automation Candidate:** No

---

---

## 40. RPTS — Reports Export Hub (25 Reports)

**Feature:** Admin portal reports page (`/reports`) with 25 CSV export endpoints (`/api/reports/[id]`).  
**Groups:** A (Financial), B (Operations), C (Providers), D (Users/Growth), E (Quality/Safety), F (System/Audit)

---

#### RPTS-001
**Name:** صفحة التقارير تُحمَّل مع كل البطاقات الـ 25  
**Priority:** High | **Type:** Functional  
**Preconditions:** الأدمن مسجّل دخول

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | الذهاب إلى `/reports` | الصفحة تُحمَّل بدون خطأ |
| 2 | التحقق من عدد البطاقات | 25 بطاقة موزّعة على 6 مجموعات (A→F) |
| 3 | كل بطاقة تحتوي | كود المجموعة (مثلاً A-01)، عنوان، وصف، زر تصدير |
| 4 | مجموعة A | 5 تقارير: اشتراكات نشطة، منتهية، تنتهي قريباً، سجل دفعات، الإيرادات الشهرية |
| 5 | مجموعة F-02 (حجم DB) | رابط يفتح Supabase Dashboard (ليس زر تصدير CSV) |

**Regression:** لا تظهر بطاقات بدون كود أو بعنوان فارغ.  
**Automation Candidate:** Yes

---

#### RPTS-002
**Name:** أعداد العدادات الحية (Live Counts) تعكس البيانات الفعلية  
**Priority:** High | **Type:** Functional  
**Preconditions:** بيانات تجريبية في قاعدة البيانات

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | فتح `/reports` | كل بطاقة تُظهر عداداً رقمياً |
| 2 | مقارنة عداد A-01 (اشتراكات نشطة) | يساوي عدد الصفوف في `providers WHERE is_subscribed=true` |
| 3 | مقارنة عداد E-02 (بلاغات معلّقة) | يساوي `reports WHERE status='pending'` |
| 4 | عداد يُظهر 0 | لا يُعرض "undefined" أو "-" |
| 5 | خطأ في الاستعلام | العداد يُعرض 0 بدون تعطّل الصفحة |

**Regression:** العدادات تُحمَّل بالتوازي (Promise.allSettled) — فشل استعلام واحد لا يوقف الباقية.  
**Automation Candidate:** No

---

#### RPTS-003
**Name:** المؤشر العاجل (Rose Border) يظهر على البطاقات الصحيحة فقط  
**Priority:** Medium | **Type:** Functional  
**Preconditions:** بيانات: اشتراك ينتهي خلال 3 أيام، بلاغ معلّق، مزوّد موقوف

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | A-03 (تنتهي قريباً) عدادها > 0 | حد وردي (rose border) حول البطاقة |
| 2 | A-03 عدادها = 0 | لا حد وردي |
| 3 | E-02 (بلاغات معلّقة) عدادها > 0 | حد وردي |
| 4 | بطاقة غير عاجلة (مثل B-02) | لا حد وردي بغض النظر عن العداد |

**Automation Candidate:** No

---

#### RPTS-004
**Name:** تصدير A-01 — اشتراكات نشطة  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** مزوّد واحد على الأقل مشترك (`is_subscribed=true`)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | الضغط على "تصدير CSV" في بطاقة A-01 | يبدأ تحميل ملف `subscriptions-active-<date>.csv` |
| 2 | فتح الملف في Excel | يُفتح بشكل صحيح مع ترميز UTF-8 (BOM موجود) |
| 3 | التحقق من الأعمدة | الاسم، الهاتف، المدينة، خطة الاشتراك، تاريخ الانتهاء، عدد الوظائف |
| 4 | المحتوى | يشمل فقط المزودين الذين `is_subscribed=true` |
| 5 | الأسماء العربية | تظهر بشكل صحيح بدون أحرف مكسّرة |

**Regression:** لا صفوف بـ `is_subscribed=false` في هذا التصدير.  
**Automation Candidate:** Yes

---

#### RPTS-005
**Name:** تصدير A-04 — سجل المدفوعات  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** دفعة يدوية واحدة على الأقل مسجّلة في `manual_payments`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تصدير A-04 | ملف `payments-history-<date>.csv` |
| 2 | التحقق من الأعمدة | رقم الدفعة، الاسم، الهاتف، المبلغ (JOD)، الحالة، التاريخ، ملاحظات |
| 3 | المبلغ | رقم عشري دقيق (مثلاً 25.000) |
| 4 | الحالة | بالعربية (مثلاً "مؤكدة") |
| 5 | فلتر FK | join صحيح عبر `manual_payments_provider_id_fkey` بدون تكرار صفوف |

**Automation Candidate:** No

---

#### RPTS-006
**Name:** تصدير B-01 — الطلبات حسب الحالة (آخر 30 يوم)  
**Priority:** High | **Type:** Functional  
**Preconditions:** طلبات بحالات مختلفة في آخر 30 يوم

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تصدير B-01 | ملف `requests-by-status-<date>.csv` |
| 2 | نطاق التاريخ | طلبات منذ 30 يوماً فقط — لا طلبات أقدم |
| 3 | join العميل | اسم العميل وهاتفه موجودان (عبر `requests_client_id_fkey`) |
| 4 | حقل الحالة | بالعربية (مفتوح، قيد التنفيذ، مكتمل، ملغي) |
| 5 | المدينة والفئة | موجودتان ومطابقتان لبيانات الطلب |

**Automation Candidate:** Yes

---

#### RPTS-007
**Name:** تصدير B-03 — طلبات مفتوحة +24 ساعة بلا عروض  
**Priority:** High | **Type:** Functional  
**Preconditions:** طلب مفتوح منذ أكثر من 24 ساعة بلا أي عرض

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تصدير B-03 | ملف `requests-no-bids-<date>.csv` |
| 2 | منطق الفلترة (خطوتان) | الخطوة 1: طلبات مفتوحة >24h؛ الخطوة 2: حذف من وصلها عروض |
| 3 | طلب عمره 23 ساعة بلا عروض | لا يظهر في التصدير |
| 4 | طلب عمره 25 ساعة بعرض واحد | لا يظهر في التصدير |
| 5 | طلب عمره 25 ساعة بلا عروض | يظهر في التصدير |

**Regression:** لا طلبات بحالة `cancelled` أو `completed` في هذا التصدير.  
**Automation Candidate:** Yes

---

#### RPTS-008
**Name:** تصدير C-01 — أداء المزودين  
**Priority:** High | **Type:** Functional  
**Preconditions:** مزودون لديهم عروض مقبولة ومرفوضة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تصدير C-01 | ملف `providers-performance-<date>.csv` |
| 2 | أعمدة الأداء | نسبة القبول، عدد الوظائف، متوسط التقييم، درجة السمعة |
| 3 | نسبة القبول | محسوبة بدقة: (عروض مقبولة / إجمالي العروض) × 100 |
| 4 | عداد العروض | يستعلم بـ limit(100,000) لتجنّب اقتطاع Supabase |
| 5 | مزوّد بلا عروض | نسبة القبول = 0% بدون قسمة على صفر |

**Automation Candidate:** No

---

#### RPTS-009
**Name:** تصدير C-03 — المزودون المُبلَّغ عنهم  
**Priority:** High | **Type:** Functional  
**Preconditions:** إشارة (`provider_flag`) بحالة `reviewed=false`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تصدير C-03 | ملف `providers-flagged-<date>.csv` |
| 2 | محتوى | مزودون ذوو إشارات غير مراجعة فقط |
| 3 | حقل سبب الإشارة | موجود ومقروء |
| 4 | إشارة مراجعة (`reviewed=true`) | لا تظهر في التصدير |
| 5 | join المزوّد | اسمه وهاتفه ومدينته موجودة |

**Automation Candidate:** Yes

---

#### RPTS-010
**Name:** تصدير E-02 — بلاغات الإساءة المعلّقة  
**Priority:** Critical | **Type:** Functional  
**Preconditions:** بلاغ بحالة `status='pending'`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تصدير E-02 | ملف `abuse-reports-pending-<date>.csv` |
| 2 | join مزدوج | اسم المُبلِّغ (reporter) واسم المُبلَّغ عنه (reported) كلاهما موجودان |
| 3 | FK hint صحيح | `reports_reporter_id_fkey` و `reports_reported_user_id_fkey` |
| 4 | بلاغ بحالة `resolved` | لا يظهر في التصدير |
| 5 | نوع البلاغ | بالعربية (احتيال، محتوى مسيء، إلخ) |

**Regression:** أعمدة المُبلِّغ والمُبلَّغ عنه لا تتشابك (لا يوجد خلط بين الاثنين).  
**Automation Candidate:** Yes

---

#### RPTS-011
**Name:** تصدير D-03 — العملاء غير النشطين (تحقق إصلاح Bug CRITICAL)  
**Priority:** High | **Type:** Regression  
**Preconditions:** عميل لم يُنشئ طلباً منذ 90 يوماً + عميل نشط (طلب خلال 90 يوم)  
**Fixes:** BUG D-03 — `id` كان مفقوداً من select

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تصدير D-03 | ملف `clients-idle-<date>.csv` |
| 2 | عميل نشط (طلب منذ 30 يوم) | **لا يظهر** في التصدير |
| 3 | عميل غير نشط (آخر طلب منذ 100 يوم) | يظهر في التصدير |
| 4 | قبل الإصلاح | كل العملاء يظهرون (لأن `u.id === undefined` دائماً) |
| 5 | بعد الإصلاح | `id` موجود في select، المقارنة `activeIds.has(u.id)` تعمل بشكل صحيح |

**Automation Candidate:** Yes

---

#### RPTS-012
**Name:** تصدير B-04 — قمع التحويل: تسمية "غادر مرحلة مفتوح" وعمود الملاحظة  
**Priority:** High | **Type:** Regression  
**Fixes:** BUG B-04 — التسمية السابقة "وصلت عروضاً" مضلّلة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تصدير B-04 | ملف `requests-funnel-<date>.csv` |
| 2 | الصف الثاني | التسمية "غادر مرحلة مفتوح" وليس "وصلت عروضاً" |
| 3 | عمود الملاحظة | يحتوي "تقريبي — يشمل ملغيات قبل أي عرض" |
| 4 | النسبة | محسوبة من إجمالي الطلبات في آخر 30 يوم |

**Automation Candidate:** No

---

#### RPTS-013
**Name:** تصدير F-03 — الملخص الأسبوعي: توافق نطاق التاريخ مع الأيام السبعة  
**Priority:** Medium | **Type:** Regression  
**Fixes:** BUG F-03 — كان `ago7d` يُسبّب فجوة ~24 ساعة في أول يوم

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تصدير F-03 | ملف `weekly-summary-<date>.csv` |
| 2 | عدد الأيام | 7 أيام بالضبط (اليوم الأول = منتصف ليل 6 أيام مضت) |
| 3 | أول صف | تاريخه يساوي `days[0]` (منتصف ليل اليوم الأول) |
| 4 | بيانات اليوم الأول | تشمل **كل** الإجراءات من منتصف ليل ذلك اليوم |
| 5 | قبل الإصلاح | البيانات من أول ~24 ساعة كانت تُستعلَم لكن لا تُحتسَب في أي bucket |

**Automation Candidate:** No

---

#### RPTS-014
**Name:** ملفات CSV تُفتح بشكل صحيح في Excel مع دعم العربية  
**Priority:** High | **Type:** Functional  
**Preconditions:** تصدير أي تقرير يحتوي بيانات عربية

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تحميل أي CSV وفتحه في Excel | لا أحرف مكسّرة (no mojibake) |
| 2 | التحقق من وجود BOM | أول 3 بايتات في الملف: `EF BB BF` (UTF-8 BOM) |
| 3 | أسماء عربية في الملف | تظهر من اليمين لليسار بشكل صحيح |
| 4 | حقل يحتوي فاصلة | محاط بعلامتي اقتباس في CSV |
| 5 | حقل يحتوي علامة اقتباس | تُهرَّب مضاعفة (`""`) |

**Automation Candidate:** Yes

---

#### RPTS-015
**Name:** تقرير بلا بيانات يُعيد CSV بترويسات فقط  
**Priority:** Medium | **Type:** Functional  
**Preconditions:** قاعدة بيانات فارغة من الحالات المعنية (مثلاً لا مزودين موقوفين)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تصدير C-04 (مزودون موقوفون) مع عدم وجود أي | يُعاد ملف CSV |
| 2 | محتوى الملف | سطر الترويسات فقط — لا صفوف بيانات |
| 3 | لا يُعاد | رسالة خطأ أو ملف فارغ تماماً (بدون ترويسات) |
| 4 | حجم الملف | صغير جداً لكن ملف صالح |

**Automation Candidate:** Yes

---

#### RPTS-016
**Name:** حماية Middleware — /api/reports/* محمي بدون جلسة  
**Priority:** Critical | **Type:** Security  
**Preconditions:** مستخدم غير مسجّل (لا cookie جلسة)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | طلب مباشر لـ `/api/reports/a-01` بدون جلسة | استجابة 302 redirect إلى `/login` |
| 2 | طلب بـ cookie مزوّر | رفض — redirect إلى `/login` |
| 3 | طلب بجلسة صالحة | CSV يُعاد بشكل طبيعي |
| 4 | فحص Middleware | `proxy.ts` (أو `middleware.ts`) يشمل `/api/reports` في نطاق الحماية |

**Regression:** الصفحة `/reports` نفسها أيضاً محمية.  
**Automation Candidate:** Yes

---

#### RPTS-017
**Name:** F-02 — حجم قاعدة البيانات: رسالة إرشادية بدلاً من CSV  
**Priority:** Medium | **Type:** Functional  
**Preconditions:** أدمن مسجّل

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | بطاقة F-02 في الصفحة | تُظهر رابطاً لـ Supabase Dashboard (ليس زر تصدير) |
| 2 | طلب GET على `/api/reports/f-02` مباشرة | يُعيد ملف CSV يحتوي رسالة "يُرجى الاطلاع على Supabase Dashboard" |
| 3 | لا يُعاد | بيانات حجم DB الفعلية (يتطلب صلاحيات pg_catalog) |

**Automation Candidate:** No

---

#### RPTS-018
**Name:** A-05 — الإيرادات الشهرية: دقة التجميع بحلقة واحدة  
**Priority:** Medium | **Type:** Regression  
**Fixes:** BUG A-05 — كانت حلقتان منفصلتان تعالجان نفس البيانات  
**Preconditions:** دفعات في أشهر متعددة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تصدير A-05 | ملف `revenue-monthly-<date>.csv` |
| 2 | دفعتان في نفس الشهر | يظهران كصف واحد (مجموع صحيح) |
| 3 | المبلغ الإجمالي | sum للمبالغ لا يتضاعف بسبب حلقة مزدوجة |
| 4 | عدد الدفعات في العمود | يعكس العدد الحقيقي (لا ضعفه) |

**Automation Candidate:** Yes

---

#### RPTS-019
**Name:** تصدير B-02 — الطلبات حسب المدينة والفئة  
**Priority:** Medium | **Type:** Functional  
**Preconditions:** طلبات في مدن وفئات مختلفة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تصدير B-02 | ملف `requests-by-city-category-<date>.csv` |
| 2 | التجميع | صف لكل مجموعة (مدينة + فئة) |
| 3 | طلبان في نفس المدينة والفئة | يظهران في صف واحد مع count=2 |
| 4 | فرز | حسب العدد تنازلياً |

**Automation Candidate:** Yes

---

#### RPTS-020
**Name:** تصدير C-06 — أفضل 20 مزوداً  
**Priority:** Low | **Type:** Functional  
**Preconditions:** أكثر من 20 مزوداً مسجلاً

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تصدير C-06 | ملف `providers-top20-<date>.csv` |
| 2 | عدد الصفوف | 20 صفاً كحد أقصى |
| 3 | الترتيب | حسب `lifetime_jobs DESC` ثم `score DESC` |
| 4 | أقل من 20 مزوداً في DB | يُعاد العدد الموجود فعلاً |

**Automation Candidate:** No

---

#### RPTS-021
**Name:** D-04 — توزيع المستخدمين: لا خطأ متغير غير مستخدم  
**Priority:** Low | **Type:** Regression  
**Fixes:** BUG D-04 — `roleMap` كان معرّفاً لكن غير مستخدم

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | تصدير D-04 | ملف `users-distribution-<date>.csv` |
| 2 | محتوى | توزيع حسب المدينة والدور |
| 3 | `tsc --noEmit` على الكود | صفر أخطاء أو تحذيرات متعلقة بـ `roleMap` |

**Automation Candidate:** No

---

#### RPTS-022
**Name:** صفحة /reports تُعيد redirect لغير المسجّلين  
**Priority:** High | **Type:** Security  
**Preconditions:** مستخدم غير مسجّل

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | الذهاب إلى `/reports` بدون جلسة | redirect تلقائي إلى `/login` |
| 2 | بعد تسجيل الدخول | redirect تلقائي إلى `/reports` |
| 3 | الـ Sidebar | **لا يظهر** في صفحة `/login` (إصلاح AdminShell) |

**Regression:** صفحة `/login` لا تُظهر أي محتوى من الأدمن.  
**Automation Candidate:** Yes

---

## 41. BUGFIX3 — Bug-Fix Regression Suite v4.0 (Pass-3)

### Overview
8 regression cases covering the bugs fixed in Pass-3 (mobile app): real-time messages, countdown timer sync, provider registration rollback, notification read-state sync, double-tap guard on task-done, provider name source in rate screen, unsaved rating discard warning, and hardcoded Arabic strings in register screen.

---

#### BUGFIX3-001
**Name:** محادثة جديدة تظهر تلقائياً في قائمة الرسائل بدون سحب للأسفل  
**Fixes:** BUG-M03 | **Priority:** High | **Type:** Real-time / Mobile  
**Preconditions:** مستخدم مسجّل دخوله (client أو provider)، شاشة الرسائل مفتوحة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | الطرف الآخر يُنشئ job جديد (يصبح active) ويُرسل رسالة أولى | المحادثة الجديدة تظهر فوراً في القائمة بدون سحب |
| 2 | تحقق من عدم السحب للأسفل | البطاقة تظهر في أعلى القائمة خلال ثوانٍ |
| 3 | اضغط على المحادثة الجديدة | شاشة الـ chat تفتح بالـ job_id الصحيح |
| 4 | تحقق بعد إغلاق التطبيق وإعادة فتحه | المحادثة لا تختفي وتبقى في القائمة |

**Regression:** المحادثات الموجودة مسبقاً لا تتأثر.  
**Automation Candidate:** No

---

#### BUGFIX3-002
**Name:** مؤقت provider-confirm يُعاد تزامنه عند عودة التطبيق من الخلفية  
**Fixes:** BUG-M05 | **Priority:** High | **Type:** Timer / Mobile  
**Preconditions:** مزود على شاشة provider-confirm والمهلة لم تنته بعد

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح شاشة provider-confirm (مهلة 15 دقيقة مثلاً) | المؤقت يعدّ تنازلياً بشكل طبيعي |
| 2 | اضغط Home لإرسال التطبيق للخلفية لمدة تتجاوز المهلة | — |
| 3 | أعد التطبيق للواجهة | شاشة "المهلة انتهت" تظهر فوراً (لا تظهر قيمة مجمّدة) |
| 4 | تكرار: إرسال للخلفية قبل انتهاء المهلة ثم العودة | المؤقت يعرض الوقت المتبقي الصحيح (لا تأخير) |
| 5 | الضغط على "تأكيد" بعد انتهاء المهلة (إن عُرض) | يُعطي رسالة خطأ deadline_expired |

**Regression:** سلوك المؤقت الطبيعي (أمامية) لا يتغير.  
**Automation Candidate:** No

---

#### BUGFIX3-003
**Name:** استرداد تسجيل مزود ناقص + rollback صحيح عند الفشل  
**Fixes:** BUG-C03 | **Priority:** Critical | **Type:** Registration / Mobile  
**Preconditions:** رقم هاتف مسجّل في auth لكن بدون providers record (حالة stuck)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | أدخل رقم الهاتف المُعلَّق → OTP → شاشة التسجيل | الشاشة تفتح بشكل طبيعي |
| 2 | اختر دور "مزود" واملأ البيانات واضغط إنشاء حساب | يكتشف النظام السجل الناقص ويُنشئ providers record |
| 3 | تحقق من التوجيه | يُوجَّه لشاشة الاشتراك (subscribe) لا "الرقم مسجّل مسبقاً" |
| 4 | سيناريو rollback: إنشاء حالة فشل providers insert مع RLS يمنع الحذف | المستخدم يُسجَّل خروجه تلقائياً → يمكنه إعادة المحاولة بـ OTP |
| 5 | تحقق من عدم وجود orphaned users records بعد rollback ناجح | users.delete تمت بنجاح عند نجاح الـ rollback |

**Regression:** مسار التسجيل الطبيعي (client وprovider) يعمل بدون تغيير.  
**Automation Candidate:** No

---

#### BUGFIX3-004
**Name:** حالة "مقروء" للإشعار الوارد real-time متزامنة بين الواجهة وقاعدة البيانات  
**Fixes:** BUG-M02 | **Priority:** Medium | **Type:** Real-time / Mobile  
**Preconditions:** المستخدم على شاشة notification-inbox

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | يصل إشعار جديد real-time | يظهر في القائمة مباشرة كـ "مقروء" (is_read: true) |
| 2 | أغلق التطبيق وأعد فتحه → افتح inbox | الإشعار لا يزال "مقروءاً" — لا يعود لـ "غير مقروء" |
| 3 | محاكاة فشل الشبكة أثناء وصول إشعار (airplane mode بعد الاستقبال) | الإشعار يُعاد لـ "غير مقروء" في الواجهة ليطابق DB |
| 4 | بعد استعادة الشبكة: اضغط على الإشعار | يُحدَّث كـ "مقروء" في DB بشكل طبيعي |

**Regression:** الإشعارات المحمَّلة عند الفتح الأول (fetchPage) لا تتأثر.  
**Automation Candidate:** No

---

#### BUGFIX3-005
**Name:** الضغط المزدوج على "أنجزت العمل" لا يُولّد كوداً جديداً  
**Fixes:** BUG-H03 | **Priority:** Critical | **Type:** Double-tap Guard / Mobile  
**Preconditions:** مزود لديه job نشط، شاشة Jobs مفتوحة

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اضغط "أنجزت العمل" مرة واحدة | يُرسَل إشعار للعميل مع كود تأكيد |
| 2 | اضغط "أنجزت العمل" مرتين متتاليتين بسرعة | طلب واحد فقط يُرسَل — الكود لا يتغير |
| 3 | العميل يُدخل الكود الذي استلمه | ينجح التأكيد بدون "كود خاطئ" |
| 4 | تحقق في DB: عدد استدعاءات send-confirm-notification | استدعاء واحد فقط للـ Edge Function لكل job |

**Regression:** زر "أنجزت العمل" يعمل بشكل طبيعي للضغطة الأولى.  
**Automation Candidate:** No

---

#### BUGFIX3-006
**Name:** اسم المزود في شاشة التقييم يأتي من قاعدة البيانات لا من URL  
**Fixes:** BUG-H06 | **Priority:** Medium | **Type:** Security / Mobile  
**Preconditions:** job مكتمل، العميل على شاشة rate-job

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح شاشة التقييم بشكل طبيعي | اسم المزود يظهر صحيحاً من DB |
| 2 | حاول تعديل provider_name في الـ URL/params يدوياً | الاسم المعروض يُحدَّث للاسم الحقيقي من DB بعد التحميل |
| 3 | أرسل التقييم | التقييم يُسجَّل للمزود الصحيح (عبر job_id) لا الاسم المُعدَّل |
| 4 | تحقق في DB: jobs.client_rating | مربوط بالـ job_id الصحيح |

**Regression:** شاشة التقييم تفتح وتعمل بشكل طبيعي.  
**Automation Candidate:** No

---

#### BUGFIX3-007
**Name:** تحذير عند الرجوع من شاشة التقييم بعد إدخال بيانات  
**Fixes:** BUG-L02 | **Priority:** High | **Type:** UX / Mobile  
**Preconditions:** العميل على شاشة rate-job

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | اضغط رجوع بدون إدخال أي شيء | التنقل يحدث مباشرة بدون Alert |
| 2 | اختر نجمة ثم اضغط رجوع (iOS header) | Alert "تجاهل التقييم؟" يظهر |
| 3 | في الـ Alert: اضغط "إلغاء" | يبقى على شاشة التقييم مع الحفاظ على البيانات |
| 4 | في الـ Alert: اضغط "تجاهل" | ينتقل لقائمة الطلبات |
| 5 | اضغط زر الرجوع الصلب (Android) بعد كتابة تعليق | نفس الـ Alert يظهر |
| 6 | اكتب تعليقاً فقط (بدون نجمة) ثم ارجع | Alert يظهر (review.trim() > 0) |

**Regression:** إرسال التقييم بشكل طبيعي يعمل بدون تأثير.  
**Automation Candidate:** No

---

#### BUGFIX3-008
**Name:** نصوص شاشة التسجيل تتغير مع اللغة  
**Fixes:** BUG-L01 | **Priority:** Low | **Type:** i18n / Mobile  
**Preconditions:** المستخدم يغيّر لغة التطبيق للإنجليزية

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | افتح شاشة التسجيل بالعربية | جميع النصوص بالعربية |
| 2 | غيّر اللغة للإنجليزية وافتح شاشة التسجيل | النص "One last step to get started" يظهر (لا "خطوة أخيرة") |
| 3 | تحقق من badge التجربة المجانية | "🎁 30-day free trial + 10 welcome credits" |
| 4 | اترك حقل الاسم فارغاً واضغط إنشاء | "⚠️ Please enter your full name" |
| 5 | لا تختر مدينة واضغط إنشاء | "⚠️ Please select your city" |
| 6 | تحقق من RoleCard banner | "○  Tap to select" / "✓  Selected" |
| 7 | تحقق من trust badge | "🔒 Your data is protected..." |

**Regression:** شاشة التسجيل بالعربية تعمل بشكل طبيعي.  
**Automation Candidate:** No

---

## 42. BUGFIX4 — Bug-Fix Regression Suite v4.1 (BUG-AC01)

**Scope:** Admin suggestions management tab + trigger column fix + RLS policies  
**Files:** `mobile/app/admin.tsx`, `supabase/migrations/090_fix_suggestions_admin.sql`, `mobile/src/i18n/ar.json`, `mobile/src/i18n/en.json`

---

#### BUGFIX4-001
**ID:** BUGFIX4-001  
**Title:** Admin can see Suggestions tab in admin screen  
**Priority:** High  
**Steps:**
1. سجّل دخول بمستخدم admin (`is_admin = true`)
2. انتقل لشاشة Admin
3. افحص صف الـ filter tabs

**Expected:** يظهر tab "اقتراحات" / "Suggestions" رابعاً بعد "محلول"  
**Regression:** باقي الـ tabs (الكل، مدفوعات، محلول) تعمل بشكل طبيعي  
**Automation Candidate:** No

---

#### BUGFIX4-002
**ID:** BUGFIX4-002  
**Title:** Suggestions tab shows pending suggestions  
**Priority:** High  
**Steps:**
1. أدخل اقتراح خدمة من حساب عميل عادي
2. ادخل لحساب Admin وانتقل لـ Admin screen
3. اضغط tab "اقتراحات"

**Expected:** يظهر الاقتراح مع اسم المستخدم والتاريخ وزري "موافقة" و"رفض"  
**Regression:** شاشة التذاكر لا تتأثر عند التبديل للـ tab  
**Automation Candidate:** No

---

#### BUGFIX4-003
**ID:** BUGFIX4-003  
**Title:** Admin approve suggestion sends notification to user  
**Priority:** High  
**Steps:**
1. في tab الاقتراحات اضغط "موافقة" على اقتراح
2. أكّد في الـ Alert
3. افحص إشعارات المستخدم صاحب الاقتراح

**Expected:** الاقتراح يختفي من القائمة + يصل إشعار "✅ تمت إضافة خدمتك!" للمستخدم  
**Regression:** الـ trigger يُدرج في الأعمدة الصحيحة (`type` + `metadata`)  
**Automation Candidate:** No

---

#### BUGFIX4-004
**ID:** BUGFIX4-004  
**Title:** Admin reject suggestion removes it from pending list  
**Priority:** High  
**Steps:**
1. في tab الاقتراحات اضغط "رفض" على اقتراح
2. أكّد في الـ Alert

**Expected:** الاقتراح يختفي فوراً من القائمة (status → rejected)، لا يُرسل إشعار  
**Regression:** الاقتراحات الأخرى في القائمة لا تتأثر  
**Automation Candidate:** No

---

#### BUGFIX4-005
**ID:** BUGFIX4-005  
**Title:** Approve/reject buttons show loading state during processing  
**Priority:** Medium  
**Steps:**
1. اضغط "موافقة" وأكّد
2. راقب الزرين أثناء معالجة الطلب

**Expected:** يظهر ActivityIndicator في الزر المضغوط، كلا الزرين معطّلان حتى ينتهي الطلب  
**Regression:** لا double-submit ممكن  
**Automation Candidate:** No

---

#### BUGFIX4-006
**ID:** BUGFIX4-006  
**Title:** Suggestions tab shows empty state when no pending suggestions  
**Priority:** Medium  
**Steps:**
1. وافق/ارفض كل الاقتراحات المعلقة
2. ابق في tab الاقتراحات

**Expected:** رسالة "لا توجد اقتراحات معلقة" تظهر بوضوح  
**Regression:** لا crash، شاشة التذاكر سليمة  
**Automation Candidate:** No

---

#### BUGFIX4-007
**ID:** BUGFIX4-007  
**Title:** Non-admin user cannot access or modify suggestions  
**Priority:** Critical  
**Steps:**
1. من حساب عميل أو مقدم، حاول استدعاء:
   `SELECT * FROM service_suggestions` (بدون filter على user_id)
2. حاول UPDATE على اقتراح لمستخدم آخر

**Expected:** RLS يمنع: SELECT يُرجع فقط اقتراحات المستخدم نفسه، UPDATE يفشل  
**Regression:** RLS policies للمستخدمين العاديين لم تتغير  
**Automation Candidate:** No

---

#### BUGFIX4-008
**ID:** BUGFIX4-008  
**Title:** Existing tickets tab unaffected after admin.tsx changes  
**Priority:** High  
**Steps:**
1. ادخل لـ Admin screen
2. تنقّل بين tabs: الكل، مدفوعات، محلول
3. افتح تذكرة وتحقق من thread

**Expected:** كل tabs التذاكر تعمل بشكل طبيعي كما كانت قبل التعديل  
**Regression:** لا تأثير على support-thread.tsx أو activate subscription  
**Automation Candidate:** No

---

---

## 43. BUGFIX5 — Bug-Fix Regression Suite v4.2 (BUG-AC02)

**Scope:** Admin subscription activation fix + Grant Trial UI  
**Files:** `supabase/migrations/091_fix_admin_subscription.sql`, `mobile/app/admin.tsx`, `mobile/src/i18n/ar.json`, `mobile/src/i18n/en.json`

---

#### BUGFIX5-001
**ID:** BUGFIX5-001  
**Title:** Admin can activate paid subscription via support thread  
**Priority:** Critical  
**Steps:**
1. مزود يفتح تذكرة دفع (basic/pro/premium)
2. أدمن يفتح الـ thread ويضغط "تفعيل الاشتراك"
3. يؤكد في الـ Alert

**Expected:** الاشتراك يُفعَّل بنجاح، التذكرة تُغلق، المزود يستلم إشعاراً  
**Regression:** تفعيل المزود لنفسه من subscribe.tsx يعمل بشكل طبيعي  
**Automation Candidate:** No

---

#### BUGFIX5-002
**ID:** BUGFIX5-002  
**Title:** Admin can grant trial via 🎁 button in admin screen  
**Priority:** High  
**Steps:**
1. اضغط زر 🎁 في header شاشة Admin
2. أدخل رقم هاتف مزود لم يستخدم التجربة
3. اضغط "بحث" → تحقق من ظهور اسم المزود
4. اضغط "منح التجربة" وأكّد

**Expected:** الاشتراك التجريبي يُفعَّل (trial_used = true)، رسالة نجاح  
**Regression:** شاشة Admin العادية لا تتأثر  
**Automation Candidate:** No

---

#### BUGFIX5-003
**ID:** BUGFIX5-003  
**Title:** Search by phone returns correct provider  
**Priority:** High  
**Steps:**
1. افتح modal منح التجربة
2. أدخل رقم هاتف بصيغة 079xxxxxxx
3. اضغط "بحث"

**Expected:** يظهر اسم المزود الصحيح  
**Regression:** بحث برقم غير موجود يُظهر رسالة "لم يُعثر على مزود"  
**Automation Candidate:** No

---

#### BUGFIX5-004
**ID:** BUGFIX5-004  
**Title:** Block granting trial to provider who already used it  
**Priority:** Critical  
**Steps:**
1. ابحث عن مزود `trial_used = true`
2. لاحظ نتيجة البحث

**Expected:** يظهر تحذير "هذا المزود استخدم التجربة مسبقاً"، زر المنح لا يظهر  
**Regression:** DB guard `trial_already_used` يمنع double-grant حتى لو تجاوز الـ UI  
**Automation Candidate:** No

---

#### BUGFIX5-005
**ID:** BUGFIX5-005  
**Title:** Provider cannot activate subscription for another provider  
**Priority:** Critical  
**Steps:**
1. من حساب مزود، استدعِ `activate_provider_subscription` مع UUID مزود آخر مباشرةً

**Expected:** exception "unauthorized: cannot activate subscription for another provider"  
**Regression:** الإصلاح لم يكسر ownership check للمستخدمين العاديين  
**Automation Candidate:** No

---

#### BUGFIX5-006
**ID:** BUGFIX5-006  
**Title:** Grant Trial modal closes and resets after success  
**Priority:** Medium  
**Steps:**
1. امنح تجربة بنجاح

**Expected:** الـ modal يُغلق، حقل الهاتف يُفرَّغ، لا بيانات قديمة عند إعادة الفتح  
**Regression:** لا تأثير على باقي الشاشة  
**Automation Candidate:** No

---

---

## 44. BUGFIX6 — Bug-Fix Regression Suite v4.3 (BUG-AH06)

**Scope:** Cursor-based pagination for admin support tickets  
**Files:** `mobile/app/admin.tsx`

---

#### BUGFIX6-001
**ID:** BUGFIX6-001  
**Title:** Admin sees first 30 tickets on screen open  
**Priority:** High  
**Steps:**
1. أدخل لشاشة Admin (أكثر من 30 تذكرة موجودة في DB)
2. افحص القائمة عند الفتح

**Expected:** تظهر أحدث 30 تذكرة مرتبة تنازلياً بالتاريخ  
**Regression:** الـ filter tabs تعمل كما كانت  
**Automation Candidate:** No

---

#### BUGFIX6-002
**ID:** BUGFIX6-002  
**Title:** Scrolling to end loads next page  
**Priority:** High  
**Steps:**
1. مرر للأسفل حتى نهاية القائمة (30 تذكرة)
2. انتظر تحميل الصفحة التالية

**Expected:** spinner يظهر في الأسفل → 30 تذكرة إضافية تُضاف  
**Regression:** التذاكر الأولى لا تختفي، لا تكرار  
**Automation Candidate:** No

---

#### BUGFIX6-003
**ID:** BUGFIX6-003  
**Title:** Filter change resets list to first page  
**Priority:** High  
**Steps:**
1. مرر لأسفل وحمّل صفحة ثانية
2. غيّر الـ filter (مثلاً من "الكل" إلى "مدفوعات")

**Expected:** القائمة تُفرَّغ وتبدأ من أول 30 تذكرة للفلتر الجديد  
**Regression:** الـ cursor يُصفَّر عند كل تغيير filter  
**Automation Candidate:** No

---

#### BUGFIX6-004
**ID:** BUGFIX6-004  
**Title:** Pull-to-refresh resets to first page  
**Priority:** Medium  
**Steps:**
1. مرر للأسفل وحمّل عدة صفحات
2. اسحب للأعلى لتفعيل pull-to-refresh

**Expected:** القائمة تُعاد من أول 30 تذكرة  
**Regression:** لا تكرار في التذاكر بعد الـ refresh  
**Automation Candidate:** No

---

#### BUGFIX6-005
**ID:** BUGFIX6-005  
**Title:** No more pages indicator stops loading  
**Priority:** Medium  
**Steps:**
1. مرر للأسفل حتى تنتهي كل التذاكر

**Expected:** الـ spinner لا يظهر بعد آخر صفحة، لا طلبات إضافية للـ DB  
**Regression:** لا infinite loop  
**Automation Candidate:** No

---

#### BUGFIX6-006
**ID:** BUGFIX6-006  
**Title:** Suggestions tab unaffected by pagination changes  
**Priority:** Medium  
**Steps:**
1. انتقل لـ tab "اقتراحات"
2. تحقق من عرض الاقتراحات المعلقة

**Expected:** الاقتراحات تظهر كما كانت، لا تأثير من pagination  
**Regression:** أزرار الموافقة/الرفض تعمل طبيعياً  
**Automation Candidate:** No

---

## 45. BUGFIX7 — Bug-Fix Regression Suite v4.4 (BUG-AM02)

**Bug:** BUG-AM02 — Admin ticket count badge not updating in real-time  
**Fix:** Added Supabase Realtime subscription on `support_tickets` INSERT in `support.tsx`; badge increments immediately when a new ticket arrives without screen reload.  
**Date:** 2026-05-14  
**Files Changed:** `mobile/app/support.tsx`

---

#### BUGFIX7-001
**ID:** BUGFIX7-001  
**Title:** Admin badge increments in real-time when new ticket submitted  
**Priority:** High  
**Steps:**
1. سجّل دخول كـ admin وانتقل لشاشة الدعم (support)
2. في جهاز/نافذة ثانية، أرسل تذكرة دعم جديدة كمستخدم عادي
3. راقب شارة "صندوق الوارد" في شاشة الدعم للمسؤول دون إعادة تحميل

**Expected:** ترتفع قيمة الشارة فوراً (+1) بدون reload  
**Regression:** لا تأثير على أزرار الانتقال لـ /admin  
**Automation Candidate:** Yes

---

#### BUGFIX7-002
**ID:** BUGFIX7-002  
**Title:** Badge shows correct initial count on screen mount  
**Priority:** High  
**Steps:**
1. أنشئ 3 تذاكر مفتوحة مسبقاً
2. انتقل من admin→ support (أو أعد تحميل التطبيق)
3. لاحظ الرقم في شارة صندوق الوارد

**Expected:** تعرض الشارة عدد التذاكر الفعلية (3) عند التحميل الأولي  
**Regression:** بيانات الحالة الأولية لا تتأثر بالـ subscription  
**Automation Candidate:** No

---

#### BUGFIX7-003
**ID:** BUGFIX7-003  
**Title:** Multiple rapid tickets each increment badge once  
**Priority:** Medium  
**Steps:**
1. Admin يفتح شاشة الدعم (adminNew = 0)
2. أرسل 3 تذاكر متتالية بسرعة
3. راقب الشارة

**Expected:** الشارة تصل لـ 3 بعد استقرار الـ events  
**Regression:** لا تكرار في الإضافة  
**Automation Candidate:** No

---

#### BUGFIX7-004
**ID:** BUGFIX7-004  
**Title:** Non-admin users do not create Realtime channel  
**Priority:** Medium  
**Steps:**
1. سجّل دخول كمستخدم عادي (غير admin) وافتح شاشة الدعم
2. راقب network/console: لا يجب إنشاء channel لـ support_tickets

**Expected:** لا subscription على `support_tickets` للمستخدم العادي  
**Regression:** شاشة الدعم تعمل طبيعياً بدون أخطاء  
**Automation Candidate:** No

---

#### BUGFIX7-005
**ID:** BUGFIX7-005  
**Title:** Realtime channel cleaned up on screen unmount  
**Priority:** Medium  
**Steps:**
1. Admin يفتح شاشة الدعم
2. Admin ينتقل بعيداً (back / navigate)
3. تحقق من console: لا تحذيرات "channel already subscribed" أو memory leaks

**Expected:** `removeChannel` يُستدعى عند unmount، لا تسرب  
**Regression:** تنقل الشاشات بعدها يعمل طبيعياً  
**Automation Candidate:** No

---

#### BUGFIX7-006
**ID:** BUGFIX7-006  
**Title:** Badge absent when adminNew = 0 (no false zero badge)  
**Priority:** Low  
**Steps:**
1. Admin يفتح شاشة الدعم وجميع التذاكر مغلقة (adminNew = 0)
2. تحقق من زر "صندوق الوارد"

**Expected:** لا تظهر شارة عندما القيمة = 0  
**Regression:** الزر نفسه يظل مرئياً للـ admin  
**Automation Candidate:** No

---

## 46. BUGFIX8 — Bug-Fix Regression Suite v4.5 (BUG-H04)

**Bug:** BUG-H04 — Admin portal route shows static "not authorized" page instead of auto-redirecting  
**Fix:** Replaced static error view with `router.replace('/support')` so non-admin users are immediately redirected. DB-level RLS already protects all data.  
**Date:** 2026-05-14  
**Files Changed:** `mobile/app/admin.tsx`

---

#### BUGFIX8-001
**ID:** BUGFIX8-001  
**Title:** Non-admin user navigating to /admin is auto-redirected to support screen  
**Priority:** High  
**Steps:**
1. سجّل دخول كمستخدم عادي (غير admin)
2. انتقل مباشرةً لـ /admin (عبر deep link أو navigation)
3. لاحظ ماذا يحدث

**Expected:** إعادة توجيه فورية لشاشة الدعم (/support) دون عرض أي محتوى للأدمن  
**Regression:** المستخدم الأدمن يصل للشاشة بشكل طبيعي  
**Automation Candidate:** Yes

---

#### BUGFIX8-002
**ID:** BUGFIX8-002  
**Title:** Admin user accesses admin panel without redirect  
**Priority:** High  
**Steps:**
1. سجّل دخول كـ admin
2. انتقل لـ /admin

**Expected:** الشاشة تُحمَّل بشكل طبيعي، لا redirect  
**Regression:** جميع التبويبات (all, open, in_review, suggestions) تعمل  
**Automation Candidate:** Yes

---

#### BUGFIX8-003
**ID:** BUGFIX8-003  
**Title:** DB RLS blocks direct API access by non-admin  
**Priority:** Critical  
**Steps:**
1. احصل على JWT لمستخدم عادي
2. استعلم مباشرةً: `SELECT * FROM support_tickets`

**Expected:** يرجع فقط تذاكر المستخدم نفسه (user_id = auth.uid())  
**Regression:** الأدمن يرى كل التذاكر بنفس الاستعلام  
**Automation Candidate:** Yes

---

#### BUGFIX8-004
**ID:** BUGFIX8-004  
**Title:** Loading state does not flash admin content before redirect  
**Priority:** Medium  
**Steps:**
1. مستخدم عادي يفتح /admin
2. راقب ما يظهر خلال أول 500ms

**Expected:** لا يظهر أي محتوى للأدمن — فقط loading spinner ثم redirect  
**Regression:** لا flash للتذاكر أو الإحصائيات  
**Automation Candidate:** No

---

---

## 47. BUGFIX9 — Bug-Fix Regression Suite v4.6 (Race Condition — useUnreadMsgCount)

**Bug:** Race condition في `useUnreadMsgCount.ts` — double subscribe crash  
**Fix:** Added `cancelled` flag; after `await refresh()`, checks `if (cancelled) return` so a cleaned-up effect never calls `.on()` on an already-subscribed channel.  
**Date:** 2026-05-14  
**Files Changed:** `mobile/src/hooks/useUnreadMsgCount.ts`

---

#### BUGFIX9-001
**ID:** BUGFIX9-001  
**Title:** No console error on rapid mount/unmount of message screen  
**Priority:** High  
**Steps:**
1. افتح شاشة الرسائل ثم اضغط Back بسرعة
2. أعد فتح شاشة الرسائل
3. راقب console: لا يجب ظهور خطأ "cannot add postgres_changes callbacks after subscribe()"

**Expected:** لا أخطاء، عداد الرسائل يعمل طبيعياً  
**Regression:** عداد الرسائل غير المقروءة يظهر القيمة الصحيحة  
**Automation Candidate:** No

---

#### BUGFIX9-002
**ID:** BUGFIX9-002  
**Title:** Unread count updates correctly on new message after remount  
**Priority:** High  
**Steps:**
1. افتح التطبيق، انتقل للرسائل ثم ارجع، ثم أعد الفتح
2. أرسل رسالة جديدة من حساب آخر
3. لاحظ العداد في الـ tab bar

**Expected:** العداد يرتفع +1 بشكل طبيعي  
**Regression:** لا تأثير على أي شاشة أخرى تستخدم useUnreadMsgCount  
**Automation Candidate:** No

---

#### BUGFIX9-003
**ID:** BUGFIX9-003  
**Title:** Channel cleanup on screen leave — no memory leak  
**Priority:** Medium  
**Steps:**
1. افتح شاشة الرسائل
2. انتقل لشاشة أخرى
3. راقب: لا تحذيرات "channel already subscribed" أو memory leaks في console

**Expected:** removeChannel يُستدعى عند unmount بشكل نظيف  
**Regression:** باقي الشاشات لا تتأثر  
**Automation Candidate:** No

---

---

## 48. BUGFIX10 — Bug-Fix Regression Suite v4.7 (BUG-AL01 i18n)

**Bug:** كلمة "بروفايل" (دخيلة) مستخدمة بدلاً من "ملف" (عربية فصيحة) في 10 مواضع  
**Fix:** استبدال كامل في `ar.json` — لا تغيير في الكود أو المفاتيح  
**Date:** 2026-05-14  
**Files Changed:** `mobile/src/i18n/ar.json`

---

#### BUGFIX10-001
**ID:** BUGFIX10-001  
**Title:** Provider profile screen title shows "ملف المقدم" in Arabic  
**Priority:** Medium  
**Steps:**
1. غيّر لغة التطبيق للعربية
2. افتح ملف أي مقدم خدمة

**Expected:** عنوان الشاشة يقرأ "ملف المقدم" (لا "بروفايل المقدم")  
**Regression:** English mode يبقى "Provider Profile" بدون تغيير  
**Automation Candidate:** Yes

---

#### BUGFIX10-002
**ID:** BUGFIX10-002  
**Title:** Share sheet title shows "مشاركة ملف {{name}}"  
**Priority:** Medium  
**Steps:**
1. افتح ملف مقدم → اضغط مشاركة
2. لاحظ عنوان نافذة المشاركة

**Expected:** "مشاركة ملف اسم المقدم" (لا بروفايل)  
**Regression:** رابط المشاركة يعمل طبيعياً  
**Automation Candidate:** No

---

#### BUGFIX10-003
**ID:** BUGFIX10-003  
**Title:** Chat "share profile" message shows "ملف" not "بروفايل"  
**Priority:** Medium  
**Steps:**
1. في شاشة المحادثة، شارك ملف مقدم
2. لاحظ نص الرسالة المُرسلة

**Expected:** "أشارك معك ملف [الاسم] 👤"  
**Regression:** وظيفة المشاركة في المحادثة تعمل طبيعياً  
**Automation Candidate:** No

---

#### BUGFIX10-004
**ID:** BUGFIX10-004  
**Title:** Referral section shows "شارك ملفك" not "بروفايلك"  
**Priority:** Low  
**Steps:**
1. افتح ملف المقدم الخاص بك (provider view)
2. مرر للأسفل لقسم الإحالة

**Expected:** العنوان يقرأ "📣 شارك ملفك"  
**Regression:** زر المشاركة يعمل طبيعياً  
**Automation Candidate:** No

---

---

## 49. BUGFIX11 — Bug-Fix Regression Suite v4.8 (كهرباء → كهرباء المنازل)

**Bug:** تخصص "كهرباء" (صيانة المنازل) يظهر بدون سياق بجانب "كهرباء السيارات"  
**Fix:** تم تغيير الاسم إلى "كهرباء المنازل" في categories.ts + ar.json + en.json + DB migration + رفع CACHE_KEY إلى v2  
**Date:** 2026-05-14  
**Files Changed:** `categories.ts`, `ar.json`, `en.json`, `useCategories.ts`, `092_rename_electrical_category.sql`

---

#### BUGFIX11-001
**ID:** BUGFIX11-001  
**Title:** Provider specialty selection shows "كهرباء المنازل" not "كهرباء"  
**Priority:** Medium  
**Steps:**
1. سجّل دخول كمزود خدمة جديد أو افتح "تعديل التخصصات"
2. ابحث عن تخصص الكهرباء تحت مجموعة "صيانة المنازل"

**Expected:** يظهر "كهرباء المنازل" (لا "كهرباء")  
**Regression:** "كهرباء السيارات" تحت صيانة السيارات تبقى كما هي  
**Automation Candidate:** Yes

---

#### BUGFIX11-002
**ID:** BUGFIX11-002  
**Title:** Provider profile tag shows "كهرباء المنازل" not "كهرباء"  
**Priority:** Medium  
**Steps:**
1. افتح ملف مزود يملك تخصص `electrical`
2. لاحظ الـ tag المعروضة

**Expected:** ⚡ كهرباء المنازل  
**Regression:** باقي التخصصات تُعرض بأسمائها الصحيحة  
**Automation Candidate:** Yes

---

#### BUGFIX11-003
**ID:** BUGFIX11-003  
**Title:** Cache bust — fresh install or expired cache shows new name  
**Priority:** Medium  
**Steps:**
1. احذف بيانات التطبيق (أو انتظر انتهاء الساعة) ثم أعد الفتح
2. افتح شاشة اختيار التخصصات

**Expected:** يُجلب من DB "كهرباء المنازل" مباشرة، لا "كهرباء" القديمة  
**Regression:** جميع التخصصات الأخرى تُجلب بشكل صحيح  
**Automation Candidate:** No

---

#### BUGFIX11-004
**ID:** BUGFIX11-004  
**Title:** English mode shows "Home Electrical" not "Electrical"  
**Priority:** Low  
**Steps:**
1. غيّر لغة التطبيق للإنجليزية
2. افتح تعديل التخصصات أو ملف مزود

**Expected:** التخصص يُعرض كـ "Home Electrical"  
**Regression:** "Car Electrical" تبقى كما هي  
**Automation Candidate:** Yes

---

---

## 50. FEAT1 — Onboarding Flow Redesign (Auto-Trial + Welcome Screen)

**Change:** حذف Step 4 (اختيار الخطة) من تسجيل المزود — التجريبية تُفعَّل تلقائياً + شاشة ترحيب تسويقية  
**Date:** 2026-05-14  
**Files Changed:** `mobile/app/(auth)/onboarding.tsx`, `mobile/src/i18n/ar.json`

---

#### FEAT1-001
**ID:** FEAT1-001  
**Title:** Provider registration completes in 3 steps (not 4)  
**Priority:** High  
**Steps:**
1. سجّل حساباً جديداً كمزود خدمة
2. أكمل الخطوات وتابع progress bar

**Expected:** شريط التقدم يُظهر 3 خطوات فقط (لا 4)، لا تظهر شاشة "اختر خطة البداية"  
**Regression:** تسجيل العميل يبقى خطوتين  
**Automation Candidate:** Yes

---

#### FEAT1-002
**ID:** FEAT1-002  
**Title:** Trial activated automatically on provider registration  
**Priority:** Critical  
**Steps:**
1. سجّل مزود جديد وأكمل الخطوات الثلاث
2. تحقق من DB: providers.is_subscribed + subscription_tier + subscription_credits

**Expected:** `is_subscribed=true`, `subscription_tier='trial'`, `subscription_credits=10`, `trial_used=true`  
**Regression:** المزود يصل للداشبورد مباشرة بعد الترحيب  
**Automation Candidate:** Yes

---

#### FEAT1-003
**ID:** FEAT1-003  
**Title:** Welcome screen shows 10 free credits with 30-day validity  
**Priority:** High  
**Steps:**
1. أكمل تسجيل مزود جديد
2. لاحظ الشاشة التي تظهر قبل الداشبورد

**Expected:** تظهر شاشة "حسابك جاهز! 🎉" مع نص "10 رصيد مجاني · صالحة لمدة 30 يوماً — مجاناً"  
**Regression:** زر "اكتشف التطبيق" يوصل للداشبورد  
**Automation Candidate:** No

---

#### FEAT1-004
**ID:** FEAT1-004  
**Title:** No redirect to subscribe screen after registration  
**Priority:** High  
**Steps:**
1. سجّل مزود جديد وأكمل التسجيل
2. اضغط "اكتشف التطبيق"

**Expected:** يذهب مباشرة لـ `/(provider)` home — لا يُحوَّل لـ /subscribe  
**Regression:** شاشة /subscribe لا تزال متاحة من الداشبورد  
**Automation Candidate:** Yes

---

#### FEAT1-005
**ID:** FEAT1-005  
**Title:** Provider with trialUsed=true can still register (no crash)  
**Priority:** Medium  
**Steps:**
1. حاول تسجيل مزود بنفس الرقم مرتين (أو حساب استُنفدت تجريبيته)
2. تابع السلوك

**Expected:** الحساب يُنشأ بدون تفعيل trial — لا crash  
**Regression:** رسالة الخطأ الصحيحة تظهر للحساب المكرر  
**Automation Candidate:** No

---

---

## 51. BUGFIX12 — Bug-Fix Regression Suite v5.0 (City i18n)

**Bug:** أسماء المدن الأردنية تظهر بالعربية في وضع اللغة الإنجليزية  
**Root Cause:** `provider-profile.tsx` و`(provider)/profile.tsx` يعرضان `city` مباشرة من DB بدون `t()` + مأدبا مفقودة من ملفي الترجمة  
**Fix:** تغليف بـ `t('cities.X', X)` في الملفين + إضافة مأدبا/Madaba  
**Date:** 2026-05-14  
**Files Changed:** `provider-profile.tsx`, `(provider)/profile.tsx`, `ar.json`, `en.json`

---

#### BUGFIX12-001
**ID:** BUGFIX12-001  
**Title:** Provider public profile shows city in English when app is in English  
**Priority:** High  
**Steps:**
1. غيّر لغة التطبيق للإنجليزية
2. افتح ملف أي مزود (provider-profile)
3. لاحظ اسم المدينة

**Expected:** تظهر "Irbid" بدلاً من "إربد" (وهكذا لكل المدن)  
**Regression:** الوضع العربي يعرض الأسماء العربية كما كان  
**Automation Candidate:** Yes

---

#### BUGFIX12-002
**ID:** BUGFIX12-002  
**Title:** Provider own profile (My Profile) shows city in English  
**Priority:** High  
**Steps:**
1. غيّر لغة التطبيق للإنجليزية
2. افتح تبويب Profile للمزود
3. لاحظ chip المدينة

**Expected:** "Amman" / "Irbid" / إلخ — لا عربية  
**Regression:** زر تعديل المدينة يعمل طبيعياً  
**Automation Candidate:** Yes

---

#### BUGFIX12-003
**ID:** BUGFIX12-003  
**Title:** Madaba city displays correctly in both languages  
**Priority:** Medium  
**Steps:**
1. سجّل مزود باختيار مدينة "مأدبا"
2. افتح الملف بالعربية ثم بالإنجليزية

**Expected:** بالعربية "مأدبا" — بالإنجليزية "Madaba"  
**Regression:** باقي المدن لا تتأثر  
**Automation Candidate:** Yes

---

#### BUGFIX12-004
**ID:** BUGFIX12-004  
**Title:** All 12 Jordan cities translate correctly in English mode  
**Priority:** Medium  
**Steps:**
1. اختبر جميع المدن: عمّان، الزرقاء، إربد، العقبة، السلط، المفرق، جرش، عجلون، الكرك، معان، الطفيلة، مأدبا
2. تحقق من الترجمة الإنجليزية في الملف الشخصي

**Expected:** كل مدينة تظهر باسمها الإنجليزي الصحيح  
**Regression:** client profile يظل يعرض الترجمة الصحيحة (كان صحيحاً مسبقاً)  
**Automation Candidate:** Yes

---

---

## 52. BUGFIX13 — RTL Alert Dialog Fix (AppAlert Hook)

**Date:** 2026-05-14  
**Scope:** 5 screens — login, verify, verify-phone, notification-settings, provider profile  
**Root Cause:** Native Android `Alert.alert()` renders title with LTR alignment regardless of app RTL setting. Message body auto-detects Arabic text direction (Unicode Bidi) but title does not.  
**Fix:** Created `useAppAlert` hook (Modal-based) as drop-in replacement. Same API `showAlert(title, message)`. 30 calls replaced across 5 screens. Zero logic changes.

---

#### BUGFIX13-001
**ID:** BUGFIX13-001  
**Title:** Alert title "خطأ" appears right-aligned in Arabic mode — login screen  
**Priority:** Medium  
**Steps:**
1. افتح التطبيق باللغة العربية على أندرويد
2. أدخل رقم هاتف غير صالح في شاشة تسجيل الدخول
3. اضغط "إرسال الرمز"

**Expected:** نافذة تنبيه تظهر مع عنوان "خطأ" محاذٍ لليمين ✅  
**Regression:** نافذة التنبيه تظهر وتُغلق بشكل صحيح، لا تأثير على منطق OTP  
**Automation Candidate:** No (visual only)

---

#### BUGFIX13-002
**ID:** BUGFIX13-002  
**Title:** Alert title "رمز خاطئ" appears right-aligned in Arabic mode — verify screen  
**Priority:** High  
**Steps:**
1. افتح التطبيق باللغة العربية على أندرويد
2. أدخل رمز OTP خاطئ في شاشة التحقق

**Expected:** نافذة تنبيه تظهر بعنوان "رمز خاطئ" محاذٍ لليمين ✅  
**Regression:** حقول OTP تُفرّغ بعد الخطأ، التركيز يعود للحقل الأول — يظل يعمل  
**Automation Candidate:** No (visual only)

---

#### BUGFIX13-003
**ID:** BUGFIX13-003  
**Title:** Alert title "خطأ" appears right-aligned — verify-phone screen  
**Priority:** Medium  
**Steps:**
1. افتح التطبيق باللغة العربية على أندرويد
2. في شاشة تغيير رقم الهاتف، أدخل رمزاً خاطئاً

**Expected:** عنوان "خطأ" / "رمز خاطئ" محاذٍ لليمين ✅  
**Regression:** منطق تغيير الهاتف لا يتأثر  
**Automation Candidate:** No (visual only)

---

#### BUGFIX13-004
**ID:** BUGFIX13-004  
**Title:** Alert title right-aligned in Arabic mode — notification-settings screen  
**Priority:** Low  
**Steps:**
1. افتح إعدادات الإشعارات باللغة العربية على أندرويد
2. اضغط "حفظ" مع خطأ في الشبكة (simulate offline)

**Expected:** عنوان "خطأ" محاذٍ لليمين ✅  
**Regression:** إعدادات الإشعارات تُحفظ وتُقرأ بشكل صحيح  
**Automation Candidate:** No (visual only)

---

#### BUGFIX13-005
**ID:** BUGFIX13-005  
**Title:** Alert title right-aligned in Arabic mode — provider profile screen  
**Priority:** Medium  
**Steps:**
1. افتح ملف مزود الخدمة باللغة العربية على أندرويد
2. حاول حفظ تخصصات مع تجاوز الحد الأقصى

**Expected:** عنوان "الحد الأقصى للتخصصات" محاذٍ لليمين ✅  
**Regression:** حفظ التخصصات واختيار المدينة يظلان يعملان بشكل صحيح  
**Automation Candidate:** No (visual only)

---

#### BUGFIX13-006
**ID:** BUGFIX13-006  
**Title:** AppAlert OK button dismisses dialog correctly  
**Priority:** High  
**Steps:**
1. أي شاشة من الشاشات الخمس — أثِر نافذة التنبيه
2. اضغط "حسناً"

**Expected:** النافذة تُغلق فوراً، الشاشة الأصلية تظهر بدون أي تأثير جانبي  
**Regression:** لا تغيير في state الشاشة بعد الإغلاق  
**Automation Candidate:** No (visual only)

---

---

## 53. BUGFIX14 — Image Picker Buttons RTL Order Fix

**Date:** 2026-05-14  
**Scope:** portfolio-add.tsx — pickImage dialog  
**Root Cause:** Alert.alert() renders buttons L→R in array order. In RTL mode, "إلغاء" appeared on the right (most prominent position). Camera and Gallery were on the left — opposite of RTL expectations.  
**Fix:** Reverse buttons array when `isRTL` is true. No logic changes.

---

#### BUGFIX14-001
**ID:** BUGFIX14-001  
**Title:** Image picker buttons appear in correct RTL order — Arabic mode  
**Priority:** Low  
**Steps:**
1. افتح التطبيق باللغة العربية على أندرويد
2. اذهب إلى إضافة عمل جديد في المحفظة
3. اضغط على أي صورة مقارنة (قبل أو بعد)

**Expected:** ترتيب الأزرار من اليمين لليسار: الكاميرا ← معرض الصور ← إلغاء ✅  
**Regression:** الكاميرا ومعرض الصور يعملان بشكل صحيح بعد عكس الترتيب  
**Automation Candidate:** No (visual only)

---

#### BUGFIX14-002
**ID:** BUGFIX14-002  
**Title:** Image picker buttons maintain correct LTR order — English mode  
**Priority:** Low  
**Steps:**
1. افتح التطبيق باللغة الإنجليزية
2. اذهب إلى إضافة عمل جديد في المحفظة
3. اضغط على أي صورة مقارنة

**Expected:** ترتيب الأزرار من اليسار لليمين: Camera ← Gallery ← Cancel ✅  
**Regression:** لا تأثير على وضع اللغة الإنجليزية  
**Automation Candidate:** No (visual only)

---

---

## 54. PRELAUNCH1 — Pre-Launch Hardening Suite (3G Resilience + Security)

**Date:** 2026-05-15  
**Scope:** login.tsx, verify.tsx, jobs.tsx, (client)/index.tsx, requests.tsx, provider-profile.tsx, seed.ts, seed.js, git history  
**Changes:**
- Slow-network indicator (8 s timer) added to OTP send, OTP verify, OTP resend, task-done send
- hasError state + retry button added to jobs list, client home, requests list, provider profile
- Safety timeout (12 s) added to jobs list, requests list, provider profile data loaders
- Network poll interval: 15 s → 5 s
- CHANNEL_ERROR fallback refresh on all Realtime channels
- AI price suggest wrapped in 10 s Promise.race
- i18n: "Start" → "Get Started", "Sending..." → "Resending..."
- Service role JWT removed from seed.ts + seed.js (replaced with env var)
- Git history rewritten with git filter-repo to purge key from all 405 commits

---

#### PRELAUNCH1-001
**ID:** PRELAUNCH1-001  
**Title:** Slow-network hint appears during OTP send on 3G  
**Priority:** Medium  
**Steps:**
1. افتح شاشة تسجيل الدخول
2. أدخل رقم الهاتف واضغط "إرسال الرمز"
3. محاكاة شبكة بطيئة (DevTools throttle → Slow 3G) قبل الضغط
4. انتظر 8 ثوانٍ دون استجابة

**Expected:** يظهر نص "🌐 الشبكة بطيئة، الرسالة في الطريق..." بلون أصفر تحت الزر  
**Regression:** لا تغيير في منطق إرسال OTP أو معالجة الأخطاء  
**Automation Candidate:** No

---

#### PRELAUNCH1-002
**ID:** PRELAUNCH1-002  
**Title:** Slow-network hint disappears after OTP send completes  
**Priority:** Medium  
**Steps:**
1. كرّر PRELAUNCH1-001
2. انتظر حتى يكتمل الإرسال (ناجح أو فاشل)

**Expected:** يختفي النص الأصفر بمجرد انتهاء العملية  
**Regression:** لا يبقى النص على الشاشة بعد انتهاء الطلب  
**Automation Candidate:** No

---

#### PRELAUNCH1-003
**ID:** PRELAUNCH1-003  
**Title:** Slow-network hint appears during OTP verification on slow connection  
**Priority:** Medium  
**Steps:**
1. أدخل رمز OTP الخاطئ على شاشة verify
2. محاكاة شبكة بطيئة
3. اضغط "تحقق" وانتظر 8 ثوانٍ

**Expected:** يظهر نص "🌐 الشبكة بطيئة..." طالما التحميل مستمر  
**Regression:** رسائل خطأ OTP (رمز خاطئ، منتهي) تعمل بشكل طبيعي  
**Automation Candidate:** No

---

#### PRELAUNCH1-004
**ID:** PRELAUNCH1-004  
**Title:** Slow-network hint appears during OTP resend  
**Priority:** Medium  
**Steps:**
1. على شاشة verify، انتظر انتهاء مؤقت إعادة الإرسال
2. محاكاة شبكة بطيئة واضغط "إعادة الإرسال"
3. انتظر 8 ثوانٍ

**Expected:** يظهر نص المهلة أثناء عملية إعادة الإرسال  
**Automation Candidate:** No

---

#### PRELAUNCH1-005
**ID:** PRELAUNCH1-005  
**Title:** Slow-network hint during task-done send on provider jobs screen  
**Priority:** Medium  
**Steps:**
1. سجّل دخول كمزود خدمة، افتح قائمة الوظائف
2. افتح وظيفة جارية واضغط "إرسال رمز الإتمام"
3. محاكاة شبكة بطيئة وانتظر 8 ثوانٍ

**Expected:** يظهر "🌐 الشبكة بطيئة، الرمز في الطريق..." أثناء الإرسال البطيء  
**Automation Candidate:** No

---

#### PRELAUNCH1-006
**ID:** PRELAUNCH1-006  
**Title:** Jobs screen shows error state with retry button on network failure  
**Priority:** High  
**Steps:**
1. أوقف الاتصال بالإنترنت تماماً
2. افتح تطبيق مزود الخدمة واذهب لقائمة الوظائف

**Expected:** تظهر رسالة خطأ ⚠️ مع زر "إعادة المحاولة" بدلاً من قائمة فارغة  
**Regression:** عند استعادة الاتصال والضغط على الزر، تُحمّل الوظائف بشكل طبيعي  
**Automation Candidate:** No

---

#### PRELAUNCH1-007
**ID:** PRELAUNCH1-007  
**Title:** Client home screen shows error state with retry on network failure  
**Priority:** High  
**Steps:**
1. أوقف الاتصال بالإنترنت
2. افتح التطبيق كعميل (الصفحة الرئيسية)

**Expected:** تظهر رسالة خطأ مع زر إعادة المحاولة بدلاً من الشاشة الفارغة  
**Regression:** الضغط على "إعادة المحاولة" يستأنف التحميل الطبيعي  
**Automation Candidate:** No

---

#### PRELAUNCH1-008
**ID:** PRELAUNCH1-008  
**Title:** Client requests list shows error state with retry on network failure  
**Priority:** High  
**Steps:**
1. أوقف الاتصال
2. افتح "طلباتي" كعميل

**Expected:** رسالة خطأ + زر إعادة المحاولة في المكوّن الفارغ  
**Regression:** حالات الفلترة (نشط، مكتمل، ملغى) تعمل طبيعياً بعد استعادة الاتصال  
**Automation Candidate:** No

---

#### PRELAUNCH1-009
**ID:** PRELAUNCH1-009  
**Title:** Provider profile shows network-error message (not "not found") on load failure  
**Priority:** High  
**Steps:**
1. أوقف الاتصال
2. افتح ملف مزود خدمة من قائمة العروض

**Expected:** يظهر "تعذّر تحميل الملف الشخصي" مع زر "إعادة المحاولة" — لا رسالة "المزود غير موجود"  
**Regression:** عند استعادة الاتصال والضغط retry، يُحمّل الملف الشخصي بشكل كامل  
**Automation Candidate:** No

---

#### PRELAUNCH1-010
**ID:** PRELAUNCH1-010  
**Title:** Safety timeout prevents infinite spinner (12 s cap)  
**Priority:** High  
**Steps:**
1. محاكاة استجابة معلّقة (block all network, no error returned)
2. افتح jobs list أو requests list أو provider profile

**Expected:** يختفي مؤشر التحميل بعد 12 ثانية على الأكثر حتى بدون استجابة خادم  
**Regression:** الشاشة لا تتجمد إلى الأبد على مؤشر التحميل  
**Automation Candidate:** No

---

#### PRELAUNCH1-011
**ID:** PRELAUNCH1-011  
**Title:** Realtime CHANNEL_ERROR triggers fallback refresh on unread message count  
**Priority:** High  
**Steps:**
1. سجّل الدخول كعميل لديه رسائل غير مقروءة
2. محاكاة انقطاع WebSocket (أوقف الشبكة ثم استعدها)

**Expected:** عدد الرسائل غير المقروءة يتحدث بعد استعادة الاتصال دون الحاجة لإعادة تشغيل التطبيق  
**Automation Candidate:** No

---

#### PRELAUNCH1-012
**ID:** PRELAUNCH1-012  
**Title:** Realtime CHANNEL_ERROR triggers fallback refresh on notification count  
**Priority:** High  
**Steps:**
1. سجّل الدخول كمزود خدمة لديه إشعارات
2. محاكاة انقطاع WebSocket

**Expected:** عداد الإشعارات يتحدث بعد استعادة الاتصال  
**Automation Candidate:** No

---

#### PRELAUNCH1-013
**ID:** PRELAUNCH1-013  
**Title:** AI price suggestion times out gracefully after 10 s (new request)  
**Priority:** Medium  
**Steps:**
1. في وضع الشبكة البطيئة جداً، ابدأ إنشاء طلب جديد
2. اختر الخدمة وانتظر اقتراح السعر

**Expected:** بعد 10 ثوانٍ بدون استجابة من AI، تُعرض حقول السعر فارغة دون خطأ — الطلب يمكن إتمامه  
**Regression:** اقتراح AI الناجح خلال 10 ثوانٍ يُعرض بشكل طبيعي  
**Automation Candidate:** No

---

#### PRELAUNCH1-014
**ID:** PRELAUNCH1-014  
**Title:** AI price suggestion times out gracefully after 10 s (urgent request)  
**Priority:** Medium  
**Steps:**
1. كرّر PRELAUNCH1-013 من شاشة الطلب العاجل

**Expected:** نفس السلوك — المهلة الزمنية لا تمنع إتمام الطلب العاجل  
**Automation Candidate:** No

---

#### PRELAUNCH1-015
**ID:** PRELAUNCH1-015  
**Title:** i18n — "Get Started" button text correct in English  
**Priority:** Low  
**Steps:**
1. افتح التطبيق باللغة الإنجليزية
2. اذهب لشاشة تسجيل الدخول أو الترحيب

**Expected:** الزر يعرض "Get Started" (وليس "Start")  
**Regression:** النص العربي "ابدأ" غير متأثر  
**Automation Candidate:** Yes

---

#### PRELAUNCH1-016
**ID:** PRELAUNCH1-016  
**Title:** i18n — "Resending..." text correct during OTP resend in English  
**Priority:** Low  
**Steps:**
1. افتح verify باللغة الإنجليزية
2. اضغط زر إعادة إرسال OTP

**Expected:** الزر يعرض "Resending..." (وليس "Sending...")  
**Regression:** حالة الإرسال الأول غير متأثرة  
**Automation Candidate:** Yes

---

#### PRELAUNCH1-017
**ID:** PRELAUNCH1-017  
**Title:** Service role key not present in any file in working tree  
**Priority:** Critical  
**Steps:**
1. في مجلد المشروع، ابحث عن السلسلة `JfE_DLW4jB6_E1MjaOFCSj56n6Tr0jhfQXwFqhKd1V0`
   ```
   git grep "JfE_DLW4jB6" -- '*.ts' '*.js' '*.json' '*.yaml'
   ```

**Expected:** لا نتائج — المفتاح لا يوجد في أي ملف حالي  
**Automation Candidate:** Yes (CI secret scanning)

---

#### PRELAUNCH1-018
**ID:** PRELAUNCH1-018  
**Title:** Service role key not present in git history  
**Priority:** Critical  
**Steps:**
1. شغّل:
   ```
   git log --all -p | grep "JfE_DLW4jB6"
   ```

**Expected:** لا نتائج — المفتاح أُزيل من كامل تاريخ git بعد تشغيل git filter-repo  
**Automation Candidate:** Yes (CI secret scanning on full history)

---

#### PRELAUNCH1-019
**ID:** PRELAUNCH1-019  
**Title:** Seed script uses env var for service role key (no hardcoded value)  
**Priority:** Critical  
**Steps:**
1. افتح `supabase/seed.ts` و `supabase/seed.js`
2. تحقق من السطر الذي يُعرّف المفتاح

**Expected:** `const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';` — لا قيمة مُشفّرة  
**Automation Candidate:** Yes (CI secret scanning)

---

#### PRELAUNCH1-020
**ID:** PRELAUNCH1-020  
**Title:** Legacy JWT-based API key is disabled and non-functional  
**Priority:** Critical  
**Steps:**
1. احصل على المفتاح القديم (من أي نسخة تاريخية)
2. حاول استخدامه لاستدعاء Supabase REST API:
   ```
   curl https://bkbjsstxhvdnqcmpuulf.supabase.co/rest/v1/users \
     -H "apikey: <OLD_KEY>" -H "Authorization: Bearer <OLD_KEY>"
   ```

**Expected:** استجابة 401 Unauthorized — المفتاح القديم لا يعمل بعد تعطيل Legacy JWT  
**Automation Candidate:** No (manual verification)

---

---

### Module PRELAUNCH2 — API Key Migration & Load Test Validation

#### PRELAUNCH2-001
**ID:** PRELAUNCH2-001  
**Title:** Publishable API key (waseetupdated) accepted by Supabase REST API  
**Priority:** Critical  
**Steps:**
1. شغّل:
   ```
   curl -s -o /dev/null -w "%{http_code}" \
     -H "apikey: sb_publishable_lKYwWidN9UNk3ncxGoJq0Q_zCo5-nyQ" \
     -H "Authorization: Bearer sb_publishable_lKYwWidN9UNk3ncxGoJq0Q_zCo5-nyQ" \
     "https://bkbjsstxhvdnqcmpuulf.supabase.co/rest/v1/requests?select=id&limit=1"
   ```
2. لاحظ الـ HTTP status code

**Expected:** 200 — المفتاح مقبول والاستجابة صحيحة  
**Automation Candidate:** Yes (CI health check)

---

#### PRELAUNCH2-002
**ID:** PRELAUNCH2-002  
**Title:** Unregistered API key rejected with clear error  
**Priority:** High  
**Steps:**
1. جرّب مفتاحاً غير مسجّل:
   ```
   curl -s -H "apikey: sb_publishable_INVALID" \
     "https://bkbjsstxhvdnqcmpuulf.supabase.co/rest/v1/requests?select=id&limit=1"
   ```

**Expected:** `{"message":"Unregistered API key"}` مع status 401  
**Automation Candidate:** Yes

---

#### PRELAUNCH2-003
**ID:** PRELAUNCH2-003  
**Title:** codemagic.yaml android workflow uses correct publishable key  
**Priority:** Critical  
**Steps:**
1. افتح `codemagic.yaml`
2. في قسم `android-staging` → `vars`، تحقق من قيمة `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Expected:** `sb_publishable_lKYwWidN9UNk3ncxGoJq0Q_zCo5-nyQ`  
**Automation Candidate:** Yes (grep in CI)

---

#### PRELAUNCH2-004
**ID:** PRELAUNCH2-004  
**Title:** codemagic.yaml ios workflow uses correct publishable key  
**Priority:** Critical  
**Steps:**
1. افتح `codemagic.yaml`
2. في قسم `ios-staging` → `vars`، تحقق من قيمة `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Expected:** `sb_publishable_lKYwWidN9UNk3ncxGoJq0Q_zCo5-nyQ` — مطابق لقسم android  
**Automation Candidate:** Yes

---

#### PRELAUNCH2-005
**ID:** PRELAUNCH2-005  
**Title:** k6 load test — 0% HTTP error rate at 300 VUs  
**Priority:** High  
**Steps:**
1. شغّل: `k6 run k6/load_test.js`
2. انتظر اكتمال الـ 3 دقائق (ramp 50→150→300→0 VUs)
3. لاحظ `http_req_failed` و `error_rate`

**Expected:** `http_req_failed: 0.00%` و `error_rate: 0.00%` — صفر أخطاء  
**Automation Candidate:** Yes (CI load stage)

---

#### PRELAUNCH2-006
**ID:** PRELAUNCH2-006  
**Title:** k6 load test — REST /requests endpoint returns 200  
**Priority:** High  
**Steps:**
1. شغّل: `k6 run k6/load_test.js`
2. في ملخص النتائج، تحقق من الـ check `requests 200`

**Expected:** ✓ 100% pass — جميع طلبات `/rest/v1/requests` تُجيب بـ 200  
**Automation Candidate:** Yes

---

#### PRELAUNCH2-007
**ID:** PRELAUNCH2-007  
**Title:** k6 load test — REST /users (providers) endpoint returns 200  
**Priority:** High  
**Steps:**
1. شغّل: `k6 run k6/load_test.js`
2. في ملخص النتائج، تحقق من الـ check `providers 200`

**Expected:** ✓ 100% pass — جميع طلبات `/rest/v1/users?role=eq.provider` تُجيب بـ 200  
**Automation Candidate:** Yes

---

#### PRELAUNCH2-008
**ID:** PRELAUNCH2-008  
**Title:** k6 load test — REST /service_categories endpoint returns 200  
**Priority:** High  
**Steps:**
1. شغّل: `k6 run k6/load_test.js`
2. في ملخص النتائج، تحقق من الـ check `categories 200`

**Expected:** ✓ 100% pass — جميع طلبات `/rest/v1/service_categories` تُجيب بـ 200  
**Automation Candidate:** Yes

---

#### PRELAUNCH2-009
**ID:** PRELAUNCH2-009  
**Title:** k6 load test — median latency under 300ms on free tier  
**Priority:** Medium  
**Steps:**
1. شغّل: `k6 run k6/load_test.js`
2. في ملخص النتائج، لاحظ `http_req_duration` median

**Expected:** median < 300ms — الـ median latency مقبول حتى على الخطة المجانية  
**Automation Candidate:** Yes

---

#### PRELAUNCH2-010
**ID:** PRELAUNCH2-010  
**Title:** Sentry DSN configured in mobile app  
**Priority:** High  
**Steps:**
1. افتح `mobile/.env.local`
2. تحقق من وجود `EXPO_PUBLIC_SENTRY_DSN`
3. افتح `mobile/app/_layout.tsx`
4. تأكد من `Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN })`
5. تأكد أن `export default Sentry.wrap(RootLayout)`

**Expected:** DSN مُعرَّف وSentry مُهيَّأ ويلتف حول RootLayout  
**Automation Candidate:** Yes (grep)

---

---

## Module HOMEUI — Client Home UI Redesign

**Scope:** البحث 3D · صف الأيقونات · Footer المُعاد ترتيبه  
**Files:** `mobile/app/(client)/index.tsx`, `mobile/app/(client)/_layout.tsx`

---

#### HOMEUI-001
**ID:** HOMEUI-001  
**Title:** Search bar renders with elevated 3D shadow (light mode)  
**Priority:** Medium  
**Steps:**
1. افتح تطبيق العميل بالمظهر الفاتح
2. انتقل للشاشة الرئيسية
3. لاحظ حقل البحث

**Expected:** الحقل يظهر بخلفية بيضاء مع ظل خفيف (elevation: 5) يجعله يبدو بارزاً كـ 3D — لا يلمس الحواف ولا يُشوَّه  
**Automation Candidate:** No (visual)

---

#### HOMEUI-002
**ID:** HOMEUI-002  
**Title:** Search bar renders with highlight border (dark mode)  
**Priority:** Medium  
**Steps:**
1. افتح تطبيق العميل بالمظهر الداكن
2. انتقل للشاشة الرئيسية
3. لاحظ حافة حقل البحث العلوية

**Expected:** حافة علوية أفتح (rgba(255,255,255,0.18)) تعطي وهم 3D في الوضع الداكن  
**Automation Candidate:** No (visual)

---

#### HOMEUI-003
**ID:** HOMEUI-003  
**Title:** Category icon row replaces chips — 11 icons visible  
**Priority:** High  
**Steps:**
1. افتح الشاشة الرئيسية للعميل
2. تحقق من عدم وجود chips نصية
3. مرر أفقياً في صف الأيقونات
4. عد الأيقونات

**Expected:** 11 أيقونة دائرية (emoji + label قصير تحتها)، لا chips، القائمة قابلة للتمرير أفقياً  
**Automation Candidate:** No

---

#### HOMEUI-004
**ID:** HOMEUI-004  
**Title:** Tapping icon selects group and updates category grid  
**Priority:** High  
**Steps:**
1. افتح الشاشة الرئيسية
2. انقر على أيقونة "سيارات"
3. لاحظ تغير الأيقونة المحددة وشبكة الفئات

**Expected:** أيقونة السيارات تظهر بحدود ملونة (active state)، وشبكة الفئات تُحدَّث لتعرض فئات car_services  
**Automation Candidate:** No

---

#### HOMEUI-005
**ID:** HOMEUI-005  
**Title:** Icon row labels truncate correctly (no overflow)  
**Priority:** Medium  
**Steps:**
1. اختبر على جهاز بعرض ضيق (320px) وعريض (430px)
2. لاحظ أسماء الأيقونات

**Expected:** الأسماء القصيرة (صيانة، سيارات، حِرَف...) تظهر في سطر واحد دون تداخل أو overflow  
**Automation Candidate:** No

---

#### HOMEUI-006
**ID:** HOMEUI-006  
**Title:** Icon sizes scale correctly on all screen widths  
**Priority:** Medium  
**Steps:**
1. اختبر على iPhone SE (375px)، iPhone 15 (393px)، Samsung Galaxy (412px)
2. لاحظ حجم دوائر الأيقونات

**Expected:** الحجم يتراوح بين 43-48px عبر الأجهزة (Math.min(48, W*0.115)) — دائري واضح في جميع الحالات  
**Automation Candidate:** No

---

#### HOMEUI-007
**ID:** HOMEUI-007  
**Title:** Footer tab order: Home | Requests | +New | Messages | Profile  
**Priority:** High  
**Steps:**
1. افتح تطبيق العميل
2. لاحظ ترتيب تبويبات الـ Footer من اليسار لليمين (LTR) أو من اليمين لليسار (RTL)

**Expected:** LTR: 🏠 الرئيسية | 📋 طلباتي | ➕ طلب جديد | 💬 الرسائل | 👤 حسابي  
**Automation Candidate:** No

---

#### HOMEUI-008
**ID:** HOMEUI-008  
**Title:** Center "New Request" tab renders as prominent gold button  
**Priority:** High  
**Steps:**
1. افتح تطبيق العميل
2. لاحظ تبويبة "طلب جديد" في المنتصف

**Expected:** أيقونة ➕ داخل مربع ذهبي مدور (colors.accent) بحجم ~46px — بارز بصرياً مقارنة بباقي التبويبات  
**Automation Candidate:** No

---

#### HOMEUI-009
**ID:** HOMEUI-009  
**Title:** Center button shadow visible on iOS  
**Priority:** Low  
**Steps:**
1. اختبر على جهاز/محاكي iOS
2. لاحظ ظل زر "طلب جديد"

**Expected:** ظل ذهبي خفيف تحت الزر المركزي (shadowColor: accent) — يعزز البروز البصري  
**Automation Candidate:** No

---

#### HOMEUI-010
**ID:** HOMEUI-010  
**Title:** RTL: footer reverses correctly with reordered tabs  
**Priority:** High  
**Steps:**
1. اضبط اللغة على العربية (RTL)
2. افتح الشاشة الرئيسية

**Expected:** الترتيب يُعكس: حسابي | الرسائل | طلب جديد (مركز) | طلباتي | الرئيسية — الزر المركزي يبقى في المنتصف  
**Automation Candidate:** No

---

#### HOMEUI-011
**ID:** HOMEUI-011  
**Title:** Dark mode: icon row circles use dark background  
**Priority:** Medium  
**Steps:**
1. فعّل المظهر الداكن
2. لاحظ الأيقونات غير المحددة

**Expected:** دوائر الأيقونات بخلفية `rgba(255,255,255,0.06)` — تناسب الخلفية الداكنة دون بروز مفرط  
**Automation Candidate:** No

---

#### HOMEUI-012
**ID:** HOMEUI-012  
**Title:** Tapping search bar navigates to new-request screen  
**Priority:** High  
**Steps:**
1. من الشاشة الرئيسية، انقر على حقل البحث

**Expected:** التطبيق ينتقل لشاشة "طلب جديد" (/(client)/new-request) — نفس السلوك السابق بدون تغيير  
**Automation Candidate:** No

---

*End of Waseet QA Test Cases Report v5.2*  
*Total Test Cases: 668 across 56 modules*  
*Critical: 164 | High: 283 | Medium: 179 | Low: 42 (previously: 656/55)*  
*⚠️ عند إضافة خدمة جديدة: سطر في CAT-005 + حالة في NCAT + تحديث العدد*  
*⚠️ عند إضافة مجموعة جديدة: سطر في CAT-006 + تحديث GROUP_COLORS/EMOJI/SHORT_AR/ICON_LABEL/DISPLAY_ORDER في (client)/index.tsx*  
*⚠️ عند تعديل DemoRequestCard: تحقق من DEMO-001..008 كاملاً*
