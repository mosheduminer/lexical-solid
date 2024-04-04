import {
  LexicalComposerContextType,
  createLexicalComposerContext,
  LexicalComposerContext,
} from "./LexicalComposerContext";
import { useCollaborationContext } from "./LexicalCollaborationContext";
import {
  EditorThemeClasses,
  Klass,
  LexicalEditor,
  LexicalNode,
  LexicalNodeReplacement,
} from "lexical";
import type { KlassConstructor, Transform } from "lexical";
import { createEffect, JSX, onCleanup, useContext } from "solid-js";

function getTransformSetFromKlass(
  klass: KlassConstructor<typeof LexicalNode>
): Set<Transform<LexicalNode>> {
  const transform = klass.transform();
  return transform !== null
    ? new Set<Transform<LexicalNode>>([transform])
    : new Set<Transform<LexicalNode>>();
}

export function LexicalNestedComposer(props: {
  children: JSX.Element;
  initialEditor: LexicalEditor;
  initialTheme?: EditorThemeClasses;
  initialNodes?: ReadonlyArray<Klass<LexicalNode> | LexicalNodeReplacement>;
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
        transforms: getTransformSetFromKlass(entry.klass),
        exportDOM: entry.exportDOM,
      });
    }
  } else {
    for (let klass of props.initialNodes) {
      let replace = null;
      let replaceWithKlass = null;

      if (typeof klass !== "function") {
        const options = klass;
        klass = options.replace;
        replace = options.with;
        replaceWithKlass = options.withKlass || null;
      }
      const registeredKlass = props.initialEditor._nodes.get(klass.getType());
      props.initialEditor._nodes.set(klass.getType(), {
        exportDOM: registeredKlass ? registeredKlass.exportDOM : undefined,
        klass,
        replace,
        replaceWithKlass,
        transforms: getTransformSetFromKlass(klass),
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
