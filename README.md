# Project: Emergency Camera Cloud Capture (ECCC)

A web-based application that allows users to capture photos and videos directly to the cloud, designed specifically for situations where the user's phone storage is full.



## Core Problem & Solution

* **Problem:** You're in an urgent situation and need to take a photo or video, but your phone displays the dreaded "Storage Full" error, preventing you from using your camera.
* **Solution:** ECCC provides a simple webpage (PWA) that uses the browser's built-in camera APIs to capture media and immediately upload it to a secure cloud server, completely bypassing the device's local storage.

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
* **Local Development:** A local HTTPS server (e.g., using `mkcert` and Node.js's `http-server`) will be used for testing on mobile devices, as camera APIs require a secure context (`https`).

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