/**
 * Final Submit Page Script - Version 2.0
 * 
 * Purpose: Generate Survey123 URL with pre-filled data and display it
 * Survey123 URL: https://survey123.arcgis.com/share/cff62fc5070c4f468b2c9269d5b2535f
 * 
 * Field Mappings:
 * - Used hazard maps → field_24
 * - Marbling description → Mabling
 * - Collage description → collage
 * - Message (artwork title) → Message
 * - Creator name → field_25
 * - Target location → center=lat,lon
 * 
 * New Features:
 * - Tab navigation with missing data badges
 * - One-screen layout with step-by-step flow
 * - Missing data input (creation date, hazards editing)
 * - Pseudo completion flow with checkbox
 * - Success message and next action button
 */

// =====================================
// Configuration
// =====================================
const CONFIG = {
    SURVEY123_BASE_URL: 'https://survey123.arcgis.com/share/cff62fc5070c4f468b2c9269d5b2535f',
    
    // Page URLs - 実際のプロジェクト構成に合わせて修正してください
    PAGES: {
        hazard: '/workshop/map/Log/log_hazard_map.html',        // ← 対象地点/ハザードマップ選択ページ
        marbling: '/workshop/marbling/Log/log_marbling.html',      // ← マーブリング体験ページ
        collage: '/workshop/collage/Log/log_collage.html',         // ← コラージュ体験ページ
        artwork: '/workshop/message/artwork/artwork_submit.html',   // ← 作品情報入力ページ
        next: '/workshop/present/index.html',     // ← 次の防災行動ページ（仮）
        map: 'https://arcgis.com/apps/mapviewer/',  // ← 作品集マップURL（仮）
        home: '../index.html'                        // ← トップページ
    },
    
    IFRAME_ENABLED: true // Try iframe first, fallback to new tab if fails
};

// =====================================
// State Management
// =====================================
let appData = {
    hazardMap: {
        hazards: [],
        location: { lat: null, lon: null }
    },
    marbling: {
        description: ''
    },
    collage: {
        description: ''
    },
    artwork: {
        title: '',
        creatorName: '',
        creationDate: ''  // New field
    }
};

let survey123URL = '';
let previewMap = null;
let previewMarker = null;

// =====================================
// Initialize Page
// =====================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('Final Submit Page v2.0 - Initializing...');
    
    loadAllData();
    displayDataSummary();
    checkMissingData();
    survey123URL = generateSurvey123URL();
    
    console.log('Generated Survey123 URL:', survey123URL);
    console.log('Final Submit Page - Ready');
});

// =====================================
// Load Data from localStorage
// =====================================
function loadAllData() {
    try {
        const hazardMapData = localStorage.getItem('hazardMapLog');
        if (hazardMapData) {
            const parsed = JSON.parse(hazardMapData);
            appData.hazardMap = parsed.hazardMap ?? parsed;
            console.log('Loaded hazard map data:', appData.hazardMap);
        }

        const marblingData = localStorage.getItem('marblingLog');
        if (marblingData) {
            const parsed = JSON.parse(marblingData);
            appData.marbling = parsed.marbling ?? parsed;
            console.log('Loaded marbling data:', appData.marbling);
        }

        const collageData = localStorage.getItem('collageLog');
        if (collageData) {
            const parsed = JSON.parse(collageData);
            appData.collage = parsed.collage ?? parsed;
            console.log('Loaded collage data:', appData.collage);
        }

        const artworkData = localStorage.getItem('artworkSubmit');
        if (artworkData) {
            const parsed = JSON.parse(artworkData);
            appData.artwork.title = parsed.title ?? '';
            appData.artwork.creatorName = parsed.creatorName ?? '';
            appData.artwork.creationDate = parsed.creationDate ?? '';
            console.log('Loaded artwork data:', appData.artwork);
        }
    } catch (error) {
        console.error('Error loading data from localStorage:', error);
        alert('データの読み込みに失敗しました。前のページに戻ってやり直してください。');
    }
}

// =====================================
// Display Data Summary
// =====================================
function displayDataSummary() {
    // Location
    const loc = appData.hazardMap.location;
    const locationEl = document.getElementById('summary-location');
    if (loc?.lat && loc?.lon) {
        locationEl.textContent = `緯度: ${loc.lat.toFixed(6)}, 経度: ${loc.lon.toFixed(6)}`;
        locationEl.classList.remove('empty');
        renderSummaryMap(loc.lat, loc.lon);
    } else {
        locationEl.textContent = '（未選択）';
        locationEl.classList.add('empty');
    }
    
    // Hazards
    const hazardsEl = document.getElementById('summary-hazards');
    if (appData.hazardMap.hazards && appData.hazardMap.hazards.length > 0) {
        hazardsEl.innerHTML = appData.hazardMap.hazards
            .map(h => `<span class="tag">${h}</span>`)
            .join(' ');
        hazardsEl.classList.remove('empty');
    } else {
        hazardsEl.textContent = '（未選択）';
        hazardsEl.classList.add('empty');
    }
    
    // Marbling
    const marblingEl = document.getElementById('summary-marbling');
    if (appData.marbling.description) {
        marblingEl.textContent = appData.marbling.description;
        marblingEl.classList.remove('empty');
    } else {
        marblingEl.textContent = '（未入力）';
        marblingEl.classList.add('empty');
    }
    
    // Collage
    const collageEl = document.getElementById('summary-collage');
    if (appData.collage.description) {
        collageEl.textContent = appData.collage.description;
        collageEl.classList.remove('empty');
    } else {
        collageEl.textContent = '（未入力）';
        collageEl.classList.add('empty');
    }
    
    // Title
    const titleEl = document.getElementById('summary-title');
    if (appData.artwork.title) {
        titleEl.textContent = appData.artwork.title;
        titleEl.classList.remove('empty');
    } else {
        titleEl.textContent = '（未入力）';
        titleEl.classList.add('empty');
    }
    
    // Creator
    const creatorEl = document.getElementById('summary-creator');
    if (appData.artwork.creatorName) {
        creatorEl.textContent = appData.artwork.creatorName;
        creatorEl.classList.remove('empty');
    } else {
        creatorEl.textContent = '（未入力）';
        creatorEl.classList.add('empty');
    }
}

// =====================================
// Check Missing Data & Show Badges
// =====================================
function checkMissingData() {
    const missing = [];
    const badges = {
        hazard: false,
        marbling: false,
        collage: false,
        artwork: false
    };
    
    // Check hazard & location
    if (!appData.hazardMap.hazards || appData.hazardMap.hazards.length === 0) {
        missing.push('ハザードマップが選択されていません');
        badges.hazard = true;
    }
    if (!appData.hazardMap.location?.lat || !appData.hazardMap.location?.lon) {
        missing.push('対象地点が選択されていません');
        badges.hazard = true;
    }
    
    // Check marbling
    if (!appData.marbling.description || appData.marbling.description.trim() === '') {
        missing.push('マーブリング作品の説明が入力されていません');
        badges.marbling = true;
    }
    
    // Check collage
    if (!appData.collage.description || appData.collage.description.trim() === '') {
        missing.push('コラージュ作品の説明が入力されていません');
        badges.collage = true;
    }
    
    // Check artwork
    if (!appData.artwork.title || appData.artwork.title.trim() === '') {
        missing.push('作品タイトルが入力されていません');
        badges.artwork = true;
    }
    if (!appData.artwork.creatorName || appData.artwork.creatorName.trim() === '') {
        missing.push('制作者名が入力されていません');
        badges.artwork = true;
    }
    
    // Show/hide warning badges
    Object.keys(badges).forEach(key => {
        const badge = document.getElementById(`badge-${key}`);
        if (badge) {
            badge.style.display = badges[key] ? 'flex' : 'none';
        }
    });
    
    // Show missing items alert
    const alertEl = document.getElementById('alert-missing');
    const listEl = document.getElementById('missing-items-list');
    
    if (missing.length > 0) {
        alertEl.style.display = 'flex';
        listEl.innerHTML = missing.map(item => `<li>${item}</li>`).join('');
    } else {
        alertEl.style.display = 'none';
    }
}

// =====================================
// Initialize Input Fields
// =====================================
function initializeInputs() {
    // Hazards input
    const hazardsInput = document.getElementById('input-hazards');
    const currentHazards = document.getElementById('current-hazards');
    
    if (appData.hazardMap.hazards && appData.hazardMap.hazards.length > 0) {
        const hazardsStr = appData.hazardMap.hazards.join(', ');
        hazardsInput.value = hazardsStr;
        currentHazards.textContent = hazardsStr;
    } else {
        currentHazards.textContent = 'なし';
    }

    // Listen for changes to update appData
    hazardsInput.addEventListener('input', function() {
        const value = this.value.trim();
        if (value) {
            appData.hazardMap.hazards = value.split(',').map(h => h.trim()).filter(h => h);
            survey123URL = generateSurvey123URL();
        }
    });
    
    dateInput.addEventListener('change', function() {
        appData.artwork.creationDate = this.value;
        // Save to localStorage
        const artworkData = localStorage.getItem('artworkSubmit');
        if (artworkData) {
            const parsed = JSON.parse(artworkData);
            parsed.creationDate = this.value;
            localStorage.setItem('artworkSubmit', JSON.stringify(parsed));
        }
    });
}

// =====================================
// Set Default Creation Date
// =====================================
function setDefaultCreationDate() {
    const dateInput = document.getElementById('input-creation-date');
    if (!dateInput.value) {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        dateInput.value = dateStr;
        appData.artwork.creationDate = dateStr;
    }
}

// =====================================
// Generate Survey123 URL
// =====================================
function generateSurvey123URL() {
    const baseURL = CONFIG.SURVEY123_BASE_URL;
    const parts = [];

    function add(key, value) {
        if (value === undefined || value === null) return;
        const s = String(value);
        if (s.trim() === '') return;
        parts.push(`${key}=${encodeURIComponent(s)}`);
    }

    function normalizeHazardLabel(s) {
        return String(s)
            .replace(/\(/g, '（')
            .replace(/\)/g, '）')
            .replace(/\s+/g, ' ')
            .trim();
    }

    if (appData.hazardMap.hazards && appData.hazardMap.hazards.length > 0) {
        const normalized = appData.hazardMap.hazards.map(normalizeHazardLabel);
        add('field:field_24', normalized.join(', '));
    }

    add('field:Mabling', appData.marbling.description);
    add('field:collage', appData.collage.description);
    add('field:Message', appData.artwork.title ?? appData.artwork.message ?? '');
    add('field:field_25', appData.artwork.creatorName);

    const loc = appData.hazardMap.location;
    if (loc && loc.lat && loc.lon) {
        add('center', `${loc.lat},${loc.lon}`);
    }

    return `${baseURL}?${parts.join('&')}`;
}

// =====================================
// Open Survey123
// =====================================
function openSurvey123() {
    // Regenerate URL with latest data
    survey123URL = generateSurvey123URL();
    
    // Show iframe
    if (CONFIG.IFRAME_ENABLED) {
        try {
            showSurveyIframe();
            // Show completion checkbox after a delay
            setTimeout(() => {
                document.getElementById('completion-check').style.display = 'block';
                document.getElementById('completion-check').scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest' 
                });
            }, 2000);
        } catch (error) {
            console.error('Iframe display failed:', error);
            openSurvey123InNewTab();
        }
    } else {
        openSurvey123InNewTab();
    }
}

// =====================================
// Show Survey in Iframe
// =====================================
function showSurveyIframe() {
    const surveyContainer = document.getElementById('survey-container');
    const surveyIframe = document.getElementById('survey-iframe');
    
    surveyIframe.src = survey123URL;
    surveyContainer.style.display = 'block';
    
    surveyContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    surveyIframe.onload = function() {
        console.log('Survey123 loaded in iframe');
    };
    
    surveyIframe.onerror = function() {
        console.error('Failed to load Survey123 in iframe');
        closeSurvey();
        openSurvey123InNewTab();
    };
    
    console.log('Survey123 displayed in iframe');
}

// =====================================
// Close Survey Iframe
// =====================================
function closeSurvey() {
    const surveyContainer = document.getElementById('survey-container');
    const surveyIframe = document.getElementById('survey-iframe');
    
    surveyContainer.style.display = 'none';
    surveyIframe.src = '';
}

// =====================================
// Open Survey123 in New Tab
// =====================================
function openSurvey123InNewTab() {
    window.open(survey123URL, '_blank');
    
    // Show completion checkbox
    document.getElementById('completion-check').style.display = 'block';
    document.getElementById('completion-check').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
    });
    
    alert(`✅ Survey123を新しいタブで開きました\n\n【次の操作】\n1️⃣ 新しいタブで内容を確認\n2️⃣ 作品画像をアップロード\n3️⃣ 画面下の「送信」ボタンをクリック\n4️⃣ このページに戻り、完了チェックを入れてください`);
}

// =====================================
// Handle Completion Checkbox
// =====================================
function handleCompletionCheck() {
    const checkbox = document.getElementById('checkbox-submitted');
    const completeSection = document.getElementById('step-complete');
    
    if (checkbox.checked) {
        // Show success message
        completeSection.style.display = 'block';
        completeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Optional: Confetti effect or celebration animation
        celebrateCompletion();
    } else {
        completeSection.style.display = 'none';
    }
}

// =====================================
// Celebration Animation
// =====================================
function celebrateCompletion() {
    // Simple celebration - you can add more effects here
    console.log('🎉 Completion celebrated!');
    
    // Optional: Add confetti or animation library
}

// =====================================
// Navigation Functions
// =====================================
function navigateToPage(page) {
    if (CONFIG.PAGES[page]) {
        if (confirm(`${getPageName(page)}ページに移動しますか？\n（入力した内容は保存されています）`)) {
            window.location.href = CONFIG.PAGES[page];
        }
    }
}

function getPageName(page) {
    const names = {
        hazard: '対象地点/ハザードマップ',
        marbling: 'マーブリング',
        collage: 'コラージュ',
        artwork: '作品情報'
    };
    return names[page] || '';
}

function goBack() {
    navigateToPage('artwork');
}

function goToNextAction() {
    window.location.href = CONFIG.PAGES.next;
}

function viewMap() {
    window.open(CONFIG.PAGES.map, '_blank');
}

function goHome() {
    if (confirm('トップページに戻りますか？')) {
        window.location.href = CONFIG.PAGES.home;
    }
}

// =====================================
// Map Preview (Leaflet)
// =====================================
function renderSummaryMap(lat, lon) {
    const mapEl = document.getElementById('summary-map');
    if (!mapEl) return;

    if (!lat || !lon) {
        mapEl.innerHTML = '<div style="padding:12px;color:#999;text-align:center;">地図を表示できません</div>';
        return;
    }

    // Create map only once
    if (!previewMap) {
        previewMap = L.map('summary-map', { 
            zoomControl: true,
            scrollWheelZoom: false,
            dragging: true,
            touchZoom: true
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(previewMap);
    }

    // Set view
    previewMap.setView([lat, lon], 15);

    if (previewMarker) previewMarker.remove();
    previewMarker = L.marker([lat, lon]).addTo(previewMap);
    
    // Fix map rendering issues
    setTimeout(() => {
        if (previewMap) previewMap.invalidateSize();
    }, 100);
}

// =====================================
// Utility Functions
// =====================================
function logAppData() {
    console.log('=== App Data ===');
    console.log('Hazard Map:', appData.hazardMap);
    console.log('Marbling:', appData.marbling);
    console.log('Collage:', appData.collage);
    console.log('Artwork:', appData.artwork);
    console.log('Survey123 URL:', survey123URL);
    console.log('================');
}

// Expose to global for debugging
window.logAppData = logAppData;
window.openSurvey123InNewTab = openSurvey123InNewTab;
