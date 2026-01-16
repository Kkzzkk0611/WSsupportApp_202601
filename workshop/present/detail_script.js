document.addEventListener("DOMContentLoaded", function() {

  // --- 1. チュートリアル機能 ---
  function setupDetailTutorial() {
    const overlay = document.getElementById("detail-tutorial-overlay");
    const imgEl = document.getElementById("dt-img");
    const titleEl = document.getElementById("dt-title");
    const descEl = document.getElementById("dt-desc");
    
    const nextBtn = document.getElementById("dt-next-btn");
    const skipBtn = document.getElementById("dt-skip-btn"); 
    
    const dots = document.querySelectorAll(".dt-dot");
    const helpBtn = document.getElementById("detail-help-btn");

    if (!overlay) return;

    const steps = [
      {
        title: "ようこそ",
        desc: "鑑賞するアート作品には、<br>作者が見つけたこの場所の<strong>災害リスク</strong>と<br>それに対する<strong>防災行動</strong>が隠されています。",
        img: "tutorial_d_01.png"
      },
      {
        title: "災害リスク",
        desc: "背景の模様には<strong>『マーブリング』技法</strong>が使われ、作者が見つけた災害リスクが表現されています。",
        img: "tutorial_d_02.png"
      },
      {
        title: "防災行動",
        desc: "背景の模様に図形を貼る<strong>『コラージュ』技法</strong>が使われ、作者が伝えたい防災行動が表現されています。",
        img: "tutorial_d_03.png"
      },
      {
        title: "鑑賞のしかた",
        desc: "上から順番に鑑賞を進め、作品に込められた<strong>作者のメッセージ</strong>を受け取りましょう。",
        img: "tutorial_d_04.png"
      }
    ];

    let currentPage = 0;
    const hasSeen = localStorage.getItem("has_seen_detail_tutorial");
    if (!hasSeen) {
        updateSlide();
        overlay.style.display = "flex";
    } else {
        overlay.style.display = "none";
    }

    if(helpBtn) {
        helpBtn.addEventListener("click", () => {
            currentPage = 0;
            updateSlide();
            overlay.style.display = "flex";
        });
    }

    if(skipBtn) {
        skipBtn.onclick = () => {
            localStorage.setItem("has_seen_detail_tutorial", "true");
            closeTutorial();
        };
    }

    if(nextBtn) {
        nextBtn.onclick = () => {
            if (currentPage < steps.length - 1) {
                currentPage++;
                updateSlide();
            } else {
                localStorage.setItem("has_seen_detail_tutorial", "true");
                closeTutorial();
            }
        };
    }

    function closeTutorial() {
      overlay.style.animation = "fadeOut 0.3s forwards";
      setTimeout(() => {
        overlay.style.display = "none";
        overlay.style.animation = "";
      }, 300);
    }

    function updateSlide() {
      const step = steps[currentPage];
      if(titleEl) titleEl.innerHTML = step.title;
      if(descEl) descEl.innerHTML = step.desc;
      if(imgEl) {
          imgEl.src = step.img;
          imgEl.onerror = () => { imgEl.src = "https://via.placeholder.com/400x300?text=Guide+" + (currentPage + 1); };
      }
      dots.forEach((d, i) => d.classList.toggle("active", i === currentPage));
      
      if(nextBtn) {
          if (currentPage === steps.length - 1) {
            nextBtn.innerText = "完了";
          } else {
            nextBtn.innerText = "次へ ＞";
          }
      }
    }
  }

  setupDetailTutorial();
  
  // --- 2. 地図機能とメインロジック ---
  require([
    "esri/WebMap",
    "esri/views/MapView",
    "esri/layers/FeatureLayer",
    "esri/Graphic",
    "esri/widgets/Legend",
    "esri/geometry/geometryEngine",
    "esri/layers/support/LabelClass",
    "esri/symbols/support/symbolUtils", // ★追加！これがないとアイコン作れないよ
    "esri/widgets/Expand"
  ], function(WebMap, MapView, FeatureLayer, Graphic, Legend, geometryEngine, LabelClass, symbolUtils, Expand) {
  
    // --- 変数定義 ---
    let featureAttributes = null; 
    let originalFeature = null; 
    let hazardLegendExpand = null; // ★追加：凡例ボタンを入れておく箱！
    
    // HTML要素
    let interactionPanel = document.getElementById("interaction-panel");
    let questMenuPanel = document.getElementById("quest-menu-panel");
    let artImageElement = document.getElementById("art-image");
    let artworkInfo = document.getElementById("artwork-info");
  
    // URLからIDを取得
    const urlParams = new URLSearchParams(window.location.search);
    const objectId = parseInt(urlParams.get("id"));

    if (!objectId) {
        alert("作品が見つかりませんでした。マップに戻ります。");
        window.location.href = "index.html";
        return;
    }
  
    // WebMap読み込み
    const webmap = new WebMap({ portalItem: { id: "fef70d22c8bd4545be008db3c813117c" } });
    const view = new MapView({
      container: "surrounding-map",
      map: webmap,
      ui: { components: ["zoom"] }
    });

    view.when(() => {
        // ① トップページと同じ「わかりやすい名前」の辞書を作る
        const legendTitleMapping = {
            "gaisui_clip": "川の水があふれる洪水（外水氾濫）",
            "naisui_R7_clip": "下水があふれる洪水（内水氾濫）",
            "takashio_clip": "高潮（浸水深）",
            "tsunami_clip": "津波（浸水深、慶長型地震）",
            "kyukeisha_R7_clip": "土砂災害",
            "ekijyouka_clip": "地盤の液状化（元禄型関東地震）",
            "jishindo_clip": "震度情報（元禄型関東地震）",
            "shoshitsu_clip": "地震火災（元禄型関東地震）"
        };

        // ② 地図にあるレイヤーの中から「ハザードマップだけ」を選び出す
        // （作品ピンや、辞書にないレイヤーは無視するよ）
        const hazardLayers = view.map.allLayers.filter(layer => {
            return legendTitleMapping.hasOwnProperty(layer.title);
        }).map(layer => {
            return {
                layer: layer,
                title: legendTitleMapping[layer.title] // 名前を日本語に変換！
            };
        }).toArray();

        // ③ 凡例（中身）を作る
        const legend = new Legend({
            view: view,
            layerInfos: hazardLayers, // ここで選んだレイヤーだけを渡す！
            style: {
                type: "card", // 見やすいカード型
                layout: "auto"
            }
        });

        // ④ ボタン（Expand）に入れる
        // ★修正：const を消して、外で作った変数に入れる！
        hazardLegendExpand = new Expand({
            view: view,
            content: legend,
            expandIcon: "legend", 
            expandTooltip: "凡例を表示",
            expanded: false,
            mode: "floating"
        });

        // ★注意：ここでは一旦「追加しない」でおく（startQuestで制御するから！）
        // view.ui.add(hazardLegendExpand, "top-right"); ← この行は消すかコメントアウト！
    });

    const artPinsLayer = new FeatureLayer({
      url: "https://services2.arcgis.com/xpOLkBdwWTLJMFA7/arcgis/rest/services/survey123_cff62fc5070c4f468b2c9269d5b2535f/FeatureServer/0"
    });
  
    const allHazardsDef = {
        "洪水": { title: "川の水があふれる洪水（外水氾濫）", layerKeyword: "gaisui", icon: "" },
        "内水": { title: "下水があふれる洪水（内水氾濫）", layerKeyword: "naisui", icon: "" },
        "高潮": { title: "高潮（浸水深）", layerKeyword: "takashio", icon: "" },
        "津波": { title: "津波（浸水深、慶長型地震）", layerKeyword: "tsunami", icon: "" },
        "土砂": { title: "土砂災害", layerKeyword: "kyukeisha", icon: "" },
        "液状化": { title: "地盤の液状化（元禄型関東地震）", layerKeyword: "ekijyouka", icon: "" },
        "震度": { title: "震度情報（元禄型関東地震）", layerKeyword: "jishindo", icon: "" },
        "火災": { title: "地震火災（元禄型関東地震）", layerKeyword: "shoshitsu", icon: "" }
    };

    const phaseKeywords = {
      prior: ["備蓄", "水", "食料", "ハザードマップ", "訓練", "家具", "固定", "ガラス", "ブロック塀", "散歩", "確認", "話し合い", "家族", "連絡", "知る", "学ぶ", "準備", "日頃", "靴", "備え", "アプリ", "登録"],
      during: ["逃げる", "避難", "高台", "走る", "垂直", "2階", "3階", "浸水", "揺れ", "机の下", "守る", "火", "消火", "煙", "119", "110", "通報", "助けて", "声かけ", "安否", "ライト", "懐中電灯", "停電", "ブレーカー"],
      recovery: ["片付け", "掃除", "泥", "ゴミ", "ボランティア", "助け合い", "協力", "炊き出し", "避難所", "トイレ", "衛生", "薬", "病院", "給水", "復旧", "再開", "つながり", "励まし", "絆", "相談", "申請"]
    };

    // --- ★新しいデータ構造：6つのカテゴリ定義 ---
    const resourceGroupsDef = [
      {
        id: "res-evac",
        title: "避難場所",
        icon: "🏠",
        items: [
          { title: "地域防災拠点", layer: "TIIKIBOSAIKYOTEN" },
          { title: "公園", layer: "koen-point" }
        ]
      },
      {
        id: "res-toilet",
        title: "トイレ",
        icon: "🚻",
        items: [
          { title: "公衆トイレ", layer: "toilet" },
          { title: "災害用ハマッコトイレ", layer: "hamakkotoilet" }
        ]
      },
      {
        id: "res-water",
        title: "給水",
        icon: "💧",
        items: [
          { title: "緊急給水栓", layer: "kinkyu_kyusuisen" },
          { title: "耐震給水栓", layer: "taishin_kyusuisen" },
          { title: "災害用地下給水タンク", layer: "kyusuitank" },
          { title: "配水池・配水槽", layer: "haisuisou" }
        ]
      },
      {
        id: "res-fire",
        title: "消防",
        icon: "🚒",
        items: [
          { title: "消防器具置き場", layer: "syouboukigu" }
        ]
      },
      {
        id: "res-road",
        title: "道路",
        icon: "🛣️",
        items: [
          { title: "避難に適する道路", layer: "douro12" },
          { title: "避難に適さない道路", layer: "douro4" },
          { title: "緊急輸送路", layer: "yusouro" }
        ]
      },
      {
        id: "res-river",
        title: "水部",
        icon: "🌊",
        items: [
          { title: "水部（川・海など）", layer: "suibu" }
        ]
      }
    ];

    const resourceKeywordsMap = {
      "避難": "res-evac", "逃げる": "res-evac", "学校": "res-evac", "公園": "res-evac", "集まる": "res-evac",
      "トイレ": "res-toilet", "便所": "res-toilet", "衛生": "res-toilet",
      "水": "res-water", "給水": "res-water", "喉": "res-water", "飲む": "res-water", "渇き": "res-water", "ボトル": "res-water",
      "火": "res-fire", "消防": "res-fire", "消す": "res-fire", "煙": "res-fire",
      "道": "res-road", "道路": "res-road", "通る": "res-road", "橋": "res-road", "混雑": "res-road", "狭い": "res-road",
      "川": "res-river", "海": "res-river", "氾濫": "res-river", "流れる": "res-river"
    };
  
    // --- データの読み込み ---
    artPinsLayer.queryFeatures({
      where: `objectid = ${objectId}`,
      outFields: ["*"],
      returnGeometry: true
    }).then(results => {
      
      showQuestMenu();
      
      if (results.features.length === 0) return;
  
      originalFeature = results.features[0]; 
      featureAttributes = originalFeature.attributes;
      
      if (artworkInfo) {
          artworkInfo.innerHTML = `<div class="simple-author-label">作者: ${featureAttributes.field_25 || "匿名"}</div>`;
      }

      setText("mabling-text", featureAttributes.Mabling);
      setText("collage-text", featureAttributes.collage);
      setText("author-message-text", featureAttributes.Message);

      artPinsLayer.queryAttachments({ objectIds: [objectId] }).then(attachments => {
        if (attachments[objectId] && attachments[objectId].length > 0) {
          artImageElement.src = attachments[objectId][0].url;
        }
      });
  
      view.when(() => {
        view.goTo({ target: originalFeature.geometry, zoom: 15 });
        const surveyLayer = webmap.allLayers.find(l => l.title === "survey");
        if (surveyLayer) {
            surveyLayer.definitionExpression = `objectid = ${objectId}`;
        }
        resetMapLayers();
      });
    });

    function setText(id, text) {
        const el = document.getElementById(id);
        if(el) el.textContent = text || "（コメントなし）";
    }

    // --- クエスト制御 ---
    window.showQuestMenu = function() {
      questMenuPanel.style.display = "block";
      interactionPanel.style.display = "none";
    };

    function resetMapLayers() {
        if(!webmap) return;
        webmap.allLayers.forEach(layer => {
            let isHazard = false;
            Object.values(allHazardsDef).forEach(def => {
                if (layer.title.includes(def.layerKeyword)) isHazard = true;
            });
            if (isHazard) {
                layer.visible = false;
            }
        });
    }
  
    // --- クエスト進行 ---
    window.startQuest = function(stepNum) {
      questMenuPanel.style.display = "none";
      interactionPanel.style.display = "flex";

      // ★修正：最初に「全部のステップの要素」を徹底的に隠す！
      // これでボタンの消し忘れを防ぐよ
      const allStepIds = ["step1", "step2", "step3"];
      allStepIds.forEach(id => {
          const info = document.getElementById(`${id}-info`);
          const controls = document.getElementById(`${id}-controls`);
          const btnArea = document.getElementById(`${id}-btn-area`);
          // 3番目のコンテンツエリア用
          const content = document.getElementById(`${id}-content`); 

          if(info) info.style.display = "none";
          if(controls) controls.style.display = "none";
          if(btnArea) btnArea.style.display = "none";
          if(content) content.style.display = "none";
      });

      // レイアウトコンテナも一旦隠す
      const splitLayout = document.getElementById("split-layout-container");
      if(splitLayout) splitLayout.style.display = "none";
      
      const infoBox = document.querySelector(".info-box-container");
      const verifyTitle = document.querySelector(".verify-title");

      if (hazardLegendExpand) {
          if (stepNum === 1) {
              // STEP1なら、右上に表示！
              view.ui.add(hazardLegendExpand, "top-right");
          } else {
              // それ以外（STEP2, 3）なら、画面から消去！
              view.ui.remove(hazardLegendExpand);
          }
      }
      // --- ここから「表示したいものだけ」を表示する ---

      if (stepNum === 1) {
        if(splitLayout) splitLayout.style.display = "flex";
        document.getElementById("step1-info").style.display = "block";
        document.getElementById("step1-controls").style.display = "block";
        const btnArea1 = document.getElementById("step1-btn-area");
        if(btnArea1) btnArea1.style.display = "block";
        
        if(verifyTitle) verifyTitle.textContent = "▼ ハザードマップを重ねて解説を確認しよう";
        if(infoBox) infoBox.classList.remove("action-mode");

        resetMapLayers();
        generateHazardCheckboxes();
        setText("mabling-text", featureAttributes.Mabling);

      } else if (stepNum === 2) {
        if(splitLayout) splitLayout.style.display = "flex";
        document.getElementById("step2-info").style.display = "block";
        document.getElementById("step2-controls").style.display = "block";
        const btnArea2 = document.getElementById("step2-btn-area");
        if(btnArea2) btnArea2.style.display = "block";

        if(verifyTitle) verifyTitle.innerHTML = `
            ▼ カテゴリボタンを押して地図上に詳細を表示<br>
            <span style="display:inline-block; margin-top:4px; font-size:0.85em; font-weight:normal; color:#666;">
                ( <span style="color:#ff9800; font-weight:bold; font-size:1.1em;">★</span> 印は、作品から推測されたおすすめカテゴリ )
            </span>`;
        if(infoBox) infoBox.classList.add("action-mode");

        resetMapLayers();
        setText("collage-text", featureAttributes.collage);
        generateResourceCheckboxes();

      } else if (stepNum === 3) {
        document.getElementById("step3-content").style.display = "block";
        
        const addressee = extractAddressee(
            featureAttributes.Message, 
            featureAttributes.collage, 
            featureAttributes.Mabling
        );
        const addresseeEl = document.getElementById("message-addressee");
        if (addresseeEl) {
            // "To" はつけずに、そのまま「〇〇へ」を表示するよ！
            addresseeEl.textContent = addressee;
        }

        setText("author-message-text", featureAttributes.Message);
        const signature = document.getElementById("author-name-signature");
        if(signature) signature.textContent = (featureAttributes.field_25 || "作者") + " より";
      }
    };

    // --- ★修正：左リモコン・右パネル方式（アイコン付き） ---
    function generateResourceCheckboxes() {
        const leftContainer = document.getElementById("step2-resource-check-area");
        if(!leftContainer || !featureAttributes) return;
        leftContainer.innerHTML = "";

        // 右側のパネル（地図の上）を作る
        let rightPanel = document.getElementById("resource-floating-panel");
        if (!rightPanel) {
            rightPanel = document.createElement("div");
            rightPanel.id = "resource-floating-panel";
            rightPanel.className = "resource-floating-panel";
            const mapWrapper = document.querySelector(".map-wrapper");
            if (mapWrapper) {
                mapWrapper.appendChild(rightPanel);
                mapWrapper.style.position = "relative"; 
            }
        }

        const actionText = (featureAttributes.collage || "") + (featureAttributes.Message || "");
        const highlightGroupIds = new Set();
        Object.keys(resourceKeywordsMap).forEach(key => {
            if (actionText.includes(key)) {
                highlightGroupIds.add(resourceKeywordsMap[key]);
            }
        });

        const menuContainer = document.createElement("div");
        menuContainer.className = "resource-menu-container";

        let activeGroupId = null;

        // --- 右パネルを表示する関数 ---
        const openRightPanel = (group) => {
            rightPanel.innerHTML = `
                <div class="rf-header">
                    <span class="rf-close" id="rf-close-btn">×</span>
                </div>
                <div class="rf-content" id="rf-list-area"></div>
            `;

            const listArea = rightPanel.querySelector("#rf-list-area");
            
            group.items.forEach((item, index) => {
                const div = document.createElement("div");
                div.className = "rf-item";
                const uId = `chk-rf-${group.id}-${index}`;
                
                const layer = webmap.allLayers.find(l => l.title === item.layer);
                const isChecked = layer ? layer.visible : false;

                // 1. まず箱だけ作る
                div.innerHTML = `
                    <input type="checkbox" id="${uId}" ${isChecked ? "checked" : ""}>
                    <label for="${uId}">${item.title}</label>
                `;
                
                // 2. ★シンボルを非同期で取得して先頭に追加（prepend）
                if (layer) {
                    layer.load().then(() => {
                        let symbol = null;
                        if (layer.renderer) {
                            if (layer.renderer.symbol) {
                                symbol = layer.renderer.symbol;
                            } else if (layer.renderer.uniqueValueInfos && layer.renderer.uniqueValueInfos.length > 0) {
                                symbol = layer.renderer.uniqueValueInfos[0].symbol;
                            }
                        }
                        
                        if (symbol) {
                            symbolUtils.renderPreviewHTML(symbol, { size: 16 }).then(icon => {
                                icon.style.marginRight = "6px"; // アイコンとチェックボックスの隙間
                                div.prepend(icon); // ★[アイコン] [チェック] [ラベル] の順番になる！
                            });
                        }
                    });
                }
                
                div.querySelector("input").addEventListener("change", (e) => {
                    const l = webmap.allLayers.find(ly => ly.title === item.layer);
                    if (l) l.visible = e.target.checked;
                });
                
                listArea.appendChild(div);
            });

            rightPanel.querySelector("#rf-close-btn").onclick = () => {
                closeRightPanel();
            };

            rightPanel.style.display = "flex";
            activeGroupId = group.id;
        };

        const closeRightPanel = () => {
            rightPanel.style.display = "none";
            activeGroupId = null;
            menuContainer.querySelectorAll(".resource-menu-btn").forEach(b => b.classList.remove("active"));
        };

        resourceGroupsDef.forEach(group => {
            const btn = document.createElement("div");
            btn.className = "resource-menu-btn";
            btn.id = `btn-${group.id}`;

            if (highlightGroupIds.has(group.id)) {
                btn.classList.add("recommend");
            }

            btn.innerHTML = `
                <span class="rm-icon">${group.icon}</span>
                <span class="rm-label">${group.title}</span>
            `;

            btn.onclick = () => {
                if (activeGroupId === group.id) {
                    closeRightPanel();
                    return; 
                }
                menuContainer.querySelectorAll(".resource-menu-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                openRightPanel(group);
            };

            menuContainer.appendChild(btn);
        });

        leftContainer.appendChild(menuContainer);

        if (highlightGroupIds.size > 0) {
            const firstRecommendId = Array.from(highlightGroupIds)[0];
            const targetBtn = menuContainer.querySelector(`#btn-${firstRecommendId}`);
            if (targetBtn) {
                targetBtn.click(); 
            }
        }
    }

    function generateHazardCheckboxes() {
        const container = document.getElementById("step1-hazard-check-area");
        if(!container || !featureAttributes) return;
        
        container.innerHTML = "";

        const riskText = featureAttributes.field_24 || ""; 
        let hitCount = 0;

        Object.keys(allHazardsDef).forEach(key => {
            if (riskText.includes(key)) {
                const def = allHazardsDef[key];
                hitCount++;

                const div = document.createElement("div");
                div.className = "hazard-check-item";
                const checkId = `chk-hazard-${key}`;
                
                div.innerHTML = `
                    <input type="checkbox" id="${checkId}">
                    <label for="${checkId}">${def.icon} ${def.title}</label>
                `;
                
                container.appendChild(div);

                const checkbox = div.querySelector("input");
                checkbox.addEventListener("change", () => {
                    const isChecked = checkbox.checked;
                    webmap.allLayers.forEach(l => {
                        if (l.title.includes(def.layerKeyword)) {
                            l.visible = isChecked;
                        }
                    });
                });
            }
        });

        if (hitCount === 0) {
            container.innerHTML = "<p style='font-size:0.8em; color:#999;'>※特に関連するハザードマップ情報はありません</p>";
        }
    }
  
    // --- 🕵️‍♀️ 1. 探す専用のミニロボット関数 ---
    function findPersonText(text) {
        if (!text) return null;
        let cleanText = text.replace(/[\r\n\s]+/g, "");
        cleanText = cleanText.split(/[、。.,．]/)[0];
        const limitText = cleanText.substring(0, 40);
        const regex = /.*?(人|者|民|方|達|学生|慶應生|生徒|たち|家族|みんな|さん|ちゃん|友|自分|ママ|パパ)/;
        const match = limitText.match(regex);
        if (match) return match[0] + "へ";
        return null; 
    }

    // --- 🎯 2. メインの宛名決定関数 ---
    function extractAddressee(message, collage, Mabling) {
        const target1 = findPersonText(message);
        if (target1) return target1; 
        const target2 = findPersonText(collage);
        if (target2) return target2; 
        const target3 = findPersonText(Mabling);
        if (target3) return target3; 
        return "地域のみんなへ";
    }

    function highlightMapPin(oid, layerView) {
        if (activeHighlightHandle) { activeHighlightHandle.remove(); activeHighlightHandle = null; }
        activeView.graphics.removeAll(); 
        highlightedObjectId = oid;
        if (oid === null || !layerView) return;

        const query = { objectIds: [oid], outFields: ["*"], returnGeometry: true };
        layerView.layer.queryFeatures(query).then(res => {
            if (highlightedObjectId !== oid) return;
            if (res.features.length > 0) {
                const feature = res.features[0];
                const attrs = feature.attributes;
                const message = attrs.Message || attrs.message || "";
                const collage = attrs.collage || attrs.Collage || ""; 
                const marbling = attrs.Mabling || attrs.Marbling || attrs.mabling || "";
                const addressee = extractAddressee(message, collage, marbling);
                if (!feature.geometry) return;

                const label = new Graphic({
                    geometry: feature.geometry,
                    symbol: {
                        type: "text", color: "#333333", text: "✉️ " + addressee, 
                        yoffset: 30, font: { size: 12, weight: "bold", family: "sans-serif" },
                        backgroundColor: [255, 255, 255, 0.95],
                        borderLineColor: [0, 121, 193, 0.5], borderLineSize: 1,
                        horizontalAlignment: "center",
                        lineWidth: 500
                    }
                });
                activeView.graphics.add(label);
                activeHighlightHandle = layerView.highlight(feature);
            }
        }).catch(error => { console.error("ラベル描画エラー:", error); });
    }

    window.finishQuest = function(stepNum) {
      showQuestMenu(); 

      const addResultText = (item, text) => {
          if(!item.querySelector(".quest-result-text")) {
              const div = document.createElement("div");
              div.className = "quest-result-text";
              div.innerHTML = text;
              item.appendChild(div);
          }
      };

      const enableReplay = (item, step) => {
          item.onclick = function() { startQuest(step); };
          item.title = "クリックしてもう一度確認する";
      };

      if (stepNum === 1) {
        const item1 = document.getElementById("quest-item-1");
        const btn1 = item1.querySelector("button");
        item1.classList.add("completed"); 
        item1.classList.remove("active"); 
        if(btn1) btn1.style.display = "none"; 
        addResultText(item1, featureAttributes.Mabling || "災害リスク");
        enableReplay(item1, 1);

        const item2 = document.getElementById("quest-item-2");
        const btn2 = document.getElementById("btn-step2");
        if(item2 && btn2) {
            item2.classList.remove("locked");
            item2.classList.add("active"); 
            btn2.disabled = false;
            btn2.innerText = "コラージュを鑑賞する ＞";
        }

      } else if (stepNum === 2) {
        const item2 = document.getElementById("quest-item-2");
        const btn2 = item2.querySelector("button");
        item2.classList.add("completed");
        item2.classList.remove("active"); 
        if(btn2) btn2.style.display = "none"; 
        addResultText(item2, featureAttributes.collage || "防災行動");
        enableReplay(item2, 2);

        const item3 = document.getElementById("quest-item-3");
        const btn3 = document.getElementById("btn-step3");
        if(item3 && btn3) {
            item3.classList.remove("locked");
            item3.classList.add("active");
            btn3.disabled = false;
            btn3.innerText = "手紙を開く 💌";
        }

      } else if (stepNum === 3) {
        const item3 = document.getElementById("quest-item-3");
        const btn3 = document.getElementById("btn-step3");
        item3.classList.add("completed");
        item3.classList.remove("active");
        if(btn3) btn3.style.display = "none"; 
        addResultText(item3, featureAttributes.Message || "作者からのメッセージ");
        enableReplay(item3, 3);
        
        const viewedList = JSON.parse(localStorage.getItem("bousai_viewed") || "[]");
        if (!viewedList.includes(objectId)) {
            viewedList.push(objectId);
            localStorage.setItem("bousai_viewed", JSON.stringify(viewedList));
            updateHeaderStats();
        }

        const postArea = document.getElementById("post-quest-area");
        if(postArea) postArea.style.display = "block";
        const guide = document.querySelector(".appreciation-guide");
        if(guide) guide.style.display = "none";
      }
    };

    // --- おすすめ作品ロジック ---
    let nearbyView = null;
    let nearbyLayer = null;

    window.goToNearbyWorks = function() {
        const btn = document.getElementById("find-nearby-btn");
        const overlay = document.getElementById("nearby-overlay");
        if(btn) {
            btn.innerHTML = "⌛ 準備中...";
            btn.style.opacity = "0.7";
            btn.style.pointerEvents = "none"; 
        }
        if(overlay) {
            overlay.style.display = "flex";
            void overlay.offsetWidth; 
        }

        setTimeout(function() {
            if (!nearbyView) {
                const nearbyWebmap = new WebMap({ portalItem: { id: "fef70d22c8bd4545be008db3c813117c" } });
                nearbyView = new MapView({
                    container: "nearby-map-view",
                    map: nearbyWebmap,
                    center: originalFeature.geometry, 
                    zoom: 13, 
                    ui: { components: [] } 
                });
    
                nearbyView.when(() => {
                    nearbyLayer = nearbyWebmap.allLayers.find(l => l.title === "survey");
                    if (nearbyLayer) {
                        nearbyLayer.definitionExpression = "1=0";
                        const labelClass = new LabelClass({
                          symbol: {
                            type: "text", 
                            color: "#333333", 
                            haloColor: "white",
                            haloSize: 2,
                            font: { size: 10, weight: "bold", family: "sans-serif" },
                            backgroundColor: "rgba(255, 255, 255, 0.9)",
                            borderLineColor: "rgba(0, 0, 0, 0.1)",
                            borderLineSize: 1,
                            yoffset: 20,
                            verticalAlignment: "bottom"
                          },
                          labelPlacement: "above-center",
                          labelExpressionInfo: {
                            expression: `
                              var msg = $feature.Message;
                              var idx = Find("へ", msg);
                              if (idx > -1) { return Left(msg, idx + 1); } else { return "地域のみんなへ"; }
                            `
                          }
                        });
                        nearbyLayer.labelingInfo = [labelClass];
                        nearbyLayer.labelsVisible = true;
                    }
                    loadDualRecommendation();
                    resetButton();
                });
    
                nearbyView.on("click", (event) => {
                  nearbyView.hitTest(event).then((res) => {
                    const result = res.results.find(r => r.graphic.layer === nearbyLayer || r.graphic.layer === nearbyView.graphics);
                    if (result) {
                      const oid = result.graphic.attributes.objectid;
                      if(oid) window.location.href = `detail.html?id=${oid}`;
                    }
                  });
                });
            } else {
                resetButton();
            }
        }, 500);
        
        function resetButton() {
            if(btn) {
                btn.innerHTML = "🗺️ 次に鑑賞する作品を探す";
                btn.style.opacity = "1";
                btn.style.pointerEvents = "auto";
            }
        }
    };

    window.closeNearbyOverlay = function() {
        document.getElementById("nearby-overlay").style.display = "none";
    };

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function getRiskCategory(attrs) {
        const val = attrs.field_24 || "";
        if (val.includes("震度") || val.includes("火災")) return "jishin";
        if (val.includes("土砂災害") || val.includes("液状化")) return "jiban";
        if (val.includes("洪水") || val.includes("高潮") || val.includes("津波")) return "mizu";
        return "other";
    }

    function getPhaseCategory(attrs) {
        const text = (attrs.Message || "") + (attrs.collage || "") + (attrs.Mabling || "");
        for (const kw of phaseKeywords.prior) if (text.includes(kw)) return "prior";
        for (const kw of phaseKeywords.during) if (text.includes(kw)) return "during";
        for (const kw of phaseKeywords.recovery) if (text.includes(kw)) return "recovery";
        return "other";
    }

    function getRiskSQL(category) {
        if (category === "jishin") return "(field_24 LIKE '%震度%' OR field_24 LIKE '%火災%')";
        if (category === "jiban") return "(field_24 LIKE '%土砂災害%' OR field_24 LIKE '%液状化%')";
        if (category === "mizu") return "(field_24 LIKE '%洪水%' OR field_24 LIKE '%高潮%' OR field_24 LIKE '%津波%')";
        return "1=1";
    }

    function getPhaseSQL(phase) {
        const kws = phaseKeywords[phase];
        if (!kws) return "1=1";
        const conditions = kws.map(kw => `(Message LIKE '%${kw}%' OR collage LIKE '%${kw}%' OR Mabling LIKE '%${kw}%')`).join(" OR ");
        return `(${conditions})`;
    }

    function loadDualRecommendation() {
        const gridRisk = document.getElementById("grid-risk");
        const gridTime = document.getElementById("grid-time");
        gridRisk.innerHTML = "<p style='font-size:0.8em; color:#999;'>読み込み中...</p>";
        gridTime.innerHTML = "<p style='font-size:0.8em; color:#999;'>読み込み中...</p>";

        const myRisk = getRiskCategory(featureAttributes);
        const myPhase = getPhaseCategory(featureAttributes);
        const riskWhere = getRiskSQL(myRisk);
        const phaseWhere = getPhaseSQL(myPhase);

const hiddenIds = [23, 25, 26, 27, 28];
        const excludeSQL = `objectid NOT IN (${hiddenIds.join(",")})`;

        const promises = [];
        const queryRisk = artPinsLayer.createQuery();
        queryRisk.where = `objectid <> ${objectId} AND ${riskWhere} AND ${excludeSQL}`;
        queryRisk.returnGeometry = true;
        queryRisk.outFields = ["*"];
        queryRisk.num = 20; 
        promises.push(artPinsLayer.queryFeatures(queryRisk));

        const queryTime = artPinsLayer.createQuery();
        queryTime.where = `objectid <> ${objectId} AND ${phaseWhere} AND ${excludeSQL}`;
        queryTime.returnGeometry = true;
        queryTime.outFields = ["*"];
        queryTime.num = 20; 
        promises.push(artPinsLayer.queryFeatures(queryTime));

        Promise.all(promises).then(results => {
            let riskCandidates = results[0].features;
            let timeCandidates = results[1].features;
            
            shuffleArray(riskCandidates);
            const riskFeatures = riskCandidates.slice(0, 2);

            const usedIds = riskFeatures.map(f => f.attributes.objectid);
            timeCandidates = timeCandidates.filter(f => !usedIds.includes(f.attributes.objectid));
            shuffleArray(timeCandidates);
            const timeFeatures = timeCandidates.slice(0, 2);
            
            gridRisk.innerHTML = "";
            gridTime.innerHTML = "";

            const allFeatures = [...riskFeatures, ...timeFeatures];
            const allIds = allFeatures.map(f => f.attributes.objectid);

            if (nearbyLayer) {
                if (allIds.length > 0) {
                    nearbyLayer.definitionExpression = `objectid IN (${allIds.join(",")})`;
                    addColoredNumberLabels(riskFeatures, timeFeatures);
                    zoomToFeatures(allFeatures);
                } else {
                    nearbyLayer.definitionExpression = "1=0"; 
                }
            }
            
            const createCompactCard = (container, feature, badgeText, badgeColor, indexNumber, badgeClass) => {
                const attrs = feature.attributes;
                const oid = attrs.objectid;
                const author = attrs.field_25 || "匿名";
                const item = document.createElement("div");
                item.className = "nearby-item compact";
                item.style.borderColor = badgeColor; 
                item.onclick = () => { window.location.href = `detail.html?id=${oid}`; };
                
                item.innerHTML = `
                    <div class="compact-thumb-box">
                      <div class="number-badge-float ${badgeClass}">${indexNumber}</div>
                      <img id="thumb-${oid}" class="compact-thumb" src="https://via.placeholder.com/150?text=Loading">
                    </div>
                    <div class="compact-info">
                        <div class="compact-author">👤 ${author}</div>
                    </div>
                `;
                container.appendChild(item);
                artPinsLayer.queryAttachments({ objectIds: [oid] }).then(attachments => {
                    const img = document.getElementById(`thumb-${oid}`);
                    if (attachments[oid] && attachments[oid].length > 0) {
                        img.src = attachments[oid][0].url;
                    } else {
                        img.src = "https://via.placeholder.com/150?text=No+Image";
                    }
                });
            };

            let count = 1;
            if(riskFeatures.length > 0) {
                riskFeatures.forEach(f => createCompactCard(gridRisk, f, "同じ災害リスクを扱った作品", "#EE8972", count++, "badge-risk"));
            } else {
                gridRisk.innerHTML = "<p style='font-size:0.8em; color:#999; padding:5px;'>該当なし</p>";
            }

            if(timeFeatures.length > 0) {
                timeFeatures.forEach(f => createCompactCard(gridTime, f, "同じタイミングの防災行動を扱った作品", "#6BAA9F", count++, "badge-time"));
            } else {
                gridTime.innerHTML = "<p style='font-size:0.8em; color:#999; padding:5px;'>該当なし</p>";
            }
        });
    }

    function addColoredNumberLabels(riskGroup, timeGroup) {
        if (!nearbyView) return;
        nearbyView.graphics.removeAll();
        let count = 1;
        const drawLabel = (feature, bgColor) => {
            if (!feature.geometry) return;
            const textGraphic = new Graphic({
                geometry: feature.geometry,
                attributes: { objectid: feature.attributes.objectid },
                symbol: {
                    type: "text",
                    color: "white",
                    haloColor: "rgba(0,0,0,0.3)",
                    haloSize: "1px",
                    text: count.toString(),
                    xoffset: 0,
                    yoffset: -5, 
                    font: { size: 12, weight: "bold" },
                    backgroundColor: bgColor,
                    borderLineColor: "white",
                    borderLineSize: 1,
                }
            });
            nearbyView.graphics.add(textGraphic);
            count++;
        };
        riskGroup.forEach(f => drawLabel(f, "#EE8972"));
        timeGroup.forEach(f => drawLabel(f, "#6BAA9F"));
    }

    function zoomToFeatures(features) {
        if (!nearbyView || features.length === 0) return;
        const geometries = features.map(f => f.geometry).filter(g => g);
        if(geometries.length > 0) {
            nearbyView.goTo(geometries, { 
                padding: { top: 80, bottom: 80, left: 60, right: 60 },
                duration: 1000 
            }).catch(e => {});
        }
    }

    window.showFinalCTA = function() {
        document.getElementById("nearby-overlay").style.display = "none";
        document.getElementById("final-cta-overlay").style.display = "flex";
        
        const countSpan = document.getElementById("total-art-count");
        const bgContainer = document.getElementById("final-background");
        const layerUrl = "https://services2.arcgis.com/xpOLkBdwWTLJMFA7/arcgis/rest/services/survey123_cff62fc5070c4f468b2c9269d5b2535f/FeatureServer/0";

        bgContainer.innerHTML = "";

        const hiddenIds = [23, 25, 26, 27, 28];
        const excludeSQL = `objectid NOT IN (${hiddenIds.join(",")})`;

        require(["esri/rest/query", "esri/rest/support/Query", "esri/layers/FeatureLayer"], function(query, Query, FeatureLayer) {
            const q = new Query();
            q.where = excludeSQL;
            
            query.executeForCount(layerUrl, q).then(function(count){
                let current = 0;
                const timer = setInterval(() => {
                    current += Math.ceil(count / 20);
                    if (current >= count) {
                        current = count;
                        clearInterval(timer);
                    }
                    if(countSpan) countSpan.textContent = current;
                }, 50);
            });

            const layer = new FeatureLayer({ url: layerUrl });
            const floatQuery = layer.createQuery();
            floatQuery.where = `Message IS NOT NULL AND objectid <> ${objectId} AND ${excludeSQL}`;
            floatQuery.outFields = ["objectid", "Message"];
            floatQuery.returnGeometry = false;
            floatQuery.num = 50; 

            layer.queryFeatures(floatQuery).then(function(results){
                const features = results.features;
                for (let i = features.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [features[i], features[j]] = [features[j], features[i]];
                }
                const selected = features.slice(0, 10);
                selected.forEach((feat, index) => {
                    const oid = feat.attributes.objectid;
                    const msg = feat.attributes.Message;
                    let toName = "地域のみんなへ";
                    const idx = msg.indexOf("へ");
                    if(idx > 0 && idx < 15) toName = msg.substring(0, idx+1);
                    toName = "💭 " + toName;
                    layer.queryAttachments({ objectIds: [oid] }).then(att => {
                        let imgSrc = "https://via.placeholder.com/120?text=Art";
                        if(att[oid] && att[oid].length > 0) imgSrc = att[oid][0].url;
                        createFloatingElement(bgContainer, imgSrc, toName, index);
                    });
                });
            });
        });
    };

    function createFloatingElement(container, imgSrc, text, index) {
        const div = document.createElement("div");
        div.className = "floating-card";
        div.innerHTML = `
            <div class="floating-bubble">${text}</div>
            <img src="${imgSrc}" class="floating-img">
        `;
        let randomLeft;
        if (index % 2 === 0) {
            randomLeft = Math.floor(Math.random() * 15) + 10; 
        } else {
            randomLeft = Math.floor(Math.random() * 15) + 75; 
        }
        const fixedDur = 15; 
        const delay = index * 3.0; 
        div.style.left = randomLeft + "%";
        div.style.animationDuration = fixedDur + "s";
        div.style.animationDelay = delay + "s";
        container.appendChild(div);
    }

    function updateHeaderStats() {
      const savedHearts = JSON.parse(localStorage.getItem("bousai_hearts") || "[]");
      const savedActions = JSON.parse(localStorage.getItem("bousai_actions") || "[]");
      const viewedList = JSON.parse(localStorage.getItem("bousai_viewed") || "[]");

      const heartEl = document.getElementById("header-heart-count");
      const actionEl = document.getElementById("header-action-count");
      const viewEl = document.getElementById("view-count");

      if (heartEl) heartEl.textContent = savedHearts.length;
      if (actionEl) actionEl.textContent = savedActions.length;
      if (viewEl) viewEl.textContent = viewedList.length; 
    }

    function setupReactionButtons() {
      const btnHeart = document.getElementById("btn-heart");
      const btnAction = document.getElementById("btn-action");
      
      updateHeaderStats();

      if (!btnHeart || !btnAction) return;

      const savedHearts = JSON.parse(localStorage.getItem("bousai_hearts") || "[]");
      const savedActions = JSON.parse(localStorage.getItem("bousai_actions") || "[]");

      if (savedHearts.includes(objectId)) {
          btnHeart.classList.add("active");
          btnHeart.innerHTML = '<span class="icon">💖</span> 共感した';
      }
      if (savedActions.includes(objectId)) {
          btnAction.classList.add("active");
          btnAction.innerHTML = '<span class="icon">✨</span> 実践したい';
      }

      btnHeart.addEventListener("click", () => {
          let list = JSON.parse(localStorage.getItem("bousai_hearts") || "[]");
          if (list.includes(objectId)) {
              list = list.filter(id => id !== objectId);
              btnHeart.classList.remove("active");
              btnHeart.innerHTML = '<span class="icon">🤍</span> 共感した';
          } else {
              list.push(objectId);
              btnHeart.classList.add("active");
              btnHeart.innerHTML = '<span class="icon">💖</span> 共感した';
          }
          localStorage.setItem("bousai_hearts", JSON.stringify(list));
          updateHeaderStats();
      });

      btnAction.addEventListener("click", () => {
          let list = JSON.parse(localStorage.getItem("bousai_actions") || "[]");
          if (list.includes(objectId)) {
              list = list.filter(id => id !== objectId);
              btnAction.classList.remove("active");
              btnAction.innerHTML = '<span class="icon">⭐</span> 実践したい';
          } else {
              list.push(objectId);
              btnAction.classList.add("active");
              btnAction.innerHTML = '<span class="icon">✨</span> 実践したい';
          }
          localStorage.setItem("bousai_actions", JSON.stringify(list));
          updateHeaderStats();
      });
    }

    setupReactionButtons();

    const findNearbyBtn = document.getElementById("find-nearby-btn");
    if (findNearbyBtn) {
        findNearbyBtn.addEventListener("click", goToNearbyWorks);
    }

  }); // require End
}); // DOMContentLoaded End