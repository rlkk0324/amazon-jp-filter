// maker-match.js（日本メーカー判定の純粋ロジック）の回帰テスト。
// 実行：プロジェクトルートで `npm test`（= node extension/maker-match.test.cjs）。
// 部分一致による誤検出（リコー⊂シリコーン 等）が再発しないことを守る。
const assert = require('node:assert');
const { isJapaneseMaker } = require('./maker-match.js');

// [タイトル, 期待値, 説明]
const cases = [
  // --- 誤検出してはいけない（短いカナが一般語に部分一致するケース） ---
  ['Aizgalxor オーシャン バンド 対応 Apple Watch Ultra ウォータースポーツシリコーン交換用バンド 対応 iWatch', false, 'シリコーン ⊃ リコー'],
  ['シリコン 交換用バンド 45mm', false, 'シリコン（リコー誤検出の確認）'],
  ['シャープペンシル 0.5mm 本体 製図用 替芯付き', false, 'シャープペンシル ⊃ シャープ（他に日本メーカーを含まない）'],
  ['替芯 シャープ芯 0.5mm HB 40本', false, 'シャープ芯 ⊃ シャープ'],
  ['阪神タイガース 応援タオル 公式グッズ', false, 'タイガース ⊃ タイガー'],
  ['タイガー柄 トートバッグ レディース 大容量', false, 'タイガー柄 ⊃ タイガー'],
  ['ロードバイク スリックタイヤ 700x25c 2本セット', false, 'スリックタイヤ ⊃ スリック'],
  ['Anker モバイルバッテリー 10000mAh', false, '無関係な海外ブランド'],

  // --- 正規の日本メーカーは従来どおり検出する（ガードで巻き込まない） ---
  ['シャープ 液晶テレビ AQUOS 4K 50インチ', true, 'シャープ（家電・カナ単独）'],
  ['タイガー魔法瓶 炊飯器 5.5合 IH', true, 'タイガー（魔法瓶・カナ単独）'],
  ['SLIK スリック 三脚 プロ 700 DX', true, 'スリック（三脚・カナ単独）'],
  ['RICOH リコー デジタルカメラ GR III', true, 'RICOH（英字でリコー検出）'],
  ['ソニー ワイヤレスイヤホン WF-1000XM5', true, 'ソニー（カナ）'],
  ['SONY ブラビア 有機EL テレビ', true, 'SONY（英字・単語境界）'],
  ['OMRON オムロン 体重体組成計', true, 'オムロン（カナ）'],
  ['パナソニック ドライヤー ナノケア', true, 'パナソニック（カナ）'],
  ['Apple Watch 用 audio-technica 変換', true, 'audio-technica（ハイフン入り英字）'],

  // --- 英字の単語境界（誤検出しないことの確認） ---
  ['connect ケーブル USB-C', false, 'connect の中の nec に誤反応しない'],
  ['Buy every U.S. adapter for every user manual', false, 'every U.S./every user は every U. と誤一致しない'],

  // --- every U.（TOKYO LM／ランテル・メディエール）の検出 ---
  ['every U. チタンコート 片手鍋 18cm ガラス蓋付き ガス火/IH対応', true, 'every U.（日本ブランド・ピリオド付き正確形）'],
  ['every U. チタンコートフライパン 20cm', true, 'every U.（フライパン）'],

  // --- 日本運営ブランドの検出（海外発祥・デサント/ゴールドウイン傘下） ---
  ['le coq sportif ルコック スポルティフ ポロシャツ', true, 'ルコック スポルティフ（フランス発祥・デサント運営）'],
  ['MARMOT マーモット ジャケット ダウン', true, 'マーモット（米国発祥・デサント運営）'],
  ['ARENA アリーナ 競泳水着 レディース', true, 'アリーナ（米国発祥・デサント運営）'],
  ['HELLY HANSEN ヘリーハンセン パーカー 防水', true, 'ヘリーハンセン（ノルウェー発祥・ゴールドウイン運営）'],
  ['speedo スピード 競泳ゴーグル', true, 'スピード（豪州発祥・ゴールドウイン運営）'],

  // --- ドラッグストア系（化粧品・トイレタリー・医薬）の検出 ---
  ['資生堂 SHISEIDO アネッサ 日焼け止め', true, '資生堂'],
  ['花王 ビオレ ハンドソープ 詰め替え', true, '花王（漢字）'],
  ['コーセー 雪肌精 化粧水 200ml', true, 'コーセー/雪肌精'],
  ['FANCL ファンケル 無添加 クレンジング', true, 'ファンケル'],
  ['ポーラ B.A ローション', true, 'ポーラ'],
  ['DHC 薬用ディープクレンジングオイル', true, 'DHC'],
  ['ピジョン 哺乳瓶 母乳実感 160ml', true, 'ピジョン'],
  ['ユニ・チャーム ムーニー おむつ Mサイズ', true, 'ユニ・チャーム/ムーニー'],
  ['エリエール トイレットペーパー 12ロール', true, 'エリエール'],
  ['アース製薬 モンダミン マウスウォッシュ', true, 'アース製薬/モンダミン'],
  ['フマキラー FUMAKILLA 蚊取り 電池式', true, 'フマキラー'],
  ['龍角散 のどすっきり飴', true, '龍角散'],

  // --- ドラッグストア系の誤検出ガード ---
  ['ピジョンブラッド ルビー リング 0.5ct K18', false, 'ピジョンブラッド（ピジョン誤検出を防ぐ）'],
  ['polar bear ポーラーベア ぬいぐるみ 特大', false, 'polar/ポーラー は POLA/ポーラ と誤一致しない'],
  ['Polaroid インスタントカメラ', false, 'Polaroid は POLA と誤一致しない'],
  ['アースカラー 無地 Tシャツ メンズ earth color', false, '「アース」「earth」単体は誤検出しない'],
  ['スコッティ ファイン キッチンタオル', false, 'スコッティは未登録（クレシアの誤検出ではない）'],
  ['星の王子さま サン＝テグジュペリ 文庫', false, 'サンテグジュペリは参天製薬と誤一致しない'],

  // --- 第2バッチ：食品・飲料（2026-06-17） ---
  ['明治 チョコレート バー', true, '明治'],
  ['アサヒ 飲料 カルピス', true, 'アサヒ'],
  ['サントリー ペプシ コーラ', true, 'サントリー'],
  ['キリン 生茶 飲料', true, 'キリン'],
  ['江崎グリコ ポッキー スナック菓子', true, 'グリコ'],
  ['味の素 Ajinomoto 調味料 MSG', true, '味の素'],
  ['伊藤園 ITO EN 茶飲料 緑茶', true, '伊藤園'],
  ['カゴメ トマト ジュース', true, 'カゴメ'],
  ['日清食品 カップ ヌードル 即席麺', true, '日清'],
  ['山崎製パン パン 菓子', true, '山崎'],
  ['森永 ハイチュウ チョコレート', true, '森永'],
  ['カルビー ポテト チップス スナック', true, 'カルビー'],
  ['キッコーマン 醤油 調味料', true, 'キッコーマン'],
  ['宝ホールディングス 日本酒 焼酎', true, '宝'],
  ['ハウス食品 カレー ルー', true, 'ハウス'],

  // --- 第3-6バッチ：衣料・アウトドア・オーディオ・文具 ---
  ['WACOAL ワコール スポーツブラ', true, 'ワコール'],
  ['GUNZE グンゼ 靴下 アンダーシャツ', true, 'グンゼ'],
  ['SPINGLE スピングル スニーカー カンガルー', true, 'スピングル'],
  ['Snow Peak スノーピーク テント タープ', true, 'スノーピーク'],
  ['LOGOS ロゴス テント ファミリー', true, 'ロゴス'],
  ['Captain Stag キャプテンスタッグ バーベキュー', true, 'キャプテンスタッグ'],
  ['UNIFLAME ユニフレーム バーナー 調理', true, 'ユニフレーム'],
  ['ogawa オガワ テント 高級', true, 'オガワ'],
  ['Arai Tent アライテント 登山 テント', true, 'アライテント'],
  ['DOD ディーオーディー カマボコテント', true, 'DOD'],
  ['Shimano シマノ リール 釣具', true, 'シマノ'],
  ['Daiwa ダイワ 釣竿 ロッド', true, 'ダイワ'],
  ['Zett ゼット テニス ラケット', true, 'ゼット'],
  ['Zoom ズーム オーディオ レコーダー H1', true, 'ズーム'],
  ['Tascam タスカム マルチトラック レコーダー', true, 'タスカム'],
  ['Ibanez アイバニーズ ギター エレキ', true, 'アイバニーズ'],
  ['Kawai カワイ ピアノ デジタル', true, 'カワイ'],
  ['Takamine タカミネ アコースティック ギター', true, 'タカミネ'],
  ['Tama タマ ドラム キット', true, 'タマ'],
  ['Pearl パール ドラム Masterworks', true, 'パール'],
  ['Boss ボス ペダル GT-1', true, 'ボス'],
  ['ESP エスピー ギター LTD', true, 'エスピー'],
  ['Greco グレコ ギター ベース', true, 'グレコ'],
  ['Fernandes フェルナンデス ギター Sustainer', true, 'フェルナンデス'],
  ['Morris モーリス ギター クラシック', true, 'モーリス'],
  ['Pilot パイロット ペン フリクション', true, 'パイロット'],
  ['Kokuyo コクヨ ノート キャンパス', true, 'コクヨ'],
  ['Mitsubishi Pencil 三菱鉛筆 ユニ ジェットストリーム', true, '三菱鉛筆'],
  ['Zebra ゼブラ ボールペン サラサ', true, 'ゼブラ'],
  ['Tombow トンボ鉛筆 書道 筆ペン', true, 'トンボ鉛筆'],
  ['Pentel ぺんてる シャープペン サイン筆', true, 'ぺんてる'],
  ['Sailor セーラー 万年筆 金ペン', true, 'セーラー'],
  ['Platinum プラチナ万年筆 3776', true, 'プラチナ万年筆'],
  ['Midori ミドリ MDノート 手帳', true, 'ミドリ'],
  ['King Jim キングジム キングファイル', true, 'キングジム'],
  ['Lihit Lab リヒトラブ ペンケース ファイル', true, 'リヒトラブ'],
  ['Apica アピカ ノート 万年筆 紙', true, 'アピカ'],
  ['Maruman マルマン ノート 高品質', true, 'マルマン'],
  ['Takenaka 竹中 弁当箱 キッチン', true, '竹中'],
  ['Yamazen ヤマゼン こたつ 照明', true, 'ヤマゼン'],
  ['Kutani 九谷焼 磁器 食卓', true, '九谷焼'],
];

let passed = 0;
const failures = [];
for (const [title, want, desc] of cases) {
  const got = isJapaneseMaker(title);
  if (got === want) {
    passed++;
  } else {
    failures.push(`  期待=${want} 結果=${got} | ${desc}\n    タイトル: ${title}`);
  }
}

console.log(`maker-match: ${passed}/${cases.length} passed`);
if (failures.length) {
  console.error('FAILED:\n' + failures.join('\n'));
  assert.fail(`${failures.length} 件のケースが失敗しました`);
}
