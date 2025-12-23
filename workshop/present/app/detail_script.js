document.addEventListener("DOMContentLoaded", function() {

require([
  "esri/WebMap",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/widgets/Legend",
], function(WebMap, MapView, FeatureLayer, Legend) {

  // フロー全体で使う変数
  let currentStep = 1; // 現在の鑑賞ステップ
  let featureAttributes = null; // 作品の属性情報（解説文など）
  let originalFeature = null; // 作品のフィーチャ（ジオメトリを含む）を保存
  let relatedHazardCheckboxes = []; // Step1で操作対象となるチェックボックスのリスト
  let clickedCheckboxes = new Set(); // Step1でクリック済みのチェックボックスを記録

  // 既存の要素への参照
  let instructionTitle, interactionPanel, nextButton, backToTopButton, 
      artPanel, artworkInfo, mapPanel, rightColumn, leftColumn, filterWidget, buttonWrapper;
  let step1PanelHTML = null; // ★Step 1 のパネルHTMLを保存する変数

  const objectId = parseInt(new URLSearchParams(window.location.search).get("id"));
  if (!objectId) return;

  // ハザード情報をグローバルスコープに移動？
  let legendWidget = null;
  let currentHighlight = null;
  const allHazardsInfo = {
      "下水があふれる洪水（内水氾濫）": { layerTitle: "naisui_R7_clip", checkboxId: "naisui_R7-filter" },
      "川の水があふれる洪水（外水氾濫）": { layerTitle: "gaisui_clip", checkboxId: "gaisui-filter" },
      "土砂災害マップ": { layerTitle: "kyukeisha_R7_clip", checkboxId: "kyukeisha_R7-filter" },
      "高潮（浸水深）": { layerTitle: "takashio_clip", checkboxId: "takashio-filter" },
      "津波（浸水深、慶長型地震）": { layerTitle: "tsunami_clip", checkboxId: "tsunami-filter" },
      "震度情報（元禄型関東地震）": { layerTitle: "jishindo_clip", checkboxId: "jishindo-filter" },
      "地震火災（元禄型関東地震）": { layerTitle: "shoshitsu_clip", checkboxId: "shoshitsu-filter" },
      "地盤の液状化（元禄型関東地震）": { layerTitle: "ekijyouka_clip", checkboxId: "ekijyoukakiken-filter" }
  };

  const artPinsLayer = new FeatureLayer({
    url: "https://services2.arcgis.com/xpOLkBdwWTLJMFA7/arcgis/rest/services/survey123_cff62fc5070c4f468b2c9269d5b2535f/FeatureServer/0"
  });

  const webmap = new WebMap({ portalItem: { id: "fef70d22c8bd4545be008db3c813117c" } });
  const view = new MapView({ container: "surrounding-map", map: webmap, ui: { components: ["zoom"] } });

  function displayBackButtonIfNeeded() {
    const urlParams = new URLSearchParams(window.location.search);
    const fromId = urlParams.get('from');

    if (fromId) {
      // 1. fromId から作品情報を取得 (作者名が欲しい)
      artPinsLayer.queryFeatures({
        where: `objectid = ${fromId}`,
        outFields: ["field_25"], // 作者名だけ取得
        returnGeometry: false
      }).then(results => {
        if (results.features.length > 0) {
          const fromAuthor = results.features[0].attributes.field_25 || '前の作品';

          // 2. 戻るボタン要素を作成
          const backButton = document.createElement('button');
          backButton.id = 'back-to-previous-button';
          backButton.className = 'nav-button btn-secondary'; // 他のボタンと同じスタイル
          backButton.textContent = `◁「${fromAuthor}」の作品に戻る`;

          // 3. クリックしたら、前の作品のページに飛ぶ
          backButton.addEventListener('click', () => {
            window.location.href = `detail.html?id=${fromId}`;
          });

          // 4. leftColumn の artworkInfo の「前」に挿入
          const artworkInfoDiv = document.getElementById('artwork-info');
          if (artworkInfoDiv) {
            artworkInfoDiv.parentNode.insertBefore(backButton, artworkInfoDiv);
          }
        }
      }).catch(err => {
        console.error("'from' 作品情報の取得に失敗:", err);
        // エラーでもボタンは出す（作者名なしで）
        const backButton = document.createElement('button');
        backButton.id = 'back-to-previous-button';
        backButton.className = 'nav-button btn-secondary';
        backButton.textContent = `◁ 前の作品に戻る`;
        backButton.addEventListener('click', () => {
          window.location.href = `detail.html?id=${fromId}`;
        });
        const artworkInfoDiv = document.getElementById('artwork-info');
        if (artworkInfoDiv) {
          artworkInfoDiv.parentNode.insertBefore(backButton, artworkInfoDiv);
        }
      });
    }
  }

  artPinsLayer.queryFeatures({
    where: `objectid = ${objectId}`,
    outFields: ["*"],
    returnGeometry: true
  }).then(results => {

    instructionTitle = document.querySelector(".instruction-title");
    interactionPanel = document.querySelector(".interaction-panel");
    nextButton = document.getElementById("next-button");
    backToTopButton = document.getElementById("back-to-top-button");
    artPanel = document.querySelector(".art-panel");
    artworkInfo = document.getElementById("artwork-info");
    mapPanel = document.querySelector(".map-panel");
    rightColumn = document.querySelector('.right-column');
    leftColumn = document.querySelector('.left-column');
    filterWidget = document.getElementById("filter-widget");
    buttonWrapper = document.querySelector('.button-wrapper');
    step1PanelHTML = interactionPanel.innerHTML; // ★Step 1 のHTMLを保存

    displayBackButtonIfNeeded();
    
    if (results.features.length === 0) return;

    // 作品データをセット
    originalFeature = results.features[0]; 
    featureAttributes = originalFeature.attributes;
    
    document.getElementById("artwork-info").innerHTML = `<div class="info-label">作者: ${featureAttributes.field_25}</div>`;
    artPinsLayer.queryAttachments({ objectIds: [objectId] }).then(attachments => {
      if (attachments[objectId] && attachments[objectId].length > 0) {
        document.getElementById("art-image").src = attachments[objectId][0].url;
      }
    });

    // 地図とレイヤーの設定
    view.when(() => {
      const artPinsLayerOnMap = webmap.allLayers.find(layer => layer.title === "survey");
      if (artPinsLayerOnMap) artPinsLayerOnMap.definitionExpression = `objectid = ${objectId}`;
      view.goTo({ target: originalFeature.geometry, zoom: 15 });

      // ハザードレイヤーを一旦すべて非表示に
      Object.values(allHazardsInfo).forEach(info => {
          const layer = webmap.allLayers.find(l => l.title === info.layerTitle);
          if (layer) layer.visible = false;
      });

      // チェックボックス
      const hazardTypeString = featureAttributes.field_24; 
      if (hazardTypeString) {
        const hazardNames = hazardTypeString.split(',').map(name => name.trim());
        filterWidget.innerHTML = '<h3>表示するハザードマップ</h3>';

        hazardNames.forEach(name => {
            const hazardInfo = allHazardsInfo[name];
            if (hazardInfo) {
                const optionDiv = document.createElement("div");
                optionDiv.className = "filter-option";
                optionDiv.innerHTML = `<input type="checkbox" id="${hazardInfo.checkboxId}" value="${hazardInfo.layerTitle.replace('_clip','')}"><label for="${hazardInfo.checkboxId}">${name}</label>`;
                filterWidget.appendChild(optionDiv);
                
                // Step1の対象となるチェックボックスをリストに追加
                relatedHazardCheckboxes.push(document.getElementById(hazardInfo.checkboxId));
            }
        });
        
        // 凡例生成時にレイヤーを非表示
        hazardNames.forEach(name => {
          const layerInfo = allHazardsInfo[name];
          const layer = layerInfo ? webmap.allLayers.find(l => l.title === layerInfo.layerTitle) : null;
          if(layer) {
              layer.visible = false;
              const checkbox = document.getElementById(layerInfo.checkboxId);
              if (checkbox) checkbox.checked = false;
          }
        });
      }
      
      // チェックボックスのイベントリスナー
      document.querySelectorAll('#filter-widget input[type="checkbox"]').forEach(checkbox => {
        const matchingHazard = Object.values(allHazardsInfo).find(info => info.checkboxId === checkbox.id);
        if (matchingHazard) {
          const layer = webmap.allLayers.find(l => l.title === matchingHazard.layerTitle);
          if (layer) {
            checkbox.addEventListener('change', () => { 
              layer.visible = checkbox.checked;
                      
              // Step1の作業チェック
              if (currentStep === 1) {
                checkStep1Completion(checkbox);
              }
            });
          }
      }
    });
      
      // Step1の初期化
      initializeStep1();
    });

    // メインのボタンイベントリスナー

    // 「戻る」ボタンのメインの動作を、新しい関数で管理
    backToTopButton.addEventListener("click", handleBackButtonClick);

    function handleBackButtonClick() {
      // Step 7 で非表示にしたボタンを再表示
      nextButton.style.display = 'block';

      if (currentStep === 1) {
        // Step 1 の時はトップページへ
        window.location.href = "index.html";
      } else {
        // Step 2以降は前のステップへ
        goToPreviousStep();
      }
    }

    // 「次へ」ボタン
    nextButton.addEventListener("click", () => {
      goToNextStep();
    });

  });

  // 凡例を（再）生成す
  function createLegend() {
    
    // 既存の凡例ウィジェットがあれば破棄
    if (legendWidget) {
      legendWidget.destroy();
      legendWidget = null;
    }

    const hazardTypeString = featureAttributes.field_24; 
    if (!hazardTypeString) return; 

    const hazardNames = hazardTypeString.split(',').map(name => name.trim());
    
    const legendLayerInfos = hazardNames.map(name => {
      const layerInfo = allHazardsInfo[name]; 
      const layer = layerInfo ? webmap.allLayers.find(l => l.title === layerInfo.layerTitle) : null;
      return layer ? { layer: layer, title: name } : null;
    }).filter(info => info !== null);

    if (legendLayerInfos.length > 0) {
      // 新しい凡例ウィジェットを作成
      legendWidget = new Legend({ 
        view: view, 
        layerInfos: legendLayerInfos,
        className: "fixed-height-legend"
      });
      
      // 地図の左下に追加
      view.ui.add(legendWidget, "bottom-right");
    }
  }

  /**
   * プログレスバーの状態を更新する
   * @param {number} logicalStep - 現在の論理ステップ番号 (1-7)
   */
  function updateProgressBar(logicalStep) {
    
    let visualStep = 0;
    if (logicalStep <= 2) {       // 内部Step 1 (タスク) or 2 (解説)
      visualStep = 1; // -> 見た目Step 1 "危険"
    } else if (logicalStep <= 4) { // 内部Step 3 (タスク) or 4 (解説)
      visualStep = 2; // -> 見た目Step 2 "行動"
    } else if (logicalStep === 5) {
      visualStep = 3; // -> 見た目Step 3 "作者の想い"
    } else if (logicalStep === 6) {
      visualStep = 4; // -> 見た目Step 4 "周辺の作品"
    }

    const steps = document.querySelectorAll(".progress-step");
    steps.forEach(stepEl => {
      // HTMLの data-step (1-5) を取得
      const stepNum = parseInt(stepEl.dataset.step, 10); 
      
      if (stepNum < visualStep) {
        // 完了したステップ
        stepEl.classList.add("completed");
        stepEl.classList.remove("active");
      } else if (stepNum === visualStep) {
        // 現在のステップ
        stepEl.classList.remove("completed");
        stepEl.classList.add("active");
      } else {
        // これからのステップ
        stepEl.classList.remove("completed");
        stepEl.classList.remove("active");
      }
    });
  }

  // Step 1（危険当て作業）の初期設定
  function initializeStep1() {
    
    // 1. タイトルと案内文を更新
    instructionTitle.innerHTML = `このアート作品が示す「危険」は何でしょう？`;
    
    // 2. ボタンの状態をリセット
    nextButton.disabled = true; 
    backToTopButton.textContent = "← トップに戻る";
    nextButton.textContent = "「危険」の解説を見る →";

    // 3. パネルの中身を、保存しておいた Step 1 のHTMLに戻す
    interactionPanel.innerHTML = step1PanelHTML;
    interactionPanel.classList.remove("expanded");    
    createLegend(); 
    
    // 4.レイヤーのチェックボックスと表示をリセット
    document.querySelectorAll('#filter-widget input[type="checkbox"]').forEach(checkbox => {
      const matchingHazard = Object.values(allHazardsInfo).find(info => info.checkboxId === checkbox.id);
      if (matchingHazard) {
          const layer = webmap.allLayers.find(l => l.title === matchingHazard.layerTitle);
          if (layer) {
              layer.visible = false;
              checkbox.checked = false;
          }
      }
    });

    // 5. Step 1 の完了チェック状態もリセット
    clickedCheckboxes.clear();

    // 6. 関連チェックボックスが0個の判定
    if (relatedHazardCheckboxes.length === 0) {
        nextButton.disabled = false;
    }
    updateProgressBar(currentStep);
    if (filterWidget) {
      filterWidget.classList.add("pika-pika");
    }
    // もし「前の作品に戻る」ボタンが存在すれば、表示する
    const prevButton = document.getElementById('back-to-previous-button');
    if (prevButton) {
      prevButton.style.display = 'block';
    }
  }

  //Step 1の作業完了をチェック
  function checkStep1Completion(clickedCheckbox) {
    // クリックされたチェックボックスをSetに追加
    clickedCheckboxes.add(clickedCheckbox.id);
    
    // クリックされた数が、関連するチェックボックスの総数と同じになったら
    if (clickedCheckboxes.size === relatedHazardCheckboxes.length) {
      // 「次へ」ボタンを有効化
      nextButton.disabled = false;
    }
  }

  //「次へ」ボタンが押された時に、ステップを進めるメインの関数
  function goToNextStep() {
    currentStep++; // ステップを次に進める
    updateProgressBar(currentStep);

    if (legendWidget) {
      legendWidget.destroy();
      legendWidget = null;
    }

    // Step 2 以降に進んだら、ボタンのテキストを「前に戻る」に変更
    if (currentStep > 1) {
      backToTopButton.textContent = "← 前のステップに戻る";
    }
    
    switch (currentStep) {
      case 2: // Step 2: 危険の答え合わせ
      // Step 1 で使ったピカピカと凡例を消す
        if (filterWidget) {
          filterWidget.classList.remove("pika-pika");
        }

        showStep2_DangerExplanation();
        break;
      case 3: // Step 3: 行動の作業
        showStep3_ActionTask();
        break;
      case 4: // Step 4: 行動の答え合わせ
        showStep4_ActionExplanation();
        break;
      case 5: // Step 5: 作者の想い
        showStep5_AuthorMessage();
        break;
      case 6: // Step 6: 周辺の作品
        showStep6_NearbyWorks();
        break;
      case 7: // Step 7: 制作への誘い
        view.featureEffect = null;
        if (currentHighlight) {
          currentHighlight.remove();
          currentHighlight = null;
        }
        window.location.href = "index.html";
        break;
    }
  }

  //「前に戻る」ボタンが押された時に、ステップを戻すメインの関数
  function goToPreviousStep() {
    currentStep--; // ステップを一つ戻す
    updateProgressBar(currentStep);

    if (legendWidget) {
      legendWidget.destroy();
      legendWidget = null;
    }
    
    // 戻る処理の共通設定
    // メインのボタンラッパーを再表示
    buttonWrapper.style.display = 'flex';
    interactionPanel.style.display = 'block';
    leftColumn.innerHTML = '';
    leftColumn.appendChild(artworkInfo);
    leftColumn.appendChild(artPanel);

    switch (currentStep) {
      case 1:
        interactionPanel.classList.remove("expanded-explanation");
        interactionPanel.classList.remove("pika-pika");
        initializeStep1(); // Step 1 の関数（テキストも「トップに戻る」に戻る）

        // 戻ってきた時は、Step 1 の作業（チェックボックス）をスキップできるようにする
        nextButton.disabled = false;
        
        break;
      case 2:
        showStep2_DangerExplanation();
        break;
      case 3:
        showStep3_ActionTask();
        break;
      case 4:
        showStep4_ActionExplanation();
        break;
      case 5:
        const artPinsLayerOnMap = webmap.allLayers.find(layer => layer.title === "survey");
        if (artPinsLayerOnMap) {
          // マップの表示を「今の作品」だけにリセット
          artPinsLayerOnMap.definitionExpression = `objectid = ${objectId}`;
        }
        view.featureEffect = null; // 鑑賞済みエフェクトを解除
        if (currentHighlight) {
          currentHighlight.remove();
          currentHighlight = null;
        }
        showStep5_AuthorMessage();
        break;
    }

    // Step 1 以外は「戻る」ボタンのテキストを設定
    if (currentStep > 1) {
      backToTopButton.textContent = "← ステップに戻る";
    }
  }

  // Step 2: 危険の解説を表示
  function showStep2_DangerExplanation() {
    
    // 1.パネルのスタイルを変更
    interactionPanel.classList.add("expanded-explanation");
    interactionPanel.classList.add("pika-pika");
    
    // 2.タイトルと中身をセット
    instructionTitle.textContent = "作者が注目した「危険」を見てみましょう！";
    
    const mablingText = featureAttributes.Mabling || "（解説はありません）";
    
    interactionPanel.innerHTML = `
    <div class="explanation-panel">
        <h3 class="panel-header">「危険」（マーブリング）の解説</h3>
        <h4>${mablingText}</h4>
        <p style="margin-top: 20px; font-weight: bold; text-align: center; color: #333;">
          💡 この「危険」をふまえて、次はとるべき「防災行動」を考えてみましょう。
        </p>
      </div>
    `;

    interactionPanel.scrollTop = 0;

    // 3.ボタンのテキストを更新
    nextButton.textContent = "「防災行動」を考える →";
    nextButton.disabled = false;
    createLegend();
    // もし「前の作品に戻る」ボタンが存在すれば、非表示にする
    const prevButton = document.getElementById('back-to-previous-button');
    if (prevButton) {
      prevButton.style.display = 'none';
    }
  }

  // Step 3: 行動の作業を表示
  function showStep3_ActionTask() {
    // 1.メインタイトルを Step 1 と同じテイストに変更
    instructionTitle.innerHTML = `アート作品が示す「防災行動」は何でしょう？`; 
    
    // 2.パネルのスタイルを変更
    interactionPanel.classList.add("expanded-explanation");
    interactionPanel.classList.remove("pika-pika"); 
    
    // 3.カラム用のキーワードリストを定義
    const actionCategories = [
      { 
        title: "避難行動", 
        keywords: [
          "高い場所・避難所へ避難する",
          "危険な場所（川など）に近づかない",
          "落ち着いて行動する",
        ] 
      },
      {
        title: "準備",
        keywords: [
          "備蓄・防災グッズを準備・携帯する",
          "ハザードマップを確認する",
          "防災について家族・近隣の人と話し合う"
        ]
      },
    ];

    // 4.キーワードボタンのHTMLを3カラムで生成
    let buttonsHTML = '<div class="action-columns-container">';
    actionCategories.forEach(category => {
      // 1列分のHTML
      buttonsHTML += `<div class="action-column">`;
      buttonsHTML +=   `<h4 class="action-category-title">${category.title}</h4>`;
      buttonsHTML +=   `<div class="action-column-buttons">`;
      
      category.keywords.forEach(keyword => {
        buttonsHTML += `<button class="emotion-button action-keyword">${keyword}</button>`;
      });
      
      buttonsHTML +=   `</div>`; // .action-column-buttons
      buttonsHTML += `</div>`; // .action-column
    });
    buttonsHTML += '</div>'; // .action-columns-container
    
    // 5.危険の要約（サマリー）を作成
    let dangerSummary = "（危険の解説はありません）";
    if (featureAttributes.Mabling && featureAttributes.Mabling.length > 0) {
      dangerSummary = featureAttributes.Mabling;
    }

    interactionPanel.innerHTML = `
      <div class="panel-column-right">
        
        <p>アート作品は、<b>切り抜き（コラージュ）</b>で「防災行動」を表現しています。</p>

        <div class="related-danger-summary" style="margin-bottom: 15px;">
          <strong>解説にあった危険:</strong> ${dangerSummary}
        </div>
        
        <div class="guide-task-prompt">
          <p>
            この危険に対して、当てはまる行動を下の選択肢から選んでください。<br>
            <span style="font-size: 0.9em; color: #555;">※選択すると次に進めます。</span>
          </p>
        </div>
        
        ${buttonsHTML}
      </div>
    `;

    // 6.パネルを一番上までスクロール
    interactionPanel.scrollTop = 0; 

    // 7.「次へ」ボタンを無効化
    nextButton.disabled = true;
    nextButton.textContent = "「防災行動」の解説を見る →";

    // 8.キーワードボタンにイベントリスナーを追加
    document.querySelectorAll('.action-keyword').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.action-keyword').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
        nextButton.disabled = false;
      }, { once: false });
    });
  }

  // Step 4: 行動の解説を表示
  function showStep4_ActionExplanation() {
    instructionTitle.textContent = "作者が考えた「防災行動」を見てみましょう！";

    // 1.パネルのスタイルを変更
    interactionPanel.classList.add("expanded-explanation");
    interactionPanel.classList.add("pika-pika");

    // 2.解説文の準備
    let dangerSummary = "（危険の解説はありません）";
    if (featureAttributes.Mabling && featureAttributes.Mabling.length > 0) {
      dangerSummary = featureAttributes.Mabling;
    }
    const collageText = featureAttributes.collage || "（行動の解説はありません）";
    
    // 3.パネルの中身をセット
    interactionPanel.innerHTML = `
      <div class="explanation-panel">
        <h3 class="panel-header">「防災行動」の解説</h3>
        <div class="related-danger-summary">
          <strong>関連する危険:</strong> ${dangerSummary}
        </div>
        <h4>住民目線の行動（コラージュ解説）</h4>
        <p>${collageText}</p>
      </div>
    `;
    
    // 4.ボタンのテキストを更新
    nextButton.textContent = "作者の想いを見る →";
  }

  // Step 5: 共感（メッセージ）
  function showStep5_AuthorMessage() {

    // 1.パネルのスタイルを変更
    interactionPanel.classList.add("expanded-explanation", "pika-pika", "expanded");

    // 2.左カラムをリセット
    leftColumn.innerHTML = '';

    // 3.メインボタン(wrapper)を確実に表示
    buttonWrapper.style.display = 'flex';

    // 4.メインボタンのテキストを更新
    backToTopButton.textContent = "← 前のステップに戻る";
    nextButton.textContent = "周辺の作品を見る →";
    nextButton.disabled = false;

    // 5.レイアウトをリセット
    rightColumn.innerHTML = ''; 
    rightColumn.appendChild(interactionPanel); 
    rightColumn.appendChild(mapPanel); 
    interactionPanel.style.display = 'block'; 

    // 6.左カラムのアートと情報を再表示
    artworkInfo.style.display = 'block';
    artPanel.style.display = 'flex';
    leftColumn.appendChild(artworkInfo);
    leftColumn.appendChild(artPanel);

    // 7.タイトルと解説をセット
    instructionTitle.textContent = "作者からのメッセージと解説のまとめ";
    
    const messageText = featureAttributes.Message || "（メッセージはありません）";
    const authorText = featureAttributes.field_25 || "（作者情報はありません）";
    const mablingText = featureAttributes.Mabling || "（危険の解説はありません）";
    const collageText = featureAttributes.collage || "（行動の解説はありません）";

    const explanationHTML = `<div class="explanation-panel">
        
    <h4>作者からのメッセージ</h4>
        <p class="step5-message-highlight">
          ${messageText}
        </p>
        <h4 style="margin-top: 20px;">アート作品の解説</h4>
        <div class="step5-flow-box">
          <p class="step5-flow-danger">
            <strong>【危険 (マーブリング)】</strong><br>
            ${mablingText}
          </p>
          
          <div class="step5-flow-arrow">⬇️</div> 
          
          <p class="step5-flow-action">
            <strong>【防災行動 (コラージュ)】</strong><br>
            ${collageText}
          </p>
        </div>
      </div>`;
    interactionPanel.innerHTML = explanationHTML;
    
    // 9. パネルを一番上までスクロール
    interactionPanel.scrollTop = 0; 
  }

  // step 6: 周辺の作品を表示する
  // 配列をシャッフルする関数
  function shuffle(array) {
      let currentIndex = array.length, randomIndex;
      while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
          array[randomIndex], array[currentIndex]];
      }
      return array;
    }

  // 周辺の作品を表示する
  function showStep6_NearbyWorks() {

    // Step 6 に到達したら、この作品を「鑑賞済み」として記録する
    try {
      const viewedIds = JSON.parse(localStorage.getItem("viewedArtIds")) || [];
      if (!viewedIds.includes(objectId)) {
        viewedIds.push(objectId);
        localStorage.setItem("viewedArtIds", JSON.stringify(viewedIds));
      }
    } catch (e) {
    }

    instructionTitle.textContent = "周辺の作品を見てみましょう";
    interactionPanel.style.display = 'none'; // 右下のパネルは非表示

    // メインボタン(wrapper)を確実に表示する
    buttonWrapper.style.display = 'flex';
    
    // メインボタンのテキストを更新
    backToTopButton.textContent = "解説に戻る";
    nextButton.textContent = "マップに戻る →";
    nextButton.disabled = false;
    
    // 左カラムにローディング表示
    leftColumn.innerHTML = '<p style="text-align: center; margin-top: 20px;">周辺の作品を検索中...</p>'; 

    artPinsLayer.queryFeatures({
      geometry: originalFeature.geometry, 
      distance: 5, 
      units: "kilometers",
      where: `objectid <> ${objectId}`, 
      outFields: ["*"]
    }).then(nearbyResults => {

      // 1. 取得したフィーチャをシャッフル
      const shuffledFeatures = shuffle(nearbyResults.features); 
      // 2. シャッフルした中から最大4件を取得
      const randomNearbyFeatures = shuffledFeatures.slice(0, 4); 
      const allFeatures = [originalFeature].concat(randomNearbyFeatures);
      view.goTo(allFeatures); 

      // マップに推奨作品(最大4+1件)だけ表示する
      const nearbyIds = randomNearbyFeatures.map(f => f.attributes.objectid); // ★ 変更
      const allVisibleIds = [objectId].concat(nearbyIds); 
      const definitionExpression = `objectid IN (${allVisibleIds.join(',')})`;

      const artPinsLayerOnMap = webmap.allLayers.find(layer => layer.title === "survey");
      if (artPinsLayerOnMap) {
        artPinsLayerOnMap.definitionExpression = definitionExpression; 
        artPinsLayerOnMap.popupEnabled = false; 
      }

      // 鑑賞済みのピンを地図上で区別する (FeatureEffect)
      const viewedIds = JSON.parse(localStorage.getItem("viewedArtIds")) || [];
      const viewedNearbyIds = viewedIds.filter(id => allVisibleIds.includes(id) && id !== objectId); 

      if (viewedNearbyIds.length > 0) {
        view.featureEffect = {
          filter: { where: `objectid IN (${viewedNearbyIds.join(',')})` },
          includedEffect: "opacity(40%) grayscale(80%)", 
          excludedEffect: "opacity(100%)"
        };
      } else {
        view.featureEffect = null; 
      }
      
      if (randomNearbyFeatures.length > 0) {
        // 1. 画像を取得する「試み」
        artPinsLayer.queryAttachments({ 
          objectIds: randomNearbyFeatures.map(f => f.attributes.objectid)
        }).then(attachmentsMap => {
          // 2A. 画像取得に「成功」した場合
          displayNearbyWorks(randomNearbyFeatures, attachmentsMap);
        }).catch(err => {
          // 2B. 画像取得に「失敗」した場合
          displayNearbyWorks(randomNearbyFeatures, {});
        });

      } else {
        // 3. 周辺に作品が「0件」だった場合
        displayNearbyWorks_NoResults();
      }
    }).catch(err => {
      // 4. 周辺作品の「検索自体」に失敗した場合
      leftColumn.innerHTML = `<div class="list-wrapper-left">
          <p class="no-nearby-works">エラー: 周辺の作品を読み込めませんでした。</p>
        </div>`;
    });
  }
        
  // 周辺の作品リスト
  function displayNearbyWorks(features, attachmentsMap) {
    let nearbyWorksHTML = '<div class="list-wrapper-left">';
    nearbyWorksHTML += '<div class="nearby-works-grid">';

    const viewedIds = JSON.parse(localStorage.getItem("viewedArtIds")) || [];

    features.forEach(nearbyFeature => {
      const nearbyId = nearbyFeature.attributes.objectid;
      const attachments = attachmentsMap[nearbyId] || []; 
      const imageUrl = (attachments.length > 0) ? attachments[0].url : "";
      const author = nearbyFeature.attributes.field_25 || "（作者情報なし）"; 
      const isViewed = viewedIds.includes(nearbyId);

      const viewedClass = isViewed ? ' viewed' : '';
      const viewedLabel = isViewed ? `<span class="viewed-label">鑑賞済み</span>` : '';

      nearbyWorksHTML += `
        <div class="nearby-work-grid-item${viewedClass}" data-objectid="${nearbyId}">
          <img src="${imageUrl}" alt="アート作品${imageUrl ? '' : '（画像なし）'}">
          <div class="nearby-work-info">
            <p class="nearby-author">作者: ${author}</p>
            ${viewedLabel}
            
            <a href="detail.html?id=${nearbyId}&from=${objectId}" class="nearby-work-detail-link">
              この作品を見る ▷
            </a>
          </div>
        </div>`;
    });
    nearbyWorksHTML += '</div></div>';
    leftColumn.innerHTML = nearbyWorksHTML;

    // タップでハイライト
    document.querySelectorAll('.nearby-work-grid-item').forEach(item => {
      item.addEventListener('click', () => {

       const clickedId = parseInt(item.dataset.objectid, 10);
        
        // 1. 他のグリッドの選択を解除
        document.querySelectorAll('.nearby-work-grid-item').forEach(i => i.classList.remove('selected'));
        // 2. このグリッドを選択状態にする
        item.classList.add('selected');

        // 3. 対応する作品データを探す
        const targetFeature = features.find(f => f.attributes.objectid === clickedId);
  
        if (targetFeature) {
          
          // 4. マップ上のピンをハイライト
          const artPinsLayerOnMap = webmap.allLayers.find(layer => layer.title === "survey");
      
          // 以前のハイライトを消す
          if (currentHighlight) {
            currentHighlight.remove();
            currentHighlight = null;
          }
          
          // 新しいピンをハイライト
          if (artPinsLayerOnMap) {
            
            // レイヤーからレイヤービューを取得する
            view.whenLayerView(artPinsLayerOnMap).then((layerView) => {

              // layerView に対して highlight を実行
              currentHighlight = layerView.highlight(targetFeature); 

            }).catch((error) => {
              console.error("レイヤービューの取得に失敗:", error);
            });
            
          } else {
            console.error("ハイライト対象のレイヤーが見つかりません！");
          }
        }
      });
    });
    
    document.querySelectorAll('.nearby-work-detail-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.stopPropagation(); 
      });
    });
  }
});
});