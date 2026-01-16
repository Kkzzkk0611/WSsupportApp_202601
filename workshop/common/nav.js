// workshop/common/nav.js
// ★★★ 改修版：体験ページ用ステップインジケーター対応 ★★★
(function () {
  // 各ページで window.WS_STEP を定義しておく
  var S = window.WS_STEP || { index: 0, total: 1, title: '', next: null };
  
  // ★★★ 新規追加：体験ページ表示制御 ★★★
  // showHeader が false の場合はヘッダー自体を表示しない（ミッション/導入ページ用）
  S.showHeader = S.showHeader !== false; // デフォルトは true（下位互換性維持）
  
  // ★★★ 新規追加：体験フロー情報 ★★★
  // 体験ページで使用する進捗表示用の設定
  S.flow = S.flow || null; // { current: 2, total: 4, labels: ['ハザードマップ', 'マーブリング', ...] }
  
  // 既存オプションのデフォルト
  S.hideBack  = S.hideBack === true;
  S.nextLabel = (typeof S.nextLabel === 'string' && S.nextLabel.trim()) ? S.nextLabel : null;

  // ★★★ タイマー機能は完全削除 ★★★
  // （要件：タイマーは不要のため、関連コードを削除）

  // ★★★ showHeader が false の場合はここで終了（ヘッダーを生成しない） ★★★
  if (!S.showHeader) {
    console.log('[nav.js] showHeader=false のためヘッダーを非表示');
    return; // ヘッダーを作らず終了
  }

  // --- ヘッダー生成 ---
  var header = document.createElement('header');
  header.className = 'ws-header';
  
  // ボタンHTML準備
  var backBtnHtml = S.hideBack ? '' : '<button class="btn" id="backBtn">◀ 前のセクションに戻る</button>';
  var nextText    = S.nextLabel ? S.nextLabel : '次のセクションへ ▶';
  var nextBtnHtml = S.next ? ('<button class="btn accent" id="nextBtn">' + nextText + '</button>') : '';
  // ★ 追加：地図ボタン（mapUrl があるページだけ表示）
var mapBtnHtml = S.mapUrl
  ? '<button class="btn" id="mapBtn">🗺 地図</button>'
  : '';


  // ★★★ 体験ページ用：ステップインジケーターHTML生成 ★★★
  var stepperHtml = '';
  if (S.flow && S.flow.total > 0) {
    var dots = [];
    for (var i = 1; i <= S.flow.total; i++) {
      var isDone = i <= S.flow.current;
      var label = S.flow.labels && S.flow.labels[i-1] ? S.flow.labels[i-1] : ('体験' + i);
      dots.push(
        '<div class="ws-stepper__item ' + (isDone ? 'done' : '') + '" title="' + label + '">' +
          '<div class="ws-stepper__dot">' + (isDone ? '●' : '○') + '</div>' +
          '<div class="ws-stepper__label">' + label + '</div>' +
        '</div>'
      );
    }
    stepperHtml = '<div class="ws-stepper">' + dots.join('') + '</div>';
  }

  // ★★★ ヘッダー構造（体験ページ版） ★★★
  // 左：現在の体験名（タイトル）
  // 中央：ステップインジケーター
  // 右：戻る・次へボタンのみ（説明・地図・ワークシートボタンは表示しない）
  header.innerHTML =
    '<div class="left">' + (S.title || '') + '</div>' +
    '<div class="center">' + stepperHtml + '</div>' +
    '<div class="right">' +
      mapBtnHtml +
      backBtnHtml +
      nextBtnHtml +
    '</div>';

  document.body.prepend(header);

  // ★★★ 説明オーバーレイ（Missionポップアップ）は完全削除 ★★★
  // （要件：Missionポップアップは不要のため削除）

  // ★★★ お知らせ機能は維持（必要に応じて） ★★★
  if (S.notice) {
    var onceOkay = !(S.notice.onceKey && localStorage.getItem(S.notice.onceKey));
    var needBtn  = S.notice.showButton !== false;
    var autoOpen = S.notice.autoOpen !== false && onceOkay;

    if (needBtn) {
      var right = header.querySelector('.right');
      var nbtn = document.createElement('button');
      nbtn.className = 'btn';
      nbtn.id = 'noticeBtn';
      nbtn.textContent = '🔔 お知らせ';
      right.insertBefore(nbtn, right.firstChild);
    }

    var nlay = document.createElement('div');
    nlay.className = 'help-overlay';
    nlay.innerHTML =
      '<div class="help-card">' +
        '<h2>' + (S.notice.title || 'お知らせ') + '</h2>' +
        '<div class="content">' + (S.notice.message || '') + '</div>' +
        '<div class="actions" id="noticeActions"></div>' +
      '</div>';
    document.body.appendChild(nlay);

    function openNotice(){
      nlay.style.display = 'grid';
      if (S.notice.onceKey) localStorage.setItem(S.notice.onceKey, 'shown');
    }
    function closeNotice(){ nlay.style.display = 'none'; }

    var actWrap = nlay.querySelector('#noticeActions');
    var acts = S.notice.actions || [{ label:'閉じる', type:'close' }];
    acts.forEach(function(a){
      var b = document.createElement('button');
      b.className = 'btn' + (a.accent ? ' accent' : '');
      b.textContent = a.label || 'OK';
      b.addEventListener('click', function(){
        if (a.type === 'close') { closeNotice(); return; }
        if (a.type === 'next')  { var nb = document.getElementById('nextBtn'); if (nb) nb.click(); closeNotice(); return; }
        if (a.href) { location.href = a.href; return; }
        closeNotice();
      });
      actWrap.appendChild(b);
    });

    var nbtnEl = document.getElementById('noticeBtn');
    if (nbtnEl) nbtnEl.addEventListener('click', openNotice);
    if (autoOpen) openNotice();
  }

  // ★★★ 地図・ワークシートパネルは維持（体験ページでは使わないが、他ページ用に残す） ★★★
  if (S.mapUrl) {
    var mapPanel = document.createElement('aside');
    mapPanel.className = 'panel';
    mapPanel.id = 'mapPanel';
    mapPanel.innerHTML =
      '<header><div>ハザードマップ</div><button id="mapClose" class="btn">×</button></header>' +
      '<div class="body"><iframe src="' + S.mapUrl + '" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe></div>';
    document.body.appendChild(mapPanel);
    var mapBtn = document.getElementById('mapBtn');
    if (mapBtn) mapBtn.addEventListener('click', function(){ mapPanel.classList.add('open'); });
    var mapClose = document.getElementById('mapClose');
    if (mapClose) mapClose.addEventListener('click', function(){ mapPanel.classList.remove('open'); });
  }

  if (S.surveyUrl) {
    var sheet = document.createElement('aside');
    sheet.className = 'panel';
    sheet.id = 'sheetPanel';
    sheet.innerHTML =
      '<header><div>ワークシート</div><button id="sheetClose" class="btn">×</button></header>' +
      '<div class="body"><iframe src="' + S.surveyUrl + '" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe></div>' +
      '<div class="footer" style="display:flex;gap:8px;align-items:center;">' +
        (S.surveyHint ? '<div style="font-size:.9rem;opacity:.8;">' + S.surveyHint + '</div>' : '') +
        '<span style="flex:1"></span>' +
      '</div>';
    document.body.appendChild(sheet);

    var sheetBtn = document.getElementById('sheetBtn');
    if (sheetBtn) sheetBtn.addEventListener('click', function(){ sheet.classList.add('open'); });
    var sheetClose = document.getElementById('sheetClose');
    if (sheetClose) sheetClose.addEventListener('click', function(){ sheet.classList.remove('open'); });
  }

  // --- 次へボタン（マーブリング・コラージュページで保存確認バナー付き） ---
  document.addEventListener('click', function (ev) {
    var nextBtn = ev.target.closest('#nextBtn');
    if (!nextBtn) return;

    var currentPath = location.pathname || '';
    var isMarblingPage = currentPath.includes('/marbling/');
    var isCollagePage  = currentPath.includes('/collage/');
    var showBanner = isMarblingPage || isCollagePage;

    // 該当ページ以外 → 通常遷移
    if (!showBanner) {
      if (S.next) location.href = S.next;
      return;
    }

    // 該当ページ：保存確認バナーを表示
    ev.preventDefault();
    ev.stopPropagation();

    if (document.getElementById('save-confirm-banner')) return;

    var banner = document.createElement('div');
    banner.id = 'save-confirm-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      background: #facc15;
      color: #111;
      font-weight: bold;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      z-index: 9999;
    `;

    banner.innerHTML = `
      <span>⚠️ 作品を保存しましたか？</span>
      <button id="confirmYes" style="padding:6px 12px;background:#16a34a;color:#fff;border:none;border-radius:6px;cursor:pointer;">はい</button>
      <button id="confirmNo" style="padding:6px 12px;background:#fff;color:#111;border:1px solid #111;border-radius:6px;cursor:pointer;">いいえ</button>
    `;

    document.body.appendChild(banner);

    document.getElementById('confirmYes').addEventListener('click', function() {
      banner.remove();
      if (S.next) location.href = S.next;
    });

    document.getElementById('confirmNo').addEventListener('click', function() {
      banner.remove();
    });
  });

  // --- 戻るボタン ---
  var backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.addEventListener('click', function(){
    if (S.prev) {
      location.href = S.prev;
      return;
    }
    if (document.referrer) {
      history.back();
      return;
    }
    var here = location.pathname.replace(/\/+$/,'');
    location.href = here.substring(0, here.lastIndexOf('/')) || '/';
  });

  // --- キーボードショートカット ---
  var nextBtn = document.getElementById('nextBtn');
  window.addEventListener('keydown', function(ev){
    if (ev.key === 'ArrowLeft' && backBtn) { backBtn.click(); }
    if (ev.key === 'ArrowRight' && nextBtn) { nextBtn.click(); }
  });

})();
