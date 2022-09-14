import type { LexicalComposerContextWithEditor } from "./LexicalComposerContext";
import type {
  EditorThemeClasses,
  Klass,
  LexicalEditor,
  LexicalNode,
} from "lexical";

import { useCollaborationContext } from "./LexicalCollaborationContext";
import {
  createLexicalComposerContext,
  LexicalComposerContext,
} from "./LexicalComposerContext";
import { createEffect, JSX, useContext } from "solid-js";

export function LexicalNestedComposer(props: {
  children: JSX.Element;
  initialEditor: LexicalEditor;
  initialTheme?: EditorThemeClasses;
  initialNodes?: ReadonlyArray<Klass<LexicalNode>>;
  skipCollabChecks?: boolean;
}): JSX.Element {
  const parentContext = useContext(LexicalComposerContext);
  let wasCollabPreviouslyReadyRef = false;
  if (parentContext == null) {
    throw Error("Unexpected parent context null on a nested composer");
  }

  const [parentEditor, parentContextContext] = parentContext!;
  const composerTheme =
    props.initialTheme || parentContextContext.getTheme() || undefined;

  const context = createLexicalComposerContext(parentContext, composerTheme);
  if (composerTheme !== undefined) {
    props.initialEditor._config.theme = composerTheme;
  }
  props.initialEditor._parentEditor = parentEditor;

  if (!props.initialNodes) {
    const parentNodes = (props.initialEditor._nodes = new Map(
      parentEditor._nodes
    ));
    for (const [type, entry] of parentNodes) {
      props.initialEditor._nodes.set(type, {
        klass: entry.klass,
        transforms: new Set(),
      });
    }
  } else {
    for (const klass of props.initialNodes) {
      const type = klass.getType();
      props.initialEditor._nodes.set(type, {
        klass,
        transforms: new Set(),
      });
    }
  }

  props.initialEditor._config.namespace = parentEditor._config.namespace;

  const composerContext: LexicalComposerContextWithEditor = [
    props.initialEditor,
    context,
  ];
  // If collaboration is enabled, make sure we don't render the children
  // until the collaboration subdocument is ready.
  const { isCollabActive, yjsDocMap } = useCollaborationContext();
  const isCollabReady = () =>
    props.skipCollabChecks ||
    wasCollabPreviouslyReadyRef ||
    yjsDocMap.has(props.initialEditor.getKey());

  createEffect(() => {
    if (isCollabReady()) {
      wasCollabPreviouslyReadyRef = true;
    }
  });

  return (
    <LexicalComposerContext.Provider value={composerContext}>
      {!isCollabActive || isCollabReady() ? props.children : null}
    </LexicalComposerContext.Provider>
  );
}
