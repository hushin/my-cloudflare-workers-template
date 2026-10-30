// Storybook のテスト (vitest) のときだけ読み込む。Storybook の画面では読まない。
// ダイアログなどの開閉のアニメーションを待たずに済むよう、アニメーションとトランジションの時間を 0 にする
// (Base UI はアニメーションの終わりを待ってから要素を外すので、時間が 0 ならすぐ外れる)。
const style = document.createElement('style');
style.textContent = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
}
`;
document.head.append(style);
