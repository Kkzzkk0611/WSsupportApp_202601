/**
 * Marbling Mission Introduction Page - JavaScript
 * Handles video playback and CTA button navigation
 */

// ============================================
// Configuration
// ============================================

// Replace this URL with your actual marbling tool page path
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
        
        // Handle video loading errors gracefully
        video.addEventListener('error', handleVideoError);
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
            // The poster image will remain visible
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

/**
 * Handle video loading errors
 */
function handleVideoError(e) {
    console.warn('Video failed to load. Using poster image as fallback.');
    // The poster attribute will display automatically
    // Keep the play overlay visible but non-functional
    if (playOverlay) {
        playOverlay.style.cursor = 'default';
        playOverlay.querySelector('.play-button').style.opacity = '0.5';
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
 * Handle CTA button click - navigate to marbling tool page
 */
function handleCTAClick() {
    // Optional: Add fade-out animation before navigation
    document.body.style.transition = 'opacity 0.3s ease';
    document.body.style.opacity = '0';
    
    setTimeout(() => {
        // Navigate to the marbling tool page
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
        if (event.code === 'Space' && document.activeElement === document.body) {
            event.preventDefault();
            if (video) {
                if (video.paused) {
                    video.play().catch(err => console.error('Play error:', err));
                } else {
                    video.pause();
                }
            }
        }
        
        // Escape key pauses video
        if (event.code === 'Escape' && video && !video.paused) {
            video.pause();
        }
        
        // Enter key on CTA button (handled by default browser behavior)
    });
}

// ============================================
// Page Visibility API (optional enhancement)
// ============================================

/**
 * Pause video when page is not visible (tab switching, etc.)
 */
function initializeVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && video && !video.paused) {
            video.pause();
        }
    });
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
    initializeVisibilityHandler();
    
    console.log('Marbling Mission Introduction page initialized');
    console.log('Next page URL:', NEXT_PAGE_URL);
}

// Run initialization when DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM is already loaded
    init();
}

// ============================================
// Optional: Analytics tracking (placeholder)
// ============================================

/**
 * Track video play events (placeholder for analytics integration)
 */
function trackVideoPlay() {
    console.log('Video play event - ready for analytics integration');
    // Example: ga('send', 'event', 'Video', 'play', 'Marbling Intro');
}

/**
 * Track CTA button clicks (placeholder for analytics integration)
 */
function trackCTAClick() {
    console.log('CTA click event - ready for analytics integration');
    // Example: ga('send', 'event', 'Button', 'click', 'Start Marbling');
}

// Attach tracking to events if needed
if (video) {
    video.addEventListener('play', trackVideoPlay, { once: true });
}

if (ctaButton) {
    ctaButton.addEventListener('click', trackCTAClick, { once: true });
}
