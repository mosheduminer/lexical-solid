import { Doc } from "yjs";
import { useCollaborationContext } from "./LexicalCollaborationContext";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import { InitialEditorStateType } from "./LexicalComposer";
import {
  CursorsContainerRef,
  useYjsCollaboration,
  useYjsFocusTracking,
  useYjsHistory,
} from "./shared/useYjsCollaboration";
import { ExcludedProperties, Provider } from "@lexical/yjs";
import { createEffect, createMemo, JSX, onCleanup } from "solid-js";

type Props = {
  id: string;
  providerFactory: (
    // eslint-disable-next-line no-shadow
    id: string,
    yjsDocMap: Map<string, Doc>
  ) => Provider;
  shouldBootstrap: boolean;
  username?: string;
  cursorColor?: string;
  cursorsContainerRef?: CursorsContainerRef;
  initialEditorState?: InitialEditorStateType;
  excludedProperties?: ExcludedProperties;
};

export function CollaborationPlugin(props: Props): JSX.Element {
  const collabContext = useCollaborationContext(
    props.username,
    props.cursorColor
  );

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

  const provider = createMemo(() => props.providerFactory(props.id, yjsDocMap));

  const [cursors, binding] = useYjsCollaboration(
    editor,
    props.id,
    provider(),
    yjsDocMap,
    name,
    color,
    props.shouldBootstrap,
    props.cursorsContainerRef,
    props.initialEditorState,
    props.excludedProperties
  );

  collabContext.clientID = binding().clientID;

  useYjsHistory(editor, binding());
  useYjsFocusTracking(editor, provider(), name, color);

  return cursors;
}
