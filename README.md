# Project: Emergency Cloud Camera Capture (Outtaspace)

A web-based application that allows users to capture photos and videos directly to the cloud, designed specifically for situations where the user's phone storage is full.



## Core Problem & Solution

* **Problem:** You're in an urgent situation and need to take a photo or video, but your phone displays the dreaded "Storage Full" error, preventing you from using your camera.
* **Solution:** Outtaspace provides a simple webpage (PWA) that uses the browser's built-in camera APIs to capture media and immediately upload it to a secure cloud server, completely bypassing the device's local storage.

***

## Guiding Principles & UX Philosophy

Our guiding principle is **"Zero Friction."** The user is likely in a stressful situation, so the application must be intuitive, reliable, and immediate.

1.  **Instant-On:** The page loads directly into a live camera viewfinder. No logins, splash screens, or introductory text.
2.  **Minimalist UI:** The interface will be clean and simple, featuring only essential controls: a prominent record/shutter button, a camera-flip button, and a flash toggle.
3.  **Clear Visual Feedback:** The user will always know the app's status with clear visual cues for recording (e.g., a blinking red dot), uploading (a progress bar), and success (a confirmation message).
4.  **Resilience First:** The application shell will be cached so it loads instantly on subsequent visits, even with a poor network connection.

***

## Technology Stack (MVP)

We are building the front-end with core web technologies to ensure maximum performance and minimal dependencies.

* **Front-End:** Vanilla **HTML**, **CSS**, and **JavaScript**.
* **Key Browser APIs:**
    * `navigator.mediaDevices.getUserMedia()`: To access the camera and microphone.
    * `MediaRecorder API`: To capture video and audio, creating `Blob` objects for uploading.
    * `Canvas API`: To capture still photos by drawing a video frame to a canvas and exporting it as a `Blob`.
    * `Screen Wake Lock API`: To prevent the device from sleeping during a long video recording.
    * `Fetch API`: To handle streaming/chunked uploads of media `Blob`s to the backend.
* **PWA Features:**
    * `manifest.json`: To make the app installable ("Add to Home Screen").
    * `Service Worker`: To cache the main application files for offline access and instant loading.
* **Local Development:** A local HTTPS server (github.com/terreng/simple-web-server) will be used for testing on mobile devices, as camera APIs require a secure context (`https`).

***

## Front-End Implementation Plan

### Step 1: HTML Structure (`index.html`)

Create a basic HTML5 boilerplate. The `<body>` will contain:
* A `<video>` element for the live camera viewfinder.
* A hidden `<canvas>` element for capturing still photos.
* `<div>` elements for UI controls (shutter button, camera-flip button).
* A `<div>` for status overlays (e.g., "Uploading...", "✅ Success").

### Step 2: Styling (`style.css`)

* Make the `<video>` element fill the entire screen (`object-fit: cover`).
* Style the UI controls to be easily tappable and position them as an overlay on top of the video feed.
* Create CSS classes for the different status indicators (e.g., a red blinking animation for recording).

### Step 3: Core Logic (`app.js`)

1.  **Initialization:** On script load, get references to all DOM elements.
2.  **Request Camera Access:**
    * Use `getUserMedia` to request video and audio streams.
    * Handle success by attaching the stream to the `<video>` element's `srcObject`.
    * Handle errors gracefully (e.g., show a message if permission is denied).
3.  **Implement Photo Capture:**
    * The shutter button's click event will draw the current video frame to the hidden `<canvas>`.
    * Use `canvas.toBlob()` to get the image data as a `Blob`.
    * Call an `uploadFile(blob)` function.
4.  **Implement Video Capture:**
    * Use the `MediaRecorder` API to capture the stream.
    * On button press, call `mediaRecorder.start()`. Use a `timeslice` (e.g., `mediaRecorder.start(5000)`) to trigger the `ondataavailable` event every 5 seconds.
    * The `ondataavailable` event handler will receive a `Blob` chunk and call the `uploadFile(event.data)` function immediately.
    * On the second button press, call `mediaRecorder.stop()`.
5.  **Implement Wake Lock:**
    * When video recording starts, request a screen wake lock.
    * When recording stops or the page is hidden, release the lock.
6.  **File Upload Logic (`uploadFile` function):**
    * This function will take a `Blob` as an argument.
    * It will use the `Fetch API` to send the `Blob` to the backend endpoint via a `POST` request.
    * Update the UI to show upload progress and success/failure messages.

***

## Backend Implementation Plan (Supabase)

For the backend, we will use **Supabase** to leverage its integrated suite of tools, which includes a database, authentication, storage, and serverless functions. This allows for rapid development and aligns perfectly with our goal of shipping a working MVP efficiently.

### 1. Supabase Storage

This is the core component for storing the actual media files.

* **Setup:** We will create a single, **private** storage bucket named `media_uploads`. Making the bucket private is crucial, as it ensures that files can only be accessed via authorized, expiring URLs, not directly.
* **Upload Flow:** To maintain security, the front-end will **not** upload directly to the bucket with a public API key. Instead, the client will first request a secure, signed upload URL from one of our Edge Functions. The function will generate a short-lived URL that grants permission to upload a single file, which the client will then use.

### 2. Supabase Database (PostgreSQL)

The database will not store the files themselves, but the **metadata** associated with them.

* **Table Schema:** We'll create a primary table named `media_files` with the following columns:
    * `id` (uuid, primary key)
    * `user_id` (uuid, foreign key to `auth.users`)
    * `file_path` (text, the path to the file in Supabase Storage)
    * `content_type` (text, e.g., 'image/jpeg' or 'video/webm')
    * `created_at` (timestamp with time zone)
    * `expires_at` (timestamp with time zone)
* **Row Level Security (RLS):** This is the most important database feature for us. We will enable RLS on the `media_files` table and create policies that enforce the rule: **"A user can only view, update, or delete records that match their own `user_id`."** This provides foundational security for our users' data.

### 3. Supabase Auth

To manage user identity and secure access to files, we'll use Supabase's built-in authentication.

* **Method:** The primary authentication method will be **Magic Links** (passwordless email login). This perfectly fits our "Zero Friction" philosophy. A user wanting to view their files will simply enter their email address, click a link sent to their inbox, and be securely logged in without needing to remember a password.
* **Integration:** When a user signs up or logs in, Supabase automatically creates an entry in the `auth.users` table. The `user_id` from this entry is the same one we'll use in our `media_files` table to associate uploads with a specific user.

### 4. Supabase Edge Functions

These serverless functions will handle our custom server-side logic. They are written in TypeScript and run on Deno.

* `generate-upload-url`: As described in the Storage section, this function will be called by the client before an upload. It will generate a signed URL for the Storage bucket and return it to the client.
* `cleanup-expired-files`: This will be set up as a **scheduled function** (cron job) to run automatically once a day. It will query the `media_files` table for any records where `expires_at` is in the past, and for each one it finds, it will delete both the database record and the corresponding file from Supabase Storage.

***

## Future Plans & Monetization

The core mission of Outtaspace will always be to provide a free and reliable emergency capture tool. Future development and monetization will focus on adding value *after* the user's media has been safely captured, following a **freemium** model.

### "Outtaspace Plus" (Premium Tier)

Once the core MVP is stable, we plan to introduce an optional premium subscription with features designed for convenience and long-term storage:

* **Permanent Cloud Storage:** Offer various storage tiers (e.g., 10GB, 50GB, 100GB) for users who want to turn Outtaspace into a permanent media backup solution.
* **Higher Quality Captures:** Unlock the ability to record in higher resolutions like 4K video and capture lossless photos.
* **Advanced Management:** Introduce features like creating albums, batch downloading files as a `.zip` archive, and searching/filtering captures.
* **Automatic Cloud Sync:** A key premium feature to automatically and seamlessly transfer captures to a user's personal Google Drive, Dropbox, or OneDrive account.

The free tier will always remain, offering temporary storage (e.g., 72 hours) to solve the core "storage full" emergency.

### Alternative Models

We may also explore simple, one-time payment options, such as a "Save Forever" button on individual files for a small fee, as an alternative to a recurring subscription. Our guiding principle is to **never add friction to the initial capture process.**

***

## 🤖 MVP Roadmap Checklist

**Instructions for Gemini:** When asked to "lock in progress," update the status of the tasks below from `[ ]` to `[x]` based on the completed work in the session. Also, update the `Last Updated` timestamp.

**Last Updated:** 2025-09-22 01:43 AM EDT

---
### Phase 0: Preparation
- [x] Create `memory.md` for Gemini persistent memory.
- [x] Create `save-prompt.md` for manually saving Gemini persistent memory.

### Phase 1: Front-End Foundation (MVP)
- [ ] **HTML:** Structure `index.html` with `<video>`, `<canvas>`, and UI control elements.
- [ ] **CSS:** Style `style.css` for a full-screen camera view and responsive UI overlays.
- [ ] **JS (Core Logic):** Implement initial `app.js` script loading and DOM element selection.

### Phase 2: Core Functionality
- [ ] **Camera Access:** Implement `getUserMedia` to display the live camera feed.
- [ ] **Photo Capture:** Implement photo capture using the Canvas API.
- [ ] **Video Capture:** Implement video recording with audio using the `MediaRecorder` API.
- [ ] **File Upload:** Create the placeholder `uploadFile(blob)` function.
- [ ] **UI Feedback:** Add visual indicators for recording, uploading, and success states.

### Phase 3: Back-End Setup (Supabase)
- [ ] **Project Setup:** Create the Supabase project and link it locally.
- [ ] **Storage:** Create the private `media_uploads` storage bucket.
- [ ] **Database:** Define the `media_files` table schema and enable Row Level Security (RLS).
- [ ] **Auth:** Configure Magic Link (passwordless) authentication.

### Phase 4: Back-End Logic (Supabase Edge Functions)
- [ ] **Function (`generate-upload-url`):** Create and deploy the Edge Function to provide secure upload URLs.
- [ ] **Function (`cleanup-expired-files`):** Create and deploy the scheduled Edge Function for file cleanup.
- [ ] **Integration:** Connect the front-end's `uploadFile` function to the `generate-upload-url` Edge Function.

### Phase 5: PWA & Polish
- [ ] **Manifest:** Create `manifest.json` with app icons and details for installability.
- [ ] **Service Worker:** Implement a basic service worker for app shell caching (offline reliability).
- [ ] **Wake Lock:** Integrate the Screen Wake Lock API to prevent the device from sleeping during recording.