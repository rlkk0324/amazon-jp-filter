// 日本メーカー判定の「純粋ロジック」だけを切り出した共有モジュール。
// content.js（コンテンツスクリプト）と Node のテストの両方から使う。
//   - ブラウザ：グローバル self.JpMakerMatch に公開
//   - Node    ：module.exports で公開（maker-match.test.cjs から require）
// DOM に触れる処理（バッジ付与・「日本の中小企業」ラベル判定など）は content.js 側に残す。
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // Node
  } else {
    root.JpMakerMatch = api; // ブラウザ（コンテンツスクリプトの分離ワールド）
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ===== 日本メーカー定義 ==========================================
  // 2つのカテゴリに分類：
  //   JP_MAKERS_DIRECT：日本企業（発祥・本拠地が日本）
  //   JP_MAKERS_OPERATED：日本運営ブランド（海外発祥だがデサント・ゴールドウイン等が日本で企画・販売運営）
  //
  // 各エントリ：
  //   jp: カナ・漢字表記（タイトルに「含まれていれば」一致と見なす＝部分一致）
  //   en: 英字表記（タイトル中で「独立した単語として」一致したときだけ採用）
  //   ※ 英字は単語境界で照合するため connect の中の "nec" 等には誤反応しない。
  //   ※ "mouse" "final" 等のありふれた語は誤検出が多いため、正確形で照合する。
  // リストはここに足す・消すだけで調整できる。

  const JP_MAKERS_DIRECT = [
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
    { jp: ['エイビオット'], en: ['AVIOT'] },
    { jp: ['ローランド'], en: ['Roland'] },
    { jp: ['コルグ'], en: ['KORG'] },
    { jp: ['ティアック'], en: ['TEAC'] },
    { jp: ['フォステクス'], en: ['FOSTEX'] },
    { jp: ['キヤノン', 'キャノン'], en: ['Canon'] },
    { jp: ['ニコン'], en: ['Nikon'] },
    { jp: ['富士フイルム', '富士フィルム'], en: ['FUJIFILM'] },
    { jp: [], en: ['RICOH'] }, // カナ「リコー」は「シリコーン」に部分一致し誤検出するため英字のみ
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
    { jp: ['ハリオ'], en: ['HARIO'] },
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

    // ===== 辞書拡充（誤検出ゼロ優先） ===============================
    // 方針：英字は「final / mouse / max」等のありふれた単語を避け、
    //       カナは「コロナ / グリーンハウス（＝温室）」等の衝突語を避ける。
    //       国籍が曖昧なブランド（Marantz等の外国発祥）は入れない。
    // --- AV・音響 ---
    { jp: ['ラックスマン'], en: ['LUXMAN'] },
    { jp: ['アキュフェーズ'], en: ['Accuphase'] },
    { jp: ['ラディウス'], en: [] }, // radius は英単語と衝突するためカナのみ
    { jp: ['カロッツェリア'], en: ['carrozzeria'] }, // パイオニアのカーAV
    // --- カメラ・光学 ---
    { jp: ['ハクバ'], en: ['HAKUBA'] },
    { jp: ['ベルボン'], en: ['Velbon'] },
    { jp: ['スリック'], en: ['SLIK'] },
    { jp: ['エツミ'], en: ['Etsumi'] },
    { jp: ['コシナ'], en: ['Cosina'] },
    { jp: ['ニッシン'], en: ['Nissin'] }, // ストロボ。日清食品にも当たるが両方日本企業なので可
    // --- PC・周辺機器 ---
    { jp: ['ブイエイオー'], en: ['VAIO'] },
    { jp: ['マウスコンピューター'], en: ['mouse computer'] }, // 単語 mouse は避け二語句で照合
    { jp: ['プリンストン'], en: ['Princeton'] },
    { jp: ['センチュリー'], en: [] },
    { jp: ['アーキサイト'], en: ['ARCHISS'] },
    { jp: ['東プレ', 'リアルフォース'], en: ['REALFORCE', 'Topre'] },
    { jp: ['ダイヤテック', 'フィルコ'], en: ['FILCO'] },
    { jp: ['ナカバヤシ'], en: ['Nakabayashi'] },
    // --- 生活家電・空調・暖房 ---
    { jp: ['ダイキン'], en: ['DAIKIN'] },
    { jp: ['ダイニチ'], en: ['Dainichi'] },
    { jp: ['トヨトミ'], en: ['TOYOTOMI'] },
    { jp: ['ノーリツ'], en: ['Noritz'] },
    { jp: ['リンナイ'], en: ['Rinnai'] },
    { jp: ['パロマ'], en: [] },
    { jp: ['ニトリ'], en: [] },
    { jp: ['無印良品'], en: ['MUJI'] },
    // --- 調理・キッチン ---
    { jp: ['エブリユー'], en: ['every U.'] }, // every U.（TOKYO LM／株式会社ランテル・メディエール・東京目黒）。every 単独は頻出語のためピリオド付き正確形で照合
    { jp: ['貝印'], en: [] },
    { jp: ['パール金属'], en: [] },
    { jp: ['和平フレイズ'], en: [] },
    { jp: ['下村工業'], en: [] },
    // --- 美容・健康家電 ---
    { jp: ['ヤーマン'], en: ['YA-MAN'] },
    { jp: [], en: ['ReFa'] }, // カナ「リファ」はリファレンス等と衝突するため英字のみ
    { jp: ['サロニア'], en: ['SALONIA'] },
    { jp: ['ドリテック'], en: ['dretec'] },
    // --- 化粧品・スキンケア・ヘアケア（ドラッグストア） ---
    { jp: ['資生堂'], en: ['SHISEIDO'] },
    { jp: ['花王'], en: [] },                  // 英字 KAO はローマ字人名等と衝突しうるため漢字のみ
    { jp: ['コーセー', '雪肌精'], en: ['KOSE'] },
    { jp: ['カネボウ'], en: ['KANEBO'] },
    { jp: ['ファンケル'], en: ['FANCL'] },
    { jp: ['オルビス'], en: ['ORBIS'] },
    { jp: ['ポーラ'], en: ['POLA'] },           // POLA は polar/polaroid と単語境界で区別される
    { jp: ['ディーエイチシー'], en: ['DHC'] },
    { jp: ['マンダム'], en: ['MANDOM'] },       // 「ギャツビー」は小説名と衝突するため社名のみ
    { jp: ['ロート製薬'], en: [] },             // 「ロート」単体は漏斗(ロート)と衝突するため社名で照合
    { jp: ['クラシエ'], en: ['Kracie'] },
    // --- トイレタリー・紙・日用品 ---
    { jp: ['小林製薬'], en: [] },
    { jp: ['ユニ・チャーム', 'ユニチャーム', 'ムーニー'], en: [] }, // 「ソフィ」はソフィア等と衝突するため除外
    { jp: ['ピジョン'], en: [] },               // 英字 PIGEON は鳥と衝突するためカナのみ（ピジョンブラッドは衝突語ガードで除外）
    { jp: ['サンスター'], en: ['SUNSTAR'] },
    { jp: ['牛乳石鹸', 'カウブランド'], en: [] },
    { jp: ['シャボン玉石けん'], en: [] },
    { jp: ['エリエール', '大王製紙'], en: [] },
    { jp: ['ネピア', '王子ネピア'], en: [] },
    { jp: ['クレシア'], en: [] },               // 日本製紙クレシア。「スコッティ」は Scotty 等と衝突するため除外
    // --- 医薬・オーラル・防虫（ドラッグストア） ---
    { jp: ['アース製薬', 'モンダミン'], en: [] }, // 「アース」単体は earth と衝突するため社名/ブランドで照合
    { jp: ['フマキラー'], en: ['FUMAKILLA'] },
    { jp: ['第一三共ヘルスケア'], en: [] },
    { jp: ['大正製薬', 'リポビタン'], en: [] },
    { jp: ['龍角散'], en: [] },
    { jp: ['ツムラ'], en: [] },
    { jp: ['参天製薬'], en: [] },               // 「サンテ」はサンテグジュペリ等と衝突するため社名のみ
    // --- 電動工具・作業用品 ---
    { jp: ['マキタ'], en: ['MAKITA'] },
    { jp: ['ハイコーキ', '工機ホールディングス'], en: ['HiKOKI'] },
    { jp: ['リョービ'], en: ['RYOBI'] },
    { jp: ['ベッセル'], en: [] },
    { jp: ['トラスコ'], en: ['TRUSCO'] },
    { jp: ['タジマ'], en: ['Tajima'] },
    { jp: ['京都機械工具'], en: ['KTC'] },
    // --- 計測・健康機器 ---
    { jp: ['オムロン'], en: ['OMRON'] },
    { jp: ['タニタ'], en: ['TANITA'] },
    { jp: ['テルモ'], en: ['Terumo'] },
    // --- カー用品・電装 ---
    { jp: ['ユピテル'], en: ['YUPITERU'] },
    { jp: ['コムテック'], en: ['COMTEC'] },
    { jp: ['デンソー'], en: ['DENSO'] },
    { jp: ['ブリヂストン'], en: ['BRIDGESTONE'] },
    // --- 電池・電子部品 ---
    { jp: ['太陽誘電'], en: ['Taiyo Yuden'] },
    { jp: ['ユアサ'], en: [] },
    { jp: ['エネループ'], en: ['eneloop'] },
    { jp: ['エフディーケイ'], en: ['FDK'] },
    // --- ゲーム・玩具 ---
    { jp: ['バンダイ'], en: ['BANDAI'] },
    { jp: ['タカラトミー'], en: [] },
    { jp: ['セガ'], en: ['SEGA'] },

    // ===== 第2バッチ：食品・飲料（2026-06-17） =====
    { jp: ['明治'], en: ['Meiji'] },
    { jp: ['アサヒ'], en: ['Asahi'] },
    { jp: ['サントリー'], en: ['Suntory'] },
    { jp: ['キリン'], en: ['Kirin'] },
    { jp: ['江崎グリコ'], en: ['Glico'] },
    { jp: ['味の素'], en: ['Ajinomoto'] },
    { jp: ['伊藤園'], en: ['ITO EN'] },
    { jp: ['カゴメ'], en: ['Kagome'] },
    { jp: ['日清食品'], en: ['Nissin'] },
    { jp: ['山崎製パン'], en: ['Yamazaki Baking'] },
    { jp: ['森永'], en: ['Morinaga'] },
    { jp: ['カルビー'], en: ['Calbee'] },
    { jp: ['キッコーマン'], en: ['Kikkoman'] },
    { jp: ['宝ホールディングス'], en: ['Takara Holdings'] },
    { jp: ['ハウス食品'], en: ['House Foods'] },

    // ===== 第3バッチ：衣料・アパレル・スポーツ（直系日本企業のみ） =====
    { jp: ['ワコール'], en: ['WACOAL'] },
    { jp: ['グンゼ'], en: ['GUNZE'] },
    { jp: ['スピングル'], en: ['SPINGLE'] },

    // ===== 第4バッチ：アウトドア・スポーツ用品 =====
    { jp: ['スノーピーク', 'Snow Peak'], en: ['Snow Peak'] },
    { jp: ['ロゴス', 'LOGOS'], en: ['LOGOS'] },
    { jp: ['キャプテンスタッグ', 'Captain Stag'], en: ['Captain Stag'] },
    { jp: ['ユニフレーム', 'UNIFLAME'], en: ['UNIFLAME'] },
    { jp: ['オガワ', 'ogawa'], en: ['ogawa'] },
    { jp: ['アライテント', 'Arai Tent'], en: ['Arai Tent'] },
    { jp: ['DOD', 'ディーオーディー'], en: ['DOD'] },
    { jp: ['シマノ'], en: ['Shimano'] },
    { jp: ['ダイワ', 'DAIWA'], en: ['Daiwa'] },
    { jp: ['ゼット'], en: ['Zett'] },

    // ===== 第5バッチ：オーディオ・楽器・音響 =====
    { jp: ['ズーム'], en: ['Zoom'] },
    { jp: ['タスカム'], en: ['Tascam'] },
    { jp: ['アイバニーズ'], en: ['Ibanez'] },
    { jp: ['カワイ'], en: ['Kawai'] },
    { jp: ['タカミネ'], en: ['Takamine'] },
    { jp: ['タマ'], en: ['Tama'] },
    { jp: ['パール'], en: ['Pearl'] },
    { jp: ['ボス'], en: ['Boss'] },
    { jp: ['エスピー'], en: ['ESP'] },
    { jp: ['グレコ'], en: ['Greco'] },
    { jp: ['フェルナンデス'], en: ['Fernandes'] },
    { jp: ['モーリス'], en: ['Morris'] },

    // ===== 第6バッチ：文具・雑貨・インテリア =====
    { jp: ['パイロット', 'パイロットコーポレーション'], en: ['Pilot', 'Pilot Corporation'] },
    { jp: ['コクヨ'], en: ['Kokuyo'] },
    { jp: ['三菱鉛筆', 'ユニ'], en: ['Mitsubishi Pencil', 'Uni'] },
    { jp: ['ゼブラ'], en: ['Zebra'] },
    { jp: ['トンボ鉛筆'], en: ['Tombow'] },
    { jp: ['ぺんてる'], en: ['Pentel'] },
    { jp: ['セーラー'], en: ['Sailor'] },
    { jp: ['プラチナ万年筆'], en: ['Platinum'] },
    { jp: ['ミドリ'], en: ['Midori'] },
    { jp: ['キングジム'], en: ['King Jim'] },
    { jp: ['リヒトラブ'], en: ['Lihit Lab'] },
    { jp: ['アピカ'], en: ['Apica'] },
    { jp: ['マルマン'], en: ['Maruman'] },
    { jp: ['竹中'], en: ['Takenaka'] },
    { jp: ['ヤマゼン'], en: ['Yamazen'] },
    { jp: ['九谷焼'], en: ['Kutani'] },

    // ===== 第7バッチ：キッチン家電（新規のみ） =====
    { jp: ['象印', 'ゾウジルシ'], en: ['ZOJIRUSHI'] },
    { jp: ['バルミューダ'], en: ['BALMUDA'] },
    { jp: ['シロカ'], en: ['siroca'] },
    { jp: ['下村工業'], en: [] },

    // ===== 第8バッチ：スマートフォン・PC周辺機器（新規のみ） =====
    { jp: ['ディーフ'], en: ['Deff'] },
    { jp: ['シーアイオー'], en: ['CIO'] },
    { jp: ['モッテル'], en: ['MOTTERU'] },
    { jp: ['オウルテック'], en: ['Owltech'] },
    { jp: ['ハミー'], en: ['Hamee'] },
    { jp: ['ピージーエー'], en: ['PGA'] },
    { jp: ['ルプラス'], en: ['Leplus'] },
    { jp: ['多摩川電機'], en: ['TREC'] },

    // ===== 第9バッチ：自転車・バイク関連（新規のみ） =====
    { jp: ['ミヤタ'], en: ['MIYATA'] },
    { jp: ['パナレーサー'], en: ['Panaracer'] },
    { jp: ['アラヤ'], en: ['Araya'] },
    { jp: ['寺本自転車工業'], en: [] },
    { jp: ['タナックス'], en: ['Tanax'] },
    { jp: ['コミネ'], en: ['Komine'] },
    { jp: ['ダンロップ'], en: ['Dunlop'] },
    { jp: ['モトログ'], en: ['Motolog'] },
    { jp: ['アピオ'], en: ['APIO'] },
    { jp: ['プロテック'], en: ['PROTEC'] },
    { jp: ['キジマ'], en: ['KIJIMA'] },
    { jp: ['ナップス'], en: [] },
    { jp: ['ウイッシュ'], en: ['WISH'] },
    { jp: ['ハリケーン'], en: ['Hurricane'] },
    { jp: ['デイトナ'], en: ['Daytona'] },

    // ===== 第10バッチ：眼鏡・アイウェア =====
    { jp: ['ハッタモリ'], en: ['HATTAORI'] },
    { jp: ['ホヤ'], en: ['HOYA'] },
    { jp: ['ニデック'], en: ['NIDEK'] },
    { jp: ['シャルマン'], en: ['CHARMAN'] },
    { jp: ['ジンズ', 'ジェイインズ'], en: ['JINS'] },
    { jp: ['ゾフ'], en: ['Zoff'] },
    { jp: ['トマト'], en: ['TOMATO'] },
    { jp: ['オーバル'], en: ['OVAL'] },
    { jp: ['アスピック'], en: ['ASPIC'] },
    { jp: ['シンアイ'], en: ['SHIN-AI'] },
    { jp: ['ロータス'], en: ['LOTUS'] },
    { jp: ['京都眼鏡'], en: ['KYOTO GLASSES'] },

    // ===== 第11バッチ：バッグ・鞄 =====
    { jp: ['吉田カバン', 'ヨシダ'], en: ['Yoshida & Co.', 'PORTER'] },
    { jp: ['大峽製鞄', 'オオバセイホウ'], en: ['Ohba Seihou', 'Ohba & Co.'] },
    { jp: ['土屋鞄製造所', 'ツチヤカバンセイゾウショ'], en: ['Tsuchiya Kaban', 'Tsuchiya Kaban Manufacturing'] },
    { jp: ['エンドー鞄', 'エンドーカバン'], en: ['Endo Kaban', 'FREQUENTER', 'NEOPRO'] },
    { jp: ['エルゴポック', 'ヘルゴポック'], en: ['HERGOPOCH', 'Kiyomoto'] },
    { jp: ['アネロ'], en: ['anello'] },
    { jp: ['ハーベストレーベル', 'ハーベスト'], en: ['HARVEST LABEL', 'Harvest Corporation'] },
    { jp: ['ココマイスター'], en: ['COCOMEISTER'] },
    { jp: ['エース', 'プロテカ'], en: ['ACE', 'Proteca'] },
    { jp: ['ホーボー'], en: ['hobo'] },
    { jp: ['ペッレモルビダ'], en: ['PELLE MORBIDA'] },
    { jp: ['サザンフィールドインダストリーズ', '南フィールド'], en: ['Southern Field Industries'] },
  ];

  // ===== 日本運営ブランド（海外発祥・日本企業が企画・販売運営） ========
  // デサント傘下：ルコック（フランス1882年）、マーモット（米国）、アリーナ（米国）
  // ゴールドウイン傘下：ヘリーハンセン（ノルウェー）、スピード（豪州）
  // これらはAmazon.co.jpで日本企画・販売・マーケティングが主体のため、ユーザーの利便性向上のため別枠で収録。
  const JP_MAKERS_OPERATED = [
    { jp: ['ルコック スポルティフ'], en: ['le coq sportif'] },  // フランス発祥・デサント運営
    { jp: ['マーモット'], en: ['MARMOT'] },                       // 米国発祥・デサント運営
    { jp: ['アリーナ'], en: ['ARENA'] },                          // 米国発祥・デサント運営。「aquatic」「swimming」コンテキスト
    { jp: ['ヘリーハンセン'], en: ['HELLY HANSEN'] },             // ノルウェー発祥・ゴールドウイン運営
    { jp: ['スピード'], en: ['speedo'] },                         // 豪州発祥・ゴールドウイン運営
  ];

  // ===== 照合用の正規表現を事前構築 ================================
  const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 日本企業
  const japanesePatternsDirect = JP_MAKERS_DIRECT.flatMap((maker) => maker.jp).map(escapeRegExp);
  const englishPatternsDirect = JP_MAKERS_DIRECT.flatMap((maker) => maker.en).map(escapeRegExp);

  // 日本運営ブランド
  const japanesesPatternsOperated = JP_MAKERS_OPERATED.flatMap((maker) => maker.jp).map(escapeRegExp);
  const englishPatternsOperated = JP_MAKERS_OPERATED.flatMap((maker) => maker.en).map(escapeRegExp);

  // 統合（両方を含める）
  const japanesePatterns = [...japanesePatternsDirect, ...japanesesPatternsOperated];
  const englishPatterns = [...englishPatternsDirect, ...englishPatternsOperated];

  // 漢字・カナは部分一致。英字は前後が単語境界のときだけ一致。
  const japaneseRegex = japanesePatterns.length
    ? new RegExp(japanesePatterns.join('|'))
    : null;
  const englishRegex = englishPatterns.length
    ? new RegExp('(?:^|[^A-Za-z0-9])(?:' + englishPatterns.join('|') + ')(?![A-Za-z0-9])', 'i')
    : null;

  // ===== 衝突語ガード ==============================================
  // メーカー名が一般語の一部として現れる誤検出を防ぐ。判定の前にこれらの語を
  // タイトルから取り除いてから照合する（ブランド単独表記は残るため正規の検出は維持）。
  //   シャープ ⊂ シャープペン（シル）/ シャープ芯（文房具）
  //   タイガー ⊂ タイガース（阪神）/ タイガー柄（虎柄）
  //   スリック ⊂ スリックタイヤ（自転車・車）
  //   ピジョン ⊂ ピジョンブラッド（ルビーの色名・宝飾）
  //   ポーラ ⊂ ポーラーベア（北極熊・玩具）
  // ※「シリコーン」⊃「リコー」はカナ辞書から外して対処済み（上の RICOH 参照）。
  // 衝突が新たに見つかったら、ここに語を足すか該当社のカナを外す。
  const COLLISION_WORDS = /シャープペン|シャープ芯|タイガース|タイガー柄|スリックタイヤ|ピジョンブラッド|ポーラーベア/g;

  const isJapaneseMaker = (title) => {
    const guarded = title.replace(COLLISION_WORDS, ' '); // 衝突語を消してから照合
    if (japaneseRegex && japaneseRegex.test(guarded)) return true;
    if (englishRegex && englishRegex.test(guarded)) return true;
    return false;
  };

  return { JP_MAKERS_DIRECT, JP_MAKERS_OPERATED, isJapaneseMaker };
});
