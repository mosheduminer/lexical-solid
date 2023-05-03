import {
  Binding,
  Provider,
  CONNECTED_COMMAND,
  createBinding,
  createUndoManager,
  initLocalState,
  setLocalStateFocus,
  syncCursorPositions,
  syncLexicalUpdateToYjs,
  syncYjsChangesToLexical,
  TOGGLE_CONNECT_COMMAND,
  ExcludedProperties,
} from "@lexical/yjs";
import {
  LexicalEditor,
  $createParagraphNode,
  $getRoot,
  $getSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  FOCUS_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from "lexical";
import { Doc, Transaction, YEvent, UndoManager } from "yjs";
import { mergeRegister } from "@lexical/utils";
import { InitialEditorStateType } from "../LexicalComposer";
import { JSX } from "solid-js";
import { Portal } from "solid-js/web";
import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
} from "solid-js";

export type CursorsContainerRef = Accessor<HTMLElement | undefined | null>;

export function useYjsCollaboration(
  editor: LexicalEditor,
  id: string,
  provider: Provider,
  docMap: Map<string, Doc>,
  name: string,
  color: string,
  shouldBootstrap: boolean,
  cursorsContainerRef?: CursorsContainerRef,
  initialEditorState?: InitialEditorStateType,
  excludedProperties?: ExcludedProperties
): [JSX.Element, Accessor<Binding>] {
  let isReloadingDoc: boolean = false;
  const [doc, setDoc] = createSignal<Doc>(docMap.get(id)!);

  const binding = createMemo(() =>
    createBinding(editor, provider, id, doc(), docMap, excludedProperties)
  );

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

  createEffect(
    on(binding, () => {
      const { root } = binding();
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
          initializeEditor(editor, initialEditorState);
        }

        isReloadingDoc = false;
      };

      const onAwarenessUpdate = () => {
        syncCursorPositions(binding(), provider);
      };

      const onYjsTreeChanges = (
        // The below `any` type is taken directly from the vendor types for YJS.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        events: Array<YEvent<any>>,
        transaction: Transaction
      ) => {
        const origin = transaction.origin;
        if (origin !== binding()) {
          const isFromUndoManager = origin instanceof UndoManager;
          syncYjsChangesToLexical(
            binding(),
            provider,
            events,
            isFromUndoManager
          );
        }
      };

      initLocalState(
        provider,
        name,
        color,
        document.activeElement === editor.getRootElement()
      );

      const onProviderDocReload = (ydoc: Doc) => {
        clearEditorSkipCollab(editor, binding());
        setDoc(ydoc);
        docMap.set(id, ydoc);
        isReloadingDoc = true;
      };

      provider.on("reload", onProviderDocReload);
      provider.on("status", onStatus);
      provider.on("sync", onSync);
      awareness.on("update", onAwarenessUpdate);
      // This updates the local editor state when we recieve updates from other clients
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
              binding(),
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

      onCleanup(() => {
        if (isReloadingDoc === false) {
          disconnect();
        }

        provider.off("sync", onSync);
        provider.off("status", onStatus);
        provider.off("reload", onProviderDocReload);
        awareness.off("update", onAwarenessUpdate);
        root.getSharedType().unobserveDeep(onYjsTreeChanges);
        docMap.delete(id);
        removeListener();
      });
    })
  );
  const cursorsContainer = createMemo(() => {
    const ref = (element: null | HTMLElement) => {
      binding().cursorsContainer = element;
    };

    const mountPoint =
      (cursorsContainerRef && cursorsContainerRef()) || document.body;

    return (
      <Portal mount={mountPoint}>
        <div ref={ref} />
      </Portal>
    );
  });

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
  provider: Provider,
  name: string,
  color: string
) {
  onCleanup(
    mergeRegister(
      editor.registerCommand(
        FOCUS_COMMAND,
        () => {
          setLocalStateFocus(provider, name, color, true);
          return false;
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          setLocalStateFocus(provider, name, color, false);
          return false;
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

function initializeEditor(
  editor: LexicalEditor,
  initialEditorState?: InitialEditorStateType
): void {
  editor.update(
    () => {
      const root = $getRoot();

      if (root.isEmpty()) {
        if (initialEditorState) {
          switch (typeof initialEditorState) {
            case "string": {
              const parsedEditorState =
                editor.parseEditorState(initialEditorState);
              editor.setEditorState(parsedEditorState, {
                tag: "history-merge",
              });
              break;
            }
            case "object": {
              editor.setEditorState(initialEditorState, {
                tag: "history-merge",
              });
              break;
            }
            case "function": {
              editor.update(
                () => {
                  const root1 = $getRoot();
                  if (root1.isEmpty()) {
                    initialEditorState(editor);
                  }
                },
                { tag: "history-merge" }
              );
              break;
            }
          }
        } else {
          const paragraph = $createParagraphNode();
          root.append(paragraph);
          const { activeElement } = document;

          if (
            $getSelection() !== null ||
            (activeElement !== null &&
              activeElement === editor.getRootElement())
          ) {
            paragraph.select();
          }
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

  const cursors = binding.cursors;

  if (cursors == null) {
    return;
  }
  const cursorsContainer = binding.cursorsContainer;

  if (cursorsContainer == null) {
    return;
  }

  // reset cursors in dom
  const cursorsArr = Array.from(cursors.values());

  for (let i = 0; i < cursorsArr.length; i++) {
    const cursor = cursorsArr[i];
    const selection = cursor.selection;

    if (selection && selection.selections != null) {
      const selections = selection.selections;

      for (let j = 0; j < selections.length; j++) {
        cursorsContainer.removeChild(selections[i]);
      }
    }
  }
}
