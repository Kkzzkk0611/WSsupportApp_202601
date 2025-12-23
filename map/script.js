require([
  "esri/WebMap",
  "esri/views/MapView",
  "esri/Graphic",
  "esri/widgets/Legend",
  "esri/symbols/support/symbolUtils"
], function(WebMap, MapView, Graphic, Legend, symbolUtils) {

  const webmap = new WebMap({
    portalItem: {
      id: "fef70d22c8bd4545be008db3c813117c"
    }
  });

  const view = new MapView({
    container: "viewDiv",
    map: webmap,
    zoom: 15,
    highlightOptions: {
      color: [255, 0, 0],
      haloOpacity: 1,
      fillOpacity: 0.3
    }
  });

  view.when(() => {

    // 凡例
    const customLegendTitles = {
      "naisui_R7_clip": "下水があふれる洪水（内水氾濫）",
      "gaisui_clip": "川の水があふれる洪水（外水氾濫）",
      "kyukeisha_R7_clip": "土砂災害",
      "takashio_clip": "高潮（浸水深）",
      "tsunami_clip": "津波（浸水深、慶長型地震）",
      "jishindo_clip": "震度情報（元禄型関東地震）",
      "shoshitsu_clip": "地震火災（元禄型関東地震）",
      "ekijyouka_clip": "地盤の液状化（元禄型関東地震）"
    };
    const legendLayers = webmap.allLayers
      .filter(layer => layer.title.includes("_clip")) // クリップと書いてあるもののみ
      .map(layer => ({ layer: layer, title: customLegendTitles[layer.title] || layer.title }));

    const legend = new Legend({
      view: view,
      layerInfos: legendLayers.toArray()
    });
    view.ui.add(legend, "bottom-right");

    // ベースマップ切り替え
    const whiteMapBtn = document.getElementById("white-map-btn");
    const satelliteBtn = document.getElementById("satellite-btn");
    const satelliteLayer = webmap.allLayers.find(layer => layer.title === "衛星画像（World Imagery）");

    if (satelliteLayer) {
      satelliteLayer.visible = false;
      whiteMapBtn.addEventListener("click", () => {
        satelliteLayer.visible = false;
        whiteMapBtn.classList.add("active");
        satelliteBtn.classList.remove("active");
      });
      satelliteBtn.addEventListener("click", () => {
        satelliteLayer.visible = true;
        whiteMapBtn.classList.remove("active");
        satelliteBtn.classList.add("active");
      });
    }

    // タブ切り替え
    const hazardTab = document.getElementById("hazard-tab");
    const resourceTab = document.getElementById("resource-tab");
    const themeTab = document.getElementById("theme-tab");
    const hazardContent = document.getElementById("hazard-content");
    const resourceContent = document.getElementById("resource-content");
    const themeContent = document.getElementById("theme-content");

    hazardTab.addEventListener("click", () => {
      hazardTab.classList.add("active");
      resourceTab.classList.remove("active");
      themeTab.classList.remove("active");
      hazardContent.style.display = "block";
      resourceContent.style.display = "none";
      themeContent.style.display = "none";
    });

    resourceTab.addEventListener("click", () => {
      hazardTab.classList.remove("active");
      resourceTab.classList.add("active");
      themeTab.classList.remove("active");
      hazardContent.style.display = "none";
      resourceContent.style.display = "block";
      themeContent.style.display = "none";
    });

    themeTab.addEventListener("click", () => {
      hazardTab.classList.remove("active");
      resourceTab.classList.remove("active");
      themeTab.classList.add("active");
      hazardContent.style.display = "none";
      resourceContent.style.display = "none";
      themeContent.style.display = "block";
    });

    // レイヤーの表示切り替え
    function setupLayerToggle(layerTitle, checkboxId) {
      const layer = webmap.allLayers.find(l => l.title === layerTitle);
      const checkbox = document.getElementById(checkboxId);
      if (layer && checkbox) {
        checkbox.checked = layer.visible;
        checkbox.addEventListener("change", () => {
          layer.visible = checkbox.checked;
        });
      }
    }

    setupLayerToggle("naisui_R7_clip", "naisui_R7-filter");
    setupLayerToggle("gaisui_clip", "gaisui-filter");
    setupLayerToggle("kyukeisha_R7_clip", "kyukeisha_R7-filter");
    setupLayerToggle("takashio_clip", "takashio-filter");
    setupLayerToggle("tsunami_clip", "tsunami-filter");
    setupLayerToggle("jishindo_clip", "jishindo-filter");
    setupLayerToggle("shoshitsu_clip", "shoshitsu-filter");
    setupLayerToggle("ekijyouka_clip", "ekijyouka-filter");

    setupLayerToggle("TIIKIBOSAIKYOTEN", "TIIKIBOSAIKYOTEN-filter");
    setupLayerToggle("koen-point", "koen-point-filter");
    setupLayerToggle("toilet", "toilet-filter");
    setupLayerToggle("hamakkotoilet", "hamakkotoilet-filter");
    setupLayerToggle("syouboukigu", "syouboukigu-filter");
    setupLayerToggle("douro12", "douro12-filter");
    setupLayerToggle("douro4", "douro4-filter");
    setupLayerToggle("yusouro", "yusouro-filter");
    setupLayerToggle("suibu", "suibu-filter");
    setupLayerToggle("kinkyu_kyusuisen", "kinkyu_kyusuisen-filter");
    setupLayerToggle("taishin_kyusuisen", "taishin_kyusuisen-filter");
    setupLayerToggle("kyusuitank", "kyusuitank-filter");
    setupLayerToggle("haisuisou", "haisuisou-filter");

    //  sシンボル画像の追加-
    async function addSymbolToResourceList() {
      const resourceOptions = document.querySelectorAll('#resource-filters .filter-option');
      for (const option of resourceOptions) {
        const checkbox = option.querySelector('input[type="checkbox"]');
        if (!checkbox) continue;

        const layerTitle = checkbox.id.replace('-filter', '');
        const layer = webmap.allLayers.find(l => l.title === layerTitle);

        if (layer) {
          try {
            await layer.load();
          } catch {
            continue;
          }

          if (layer.renderer) {
            let symbol;
            const renderer = layer.renderer;
            if (renderer.symbol) {
              symbol = renderer.symbol;
            } else if (renderer.uniqueValueInfos?.length > 0) {
              symbol = renderer.uniqueValueInfos[0].symbol;
            } else if (renderer.classBreakInfos?.length > 0) {
              symbol = renderer.classBreakInfos[0].symbol;
            }

            if (symbol) {
              symbolUtils.renderPreviewHTML(symbol, { size: 16 }).then(symbolElement => {
                symbolElement.classList.add('symbol-preview');
                const container = option.querySelector('.symbol-and-label');
                if (container) {
                  container.prepend(symbolElement);
                }
              });
            }
          }
        }
      }
    }
    addSymbolToResourceList();

    // ハザード並べ替え機能
    const hazardFilters = document.getElementById("hazard-filters");
    hazardFilters.addEventListener("click", function(event) {
      const button = event.target.closest(".reorder-button");
      if (!button) return;

      const currentOption = button.closest(".filter-option");
      const direction = button.dataset.direction;
      const currentLayerTitle = currentOption.dataset.layerTitle;
      const currentLayer = webmap.allLayers.find(l => l.title === currentLayerTitle);
      if (!currentLayer) return;

      if (direction === "up") {
        const targetOption = currentOption.previousElementSibling;
        if (targetOption) {
          const targetLayerTitle = targetOption.dataset.layerTitle;
          const targetLayer = webmap.allLayers.find(l => l.title === targetLayerTitle);
          if (targetLayer) {
            hazardFilters.insertBefore(currentOption, targetOption);
            view.map.reorder(currentLayer, view.map.layers.indexOf(targetLayer));
          }
        }
      } else if (direction === "down") {
        const targetOption = currentOption.nextElementSibling;
        if (targetOption) {
          const targetLayerTitle = targetOption.dataset.layerTitle;
          const targetLayer = webmap.allLayers.find(l => l.title === targetLayerTitle);
          if (targetLayer) {
            hazardFilters.insertBefore(targetOption, currentOption);
            view.map.reorder(currentLayer, view.map.layers.indexOf(targetLayer));
          }
        }
      }
    });

    // surveyレイヤー
    const artPinsLayer = webmap.allLayers.find(layer => layer.title === "survey");
    if (!artPinsLayer) return;

    let highlightHandle = null;
    view.whenLayerView(artPinsLayer).then(layerView => {
      const viewedIds = JSON.parse(localStorage.getItem("viewedArtIds")) || [];
      if (viewedIds.length > 0) {
        const query = artPinsLayer.createQuery();
        query.objectIds = viewedIds;
        artPinsLayer.queryFeatures(query).then(result => {
          if (highlightHandle) highlightHandle.remove();
          highlightHandle = layerView.highlight(result.features);
        });
      }
    });

    // 3.テーマによる作品絞り込み機能
    const themeKeywords = {'地震': ['揺れ', 'ブロック塀', 'ガラス', 'エレベーター', '電柱', '電線'],'火災': ['消火', '煙', '報知器', '通報', '漏電'],'津波': ['高台', 'ビル', '警報', 'サイレン', '引き波', '垂直'],'液状化': ['マンホール', '噴砂', '地盤沈下', '埋立地'],'土砂災害': ['崖', '崖崩れ', '土石流', '地すべり'],'気象': ['大雨', '台風', '雷', '雪', '竜巻', '強風'],'火山': ['噴火', '火山灰', '噴石', '火砕流', '溶岩', 'マスク', '屋内'],'洪水': ['内水氾濫', '深水', '地下', '排水溝', 'アンダーパス', '屋根'],'高潮': ['防波堤', '海岸', '河口', '満潮', '河川逆流'],'避難': ['安全', '危険', '非常', 'リスク', 'ハザードマップ', '経路', '訓練', '防災バッグ', '車'],'インフラ': ['道路', '橋', '電気', 'ガス', '水道', '電波', '通信'],'備蓄': ['水', '食料', 'ヘルメット', '軍手', '靴', 'バッテリー', '家'],'行動主体': ['住民', '学生', '子ども', '高齢者', '外国人', 'ペット', 'ボランティア'],'情報': ['SNS', 'ラジオ', 'デマ', 'フェイク', '携帯', '無線', '充電'],'衛生': ['感染症', '消毒', '薬', 'トイレ', 'ゴミ', '体調管理'],'救助': ['声かけ', '自助', '共助', '安否', '応急手当', '病院', '救急', 'AED'],'感情': ['ストレス', '不安', '孤立', '安心', '希望', 'つながり']};
    const themeButtonsContainer = document.querySelector(".theme-buttons");
    const allButton = document.createElement("span");
    allButton.className = "theme-button active";
    allButton.textContent = "すべて表示";
    allButton.dataset.theme = "all";
    themeButtonsContainer.appendChild(allButton);
    Object.keys(themeKeywords).forEach(theme => {
      const button = document.createElement("span");
      button.className = "theme-button";
      button.textContent = theme;
      button.dataset.theme = theme;
      themeButtonsContainer.appendChild(button);
    });
    themeButtonsContainer.addEventListener("click", function(event) {
      const clickedButton = event.target;
      if (!clickedButton.classList.contains("theme-button")) return;
      themeButtonsContainer.querySelectorAll(".theme-button").forEach(btn => { btn.classList.remove("active"); });
      clickedButton.classList.add("active");
      const selectedTheme = clickedButton.dataset.theme;
      if (selectedTheme === "all") {
        artPinsLayer.definitionExpression = null;
      } else {
        const searchFields = ['Mabling', 'Message', 'collage'];
        const keywords = themeKeywords[selectedTheme];
        const allConditions = keywords.map(kw => {
          const fieldConditions = searchFields.map(field => `${field} LIKE '%${kw}%'`).join(" OR ");
          return `(${fieldConditions})`;
        });
        const whereClause = allConditions.join(" OR ");
        artPinsLayer.definitionExpression = whereClause;
      }
    });
    
    // 4.ポップアップとクリックイベント
    let currentlyOpenPinId = null;
    artPinsLayer.popupEnabled = false; 
    view.popup.dockOptions = { buttonEnabled: false };
    view.popup.visibleElements = { closeButton: false };

    view.on("click", function(event) {
      
      view.hitTest(event).then(function(response) {
        const result = response.results.find(result => result.graphic.layer === artPinsLayer);

        if (result) {
          // ピンがクリックされた
          const clickedObjectId = result.graphic.attributes.objectid;

          if (currentlyOpenPinId === clickedObjectId) {
            // 2回目クリック
            
            window.location.href = `detail.html?id=${clickedObjectId}`;
            currentlyOpenPinId = null;
            view.popup.close(); 
            
          } else {
            // 1回目クリック
            
            currentlyOpenPinId = clickedObjectId;
            
            const query = { objectIds: [clickedObjectId], outFields: ["*"] };
            artPinsLayer.queryFeatures(query).then(function(featureSet) {
              if (!featureSet.features.length) return;
              const attributes = featureSet.features[0].attributes;
              
              artPinsLayer.queryAttachments({ objectIds: [clickedObjectId] }).then(function(attachments) {
                const imageUrl = (attachments[clickedObjectId] && attachments[clickedObjectId].length > 0) ? attachments[clickedObjectId][0].url : "";
                
                const contentHtml = `
                <div class="popup-content-vertical">
                  <p class="popup-author">作者：${attributes.field_25}</p>
                  <img src="${imageUrl}" class="popup-image-vertical">
                  <p class="popup-prompt">
                    詳細を見るにはもう一度ピンをタップ！
                  </p>
                </div>`;

                // ポップアップの位置をピンから少しずらす（オフセット）
                const mapPoint = result.graphic.geometry;
                const screenPoint = view.toScreen(mapPoint);
                
                // 画面上で 15 ピクセル「上」にずらす（Y座標をマイナスする）
                screenPoint.y = screenPoint.y - 15; 
                
                // ずらした画面座標を、地図の座標に戻す
                const offsetMapPoint = view.toMap(screenPoint);

                // ずらした位置情報（offsetMapPoint）を使ってポップアップを開く
                view.popup.open({ 
                  title: "", 
                  content: contentHtml, 
                  location: offsetMapPoint
                });
              });
            });
          }

        } else {
          // 4. ピン以外の場所（地図）がクリックされた場合
          view.popup.close();
          currentlyOpenPinId = null; 
        }
      });
    });  
  });
});