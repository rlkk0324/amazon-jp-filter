// 日本メーカーフィルター — Amazon の検索結果で日本メーカー品を強調する拡張機能の本体
// ON/OFF と表示方法（薄く表示 / 非表示）はツールバーアイコンの設定パネルから切り替える。
// 設定は chrome.storage.local に保存し、変更を監視して即座に反映する。

(function () {
  'use strict';

  // ===== 既定の設定 ===============================================
  const DEFAULTS = { enabled: true, mode: 'badge' }; // mode: 'badge'（薄く表示＋印） / 'hide'（非表示）
  let enabled = DEFAULTS.enabled;
  let mode = DEFAULTS.mode;

  const DIM_OPACITY = '0.3';           // 薄く表示するときの濃さ（0=透明〜1=通常）
  const OBSERVER_DEBOUNCE_MS = 300;    // 画面更新時に再判定するまでの待ち時間
  const PROCESSED_FLAG = 'yamatoFilterDone'; // 二重処理を防ぐ目印（dataset キー）

  // ===== 日本メーカー判定（共有モジュール） ========================
  // 判定ロジック本体と JP_MAKERS 辞書は maker-match.js に切り出し、Node テストと共有する。
  // manifest の content_scripts で maker-match.js → content.js の順に読み込むこと。
  const makerMatch = (typeof self !== 'undefined' && self.JpMakerMatch) || null;
  if (!makerMatch) {
    // ここに来るのは maker-match.js の読み込み順序が崩れたときだけ（通常は起きない）。
    console.error('[日本メーカーフィルター] maker-match.js が読み込まれていません');
    return;
  }
  const isJapaneseMaker = makerMatch.isJapaneseMaker;

  // Amazon が日本企業応援として一部商品に付ける公式ラベル「日本の中小企業」。
  // リストに無いメーカーでも、これがあれば日本企業として扱う（取りこぼし対策）。
  const SME_LABEL_TEXT = '日本の中小企業';
  const hasJapaneseSmeLabel = (card) => (card.textContent || '').includes(SME_LABEL_TEXT);

  // ===== バッジ・スタイル ==========================================
  const BADGE_CLASS = 'yamato-jp-badge';
  const badgeStyle = document.createElement('style');
  badgeStyle.textContent = `
    .${BADGE_CLASS} {
      display: inline-block;
      margin: 0 6px 4px 0;
      padding: 1px 6px;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.4;
      color: #b00;
      border: 1px solid #b00;
      border-radius: 4px;
      background: #fff5f5;
      vertical-align: middle;
    }
  `;
  document.head.appendChild(badgeStyle);

  const addBadge = (item, labelText) => {
    const titleHeading = item.querySelector('h2');
    if (!titleHeading || titleHeading.querySelector('.' + BADGE_CLASS)) return;
    const badge = document.createElement('span');
    badge.className = BADGE_CLASS;
    badge.textContent = labelText;
    titleHeading.insertBefore(badge, titleHeading.firstChild);
  };

  // ===== 1商品の見た目を更新 ======================================
  const applyToItem = (item) => {
    const titleHeading = item.querySelector('h2');
    if (!titleHeading) return; // 見出しが無い枠（区切り等）は対象外

    // いったん装飾を初期化（前回のバッジを消してからタイトルを読む）
    item.style.opacity = '';
    item.style.display = '';
    const existingBadge = titleHeading.querySelector('.' + BADGE_CLASS);
    if (existingBadge) existingBadge.remove();

    if (!enabled) return; // OFF のときは素のAmazon表示

    const title = titleHeading.textContent || '';
    const matchedMaker = isJapaneseMaker(title);
    const matchedSme = hasJapaneseSmeLabel(item); // Amazon公式「日本の中小企業」ラベル

    if (matchedMaker || matchedSme) {
      if (mode === 'badge') addBadge(item, matchedMaker ? '日本メーカー' : '日本の企業');
      return;
    }
    // 日本企業と判定できないもの
    if (mode === 'hide') {
      item.style.display = 'none';
    } else {
      item.style.opacity = DIM_OPACITY;
    }
  };

  // ===== おすすめカルーセル（よく一緒に購入・関連商品 等） =================
  // 検索結果と違い、バッジ・非表示は行わず「薄く表示」だけにする
  // （横スクロールのカルーセルは非表示にすると隙間が空いて崩れるため）。
  // カルーセル/おすすめ枠のカードは複数系統ある：
  //   li.a-carousel-card             … 「よく一緒に購入」「チェックした人は…」等
  //   div[data-csa-c-type=item]      … 検索ページ等の新しい推薦枠（検索結果内部にも使われる）
  //   div.p13n-sc-uncoverable-faceout… RHF（閲覧履歴）「よく閲覧される商品」等のタイル
  // 検索結果内部や入れ子は後段で除外する。
  const CAROUSEL_CARD_SELECTOR =
    'li.a-carousel-card, div[data-csa-c-type="item"], div.p13n-sc-uncoverable-faceout';

  const getCarouselTitle = (card) => {
    const img = card.querySelector('img[alt]');
    const alt = img ? (img.getAttribute('alt') || '').trim() : '';
    if (alt.length > 4) return alt; // 商品名はだいたい画像の alt に入っている
    const linkWithTitle = card.querySelector('a[title]');
    return linkWithTitle ? (linkWithTitle.getAttribute('title') || '').trim() : '';
  };

  const applyToCarouselCard = (card) => {
    // メインの検索結果は別処理（バッジ/非表示）なので触らない
    if (card.closest('div[data-component-type="s-search-result"]')) return;
    // カードが入れ子のときは外側だけ処理（二重に薄くしない）
    if (card.parentElement && card.parentElement.closest(CAROUSEL_CARD_SELECTOR)) return;

    // 商品カードだけを対象にする（バナー・画像ギャラリー等は触らない）
    const isProductCard = card.querySelector('a[href*="/dp/"], a[href*="/gp/product"]');
    const title = getCarouselTitle(card);
    if (!isProductCard || !title) return;

    card.style.opacity = ''; // いったん戻してから判定を反映
    if (!enabled) return;
    if (!isJapaneseMaker(title) && !hasJapaneseSmeLabel(card)) card.style.opacity = DIM_OPACITY; // 日本企業以外だけ薄く
  };

  const processAll = () => {
    document.querySelectorAll('div[data-component-type="s-search-result"]').forEach((item) => {
      item.dataset[PROCESSED_FLAG] = '1';
      applyToItem(item);
    });
    document.querySelectorAll(CAROUSEL_CARD_SELECTOR).forEach(applyToCarouselCard);
  };

  // ===== 画面更新（ページ送り・遅延読み込み）に追従 ================
  let debounceTimer = null;
  const scheduleProcess = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processAll, OBSERVER_DEBOUNCE_MS);
  };

  const observer = new MutationObserver(scheduleProcess);
  observer.observe(document.body, { childList: true, subtree: true });

  // ===== 設定パネル（popup）との連携 ==============================
  // 保存済み設定を読み込んでから初回反映。以後の変更は監視して即時反映する。
  chrome.storage.local.get(DEFAULTS, (stored) => {
    enabled = stored.enabled;
    mode = stored.mode;
    processAll();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.enabled) enabled = changes.enabled.newValue;
    if (changes.mode) mode = changes.mode.newValue;
    processAll();
  });

  // ===== 初回実行（設定読込前でも既定値で一度反映） ===============
  processAll();
})();
