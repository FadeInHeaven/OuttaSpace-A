document.addEventListener('DOMContentLoaded', () => {
    // DOM Element References
    const viewfinder = document.getElementById('viewfinder');
    const photoCanvas = document.getElementById('photo-canvas');
    const shutterButton = document.getElementById('shutter-button');
    const cameraFlipButton = document.getElementById('camera-flip');
    const flashToggleButton = document.getElementById('flash-toggle');
    const recordingIndicator = document.getElementById('recording-indicator');
    const statusOverlay = document.getElementById('status-overlay');
    const statusMessage = document.getElementById('status-message');

    // State Variables
    let mediaStream;
    let mediaRecorder;
    let recordedChunks = [];
    let isRecording = false;
    let wakeLock = null;
    let facingMode = 'environment'; // 'user' for front camera, 'environment' for back
    let flashSupported = false;

    /**
     * Shows a message in the status overlay.
     * @param {string} message - The message to display.
     * @param {number|null} duration - How long to show the message in ms. null for indefinite.
     */
    function showStatusMessage(message, duration = 2000) {
        statusMessage.textContent = message;
        statusOverlay.classList.add('visible');
        if (duration) {
            setTimeout(() => {
                statusOverlay.classList.remove('visible');
            }, duration);
        }
    }

    /**
     * Initializes the camera, requesting access and setting up the stream.
     */
    async function initCamera() {
        try {
            // Stop any existing stream before starting a new one
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
            }

            const constraints = {
                video: {
                    facingMode: { exact: facingMode },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: true
            };
            mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            viewfinder.srcObject = mediaStream;
            viewfinder.play();
            checkFlashSupport();
        } catch (error) {
            console.error("Error accessing media devices.", error);
            let message = "Could not access camera. Please grant permission and try again.";
            if (error.name === 'NotAllowedError') {
                message = "Camera access was denied. Please enable it in your browser settings.";
            } else if (error.name === 'NotFoundError') {
                message = "No camera found on this device.";
            }
            showStatusMessage(message, null); // Show indefinitely
        }
    }

    /**
     * Checks if the current video track supports flash/torch.
     */
    function checkFlashSupport() {
        const videoTrack = mediaStream.getVideoTracks()[0];
        const imageCapture = new ImageCapture(videoTrack);
        imageCapture.getPhotoCapabilities().then(capabilities => {
            flashSupported = capabilities.fillLightMode && capabilities.fillLightMode.length > 0 && capabilities.fillLightMode.includes('torch');
            flashToggleButton.style.display = flashSupported ? 'flex' : 'none';
        });
    }

    /**
     * Toggles the flashlight (torch) on or off.
     */
    async function toggleFlash() {
        if (!mediaStream || !flashSupported) return;
        const videoTrack = mediaStream.getVideoTracks()[0];
        try {
            const currentTorchState = videoTrack.getSettings().torch || false;
            await videoTrack.applyConstraints({
                advanced: [{ torch: !currentTorchState }]
            });
            // Update icon based on new state
        } catch (error) {
            console.error("Error toggling flash:", error);
            showStatusMessage("Could not control flash.", 1500);
        }
    }

    /**
     * Flips the camera between front and back.
     */
    function flipCamera() {
        facingMode = (facingMode === 'user') ? 'environment' : 'user';
        initCamera(); // Re-initialize camera with the new facing mode
    }

    /**
     * Captures a still photo from the viewfinder.
     */
    function takePhoto() {
        photoCanvas.width = viewfinder.videoWidth;
        photoCanvas.height = viewfinder.videoHeight;
        const context = photoCanvas.getContext('2d');
        context.drawImage(viewfinder, 0, 0, photoCanvas.width, photoCanvas.height);

        photoCanvas.toBlob(blob => {
            uploadFile(blob, 'image/jpeg');
        }, 'image/jpeg', 0.9);
        
        // Visual feedback
        viewfinder.style.filter = 'brightness(1.5)';
        setTimeout(() => viewfinder.style.filter = 'none', 100);
        showStatusMessage("Photo Captured! Uploading...", 2000);
    }

    /**
     * Starts video recording.
     */
    function startRecording() {
        if (!mediaStream) {
            showStatusMessage("Camera not ready.", 1500);
            return;
        }
        isRecording = true;
        recordedChunks = [];
        shutterButton.classList.add('recording');
        recordingIndicator.classList.add('visible');
        
        // Set up MediaRecorder
        const options = { mimeType: 'video/webm; codecs=vp9' };
        mediaRecorder = new MediaRecorder(mediaStream, options);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                // As per plan, upload chunks immediately
                uploadFile(event.data, options.mimeType);
            }
        };

        mediaRecorder.onstart = () => {
            showStatusMessage("Recording Started", 1500);
            requestWakeLock();
        };
        
        mediaRecorder.onstop = () => {
            isRecording = false;
            shutterButton.classList.remove('recording');
            recordingIndicator.classList.remove('visible');
            showStatusMessage("Recording Stopped. Upload finished.", 2000);
            releaseWakeLock();
        };

        // Start recording and capture chunks every 5 seconds
        mediaRecorder.start(5000); 
    }

    /**
     * Stops video recording.
     */
    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    }

    /**
     * Handles the shutter button logic for photo and video.
     * Uses a long-press gesture for video.
     */
    let pressTimer;
    shutterButton.addEventListener('mousedown', () => {
        pressTimer = setTimeout(() => {
            // Long press detected - start/stop video
            if (isRecording) {
                stopRecording();
            } else {
                startRecording();
            }
        }, 500); // 500ms for long press
    });
    
    shutterButton.addEventListener('mouseup', () => {
        clearTimeout(pressTimer);
    });

    shutterButton.addEventListener('click', () => {
        // This handles the simple click for photo
        if (!isRecording) {
            takePhoto();
        }
    });

    /**
     * Mock upload function.
     * @param {Blob} fileBlob - The file data to upload.
     * @param {string} mimeType - The MIME type of the file.
     */
    async function uploadFile(fileBlob, mimeType) {
        console.log(`Simulating upload of ${mimeType}, size: ${fileBlob.size} bytes`);
        
        // This is where you would use the Fetch API to POST to your backend
        // const formData = new FormData();
        // formData.append('media', fileBlob, `capture.${mimeType.split('/')[1]}`);
        // try {
        //     const response = await fetch('YOUR_BACKEND_ENDPOINT', {
        //         method: 'POST',
        //         body: formData,
        //     });
        //     if (!response.ok) throw new Error('Network response was not ok');
        //     const result = await response.json();
        //     console.log('Upload successful:', result);
        //     showStatusMessage("✅ Upload Complete!", 2000);
        // } catch (error) {
        //     console.error('Upload failed:', error);
        //     showStatusMessage("❌ Upload Failed. Please try again.", 3000);
        // }
        
        // Mocking a successful upload after a short delay
        showStatusMessage("Uploading...", 1500);
        setTimeout(() => {
             showStatusMessage("✅ Success!", 2000);
        }, 1500);
    }

    /**
     * Requests a screen wake lock to prevent the device from sleeping.
     */
    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen Wake Lock is active.');
                wakeLock.addEventListener('release', () => {
                    console.log('Screen Wake Lock was released.');
                });
            } catch (err) {
                console.error(`${err.name}, ${err.message}`);
            }
        }
    }

    /**
     * Releases the screen wake lock.
     */
    function releaseWakeLock() {
        if (wakeLock !== null) {
            wakeLock.release();
            wakeLock = null;
        }
    }

    // Event Listeners
    cameraFlipButton.addEventListener('click', flipCamera);
    flashToggleButton.addEventListener('click', toggleFlash);

    // Initial call to start the camera
    initCamera();
});
