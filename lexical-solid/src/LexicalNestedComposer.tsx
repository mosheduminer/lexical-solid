import type { LexicalComposerContextWithEditor } from "./LexicalComposerContext";
import type { EditorThemeClasses, LexicalEditor } from "lexical";

import { useCollaborationContext } from "./LexicalCollaborationPlugin";
import {
  createLexicalComposerContext,
  LexicalComposerContext,
} from "./LexicalComposerContext";
import { JSX, useContext } from "solid-js";

export default function LexicalNestedComposer(props: {
  children: JSX.Element;
  initialEditor: LexicalEditor;
  initialTheme?: EditorThemeClasses;
}): JSX.Element {
  const parentContext = useContext(LexicalComposerContext);
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
  props.initialEditor._nodes = parentEditor._nodes;
  const composerContext: LexicalComposerContextWithEditor = [
    props.initialEditor,
    context,
  ];
  // If collaboration is enabled, make sure we don't render the children
  // until the collaboration subdocument is ready.
  const { yjsDocMap } = useCollaborationContext();
  const isCollab = yjsDocMap.get("main") !== undefined;
  const isCollabReady = yjsDocMap.has(props.initialEditor.getKey());

  return (
    <LexicalComposerContext.Provider value={composerContext}>
      {!isCollab || isCollabReady ? props.children : null}
    </LexicalComposerContext.Provider>
  );
}
