// ============================================================================
//  FULL JS (Complete) - Touch Control: 1 finger pan only (bounded), 2 finger zoom only
//  Fixes included:
//   - webMercatorUtils import + argument (was missing)
//   - allowedArea created in view.spatialReference (SR mismatch fix)
//   - 2-finger "zoom only": center/heading/tilt are locked during pinch
//   - rotation/tilt are clamped consistently (manual tilt buttons still work)
//   - center bound check uses geometryEngine.contains with matching SR
//   - guard flags to avoid feedback loops
// ============================================================================

// ===== Style Injection for Marker Scaling =====
const style = document.createElement("style");
style.innerHTML = `
  .artwork-marker {
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.27), z-index 0s;
  }
  .artwork-marker.selected {
    transform: scale(1.3) !important;
    z-index: 99999 !important;
    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
  }
  /* 既存のマーカー内画像のスタイル調整 */
  .artwork-marker.selected .marker-container {
    border-width: 4px !important;
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.6);
  }
  #mapView, #mapContainer {
    touch-action: none;
  }
`;
document.head.appendChild(style);

// ===== Firebase Configuration & Initialization =====
async function waitForFirebase() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.firebaseModules) {
        resolve(window.firebaseModules);
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  });
}

const firebaseConfig = {
  apiKey: "AIzaSyDlAeRjw7Ml8mvR6rvs8IVIWQE3EAM7ZHk",
  authDomain: "bo-sci-2025-lp.firebaseapp.com",
  projectId: "bo-sci-2025-lp",
  storageBucket: "bo-sci-2025-lp.firebasestorage.app",
  messagingSenderId: "653385182120",
  appId: "1:653385182120:web:c2da1cfb02b3490ede0b9d",
  measurementId: "G-S4PL5GM7MF",
};

let db;
let app;

// ===== Global Variables =====
let view;
let surveyLayer;
let artworks = [];
let artworkLikes = {};
let newArtworkIds = new Set();
let currentArtwork = null;
let hasLiked = false;

// ローカルストレージ
let likedArtworks = JSON.parse(localStorage.getItem("likedArtworks") || "{}");
let myCommentIds = JSON.parse(localStorage.getItem("myCommentIds") || "[]");

let bottomInstruction;
let allowedArea;
let lastValidCamera = null;
let initialCamera = null;

let replyingToCommentId = null;
let replyingToAuthor = null;

// Intersection Observer for Desktop Scroll
let listObserver = null;
let isClickScrolling = false;
let isProgrammaticMove = false;

let isSproutMode = false;

let allowedTilt = 60;

// ===== Helpers (safe DOM) =====
function safeGet(id) {
  return document.getElementById(id);
}

// ★重要: HTMLのonclickから呼ばれる関数を確実にグローバルに登録
window.adjustTilt = function (direction) {
  if (!view || !view.ready) {
    console.warn("Map view is not ready yet.");
    return;
  }

  const cam = view.camera.clone();
  const currentTilt = cam.tilt;
  let newTilt;

  if (direction === "up") {
    newTilt = currentTilt - 15;
  } else {
    newTilt = currentTilt + 15;
  }

  if (newTilt < 0) newTilt = 0;
  if (newTilt > 80) newTilt = 80;

  cam.tilt = newTilt;

  isProgrammaticMove = true;

  view
    .goTo(cam, { duration: 400, easing: "out-cubic" })
    .then(() => {
      allowedTilt = newTilt;
      setTimeout(() => {
        isProgrammaticMove = false;
      }, 200);
    })
    .catch((error) => {
      if (error.name !== "AbortError") {
        console.error("Tilt animation error:", error);
        isProgrammaticMove = false;
      }
    });

  const mapContainer = safeGet("mapContainer");
  if (mapContainer) {
    if (newTilt < 10) {
      mapContainer.classList.add("is-top-down");
    } else {
      mapContainer.classList.remove("is-top-down");
    }
  }
};

function updateMarkerHighlight(activeId) {
  const allMarkers = document.querySelectorAll(".artwork-marker");
  allMarkers.forEach((marker) => {
    if (marker.dataset.id === activeId) {
      marker.classList.add("selected");
    } else {
      marker.classList.remove("selected");
    }
  });
}

// Firebase初期化
(async () => {
  const fb = await waitForFirebase();
  app = fb.initializeApp(firebaseConfig);
  db = fb.getFirestore(app);

  const likesCollection = fb.collection(db, "likes");

  fb.onSnapshot(likesCollection, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const data = change.doc.data();
      const id = change.doc.id;
      artworkLikes[id] = data.count !== undefined ? data.count : 0;
    });

    renderMarkers();
    renderArtworkList();
    if (currentArtwork && window.innerWidth >= 1024) {
      renderDesktopComments(currentArtwork.id);
      updateMarkerHighlight(currentArtwork.id);
    }
    if (currentArtwork) updateLikeButton();
  });
})();

// === ArcGIS Map Initialization ===
require([
  "esri/WebScene",
  "esri/views/SceneView",
  "esri/geometry/Polygon",
  "esri/geometry/Point",
  "esri/geometry/geometryEngine",
  "esri/geometry/support/webMercatorUtils",
], (WebScene, SceneView, Polygon, Point, geometryEngine, webMercatorUtils) => {
  const scene = new WebScene({
    portalItem: {
      id: "824c34a6b9134c67a8f649d027a08e0c",
    },
  });

  view = new SceneView({
    container: "mapView",
    map: scene,
    constraints: {
      altitude: {
        min: 5,
        max: 1000,
      },
      tilt: {
        max: 80,
        mode: "manual",
      },
      snapToZoom: false,
    },
    qualityProfile: "high",
    navigation: {
      browserTouchPanEnabled: true,
      momentumEnabled: false,
      gamepad: { enabled: false },
    },
  });

  // 右クリックドラッグなどの抑止
  view.on("drag", (event) => {
    if (event.button === 2) {
      event.stopPropagation();
    }
  });

  view.on("key-down", (event) => {
    const prohibitedKeys = ["ArrowLeft", "ArrowRight", "a", "d", "q", "e"];
    if (prohibitedKeys.includes(event.key)) {
      event.stopPropagation();
    }
  });

  view.when(async () => {
    const hideLoading = () => {
      const loadingEl = safeGet("mapLoading");
      if (loadingEl && !loadingEl.classList.contains("hide")) {
        loadingEl.classList.add("hide");
        setTimeout(() => {
          loadingEl.style.display = "none";
        }, 400);
      }
    };

    view.ui.remove(["zoom", "navigation-toggle", "compass"]);
    view.environment = {
      ...view.environment,
      starsEnabled: false,
      atmosphere: { quality: "low" },
    };

    view.popup.autoOpenEnabled = false;
    view.popup.visible = false;
    view.map.allLayers.forEach((layer) => {
      if ("popupEnabled" in layer) layer.popupEnabled = false;
    });

    window.view = view;

    const mapEl = view.container;

    // ----------------------------------------------------------------------
    // Touch control:
    //  - 1 finger: PAN only (ArcGIS handles pan)
    //  - 2 finger: ZOOM only (we lock center/heading/tilt while pinch)
    //  - 3+ fingers: blocked
    // ----------------------------------------------------------------------
    let isTwoFinger = false;
    let twoFingerCenter = null; // view.center clone
    let twoFingerHeading = 0;
    let twoFingerTilt = allowedTilt;

    // iOS Safari: stop gesture events
    mapEl.addEventListener("gesturestart", (e) => e.preventDefault(), {
      passive: false,
    });
    mapEl.addEventListener("gesturechange", (e) => e.preventDefault(), {
      passive: false,
    });
    mapEl.addEventListener("gestureend", (e) => e.preventDefault(), {
      passive: false,
    });

    // 2-finger pinch distance tracking (optional block when no zoom change)
    let pinchStartDist = null;
    const getDist = (t1, t2) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.hypot(dx, dy);
    };

    mapEl.addEventListener(
      "touchstart",
      (e) => {
        if (!e.touches) return;

        // block 3+ fingers
        if (e.touches.length >= 3) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // two-finger start
        if (e.touches.length === 2) {
          pinchStartDist = getDist(e.touches[0], e.touches[1]);

          isTwoFinger = true;
          twoFingerCenter = view.center ? view.center.clone() : null;
          twoFingerHeading = view.camera ? view.camera.heading : 0;
          twoFingerTilt = allowedTilt;
        }
      },
      { passive: false }
    );

    mapEl.addEventListener(
      "touchmove",
      (e) => {
        if (!e.touches) return;

        // block 3+ fingers
        if (e.touches.length >= 3) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // 2 finger: allow pinch, but if no distance change => likely pan/rotate -> block
        if (e.touches.length === 2) {
          const cur = getDist(e.touches[0], e.touches[1]);
          if (pinchStartDist == null) pinchStartDist = cur;

          const ratio = cur / pinchStartDist;

          if (Math.abs(ratio - 1) < 0.02) {
            // not zooming -> block
            e.preventDefault();
            e.stopPropagation();
          }
          return;
        }
      },
      { passive: false }
    );

    mapEl.addEventListener(
      "touchend",
      (e) => {
        pinchStartDist = null;
        if (!e.touches || e.touches.length < 2) {
          isTwoFinger = false;
          twoFingerCenter = null;
        }
      },
      { passive: true }
    );

    mapEl.addEventListener(
      "touchcancel",
      () => {
        pinchStartDist = null;
        isTwoFinger = false;
        twoFingerCenter = null;
      },
      { passive: true }
    );

    // ----------------------------------------------------------------------
    // Allowed area: build polygon in view.spatialReference (SR mismatch fix)
    // ----------------------------------------------------------------------
    const ringLonLat = [
      [139.611, 35.5265],
      [139.611, 35.555],
      [139.648, 35.555],
      [139.648, 35.5265],
      [139.611, 35.5265],
    ];

    // Convert to view SR (usually WebMercator)
    const ringInViewSR = ringLonLat.map(([lon, lat]) => {
      const p = new Point({
        longitude: lon,
        latitude: lat,
        spatialReference: { wkid: 4326 },
      });

      // If view is already geographic, keep as-is; else convert
      if (view.spatialReference && view.spatialReference.isGeographic) {
        return [p.x, p.y];
      }
      const p2 = webMercatorUtils.geographicToWebMercator(p);
      return [p2.x, p2.y];
    });

    allowedArea = new Polygon({
      rings: [ringInViewSR],
      spatialReference: view.spatialReference,
    });

    // ----------------------------------------------------------------------
    // Initial camera
    // ----------------------------------------------------------------------
    const centerLon = (139.621 + 139.658) / 2;
    const centerLat = (35.5035 + 35.555) / 2;

    // NOTE: you may want smaller initial z and lower MAX_Z to prevent "Japan map" zoom-out.
    initialCamera = {
      position: {
        longitude: centerLon,
        latitude: centerLat,
        z: 1000,
      },
      heading: 0,
      tilt: 60,
    };

    try {
      await view.goTo(initialCamera);
    } catch (error) {
      if (error.name !== "AbortError") console.error(error);
    }

    // ----------------------------------------------------------------------
    // Camera constraints (hard lock):
    //   - heading fixed
    //   - tilt locked to allowedTilt (except when adjustTilt updates allowedTilt)
    //   - zoom z clamped
    //   - when 2-finger pinch: lock center/heading/tilt, allow only z change
    // ----------------------------------------------------------------------
    const MIN_Z = 5;
    const MAX_Z = 1000;
    const FIXED_HEADING = 0;

    view.watch("camera", (cam) => {
      if (isProgrammaticMove) return;

      const next = cam.clone();
      let changed = false;

      // heading lock
      const desiredHeading =
        isTwoFinger && twoFingerCenter ? twoFingerHeading : FIXED_HEADING;
      if (Math.abs(next.heading - desiredHeading) > 0.3) {
        next.heading = desiredHeading;
        changed = true;
      }

      // tilt lock
      const desiredTilt =
        isTwoFinger && twoFingerCenter ? twoFingerTilt : allowedTilt;
      if (Math.abs(next.tilt - desiredTilt) > 0.3) {
        next.tilt = desiredTilt;
        changed = true;
      }

      // zoom clamp (z)
      const z = next.position.z;
      if (z < MIN_Z) {
        next.position.z = MIN_Z;
        changed = true;
      } else if (z > MAX_Z) {
        next.position.z = MAX_Z;
        changed = true;
      }

      // Apply correction
      if (changed) {
        isProgrammaticMove = true;

        // If pinching: lock center too (ZOOM ONLY)
        if (isTwoFinger && twoFingerCenter) {
          // Keep current viewpoint centered at twoFingerCenter
          // Use goTo object so "center" is enforced.
          view
            .goTo(
              {
                center: twoFingerCenter,
                heading: next.heading,
                tilt: next.tilt,
                position: next.position, // z allowed
              },
              { animate: false }
            )
            .finally(() => {
              isProgrammaticMove = false;
            });
        } else {
          view.goTo(next, { animate: false }).finally(() => {
            isProgrammaticMove = false;
          });
        }
      }
    });

    // ----------------------------------------------------------------------
    // Center bound: if out of allowedArea -> return to initialCamera
    // (SR is now consistent)
    // ----------------------------------------------------------------------
    view.watch("center", (center) => {
      if (isProgrammaticMove) return;
      if (!allowedArea || !geometryEngine || !center) return;

      const isWithin = geometryEngine.contains(allowedArea, center);

      if (!isWithin) {
        isProgrammaticMove = true;
        view
          .goTo(initialCamera, { duration: 1000, easing: "out-expo" })
          .finally(() => {
            // give it a short grace to avoid immediate re-trigger
            setTimeout(() => {
              isProgrammaticMove = false;
            }, 150);
          });
      } else {
        lastValidCamera = view.camera.clone();
      }
    });

    // ----------------------------------------------------------------------
    // Load Survey layer
    // ----------------------------------------------------------------------
    try {
      surveyLayer = view.map.allLayers.find(
        (lyr) => lyr.title === "survey" || lyr.id === "survey"
      );

      if (surveyLayer) {
        await loadArtworksFromSurvey();
      } else {
        console.warn("Survey layer not found.");
      }
    } catch (error) {
      console.error("Error loading artworks:", error);
    } finally {
      hideLoading();
    }

    view.watch("extent", () => {
      if (artworks.length) renderMarkers();
    });
    view.watch("camera", () => {
      if (artworks.length) renderMarkers();
    });
  });
});

document.addEventListener("DOMContentLoaded", () => {
  bottomInstruction = document.querySelector(".bottom-instruction");
  const guideBtn = safeGet("mapGuideButton");
  if (guideBtn) guideBtn.style.display = "none";
  if (bottomInstruction) bottomInstruction.classList.remove("show");

  startSurveyTimer();
});

// === Timer ===
function startSurveyTimer() {
  const timerEl = safeGet("headerTimer");
  const buttonEl = safeGet("surveyButton");
  if (!timerEl || !buttonEl) return;

  let timeLeft = 180;

  const updateDisplay = () => {
    const m = Math.floor(timeLeft / 60)
      .toString()
      .padStart(2, "0");
    const s = (timeLeft % 60).toString().padStart(2, "0");
    timerEl.textContent = `${m}:${s} 後に`;
  };

  updateDisplay();

  const intervalId = setInterval(() => {
    timeLeft--;
    updateDisplay();

    if (timeLeft <= 0) {
      clearInterval(intervalId);
      timerEl.textContent = "回答お願いします！→";
      timerEl.style.color = "#16a34a";
      buttonEl.classList.remove("disabled");
    }
  }, 1000);
}

// === Helper Functions ===
function closeSiteGuide() {
  safeGet("siteGuide")?.classList.add("hidden");
  const btn = safeGet("mapGuideButton");
  if (btn) btn.style.display = "flex";
  if (bottomInstruction) bottomInstruction.classList.add("show");
}

function showSiteGuide() {
  safeGet("siteGuide")?.classList.remove("hidden");
  const btn = safeGet("mapGuideButton");
  if (btn) btn.style.display = "none";
  if (bottomInstruction) bottomInstruction.classList.remove("show");
}

function calculateSproutClusters(screenItems) {
  const clusters = [];
  const usedIndices = new Set();
  const clusterDistance = 120;

  for (let i = 0; i < screenItems.length; i++) {
    if (usedIndices.has(i)) continue;

    const baseItem = screenItems[i];
    const clusterMembers = [baseItem];
    usedIndices.add(i);

    for (let j = i + 1; j < screenItems.length; j++) {
      if (usedIndices.has(j)) continue;
      const targetItem = screenItems[j];

      const dx = baseItem.x - targetItem.x;
      const dy = baseItem.y - targetItem.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < clusterDistance) {
        clusterMembers.push(targetItem);
        usedIndices.add(j);
      }
    }

    const uniqueTypes = new Set(
      clusterMembers
        .map((m) => m.artwork.hazardType)
        .filter((t) => t && t !== "種別不明")
    );
    const typeCount = uniqueTypes.size;

    let sproutLevel = 0;
    if (typeCount >= 4) sproutLevel = 3;
    else if (typeCount === 3) sproutLevel = 2;
    else if (typeCount === 2) sproutLevel = 1;

    if (sproutLevel > 0) {
      const avgX =
        clusterMembers.reduce((sum, m) => sum + m.x, 0) / clusterMembers.length;
      const avgY =
        clusterMembers.reduce((sum, m) => sum + m.y, 0) / clusterMembers.length;

      const rect = view.container.getBoundingClientRect();
      const top = (avgY / rect.height) * 100;
      const left = (avgX / rect.width) * 100;

      clusters.push({
        position: { top, left },
        count: clusterMembers.length,
        typeCount: typeCount,
        level: sproutLevel,
      });
    }
  }
  return clusters;
}

function getHazardColor(typeString) {
  if (!typeString) return "#9ca3af";
  if (typeString.includes("土砂")) return "#8d6e63";
  if (typeString.includes("川の水")) return "#3b82f6";
  if (typeString.includes("下水")) return "#0ea5e9";
  if (typeString.includes("高潮") || typeString.includes("津波"))
    return "#1d4ed8";
  if (typeString.includes("火災")) return "#ef4444";
  if (typeString.includes("震度")) return "#eab308";
  if (typeString.includes("液状化")) return "#f97316";
  return "#6b7280";
}

const HIDE_KEYWORDS = [
  "猛犬危険",
  "散歩好きの皆",
  "慶應生は勉強",
  "逃げよう",
  "神だのみ",
  "浸水危険",
  "上へ逃げろ",
  "買い物客",
  "避難する方向に",
  "流域の方へ",
  "迅速な避難",
  "危ない気お",
  "土の表情",
];

async function loadArtworksFromSurvey() {
  if (!surveyLayer) return;

  const query = surveyLayer.createQuery();
  query.where = "1=1";
  query.outFields = [
    "objectid",
    "Message",
    "field_24",
    "field_25",
    "Mabling",
    "collage",
    "CreationDate",
  ];
  query.returnGeometry = true;
  query.returnAttachments = true;

  try {
    const result = await surveyLayer.queryFeatures(query);
    const attachmentInfo = await surveyLayer.queryAttachments({
      objectIds: result.features.map((f) => f.attributes.objectid),
    });

    const allArtworks = result.features.map((f) => {
      const a = f.attributes;
      const oid = a.objectid;
      const rawType = a.field_24 || a.SURVEYTYPE || a.surveytype || "";
      let imageUrl = "";
      if (attachmentInfo[oid] && attachmentInfo[oid].length > 0) {
        const att = attachmentInfo[oid][0];
        imageUrl = att.url;
      }

      return {
        id: String(oid),
        title: a.Message || "(タイトル未入力)",
        author: a.field_25 || "作者不明",
        imageUrl,
        marbling: a.Mabling || "",
        collage: a.collage || "",
        createdDate: a.CreationDate || 0,
        hazardType: rawType || "種別不明",
        geometry: f.geometry,
      };
    });

    artworks = allArtworks.filter((art) => {
      if (!art.title) return false;
      return !HIDE_KEYWORDS.some((keyword) => art.title.includes(keyword));
    });

    const latest3 = [...artworks]
      .sort((a, b) => b.createdDate - a.createdDate)
      .slice(0, 3);
    newArtworkIds = new Set(latest3.map((a) => a.id));

    artworks.forEach((a) => {
      if (artworkLikes[a.id] === undefined) {
        artworkLikes[a.id] = 0;
      }
    });

    renderMarkers();
    renderArtworkList();
  } catch (err) {
    console.error("Layer query failed:", err);
  }
}

// === Rendering Logic ===
function renderMarkers() {
  const container = safeGet("markersContainer");
  if (!container || !view) return;

  container.innerHTML = "";
  if (!artworks.length) return;

  const rect = view.container.getBoundingClientRect();

  const screenItems = artworks
    .map((art) => {
      const pt = view.toScreen(art.geometry);
      return { artwork: art, x: pt ? pt.x : -9999, y: pt ? pt.y : -9999 };
    })
    .filter(
      (item) =>
        item.x > -200 &&
        item.x < rect.width + 200 &&
        item.y > -200 &&
        item.y < rect.height + 200
    );

  const itemsForMarkers = JSON.parse(JSON.stringify(screenItems));
  resolveOverlaps(itemsForMarkers, rect.width, rect.height);

  itemsForMarkers.forEach((item, index) => {
    const originalArt = screenItems[index].artwork;
    const pos = {
      left: (item.x / rect.width) * 100,
      top: (item.y / rect.height) * 100,
    };
    const zIndex = Math.floor(item.y);
    container.appendChild(createArtworkMarker(originalArt, pos, zIndex));
  });

  const clusters = calculateSproutClusters(screenItems);
  clusters.forEach((cluster) => {
    container.appendChild(createSproutMarker(cluster));
  });

  if (isSproutMode) document.body.classList.add("sprout-mode-active");
  else document.body.classList.remove("sprout-mode-active");

  if (currentArtwork) updateMarkerHighlight(currentArtwork.id);
}

function createArtworkMarker(artwork, position, zIndex) {
  const isNew = newArtworkIds.has(artwork.id);
  const marker = document.createElement("div");
  const likes = artworkLikes[artwork.id] || 0;
  const isPopular = likes > 35;

  marker.className = `artwork-marker ${isPopular ? "popular" : ""}`;
  marker.dataset.id = artwork.id;

  marker.style.top = `${position.top}%`;
  marker.style.left = `${position.left}%`;
  marker.style.zIndex = zIndex;
  marker.onclick = () => openModal(artwork);

  if (currentArtwork && currentArtwork.id === artwork.id) {
    marker.classList.add("selected");
  }

  const hazardColor = getHazardColor(artwork.hazardType);

  marker.innerHTML = `
    <div class="marker-container" style="border: 3px solid ${hazardColor};">
     ${isNew ? '<div class="marker-new-badge">New!</div>' : ""} 
      <div class="marker-image-wrapper">
        <img src="${artwork.imageUrl}" class="marker-image" alt="${
    artwork.title
  }">
      </div>
      <div class="marker-overlay">
        <p class="marker-title">${artwork.title}</p>
        <p class="marker-author">${artwork.author}</p>
      </div>
      <div class="marker-likes">
        <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        <span>${likes}</span>
      </div>
      ${isPopular ? '<div class="marker-popular-badge">✨人気</div>' : ""}
    </div>
    <div class="marker-tap-hint">タップ！</div>
  `;
  return marker;
}

function resolveOverlaps(items, viewWidth, viewHeight) {
  const iterations = 5;
  const minDist = 130;
  for (let n = 0; n < iterations; n++) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        let p1 = items[i];
        let p2 = items[j];
        if (p1.x < 0 || p1.x > viewWidth || p1.y < 0 || p1.y > viewHeight)
          continue;
        let dx = p1.x - p2.x;
        let dy = p1.y - p2.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          let overlap = (minDist - dist) / 2;
          let angle =
            dist === 0 ? Math.random() * Math.PI * 2 : Math.atan2(dy, dx);
          let moveX = Math.cos(angle) * overlap * 0.5;
          let moveY = Math.sin(angle) * overlap * 0.5;
          p1.x += moveX;
          p1.y += moveY;
          p2.x -= moveX;
          p2.y -= moveY;
        }
      }
    }
  }
  return items;
}

// === Modal & Interaction ===
let modalUnsubscribe = null;
let desktopUnsubscribe = null;

function parseHazardTypes(typeString) {
  if (!typeString) return [];
  return typeString
    .split(/[,、]/)
    .map((s) => s.trim())
    .filter((s) => s);
}

function openModal(artwork) {
  currentArtwork = artwork;

  const currentLikes = artworkLikes[artwork.id] || 0;
  if (currentLikes === 0 && likedArtworks[artwork.id]) {
    delete likedArtworks[artwork.id];
    localStorage.setItem("likedArtworks", JSON.stringify(likedArtworks));
  }
  hasLiked = !!likedArtworks[artwork.id];

  const modal = safeGet("artworkModal");
  safeGet("modalImage").src = artwork.imageUrl;
  safeGet("modalTitle").textContent = artwork.title;
  safeGet("modalAuthor").textContent = `作者：${artwork.author}`;

  const hazardEl = safeGet("modalHazardInfo");
  if (hazardEl) {
    const rawType = artwork.hazardType || "種別不明";
    const types = parseHazardTypes(rawType);

    if (types.length > 0) {
      const listHtml = types
        .map((type) => {
          const color = getHazardColor(type);
          return `
            <div class="hazard-item">
              <span class="hazard-dot" style="background: ${color};"></span>
              <span>${type}</span>
            </div>`;
        })
        .join("");

      hazardEl.innerHTML = `
        <p class="hazard-section-title">使用したハザードマップ</p>
        <div class="hazard-list">
          ${listHtml}
        </div>
      `;
    } else {
      const color = getHazardColor(rawType);
      hazardEl.innerHTML = `
        <p class="hazard-section-title">使用したハザードマップ</p>
        <div class="hazard-list">
          <div class="hazard-item">
             <span class="hazard-dot" style="background: ${color};"></span>
             <span>${rawType}</span>
          </div>
        </div>
      `;
    }
  }

  const descEl = safeGet("modalDescription");
  const marblingText = artwork.marbling || "";
  const collageText = artwork.collage || "";
  if (descEl) {
    if (marblingText || collageText) {
      descEl.innerHTML = `
        <div class="description-block">
          <h2 class="description-section-title">作者が表現に込めた想い</h2>
          <p class="description-label">マーブリング(地域の危険の表現)：</p> 
          <p class="description-text">${marblingText || "（記入なし）"}</p>
        </div>
        <div class="description-block">
          <p class="description-label">コラージュ(危険に対する防災行動の表現)：</p> 
          <p class="description-text">${collageText || "（記入なし）"}</p>
        </div>
      `;
    } else {
      descEl.textContent = "";
    }
  }

  updateLikeButton();
  cancelReply();
  if (modalUnsubscribe) modalUnsubscribe();
  modalUnsubscribe = loadCommentsForElement(artwork.id, renderFirebaseComments);
  modal?.classList.add("show");

  if (window.innerWidth >= 1024) {
    isClickScrolling = true;
    isProgrammaticMove = true;

    updateMarkerHighlight(artwork.id);

    const card = document.querySelector(`.list-card[data-id="${artwork.id}"]`);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });

    if (view) {
      view
        .goTo(
          { center: artwork.geometry, zoom: 17, tilt: 60 },
          { duration: 800, easing: "out-quart" }
        )
        .then(() => {
          setTimeout(() => {
            isProgrammaticMove = false;
          }, 200);
        })
        .catch((err) => {
          if (err.name !== "AbortError") console.error(err);
          isProgrammaticMove = false;
        });

      renderDesktopComments(artwork.id);
    }

    setTimeout(() => {
      isClickScrolling = false;
    }, 1000);
  }
}

function loadCommentsForElement(artworkId, renderCallback) {
  const fb = window.firebaseModules;
  const commentsRef = fb.collection(db, "likes", artworkId, "comments");
  const q = fb.query(commentsRef, fb.orderBy("timestamp", "asc"));

  return fb.onSnapshot(q, (snapshot) => {
    const comments = [];
    snapshot.forEach((doc) => {
      comments.push({ id: doc.id, ...doc.data() });
    });
    renderCallback(comments);
  });
}

function closeModal() {
  const modal = safeGet("artworkModal");
  modal?.classList.remove("show");
  document.body.style.overflow = "";
  if (window.innerWidth < 1024) {
    currentArtwork = null;
    updateMarkerHighlight(null);
  }
  if (modalUnsubscribe) {
    modalUnsubscribe();
    modalUnsubscribe = null;
  }
}

function renderFirebaseComments(comments) {
  const commentsList = safeGet("commentsList");
  const commentCount = safeGet("commentCount");
  if (commentCount) commentCount.textContent = `(${comments.length})`;
  if (!commentsList) return;
  commentsList.innerHTML = "";
  renderCommentsToContainer(comments, commentsList, false);
}

function renderCommentsToContainer(comments, container, isDesktop) {
  const parents = comments.filter((c) => !c.parentId);
  const children = comments.filter((c) => c.parentId);

  parents.forEach((parent) => {
    container.appendChild(createCommentElement(parent, false, isDesktop));
    const replies = children.filter((c) => c.parentId === parent.id);
    replies.forEach((reply) => {
      container.appendChild(createCommentElement(reply, true, isDesktop));
    });
  });
}

function createCommentElement(data, isReply, isDesktop) {
  const div = document.createElement("div");
  div.className = `comment-item ${isReply ? "reply" : ""}`;

  if (data.timestamp) {
    const now = new Date();
    const commentDate = data.timestamp.toDate();
    const diffHours = (now - commentDate) / (1000 * 60 * 60);
    if (diffHours < 24) div.classList.add("new-comment");
  }

  let dateStr = "送信中...";
  if (data.timestamp)
    dateStr = new Date(data.timestamp.toDate()).toLocaleString("ja-JP");

  if (data.isDeleted) {
    div.innerHTML = `
      <div class="comment-header"><span class="comment-timestamp">${dateStr}</span></div>
      <p class="comment-text deleted">このコメントは削除済みです。</p>
    `;
    return div;
  }

  const isMyComment = myCommentIds.includes(data.id);
  const replyFn = isDesktop ? `startDesktopReply` : `startReply`;

  div.innerHTML = `
    <div class="comment-header">
      <p class="comment-author">${data.author || "匿名"}</p>
      <span class="comment-timestamp">${dateStr}</span>
    </div>
    <p class="comment-text">${data.text}</p>
    <div class="comment-actions">
      ${
        !isReply
          ? `<button class="reply-button" onclick="${replyFn}('${data.id}', '${
              data.author || "匿名"
            }')">返信する</button>`
          : ""
      }
      ${
        isMyComment
          ? `<button class="delete-comment-btn" onclick="deleteComment('${data.id}')">削除</button>`
          : ""
      }
    </div>
  `;
  return div;
}

function startReply(commentId, authorName) {
  replyingToCommentId = commentId;
  replyingToAuthor = authorName;
  const indicator = safeGet("replyingIndicator");
  const txt = safeGet("replyingText");
  if (txt) txt.textContent = `Replying to: ${authorName}`;
  safeGet("commentInput")?.focus();
  indicator?.classList.remove("hidden");
}

window.startDesktopReply = function (commentId, authorName) {
  replyingToCommentId = commentId;
  replyingToAuthor = authorName;
  const indicator = safeGet("desktopReplyingIndicator");
  const txt = safeGet("desktopReplyingText");
  if (txt) txt.textContent = `Replying to: ${authorName}`;
  safeGet("desktopCommentInput")?.focus();
  indicator?.classList.remove("hidden");
};

function cancelReply() {
  replyingToCommentId = null;
  replyingToAuthor = null;
  safeGet("replyingIndicator")?.classList.add("hidden");
  safeGet("desktopReplyingIndicator")?.classList.add("hidden");
}

async function handleSendComment() {
  await postComment("commentInput");
}
window.handleDesktopSendComment = async function () {
  await postComment("desktopCommentInput");
};

async function postComment(inputId) {
  const input = safeGet(inputId);
  if (!input) return;
  const text = input.value.trim();
  if (!text || !currentArtwork) return;

  const fb = window.firebaseModules;
  const commentsRef = fb.collection(db, "likes", currentArtwork.id, "comments");

  try {
    const docRef = await fb.addDoc(commentsRef, {
      text,
      author: "匿名ユーザー",
      timestamp: fb.serverTimestamp(),
      parentId: replyingToCommentId,
      isDeleted: false,
    });
    myCommentIds.push(docRef.id);
    localStorage.setItem("myCommentIds", JSON.stringify(myCommentIds));
    input.value = "";
    cancelReply();
  } catch (e) {
    console.error("Error adding comment: ", e);
    alert("コメントの送信に失敗しました");
  }
}

async function deleteComment(commentId) {
  if (!confirm("本当に削除しますか？")) return;
  const fb = window.firebaseModules;
  const commentRef = fb.doc(
    db,
    "likes",
    currentArtwork.id,
    "comments",
    commentId
  );
  try {
    await fb.updateDoc(commentRef, {
      text: "このコメントは削除済みです。",
      author: "",
      isDeleted: true,
    });
  } catch (e) {
    console.error(e);
    alert("削除失敗");
  }
}

async function handleLike() {
  if (!currentArtwork) return;
  const fb = window.firebaseModules;
  const docRef = fb.doc(db, "likes", currentArtwork.id);

  if (hasLiked) {
    delete likedArtworks[currentArtwork.id];
    localStorage.setItem("likedArtworks", JSON.stringify(likedArtworks));
    hasLiked = false;
    updateLikeButton();
    await fb.setDoc(docRef, { count: fb.increment(-1) }, { merge: true });
  } else {
    likedArtworks[currentArtwork.id] = true;
    localStorage.setItem("likedArtworks", JSON.stringify(likedArtworks));
    hasLiked = true;
    updateLikeButton();
    const btn = safeGet("likeButton");
    if (btn) {
      btn.classList.add("liked-animate");
      setTimeout(() => btn.classList.remove("liked-animate"), 600);
    }
    createHeartExplosion();
    await fb.setDoc(
      docRef,
      { count: fb.increment(1), lastLikedAt: fb.serverTimestamp() },
      { merge: true }
    );
  }
}

function updateLikeButton() {
  const button = safeGet("likeButton");
  if (!button || !currentArtwork) return;

  const count = artworkLikes[currentArtwork.id] || 0;
  const buttonText = safeGet("likeButtonText");
  const likeCountEl = safeGet("likeCount");
  const icon = button.querySelector(".like-icon");

  if (hasLiked) {
    button.classList.add("liked");
    if (buttonText) buttonText.textContent = "作者の想いを受け取りました！";
    if (icon) icon.style.fill = "white";
  } else {
    button.classList.remove("liked");
    if (buttonText) buttonText.textContent = "想いを受け取る！";
    if (icon) icon.style.fill = "none";
  }

  if (likeCountEl) likeCountEl.textContent = `地域で${count}人が共感しています`;
}

function createHeartExplosion() {
  const container = safeGet("heartExplosion");
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < 12; i++) {
    const heart = document.createElement("div");
    heart.className = "heart-particle";
    const x = (Math.random() - 0.5) * 200;
    const y = (Math.random() - 0.5) * 200;
    heart.style.setProperty("--x", `${x}px`);
    heart.style.setProperty("--y", `${y}px`);
    heart.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#ec4899"></path></svg>`;
    heart.style.animation = `heartFly 0.8s ease-out forwards`;
    heart.style.transform = `translate(${x}px, ${y}px)`;
    container.appendChild(heart);
  }
  setTimeout(() => (container.innerHTML = ""), 1000);
}

function createSproutMarker(cluster) {
  const sprout = document.createElement("div");
  sprout.className = "sprout-marker";
  sprout.style.top = `${cluster.position.top}%`;
  sprout.style.left = `${cluster.position.left}%`;

  const flowerHtml = `
    <div class="sprout-flower flower-type-${cluster.level}">
      <div class="flower-petal"></div>
      <div class="flower-petal"></div>
      <div class="flower-petal"></div>
      <div class="flower-center"></div>
    </div>
  `;

  sprout.innerHTML = `
    <div class="sprout-wrapper level-${cluster.level}">
      <div class="sprout-glow"></div>
      <div class="sprout-plant">
        <div class="sprout-stem"></div>
        <div class="sprout-leaves">
          <div class="sprout-leaf sprout-leaf-left"></div>
          <div class="sprout-leaf sprout-leaf-right"></div>
        </div>
        ${flowerHtml}
      </div>
      <div class="sprout-sparkle">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
        </svg>
      </div>
      <div class="sprout-badge">
        ${cluster.typeCount}種類のハザードマップ
      </div>
    </div>
  `;
  sprout.onclick = () => handleSproutClick(cluster, sprout);
  return sprout;
}

function handleSproutClick(cluster, sproutElement) {
  const markers = document.querySelectorAll(".artwork-marker");
  markers.forEach((m) => m.classList.add("hidden-artwork"));
  const oldOverlay = document.querySelector(".sprout-magic-overlay");
  if (oldOverlay) oldOverlay.remove();

  const overlay = document.createElement("div");
  overlay.className = "sprout-magic-overlay";
  document.body.appendChild(overlay);

  const rect = sproutElement.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const maxDist = Math.hypot(window.innerWidth, window.innerHeight) * 1.6;

  for (let i = 0; i < 140; i++) {
    const p = document.createElement("div");
    p.className = "sprout-glitter";
    const angle = Math.random() * Math.PI * 2;
    const distance = maxDist * (0.4 + Math.random() * 0.6);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    p.style.left = `${centerX}px`;
    p.style.top = `${centerY}px`;
    p.style.setProperty("--dx", `${dx}px`);
    p.style.setProperty("--dy", `${dy}px`);
    overlay.appendChild(p);
  }

  const info = safeGet("sproutInfo");
  const infoText = safeGet("sproutInfoText");
  if (info && infoText) {
    infoText.innerHTML = `${cluster.typeCount}種類のハザードへの備えが集まり、<br>共助の芽が育っています！`;
    info.classList.add("show");
    setTimeout(() => info.classList.remove("show"), 10000);
  }

  setTimeout(() => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    markers.forEach((m) => m.classList.remove("hidden-artwork"));
  }, 1200);
}

function switchTab(tabName) {
  const mapContainer = safeGet("mapContainer");
  const listView = safeGet("listView");
  const tabMap = safeGet("tabMap");
  const tabList = safeGet("tabList");

  if (tabName !== "map" && isSproutMode) {
    window.toggleSproutMode();
  }

  if (tabName === "map") {
    mapContainer?.classList.add("active");
    listView?.classList.remove("active");
    tabMap?.classList.add("active");
    tabList?.classList.remove("active");
  } else {
    mapContainer?.classList.remove("active");
    listView?.classList.add("active");
    tabMap?.classList.remove("active");
    tabList?.classList.add("active");
    renderArtworkList();
  }
}

function renderArtworkList() {
  const container = safeGet("artworkListContainer");
  if (!container) return;
  container.innerHTML = "";

  const welcomeCard = document.createElement("div");
  welcomeCard.className = "list-card welcome-card";
  welcomeCard.dataset.id = "welcome";
  welcomeCard.innerHTML = `
    <div class="welcome-icon"><i class="fa-solid fa-sun"></i></div>
    <h3>ようこそ！</h3>
    <p>スクロールして作品を発見！</p>
  `;
  container.appendChild(welcomeCard);

  const sortedArtworks = [...artworks].sort(
    (a, b) => b.createdDate - a.createdDate
  );

  sortedArtworks.forEach((art) => {
    const dateObj = new Date(art.createdDate);
    const dateStr = dateObj.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const likeCount = artworkLikes[art.id] || 0;
    const hazardColor = getHazardColor(art.hazardType);

    const card = document.createElement("div");
    card.className = "list-card";
    card.dataset.id = art.id;
    card.onclick = () => openModal(art);

    card.innerHTML = `
      <img src="${art.imageUrl}" class="list-card-image" loading="lazy" alt="${art.title}">
      <div class="list-card-content">
        <h3 class="list-card-title">${art.title}</h3>
        <div class="list-card-meta" style="flex-direction:column; align-items:flex-start; gap:4px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; width:100%;">
              <span><i class="fa-solid fa-user"></i> ${art.author}</span>
              <span class="list-card-date">${dateStr}</span>
          </div>
          <div class="list-card-hazard">
            <span class="hazard-dot" style="background: ${hazardColor};"></span>
            <span>${art.hazardType}</span>
          </div>
        </div>
        <div class="list-card-footer">
          <div class="list-card-stats">
            <div class="stat-item likes">
              <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
              <span>${likeCount}</span>
            </div>
          </div>
          <span class="list-card-detail-link">詳しく見る</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  if (window.innerWidth >= 1024) {
    setupListObserver(container);
  }
}

function setupListObserver(container) {
  if (listObserver) listObserver.disconnect();

  const options = {
    root: container,
    rootMargin: "-45% 0px -45% 0px",
    threshold: 0,
  };

  listObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        document
          .querySelectorAll(".list-card")
          .forEach((el) => el.classList.remove("active-card"));
        entry.target.classList.add("active-card");

        const id = entry.target.dataset.id;
        if (isClickScrolling) return;

        if (id === "welcome") {
          if (view && initialCamera) {
            view.goTo(initialCamera, { duration: 1000, easing: "out-expo" });
          }
          currentArtwork = null;
          updateMarkerHighlight(null);
          renderDesktopCommentsEmpty();
          updateDesktopCommentTarget(null);
        } else {
          const art = artworks.find((a) => a.id === id);
          if (art && view) {
            isProgrammaticMove = true;

            updateMarkerHighlight(id);

            view
              .goTo(
                { center: art.geometry, zoom: 17, tilt: 60 },
                { duration: 800, easing: "out-quart" }
              )
              .then(() => {
                setTimeout(() => {
                  isProgrammaticMove = false;
                }, 200);
              })
              .catch(() => {
                isProgrammaticMove = false;
              });

            currentArtwork = art;
            hasLiked = !!likedArtworks[art.id];
            renderDesktopComments(id);
          }
        }
      }
    });
  }, options);

  document.querySelectorAll(".list-card").forEach((card) => {
    listObserver.observe(card);
  });
}

function updateDesktopCommentTarget(artwork) {
  const titleEl = safeGet("targetArtworkTitle");
  const authorEl = safeGet("targetAuthorName");

  if (titleEl && authorEl) {
    if (artwork) {
      titleEl.textContent = artwork.title;
      authorEl.textContent = artwork.author || "匿名";
    } else {
      titleEl.textContent = "（作品を選択してください）";
      authorEl.textContent = "作者";
    }
  }
}

function renderDesktopComments(artworkId) {
  const art = artworks.find((a) => a.id === artworkId);
  updateDesktopCommentTarget(art);

  const container = safeGet("desktopCommentsList");
  if (!container) return;

  container.innerHTML = `<div class="empty-state">読み込み中...</div>`;
  if (desktopUnsubscribe) desktopUnsubscribe();
  desktopUnsubscribe = loadCommentsForElement(artworkId, (comments) => {
    container.innerHTML = "";
    if (comments.length === 0) {
      container.innerHTML = `<div class="empty-state">コメントはまだありません</div>`;
    } else {
      renderCommentsToContainer(comments, container, true);
    }
  });
}

function renderDesktopCommentsEmpty() {
  const container = safeGet("desktopCommentsList");
  if (!container) return;
  container.innerHTML = `<div class="empty-state"><p>右側のリストをスクロールして<br>作品を選んでください</p></div>`;
}

window.toggleSproutMode = function () {
  isSproutMode = !isSproutMode;
  const btn = safeGet("sproutFilterBtn");

  if (isSproutMode) {
    btn?.classList.add("active");
    const info = safeGet("sproutInfo");
    const infoText = safeGet("sproutInfoText");
    if (info && infoText) {
      infoText.innerHTML = `異なるハザードマップを用いた作品が集まると、<br>共助の芽が育ちます！`;
      info.classList.add("force-show");
    }
    if (view) {
      view.goTo({ zoom: 15, tilt: 45 }, { duration: 1000 });
    }
  } else {
    btn?.classList.remove("active");
    const info = safeGet("sproutInfo");
    if (info) info.classList.remove("force-show");
    if (view && initialCamera) {
      view.goTo(initialCamera, { duration: 1000, easing: "out-expo" });
    }
  }
  renderMarkers();
};

// ===== Global exports for HTML onclick =====
window.switchTab = switchTab;
window.handleLike = handleLike;
window.closeModal = closeModal;
window.closeSiteGuide = closeSiteGuide;
window.showSiteGuide = showSiteGuide;
window.handleSendComment = handleSendComment;
window.startReply = startReply;
window.cancelReply = cancelReply;
window.deleteComment = deleteComment;
