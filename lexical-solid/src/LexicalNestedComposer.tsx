import {
  LexicalComposerContextType,
  createLexicalComposerContext,
  LexicalComposerContext,
} from "./LexicalComposerContext";
import { useCollaborationContext } from "./LexicalCollaborationContext";
import { EditorThemeClasses, Klass, LexicalEditor, LexicalNode } from "lexical";
import { createEffect, JSX, onCleanup, useContext } from "solid-js";

export function LexicalNestedComposer(props: {
  children: JSX.Element;
  initialEditor: LexicalEditor;
  initialTheme?: EditorThemeClasses;
  initialNodes?: ReadonlyArray<Klass<LexicalNode>>;
  skipCollabChecks?: true;
}): JSX.Element {
  let wasCollabPreviouslyReadyRef = false;
  const parentContext = useContext(LexicalComposerContext);

  if (parentContext == null) {
    throw Error("Unexpected parent context null on a nested composer");
  }

  const [parentEditor, { getTheme: getParentTheme }] = parentContext;

  const composerTheme: EditorThemeClasses | undefined =
    props.initialTheme || getParentTheme() || undefined;

  const context: LexicalComposerContextType = createLexicalComposerContext(
    parentContext,
    composerTheme
  );

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
        replace: entry.replace,
        replaceWithKlass: entry.replaceWithKlass,
        transforms: new Set(),
      });
    }
  } else {
    for (const klass of props.initialNodes) {
      const type = klass.getType();
      props.initialEditor._nodes.set(type, {
        klass,
        replace: null,
        replaceWithKlass: null,
        transforms: new Set(),
      });
    }
  }
  props.initialEditor._config.namespace = parentEditor._config.namespace;
  props.initialEditor._editable = parentEditor._editable;

  // If collaboration is enabled, make sure we don't render the children until the collaboration subdocument is ready.
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

  // Update `isEditable` state of nested editor in response to the same change on parent editor.
  createEffect(() => {
    onCleanup(
      parentEditor.registerEditableListener((editable) => {
        props.initialEditor.setEditable(editable);
      })
    );
  });

  return (
    <LexicalComposerContext.Provider value={[props.initialEditor, context]}>
      {!isCollabActive || isCollabReady() ? props.children : null}
    </LexicalComposerContext.Provider>
  );
}
