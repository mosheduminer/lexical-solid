import { Doc } from "yjs";
import { useCollaborationContext } from "./LexicalCollaborationContext";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import { WebsocketProvider } from "y-websocket";
import { InitialEditorStateType } from "./LexicalComposer";
import {
  CursorsContainerRef,
  useYjsCollaboration,
  useYjsFocusTracking,
  useYjsHistory,
} from "./shared/useYjsCollaboration";
import { createEffect, createMemo, JSX, onCleanup } from "solid-js";

export function CollaborationPlugin({
  id,
  providerFactory,
  shouldBootstrap,
  username,
  cursorColor,
  cursorsContainerRef,
  initialEditorState,
}: {
  id: string;
  providerFactory: (
    // eslint-disable-next-line no-shadow
    id: string,
    yjsDocMap: Map<string, Doc>
  ) => WebsocketProvider;
  shouldBootstrap: boolean;
  username?: string;
  cursorColor?: string;
  cursorsContainerRef?: CursorsContainerRef;
  initialEditorState?: InitialEditorStateType;
}): JSX.Element {
  const collabContext = useCollaborationContext(username, cursorColor);

  const { yjsDocMap, name, color } = collabContext;

  const [editor] = useLexicalComposerContext();

  createEffect(() => {
    collabContext.isCollabActive = true;

    onCleanup(() => {
      // Reseting flag only when unmount top level editor collab plugin. Nested
      // editors (e.g. image caption) should unmount without affecting it
      if (editor._parentEditor == null) {
        collabContext.isCollabActive = false;
      }
    });
  });

  const provider = createMemo(() => providerFactory(id, yjsDocMap));

  const [cursors, binding] = useYjsCollaboration(
    editor,
    id,
    provider(),
    yjsDocMap,
    name,
    color,
    shouldBootstrap,
    cursorsContainerRef,
    initialEditorState
  );

  collabContext.clientID = binding().clientID;

  useYjsHistory(editor, binding());
  useYjsFocusTracking(editor, provider(), name, color);

  return cursors;
}
