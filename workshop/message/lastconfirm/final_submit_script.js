/**
 * Final Submit Page Script
 * 
 * Purpose: Generate Survey123 URL with pre-filled data and display it
 * Survey123 URL: https://survey123.arcgis.com/share/cff62fc5070c4f468b2c9269d5b2535f
 * 
 * Field Mappings:
 * - Used hazard maps → field_24
 * - Marbling description → Mabling
 * - Collage description → collage
 * - Message (artwork title) → Message
 * - Target location → center=lat,lon
 */

// =====================================
// Configuration
// =====================================
const CONFIG = {
    SURVEY123_BASE_URL: 'https://survey123.arcgis.com/share/cff62fc5070c4f468b2c9269d5b2535f',
    PREVIOUS_PAGE: '../artwork/artwork_submit.html',
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
        creatorName: ''
    }
};

let survey123URL = '';

// =====================================
// Initialize Page
// =====================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('Final Submit Page - Initializing...');
    
    loadAllData();
    displayDataPreview();
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
      appData.hazardMap = parsed.hazardMap ?? parsed; // どっちでも対応
      console.log('Loaded hazard map data:', appData.hazardMap);
    }

    const marblingData = localStorage.getItem('marblingLog');
    if (marblingData) {
      const parsed = JSON.parse(marblingData);
      appData.marbling = parsed.marbling ?? parsed; // ←重要
      console.log('Loaded marbling data:', appData.marbling);
    }

    const collageData = localStorage.getItem('collageLog');
    if (collageData) {
      const parsed = JSON.parse(collageData);
      appData.collage = parsed.collage ?? parsed; // ←重要
      console.log('Loaded collage data:', appData.collage);
    }

    const artworkData = localStorage.getItem('artworkSubmit');
    if (artworkData) {
    const parsed = JSON.parse(artworkData);

    // artwork_submit.js の保存形式:
    // { title, imageDataUrl, creatorName }
    appData.artwork.title = parsed.title ?? '';
    appData.artwork.creatorName = parsed.creatorName ?? '';

    console.log('Loaded artwork data:', appData.artwork);
    }
  } catch (error) {
    console.error('Error loading data from localStorage:', error);
    alert('データの読み込みに失敗しました。前のページに戻ってやり直してください。');
  }
}

// =====================================
// Display Data Preview
// =====================================
function displayDataPreview() {
    // Display hazards
    const hazardsEl = document.getElementById('preview-hazards');
    if (appData.hazardMap.hazards && appData.hazardMap.hazards.length > 0) {
        hazardsEl.textContent = appData.hazardMap.hazards.join(', ');
    } else {
        hazardsEl.textContent = '（未選択）';
        hazardsEl.style.color = 'var(--color-text-secondary)';
    }
    
    // Display location (Map)
    const loc = appData.hazardMap.location;
    renderPreviewMap(loc?.lat, loc?.lon);
    
    // Display marbling description
    const marblingEl = document.getElementById('preview-marbling');
    if (appData.marbling.description) {
        marblingEl.textContent = appData.marbling.description;
    } else {
        marblingEl.textContent = '（未入力）';
        marblingEl.style.color = 'var(--color-text-secondary)';
    }
    
    // Display collage description
    const collageEl = document.getElementById('preview-collage');
    if (appData.collage.description) {
        collageEl.textContent = appData.collage.description;
    } else {
        collageEl.textContent = '（未入力）';
        collageEl.style.color = 'var(--color-text-secondary)';
    }
    
    // Display message
    const messageEl = document.getElementById('preview-message');
    if (appData.artwork.title) {
        messageEl.textContent = appData.artwork.title;
    } else {
        messageEl.textContent = '（未入力）';
        messageEl.style.color = 'var(--color-text-secondary)';
    }
    // Display creator (pen name)
    const creatorEl = document.getElementById('preview-creator');
    if (creatorEl) {
        if (appData.artwork.creatorName) {
            creatorEl.textContent = appData.artwork.creatorName;
        } else {
            creatorEl.textContent = '（未入力）';
            creatorEl.style.color = 'var(--color-text-secondary)';
        }
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

  // hazards
  if (appData.hazardMap.hazards && appData.hazardMap.hazards.length > 0) {
    add('field:field_24', appData.hazardMap.hazards.join(', '));
  }

  // descriptions
  add('field:Mabling', appData.marbling.description);
  add('field:collage', appData.collage.description);

  // message/title（titleのキーが違う可能性を吸収）
  add('field:Message', appData.artwork.title ?? appData.artwork.message ?? '');
  add('field:field_25', appData.artwork.creatorName);

  // center
  const loc = appData.hazardMap.location;
  if (loc && loc.lat && loc.lon) {
    add('center', `${loc.lat},${loc.lon}`);
  }

  return `${baseURL}?${parts.join('&')}`;
}

// =====================================
// Validation
// =====================================
function validateData() {
    const errors = [];
    
    // Check hazard maps
    if (!appData.hazardMap.hazards || appData.hazardMap.hazards.length === 0) {
        errors.push('ハザードマップが選択されていません');
    }
    
    // Check location
    if (!appData.hazardMap.location || !appData.hazardMap.location.lat || !appData.hazardMap.location.lon) {
        errors.push('対象地点が選択されていません');
    }
    
    // Check marbling description
    if (!appData.marbling.description || appData.marbling.description.trim() === '') {
        errors.push('マーブリング作品の説明が入力されていません');
    }
    
    // Check collage description
    if (!appData.collage.description || appData.collage.description.trim() === '') {
        errors.push('コラージュ作品の説明が入力されていません');
    }
    
    // Check message
    if (!appData.artwork.title || appData.artwork.title.trim() === '') {
        errors.push('作品タイトル（メッセージ）が入力されていません');
    }
    
    if (errors.length > 0) {
        alert('━━━━━━━━━━━━━━━━━━━━━━━━\n⚠️ 入力内容に不足があります\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n以下の項目を入力してください:\n\n' + errors.join('\n') + '\n\n「内容を修正する」ボタンから前のページに戻り、内容を入力してください。');
        return false;
    }
    
    return true;
}

// =====================================
// Open Survey123
// =====================================
function openSurvey123() {
    // Validate data first
    if (!validateData()) {
        return;
    }
    
    // Confirm before opening Survey123
    const confirmMessage = `━━━━━━━━━━━━━━━━━━━━━━━━
📝 Survey123で最終確認を行います
━━━━━━━━━━━━━━━━━━━━━━━━

✅ 入力した内容が自動で反映されます
📸 作品画像は手動でアップロードしてください
📤 確認後、「送信」ボタンをクリックしてください

続けてよろしいですか？`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Try iframe first if enabled
    if (CONFIG.IFRAME_ENABLED) {
        try {
            showSurveyIframe();
        } catch (error) {
            console.error('Iframe display failed:', error);
            // Fallback to new tab
            openSurvey123InNewTab();
        }
    } else {
        // Open in same tab
        openSurvey123InSameTab();
    }
}

// =====================================
// Show Survey in Iframe
// =====================================
function showSurveyIframe() {
    const surveyContainer = document.getElementById('survey-container');
    const surveyIframe = document.getElementById('survey-iframe');
    
    // Set iframe src
    surveyIframe.src = survey123URL;
    
    // Show container
    surveyContainer.style.display = 'block';
    
    // Scroll to survey
    surveyContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Monitor iframe load
    surveyIframe.onload = function() {
        console.log('Survey123 loaded in iframe');
    };
    
    surveyIframe.onerror = function() {
        console.error('Failed to load Survey123 in iframe');
        closeSurvey();
        showFallbackMessage();
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
    
    alert(`━━━━━━━━━━━━━━━━━━━━━━━━
✅ Survey123を新しいタブで開きました
━━━━━━━━━━━━━━━━━━━━━━━━

【次の操作】
1️⃣ 新しいタブで内容を確認
2️⃣ 作品画像をアップロード
3️⃣ 画面下の「送信」ボタンをクリック

送信すると作品集マップに登録されます。`);
}

// =====================================
// Open Survey123 in Same Tab
// =====================================
function openSurvey123InSameTab() {
    // Navigate to Survey123 in same tab
    window.location.href = survey123URL;
}

// =====================================
// Show Fallback Message
// =====================================
function showFallbackMessage() {
    const fallbackMessage = document.getElementById('fallback-message');
    fallbackMessage.style.display = 'block';
    fallbackMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// =====================================
// Go Back
// =====================================
function goBack() {
    if (confirm('前のページに戻りますか？\n（入力した内容は保存されています）')) {
        window.location.href = CONFIG.PREVIOUS_PAGE;
    }
}

// =====================================
// Utility Functions
// =====================================

// Log app data for debugging
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

// =====================================
// Map Preview (Leaflet)
// =====================================
let previewMap = null;
let previewMarker = null;

function renderPreviewMap(lat, lon) {
    const mapEl = document.getElementById('preview-map');
    if (!mapEl) return;

    // 未選択時
    if (!lat || !lon) {
        mapEl.innerHTML = '<div style="padding:12px;color:#666;">（未選択）</div>';
        return;
    }

    // 初回のみ地図作成
    if (!previewMap) {
        previewMap = L.map('preview-map', { zoomControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(previewMap);
    }

    // 位置反映
    previewMap.setView([lat, lon], 16);

    if (previewMarker) previewMarker.remove();
    previewMarker = L.marker([lat, lon]).addTo(previewMap);
}
