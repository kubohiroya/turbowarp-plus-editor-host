import assert from 'node:assert/strict';
import {test} from 'node:test';
import {EventEmitter} from 'node:events';
import {verifyEditorHost, type EditorHost} from '../src/index.ts';

// A host that keeps to the contract with stand-ins for the VM's parts.
function host(): EditorHost & {vm: EditorHost['vm'] & EventEmitter} {
    const vm = Object.assign(new EventEmitter(), {runtime: Object.assign(new EventEmitter(), {targets: [] as any[]}), editingTarget: null as any});
    const stage = {id: 'stage', isStage: true, getName: () => 'Stage'};
    const cat = {id: 'cat', isStage: false, getName: () => 'Cat'};
    vm.runtime.targets.push(stage, cat);
    vm.editingTarget = cat;
    let dirty = true;
    const listeners = new Set<() => void>();
    return {
        vm, locale: 'ja',
        getBlockly: async () => ({inject() {}, Xml: {}}),
        deserializeBlocks(blocks) {
            for (const [id, block] of Object.entries(blocks)) (block as {id: string}).id = id;
            return blocks as Record<string, {id: string}>;
        },
        createBlockContainer() {
            const all = new Map<string, any>();
            const xml = (id: string): string => {
                const block = all.get(id);
                return block ? `<block type="${block.opcode}">${block.next ? `<next>${xml(block.next)}</next>` : ''}</block>` : '';
            };
            return {createBlock: block => {all.set(block.id, block);}, blockToXML: id => all.has(id) ? xml(id) : undefined};
        },
        isProjectDirty: () => dirty,
        markSaved() {dirty = false; for (const listener of listeners) listener();},
        isRunning: () => false,
        subscribe(listener) {listeners.add(listener); return () => listeners.delete(listener);},
        refreshBlockViews(targets) {
            if (targets.includes(vm.editingTarget)) vm.emit('workspaceUpdate', {xml: '<xml/>'});
            vm.emit('EXTERNAL_BLOCKS_RELOADED', targets);
        }
    };
}

test('a host that keeps to the contract passes', async () => {
    assert.deepEqual(await verifyEditorHost(host()), []);
});

test('each broken part is reported by name', async () => {
    const broken = host();
    broken.locale = '';
    broken.markSaved = () => {};
    broken.refreshBlockViews = () => broken.vm.emit('workspaceUpdate', {xml: '<xml/>'});
    broken.createBlockContainer = () => ({createBlock() {}, blockToXML: () => undefined});
    assert.deepEqual(await verifyEditorHost(broken), [
        'locale is a language tag',
        'deserializeBlocks and createBlockContainer make block XML',
        'markSaved clears the dirty state and notifies subscribers',
        'refreshBlockViews updates the editing target\'s workspace',
        'refreshBlockViews leaves the workspace alone for other targets'
    ]);
});

test('a thrown error is reported with its message', async () => {
    const broken = host();
    broken.vm.editingTarget = null;
    assert.deepEqual(await verifyEditorHost(broken), [
        'refreshBlockViews updates the editing target\'s workspace: no target is being edited'
    ]);
});
