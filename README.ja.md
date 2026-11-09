# TurboWarp Plus Editor Host

editor host の取り決めです。TurboWarp Plus Editor ファミリーのパッケージが editor の中で動くときに、editor から受け取るものを定めます。中身は型と照合 1 つで、依存はありません。

実装は 2 つあります。

- **TurboWarp Plus Editor：** scratch-gui 全体を持つ本体。
- **最小 editor runtime（`@kubohiroya/turbowarp-plus-editor-test-runtime`）：** パッケージ自身の試験が使うもの。

`EditorHost` に沿って書いたパッケージは、Editor をビルドしなくても、本物の VM と Scratch Blocks との結合を試せます。

## 取り決め

| 名前 | 意味 |
| --- | --- |
| `vm` | VM。パッケージが頼るのは `runtime.targets`・`editingTarget`・イベントの関数だけ |
| `locale` | `en`・`ja` のような BCP 47 の言語タグ |
| `getBlockly()` | host のワークスペースを作った Scratch Blocks |
| `deserializeBlocks` | VM の sb3 `deserializeBlocks` |
| `createBlockContainer()` | どのターゲットにも属さない、VM の `Blocks` コンテナ |
| `isProjectDirty()`・`markSaved()` | 未保存の編集の状態 |
| `isRunning()` | スクリプトが実行中かどうか |
| `subscribe(listener)` | 未保存・実行中の状態が変わったかもしれないときに呼ぶ |
| `refreshBlockViews(targets)` | パッケージが VM で直接変えたブロックを表示に反映する |

## host の照合

`verifyEditorHost(host)` は、作品を読み込み、編集対象のある host を照合します。失敗した照合の名前の一覧で解決し、すべて通れば空の一覧になります。照合のために変えた未保存の状態は元に戻します。両方の host に走らせることで、両者のずれを防ぎます。

```js
import {verifyEditorHost} from '@kubohiroya/turbowarp-plus-editor-host';
assert.deepEqual(await verifyEditorHost(host), []);
```

## 開発

`npm test` でビルドし、代役の host に対して照合を走らせます。

npm への公開は `.github/workflows/release.yml` が行います。`v<版>` のタグを push したときに、npm の Trusted Publisher で公開します。

## ライセンス

MPL-2.0。
