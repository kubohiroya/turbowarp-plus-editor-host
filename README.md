# TurboWarp Plus Editor Host

The editor host contract: what an editor gives the TurboWarp Plus Editor family packages that work inside it. It is types plus one check, and it has no dependencies.

Two hosts implement it:

- **The TurboWarp Plus Editor**, with its full scratch-gui.
- **The minimal editor runtime** (`@kubohiroya/turbowarp-plus-editor-test-runtime`), which a package's own tests use.

A package written against `EditorHost` can test its integration with the real VM and Scratch Blocks without building the Editor.

## Contract

| Member | Meaning |
| --- | --- |
| `vm` | The VM. Packages rely only on `runtime.targets`, `editingTarget` and the event methods |
| `locale` | A BCP 47 tag such as `en` or `ja` |
| `getBlockly()` | The Scratch Blocks object the host's workspace was made with |
| `deserializeBlocks` | The VM's sb3 `deserializeBlocks` |
| `createBlockContainer()` | A VM `Blocks` container of its own, not attached to a target |
| `isProjectDirty()`, `markSaved()` | The unsaved-edits state |
| `isRunning()` | Whether a script is running |
| `subscribe(listener)` | Called after the dirty or running state may have changed |
| `refreshBlockViews(targets)` | Shows blocks that a package changed in the VM directly |

## Checking a host

`verifyEditorHost(host)` checks a host that has a project loaded and a target being edited. It resolves with the names of the checks that failed, or an empty list. It puts back the dirty state it changes. Run it against both hosts, so they cannot drift apart.

```js
import {verifyEditorHost} from '@kubohiroya/turbowarp-plus-editor-host';
assert.deepEqual(await verifyEditorHost(host), []);
```

## Development

`npm test` builds the package and runs the checks against stand-in hosts.

Publishing happens in `.github/workflows/release.yml`, when a `v<version>` tag is pushed, through npm Trusted Publishing.

## License

MPL-2.0.
