/**
 * What an editor gives the family packages that work inside it. The TurboWarp Plus Editor and the minimal
 * editor runtime (`@kubohiroya/turbowarp-plus-editor-test-runtime`) both implement it, so a package written
 * against it can be tested without the Editor, and `verifyEditorHost` checks that each one keeps to it.
 */

/** Blocks as an sb3 `project.json` stores them, keyed by id. */
export type BlockTable = Record<string, unknown>;
/** The VM's sb3 `deserializeBlocks`: turns serialized blocks into VM blocks, in place. */
export type DeserializeBlocks = (blocks: BlockTable) => Record<string, {id: string; topLevel?: boolean}>;
/** A VM `Blocks` container of its own, not attached to any target. */
export interface BlockContainer {
    createBlock(block: {id: string}, deferProjectChanged?: boolean): void;
    blockToXML(id: string): string | undefined;
}
export interface EditorTarget {
    id: string;
    isStage: boolean;
    getName(): string;
}
type Listener = (...args: any[]) => void;
/** The parts of the VM that packages may rely on. Everything else on the VM is the host's own. */
export interface EditorVM {
    runtime: {targets: EditorTarget[]; on(event: string, listener: Listener): void; off(event: string, listener: Listener): void};
    editingTarget: EditorTarget | null;
    on(event: string, listener: Listener): void;
    off(event: string, listener: Listener): void;
}
/** The global Scratch Blocks (Blockly) object the host's workspace was made with. */
export interface ScratchBlocks {
    inject(container: HTMLElement, options: object): unknown;
    Xml: object;
}

export interface EditorHost {
    vm: EditorVM;
    /** A BCP 47 tag such as `en` or `ja`. */
    locale: string;
    getBlockly(): ScratchBlocks | Promise<ScratchBlocks>;
    deserializeBlocks: DeserializeBlocks;
    createBlockContainer(): BlockContainer;
    /** Whether the project has edits that are not saved. */
    isProjectDirty(): boolean;
    /** Records that the project now matches what was last loaded or saved. */
    markSaved(): void;
    /** Whether a script of the project is running. */
    isRunning(): boolean;
    /** Calls `listener` after the dirty or running state may have changed. Returns the unsubscribe function. */
    subscribe(listener: () => void): () => void;
    /**
     * Shows blocks that a package changed in the VM directly, outside the workspace: the VM emits
     * `workspaceUpdate` for the editing target when it is among `targets`, then `EXTERNAL_BLOCKS_RELOADED`.
     */
    refreshBlockViews(targets: readonly EditorTarget[]): void;
}

const sample: BlockTable = {
    'host-check-flag': {opcode: 'event_whenflagclicked', next: 'host-check-move', parent: null, inputs: {}, fields: {},
        shadow: false, topLevel: true, x: 0, y: 0},
    'host-check-move': {opcode: 'motion_movesteps', next: null, parent: 'host-check-flag', inputs: {}, fields: {},
        shadow: false, topLevel: false}
};
const waitFor = (vm: EditorVM, event: string, action: () => void) => new Promise<boolean>(resolve => {
    let seen = false;
    const listener = () => {seen = true;};
    vm.on(event, listener);
    try {action();} finally {vm.off(event, listener);}
    resolve(seen);
});

/**
 * Checks that `host` keeps to {@link EditorHost} with a project loaded and a target being edited. It does not
 * change the project: the dirty state is put back. Resolves with what failed, or an empty list.
 */
export async function verifyEditorHost(host: EditorHost): Promise<string[]> {
    const failures: string[] = [];
    const check = async (name: string, run: () => unknown) => {
        try {
            if (await run() === false) failures.push(name);
        } catch (error) {
            failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    await check('locale is a language tag', () => typeof host.locale === 'string' && /^[a-z]{2,3}(-|$)/i.test(host.locale));
    await check('getBlockly gives Scratch Blocks', async () => {
        const blockly = await host.getBlockly();
        return typeof blockly?.inject === 'function' && typeof blockly.Xml === 'object';
    });
    await check('deserializeBlocks and createBlockContainer make block XML', () => {
        const blocks = host.deserializeBlocks(structuredClone(sample));
        const container = host.createBlockContainer();
        for (const block of Object.values(blocks)) container.createBlock(block, true);
        const xml = container.blockToXML('host-check-flag') ?? '';
        return xml.includes('event_whenflagclicked') && xml.includes('motion_movesteps');
    });
    await check('isProjectDirty and isRunning are booleans', () =>
        typeof host.isProjectDirty() === 'boolean' && typeof host.isRunning() === 'boolean');
    await check('markSaved clears the dirty state and notifies subscribers', () => {
        const dirty = host.isProjectDirty();
        let calls = 0;
        const unsubscribe = host.subscribe(() => calls++);
        try {
            host.markSaved();
            return !host.isProjectDirty() && (!dirty || calls > 0);
        } finally {unsubscribe();}
    });
    await check('refreshBlockViews updates the editing target\'s workspace', async () => {
        const target = host.vm.editingTarget;
        if (!target) throw new Error('no target is being edited');
        const updated = await waitFor(host.vm, 'workspaceUpdate', () => host.refreshBlockViews([target]));
        const reloaded = await waitFor(host.vm, 'EXTERNAL_BLOCKS_RELOADED', () => host.refreshBlockViews([target]));
        return updated && reloaded;
    });
    await check('refreshBlockViews leaves the workspace alone for other targets', async () => {
        const other = host.vm.runtime.targets.find(target => target !== host.vm.editingTarget);
        if (!other) return true;
        return !await waitFor(host.vm, 'workspaceUpdate', () => host.refreshBlockViews([other]));
    });
    return failures;
}
