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
import type { EditableListener, KlassConstructor, Transform } from "lexical";
import { createEffect, JSX, onCleanup, useContext } from "solid-js";
import warnOnlyOnce from "./shared/warnOnlyOnce";

function getTransformSetFromKlass(
  klass: KlassConstructor<typeof LexicalNode>
): Set<Transform<LexicalNode>> {
  const transform = klass.transform();
  return new Set(transform ? [transform] : []);
}

export interface LexicalNestedComposerProps {
  /**
   * Any children (e.g. plug-ins) for this editor. Note that the nested editor
   * does not inherit any plug-ins or registrations from those plug-ins (such
   * as transforms and command listeners that may be necessary for correct
   * operation of those nodes) from the parent editor. If you are using nodes
   * that require plug-ins they must also be instantiated here.
   */
  children?: JSX.Element;
  /**
   * The nested editor, created outside of this component (typically in the
   * implementation of a LexicalNode) with {@link createEditor}
   */
  initialEditor: LexicalEditor;
  /**
   * Optionally overwrite the theme of the initialEditor
   */
  initialTheme?: EditorThemeClasses;
  /**
   * @deprecated This feature is not safe or correctly implemented and will be
   * removed in v0.32.0. The only correct time to configure the nodes is when
   * creating the initialEditor.
   *
   * @example
   * ```ts
   * // This is normally in the implementation of a LexicalNode that
   * // owns the nested editor
   * editor = createEditor({nodes: [], parentEditor: $getEditor()});
   * ```
   */
  initialNodes?: ReadonlyArray<Klass<LexicalNode> | LexicalNodeReplacement>;
  /**
   * If this is not explicitly set to true, and the collab plugin is active,
   * rendering the children of this component will not happen until collab is ready.
   */
  skipCollabChecks?: undefined | true;
  /**
   * If this is not explicitly set to true, the editable state of the nested
   * editor will automatically follow the parent editor's editable state.
   * When set to true, the nested editor is responsible for managing its own
   * editable state.
   *
   * Available since v0.29.0
   */
  skipEditableListener?: undefined | true;
}

const initialNodesWarning = warnOnlyOnce(
  `LexicalNestedComposer initialNodes is deprecated and will be removed in v0.32.0, it has never worked correctly.\nYou can configure your editor's nodes with createEditor({nodes: [], parentEditor: $getEditor()})`
);
const explicitNamespaceWarning = warnOnlyOnce(
  `LexicalNestedComposer initialEditor should explicitly initialize its namespace when the node configuration differs from the parentEditor. For backwards compatibility, the namespace will be initialized from parentEditor until v0.32.0, but this has always had incorrect copy/paste behavior when the configuration differed.\nYou can configure your editor's namespace with createEditor({namespace: 'nested-editor-namespace', nodes: [], parentEditor: $getEditor()}).`
);

export function LexicalNestedComposer(
  props: LexicalNestedComposerProps
): JSX.Element {
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

  const initialEditor = props.initialEditor;

  if (composerTheme !== undefined) {
    initialEditor._config.theme = composerTheme;
  }

  initialEditor._parentEditor = initialEditor._parentEditor || parentEditor;
  const createEditorArgs = initialEditor._createEditorArgs;
  const explicitNamespace = createEditorArgs && createEditorArgs.namespace;

  if (!props.initialNodes) {
    if (!(createEditorArgs && createEditorArgs.nodes)) {
      const parentNodes = (props.initialEditor._nodes = new Map(
        parentEditor._nodes
      ));
      if (!explicitNamespace) {
        // This is the only safe situation to inherit the parent's namespace
        initialEditor._config.namespace = parentEditor._config.namespace;
      }
      for (const [type, entry] of parentNodes) {
        initialEditor._nodes.set(type, {
          exportDOM: entry.exportDOM,
          klass: entry.klass,
          replace: entry.replace,
          replaceWithKlass: entry.replaceWithKlass,
          transforms: getTransformSetFromKlass(entry.klass),
        });
      }
    } else if (!explicitNamespace) {
      initialNodesWarning();
      if (!explicitNamespace) {
        explicitNamespaceWarning();
        initialEditor._config.namespace = parentEditor._config.namespace;
      }
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
    if (!props.skipEditableListener) {
      const editableListener: EditableListener = (editable) =>
        initialEditor.setEditable(editable);
      editableListener(parentEditor.isEditable());
      onCleanup(parentEditor.registerEditableListener(editableListener));
    }
  });

  return (
    <LexicalComposerContext.Provider value={[props.initialEditor, context]}>
      {!isCollabActive || isCollabReady() ? props.children : null}
    </LexicalComposerContext.Provider>
  );
}
