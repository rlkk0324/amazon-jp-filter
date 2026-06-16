// ==UserScript==
// @name         日本メーカーフィルター
// @namespace    local.yamato-filter
// @version      1.0.1
// @description  amazon.co.jp の検索結果で日本メーカーの製品に🇯🇵バッジを付け、それ以外を薄く表示する（自分用）
// @match        *://www.amazon.co.jp/*
// @match        *://amazon.co.jp/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ===== 設定 =====================================================
  // 'badge' : 日本メーカー品にバッジを付け、それ以外を薄く表示する
  // 'hide'  : 日本メーカー以外を検索結果から消す
  const MODE = 'badge';

  const DIM_OPACITY = '0.3';           // 薄く表示するときの濃さ（0=透明〜1=通常）
  const OBSERVER_DEBOUNCE_MS = 300;    // 画面更新時に再判定するまでの待ち時間
  const PROCESSED_FLAG = 'yamatoFilterDone'; // 二重処理を防ぐ目印（dataset キー）

  // ===== 日本メーカー定義 ==========================================
  // jp: カナ・漢字表記（タイトルに「含まれていれば」一致と見なす）
  // en: 英字表記（タイトル中で「独立した単語として」一致したときだけ採用）
  //   ※ 英字は単語境界で照合するため connect の中の "nec" 等には誤反応しない。
  //   ※ "mouse" "final" 等のありふれた英単語は誤検出が多いため英字照合に入れていない。
  // リストはここに足す・消すだけで調整できる。
  const JP_MAKERS = [
    { jp: ['ソニー'], en: ['SONY', 'WALKMAN', 'BRAVIA'] },
    { jp: ['パナソニック'], en: ['Panasonic'] },
    { jp: ['シャープ'], en: ['SHARP'] },
    { jp: ['東芝', 'レグザ'], en: ['TOSHIBA', 'REGZA', 'dynabook'] },
    { jp: ['日立'], en: ['HITACHI'] },
    { jp: ['三菱電機', '三菱'], en: [] },
    { jp: ['富士通'], en: ['FUJITSU', 'FMV'] },
    { jp: ['エヌイーシー'], en: ['NEC', 'LAVIE'] },
    { jp: ['ジェイブイシーケンウッド', 'ケンウッド', 'ビクター'], en: ['JVC', 'Kenwood'] },
    { jp: ['パイオニア'], en: ['Pioneer'] },
    { jp: ['オンキヨー', 'オンキョー'], en: ['ONKYO'] },
    { jp: ['デノン'], en: ['DENON'] },
    { jp: ['マランツ'], en: ['Marantz'] },
    { jp: ['ヤマハ'], en: ['YAMAHA'] },
    { jp: ['オーディオテクニカ', 'オーディオ テクニカ'], en: ['audio-technica'] },
    { jp: ['ローランド'], en: ['Roland'] },
    { jp: ['コルグ'], en: ['KORG'] },
    { jp: ['ティアック'], en: ['TEAC'] },
    { jp: ['フォステクス'], en: ['FOSTEX'] },
    { jp: ['キヤノン', 'キャノン'], en: ['Canon'] },
    { jp: ['ニコン'], en: ['Nikon'] },
    { jp: ['富士フイルム', '富士フィルム'], en: ['FUJIFILM'] },
    { jp: ['リコー'], en: ['RICOH'] },
    { jp: ['ペンタックス'], en: ['PENTAX'] },
    { jp: ['オリンパス'], en: ['OLYMPUS', 'OM SYSTEM'] },
    { jp: ['シグマ'], en: ['SIGMA'] },
    { jp: ['タムロン'], en: ['TAMRON'] },
    { jp: ['ケンコー'], en: ['Kenko'] },
    { jp: ['カシオ'], en: ['CASIO'] },
    { jp: ['セイコー'], en: ['SEIKO'] },
    { jp: ['シチズン'], en: ['CITIZEN'] },
    { jp: ['エレコム'], en: ['ELECOM'] },
    { jp: ['バッファロー'], en: ['BUFFALO'] },
    { jp: ['アイオーデータ', 'アイ・オー・データ'], en: ['IODATA', 'I-O DATA'] },
    { jp: ['サンワサプライ', 'サンワ'], en: [] },
    { jp: ['ロジテック'], en: ['Logitec'] }, // 日本のロジテック（スイスの Logitech とは別会社）
    { jp: ['エプソン', 'セイコーエプソン'], en: ['EPSON'] },
    { jp: ['ブラザー'], en: ['brother'] },
    { jp: ['京セラ'], en: ['KYOCERA'] },
    { jp: ['アイリスオーヤマ'], en: ['IRIS OHYAMA', 'IRIS'] },
    { jp: ['象印', 'ゾウジルシ'], en: ['ZOJIRUSHI'] },
    { jp: ['タイガー魔法瓶', 'タイガー'], en: ['TIGER'] },
    { jp: ['ツインバード'], en: ['TWINBIRD'] },
    { jp: ['バルミューダ'], en: ['BALMUDA'] },
    { jp: ['山善'], en: ['YAMAZEN'] },
    { jp: ['コイズミ'], en: ['KOIZUMI'] },
    { jp: ['テスコム'], en: ['TESCOM'] },
    { jp: ['シロカ'], en: ['siroca'] },
    { jp: ['ドウシシャ'], en: [] },
    { jp: ['リズム(RHYTHM)', 'リズム(Rhythm)', 'リズム時計'], en: [] }, // 「リズム」単体は音楽系に誤反応するため正確形で照合
    { jp: ['フランフラン', 'Francfranc'], en: [] },
    { jp: ['マクセル'], en: ['maxell'] },
    { jp: ['村田製作所'], en: ['Murata'] },
    { jp: ['ティーディーケイ'], en: ['TDK'] },
    { jp: ['任天堂'], en: ['Nintendo'] },
  ];

  // ===== 照合用の正規表現を事前構築 ================================
  const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const japanesePatterns = JP_MAKERS.flatMap((maker) => maker.jp).map(escapeRegExp);
  const englishPatterns = JP_MAKERS.flatMap((maker) => maker.en).map(escapeRegExp);

  // 漢字・カナは部分一致。英字は前後が単語境界のときだけ一致。
  const japaneseRegex = japanesePatterns.length
    ? new RegExp(japanesePatterns.join('|'))
    : null;
  const englishRegex = englishPatterns.length
    ? new RegExp('(?:^|[^A-Za-z0-9])(?:' + englishPatterns.join('|') + ')(?![A-Za-z0-9])', 'i')
    : null;

  const isJapaneseMaker = (title) => {
    if (japaneseRegex && japaneseRegex.test(title)) return true;
    if (englishRegex && englishRegex.test(title)) return true;
    return false;
  };

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

  const addBadge = (item) => {
    const titleHeading = item.querySelector('h2');
    if (!titleHeading || titleHeading.querySelector('.' + BADGE_CLASS)) return;
    const badge = document.createElement('span');
    badge.className = BADGE_CLASS;
    badge.textContent = '🇯🇵 日本メーカー';
    titleHeading.insertBefore(badge, titleHeading.firstChild);
  };

  // ===== 1商品の見た目を更新 ======================================
  let filteringEnabled = true; // 画面右下のボタンで一時的に切り替えられる

  const applyToItem = (item) => {
    const titleHeading = item.querySelector('h2');
    if (!titleHeading) return; // 見出しが無い枠（区切り等）は対象外
    const title = titleHeading.textContent || '';
    const matched = isJapaneseMaker(title);

    // いったん装飾を初期化してから状態を反映する（再判定で矛盾しないように）
    item.style.opacity = '';
    item.style.display = '';
    const existingBadge = titleHeading.querySelector('.' + BADGE_CLASS);
    if (existingBadge) existingBadge.remove();

    if (!filteringEnabled) return; // フィルタ無効中は素のAmazon表示

    if (matched) {
      if (MODE === 'badge') addBadge(item);
      return;
    }
    // 日本メーカー以外
    if (MODE === 'hide') {
      item.style.display = 'none';
    } else {
      item.style.opacity = DIM_OPACITY;
    }
  };

  const processAll = () => {
    const items = document.querySelectorAll('div[data-component-type="s-search-result"]');
    if (items.length > 0) ensureToggleButton(); // 検索結果があるページ（＝検索結果ページ）でだけボタンを出す
    items.forEach((item) => {
      item.dataset[PROCESSED_FLAG] = '1';
      applyToItem(item);
    });
  };

  // ===== 画面更新（ページ送り・遅延読み込み）に追従 ================
  let debounceTimer = null;
  const scheduleProcess = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processAll, OBSERVER_DEBOUNCE_MS);
  };

  const observer = new MutationObserver(scheduleProcess);
  observer.observe(document.body, { childList: true, subtree: true });

  // ===== 右下のON/OFFボタン（検索結果ページにだけ表示） ===========
  const TOGGLE_ON_LABEL = '🇯🇵 日本メーカー強調：ON';
  const TOGGLE_OFF_LABEL = '🇯🇵 日本メーカー強調：OFF';
  let toggleButton = null; // 関数宣言は巻き上げられるため processAll から先に呼べる

  function ensureToggleButton() {
    if (toggleButton) return; // 一度だけ作る
    toggleButton = document.createElement('button');
    toggleButton.textContent = filteringEnabled ? TOGGLE_ON_LABEL : TOGGLE_OFF_LABEL;
    toggleButton.style.cssText = [
      'position:fixed', 'right:16px', 'bottom:16px', 'z-index:99999',
      'padding:8px 12px', 'font-size:13px', 'font-weight:700',
      'color:#fff', 'background:#b00', 'border:none', 'border-radius:6px',
      'box-shadow:0 2px 6px rgba(0,0,0,0.3)', 'cursor:pointer',
    ].join(';');
    toggleButton.addEventListener('click', () => {
      filteringEnabled = !filteringEnabled;
      toggleButton.textContent = filteringEnabled ? TOGGLE_ON_LABEL : TOGGLE_OFF_LABEL;
      processAll();
    });
    document.body.appendChild(toggleButton);
  }

  // ===== 初回実行 ==================================================
  processAll();
})();
