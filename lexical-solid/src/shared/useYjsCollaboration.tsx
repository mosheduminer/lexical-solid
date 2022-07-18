import type {Binding} from '@lexical/yjs';
import type {LexicalEditor} from 'lexical';
import type {Doc, YEvent} from 'yjs';

import { mergeRegister } from "@lexical/utils";
import {
  CONNECTED_COMMAND,
  createBinding,
  createUndoManager,
  initLocalState,
  setLocalStateFocus,
  syncCursorPositions,
  syncLexicalUpdateToYjs,
  syncYjsChangesToLexical,
  TOGGLE_CONNECT_COMMAND,
} from "@lexical/yjs";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  FOCUS_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from "lexical";
import { createSignal, JSX, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import {WebsocketProvider} from 'y-websocket';

export function useYjsCollaboration(
  editor: LexicalEditor,
  id: string,
  provider: WebsocketProvider,
  docMap: Map<string, Doc>,
  name: string,
  color: string,
  shouldBootstrap: boolean
): [JSX.Element, Binding] {
  let isReloadingDoc: boolean = false;
  const [doc, setDoc] = createSignal<Doc>(docMap.get(id)!);
  const binding = createBinding(editor, provider, id, doc(), docMap);

  const connect = () => {
    provider.connect();
  };

  const disconnect = () => {
    try {
      provider.disconnect();
    } catch (e) {
      // Do nothing
    }
  };

  onMount(() => {
    const { root } = binding;
    const { awareness } = provider;

    const onStatus = ({ status }: { status: string }) => {
      editor.dispatchCommand(CONNECTED_COMMAND, status === "connected");
    };

    const onSync = (isSynced: boolean) => {
      if (
        shouldBootstrap &&
        isSynced &&
        root.isEmpty() &&
        root._xmlText._length === 0 &&
        isReloadingDoc === false
      ) {
        initializeEditor(editor);
      }
      isReloadingDoc = false;
    };

    const onAwarenessUpdate = () => {
      syncCursorPositions(binding, provider);
    };

    const onYjsTreeChanges = (events: YEvent<any>[], transaction: any) => {
      if (transaction.origin !== binding) {
        syncYjsChangesToLexical(binding, provider, events);
      }
    };

    initLocalState(
      provider,
      name,
      color,
      document.activeElement === editor.getRootElement()
    );

    const onProviderDocReload = (ydoc: Doc) => {
      clearEditorSkipCollab(editor, binding);
      setDoc(ydoc);
      docMap.set(id, ydoc);
      isReloadingDoc = true;
    };
    provider.on("reload", onProviderDocReload);

    provider.on("status", onStatus);
    provider.on("sync", onSync);
    awareness.on("update", onAwarenessUpdate);
    root.getSharedType().observeDeep(onYjsTreeChanges);

    const removeListener = editor.registerUpdateListener(
      ({
        prevEditorState,
        editorState,
        dirtyLeaves,
        dirtyElements,
        normalizedNodes,
        tags,
      }) => {
        if (tags.has("skip-collab") === false) {
          syncLexicalUpdateToYjs(
            binding,
            provider,
            prevEditorState,
            editorState,
            dirtyElements,
            dirtyLeaves,
            normalizedNodes,
            tags
          );
        }
      }
    );

    connect();

    return () => {
      if (isReloadingDoc === false) {
        disconnect();
      }
      provider.off("sync", onSync);
      provider.off("status", onStatus);
      provider.off("reload", onProviderDocReload);
      awareness.off("update", onAwarenessUpdate);
      root.getSharedType().unobserveDeep(onYjsTreeChanges);
      removeListener();
    };
  });

  const cursorsContainer = () => {
    const ref = (element: HTMLDivElement) => {
      binding.cursorsContainer = element;
    };

    return (
      <Portal>
        <div ref={ref} />
      </Portal>
    );
  };

  onCleanup(
    editor.registerCommand(
      TOGGLE_CONNECT_COMMAND,
      (payload) => {
        if (connect !== undefined && disconnect !== undefined) {
          const shouldConnect = payload;
          if (shouldConnect) {
            // eslint-disable-next-line no-console
            console.log("Collaboration connected!");
            connect();
          } else {
            // eslint-disable-next-line no-console
            console.log("Collaboration disconnected!");
            disconnect();
          }
        }
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    )
  );

  return [cursorsContainer, binding];
}

export function useYjsFocusTracking(
  editor: LexicalEditor,
  provider: WebsocketProvider,
  name: string,
  color: string
) {
  onCleanup(
    mergeRegister(
      editor.registerCommand(
        FOCUS_COMMAND,
        (_payload) => {
          setLocalStateFocus(provider, name, color, true);
          return true;
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand(
        BLUR_COMMAND,
        (payload) => {
          setLocalStateFocus(provider, name, color, false);
          return true;
        },
        COMMAND_PRIORITY_EDITOR
      )
    )
  );
}

export function useYjsHistory(
  editor: LexicalEditor,
  binding: Binding
): () => void {
  const undoManager = createUndoManager(binding, binding.root.getSharedType());

  onMount(() => {
    const undo = () => {
      undoManager.undo();
    };
    const redo = () => {
      undoManager.redo();
    };

    onCleanup(
      mergeRegister(
        editor.registerCommand(
          UNDO_COMMAND,
          () => {
            undo();
            return true;
          },
          COMMAND_PRIORITY_EDITOR
        ),
        editor.registerCommand(
          REDO_COMMAND,
          () => {
            redo();
            return true;
          },
          COMMAND_PRIORITY_EDITOR
        )
      )
    );
  });

  const clearHistory = () => {
    undoManager.clear();
  };

  return clearHistory;
}

function initializeEditor(editor: LexicalEditor): void {
  editor.update(
    () => {
      const root = $getRoot();
      const firstChild = root.getFirstChild();
      if (firstChild === null) {
        const paragraph = $createParagraphNode();
        root.append(paragraph);
        const activeElement = document.activeElement;
        if (
          $getSelection() !== null ||
          (activeElement !== null && activeElement === editor.getRootElement())
        ) {
          paragraph.select();
        }
      }
    },
    {
      tag: "history-merge",
    }
  );
}

function clearEditorSkipCollab(editor: LexicalEditor, binding: Binding) {
  // reset editor state
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      root.select();
    },
    {
      tag: "skip-collab",
    }
  );

  if (binding.cursors == null) {
    return;
  }

  const cursorsContainer = binding.cursorsContainer;
  if (cursorsContainer == null) {
    return;
  }

  // reset cursors in dom
  const cursors = Array.from(binding.cursors.values());
  for (let i = 0; i < cursors.length; i++) {
    const cursor = cursors[i];
    const selection = cursor.selection;
    if (selection && selection.selections != null) {
      const selections = selection.selections;
      for (let j = 0; j < selections.length; j++) {
        cursorsContainer.removeChild(selections[i]);
      }
    }
  }
}
