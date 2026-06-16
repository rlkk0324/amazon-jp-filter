// 設定パネルの本体。チェックボックス・ラジオの状態を chrome.storage.local に保存する。
// content.js 側が storage の変更を監視して即座に画面へ反映する。

const DEFAULTS = { enabled: true, mode: 'badge' };

const enabledCheckbox = document.getElementById('enabled');
const modeRadios = Array.from(document.querySelectorAll('input[name="mode"]'));

// 保存済みの設定をパネルに反映
chrome.storage.local.get(DEFAULTS, (stored) => {
  enabledCheckbox.checked = stored.enabled;
  modeRadios.forEach((radio) => {
    radio.checked = radio.value === stored.mode;
  });
});

// 操作されたら保存
enabledCheckbox.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: enabledCheckbox.checked });
});

modeRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    if (radio.checked) chrome.storage.local.set({ mode: radio.value });
  });
});
