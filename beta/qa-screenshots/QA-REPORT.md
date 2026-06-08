# Beta Screenshot QA

Generated: 2026-06-08T13:29:25.536Z
Server: http://localhost:50174 (VITE_BETA_REDESIGN=true)

## Summary

- Routes checked: 5 Beta + 1 MVP isolation
- Viewports: desktop 1280x800, mobile 390x844
- Result: ALL PASS

## Assertions per route

- data-beta-app marker present (Beta routes) / absent (/app)
- data-beta-page matches expected id
- no forbidden MVP strings: "Go Beyond the Resume", "An All-in-One Career Toolkit", "Success Stories from Professionals"
- no horizontal overflow

## Results

### `/` @ desktop — PASS
- OK data-beta-page=jobseeker-home
- OK no forbidden MVP strings
- OK no horizontal overflow

### `/employers` @ desktop — PASS
- OK data-beta-page=employer-landing
- OK no forbidden MVP strings
- OK no horizontal overflow

### `/sample-report` @ desktop — PASS
- OK data-beta-page=sample-report
- OK no forbidden MVP strings
- OK no horizontal overflow

### `/pricing` @ desktop — PASS
- OK data-beta-page=pricing
- OK no forbidden MVP strings
- OK no horizontal overflow

### `/portal` @ desktop — PASS
- OK data-beta-page=portal
- OK no forbidden MVP strings
- OK no horizontal overflow

### `/app` @ desktop — PASS
- OK isolated MVP shell (no beta marker)
- OK no horizontal overflow

### `/` @ mobile — PASS
- OK data-beta-page=jobseeker-home
- OK no forbidden MVP strings
- OK no horizontal overflow

### `/employers` @ mobile — PASS
- OK data-beta-page=employer-landing
- OK no forbidden MVP strings
- OK no horizontal overflow

### `/sample-report` @ mobile — PASS
- OK data-beta-page=sample-report
- OK no forbidden MVP strings
- OK no horizontal overflow

### `/pricing` @ mobile — PASS
- OK data-beta-page=pricing
- OK no forbidden MVP strings
- OK no horizontal overflow

### `/portal` @ mobile — PASS
- OK data-beta-page=portal
- OK no forbidden MVP strings
- OK no horizontal overflow

### `/app` @ mobile — PASS
- OK isolated MVP shell (no beta marker)
- OK no horizontal overflow

## Locale smoke (zh)

- OK zh hero copy rendered
- OK no raw beta_ keys in zh render

## Failures

None.
