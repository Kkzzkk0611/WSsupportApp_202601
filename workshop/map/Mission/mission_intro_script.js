/**
 * Mission Introduction Page - JavaScript
 * Handles video playback and CTA button navigation
 */

// ============================================
// Configuration
// ============================================

// Replace this URL with your actual next page path
const NEXT_PAGE_URL = '../app/index.html';

// ============================================
// DOM Elements
// ============================================

const video = document.getElementById('missionVideo');
const playOverlay = document.getElementById('playOverlay');
const ctaButton = document.getElementById('ctaButton');

// ============================================
// Video Playback Controls
// ============================================

/**
 * Initialize video controls on page load
 */
function initializeVideoControls() {
    // Handle play overlay click
    if (playOverlay && video) {
        playOverlay.addEventListener('click', handlePlayClick);
    }

    // Hide overlay when video starts playing
    if (video) {
        video.addEventListener('play', hidePlayOverlay);
        video.addEventListener('pause', showPlayOverlay);
        video.addEventListener('ended', showPlayOverlay);
    }
}

/**
 * Handle play button click
 */
function handlePlayClick() {
    if (video) {
        video.play().catch(error => {
            console.error('Error playing video:', error);
            // Gracefully handle autoplay restrictions or video errors
        });
    }
}

/**
 * Hide the play overlay
 */
function hidePlayOverlay() {
    if (playOverlay) {
        playOverlay.classList.add('hidden');
    }
}

/**
 * Show the play overlay
 */
function showPlayOverlay() {
    if (playOverlay && video && video.paused) {
        playOverlay.classList.remove('hidden');
    }
}

// ============================================
// CTA Button Navigation
// ============================================

/**
 * Initialize CTA button
 */
function initializeCTAButton() {
    if (ctaButton) {
        ctaButton.addEventListener('click', handleCTAClick);
    }
}

/**
 * Handle CTA button click - navigate to next page
 */
function handleCTAClick() {
    // Optional: Add fade-out animation before navigation
    document.body.style.transition = 'opacity 0.3s ease';
    document.body.style.opacity = '0';
    
    setTimeout(() => {
        // Navigate to the next page
        // Replace NEXT_PAGE_URL at the top of this file with your actual path
        window.location.href = NEXT_PAGE_URL;
    }, 300);
}

// ============================================
// Keyboard Accessibility
// ============================================

/**
 * Handle keyboard events for accessibility
 */
function initializeKeyboardControls() {
    document.addEventListener('keydown', (event) => {
        // Spacebar or Enter on video area plays/pauses video
        if (event.code === 'Space' && document.activeElement === video) {
            event.preventDefault();
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        }
        
        // Enter key on CTA button (handled by default browser behavior)
        // Escape key can pause video
        if (event.code === 'Escape' && !video.paused) {
            video.pause();
        }
    });
}

// ============================================
// Error Handling
// ============================================

/**
 * Handle video loading errors
 */
function initializeErrorHandling() {
    if (video) {
        video.addEventListener('error', (e) => {
            console.warn('Video failed to load. Using poster image as fallback.');
            // The poster attribute will display automatically
            // Optionally show a message to the user
        });
    }
}

// ============================================
// Initialization
// ============================================

/**
 * Initialize all functionality when DOM is ready
 */
function init() {
    initializeVideoControls();
    initializeCTAButton();
    initializeKeyboardControls();
    initializeErrorHandling();
    
    console.log('Mission Introduction page initialized');
}

// Run initialization when DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM is already loaded
    init();
}

// ============================================
// Optional: Prevent accidental navigation
// ============================================

/**
 * Warn user before leaving if video is playing (optional)
 * Uncomment if you want to enable this feature
 */
/*
window.addEventListener('beforeunload', (event) => {
    if (video && !video.paused && !video.ended) {
        event.preventDefault();
        event.returnValue = '';
        return '';
    }
});
*/
