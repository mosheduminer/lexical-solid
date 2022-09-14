
import type { Doc } from "yjs";

import { useLexicalComposerContext } from "./LexicalComposerContext";
import { createEffect, JSX, onCleanup } from "solid-js";
import {WebsocketProvider} from 'y-websocket';

import {
  useYjsCollaboration,
  useYjsFocusTracking,
  useYjsHistory,
} from "./shared/useYjsCollaboration";
import { useCollaborationContext } from "./LexicalCollaborationContext";

export function CollaborationPlugin({
  id,
  providerFactory,
  shouldBootstrap,
  username,
}: {
  id: string;
  providerFactory: (id: string, yjsDocMap: Map<string, Doc>) => WebsocketProvider;
  shouldBootstrap: boolean;
  username?: string;
}): JSX.Element {
  const collabContext = useCollaborationContext(username);
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
  const provider = providerFactory(id, yjsDocMap);
  const [cursors, binding] = useYjsCollaboration(
    editor,
    id,
    provider,
    yjsDocMap,
    name,
    color,
    shouldBootstrap
  );
  collabContext.clientID = binding.clientID;
  useYjsHistory(editor, binding);
  useYjsFocusTracking(editor, provider, name, color);

  return cursors;
}
