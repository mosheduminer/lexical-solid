import { Doc } from "yjs";
import {
  type CollaborationContextType,
  useCollaborationContext,
} from "./LexicalCollaborationContext";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  Binding,
  createBinding,
  ExcludedProperties,
  Provider,
} from "@lexical/yjs";
import { LexicalEditor } from "lexical";
import { InitialEditorStateType } from "./LexicalComposer";
import {
  CursorsContainerRef,
  useYjsCollaboration,
  useYjsFocusTracking,
  useYjsHistory,
} from "./shared/useYjsCollaboration";
import {
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  JSX,
  on,
  onCleanup,
  Setter,
  Show,
} from "solid-js";

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
  // `awarenessData` parameter allows arbitrary data to be added to the awareness.
  awarenessData?: object;
};

export function CollaborationPlugin(props: Props): JSX.Element {
  const isBindingInitialized = { current: false };
  const isProviderInitialized = { current: false };

  const collabContext = useCollaborationContext(
    props.username,
    props.cursorColor
  );

  const { yjsDocMap, name, color } = collabContext;

  const [editor] = useLexicalComposerContext();

  createEffect(() => {
    collabContext.isCollabActive = true;

    return () => {
      // Reseting flag only when unmount top level editor collab plugin. Nested
      // editors (e.g. image caption) should unmount without affecting it
      if (editor._parentEditor == null) {
        collabContext.isCollabActive = false;
      }
    };
  }, [collabContext, editor]);

  const [provider, setProvider] = createSignal<Provider>();

  createEffect(
    on(
      () => [props.id, props.providerFactory, yjsDocMap],
      () => {
        if (isProviderInitialized.current) {
          return;
        }

        isProviderInitialized.current = true;

        const newProvider = props.providerFactory(props.id, yjsDocMap);
        setProvider(newProvider);

        onCleanup(() => newProvider.disconnect());
      }
    )
  );

  const [doc, setDoc] = createSignal(yjsDocMap.get(props.id));
  const [binding, setBinding] = createSignal<Binding>();

  createEffect(() => {
    const p = provider();
    if (!p) {
      return;
    }

    if (isBindingInitialized.current) {
      return;
    }

    isBindingInitialized.current = true;

    const newBinding = createBinding(
      editor,
      p,
      props.id,
      doc() || yjsDocMap.get(props.id),
      yjsDocMap,
      props.excludedProperties
    );
    setBinding(newBinding);

    return () => {
      newBinding.root.destroy(newBinding);
    };
  });

  return (
    <Show when={provider() && binding()}>
      <YjsCollaborationCursors
        awarenessData={props.awarenessData}
        binding={binding()!}
        collabContext={collabContext}
        color={color}
        cursorsContainerRef={props.cursorsContainerRef}
        editor={editor}
        id={props.id}
        initialEditorState={props.initialEditorState}
        name={name}
        provider={provider()!}
        setDoc={setDoc}
        shouldBootstrap={props.shouldBootstrap}
        yjsDocMap={yjsDocMap}
      />
    </Show>
  );
}

function YjsCollaborationCursors(props: {
  editor: LexicalEditor;
  id: string;
  provider: Provider;
  yjsDocMap: Map<string, Doc>;
  name: string;
  color: string;
  shouldBootstrap: boolean;
  binding: Binding;
  setDoc: Setter<Doc | undefined>;
  cursorsContainerRef?: CursorsContainerRef | undefined;
  initialEditorState?: InitialEditorStateType | undefined;
  awarenessData?: object;
  collabContext: CollaborationContextType;
}) {
  const cursors = useYjsCollaboration(
    props.editor,
    props.id,
    () => props.provider,
    props.yjsDocMap,
    props.name,
    props.color,
    props.shouldBootstrap,
    () => props.binding,
    props.setDoc,
    props.cursorsContainerRef,
    props.initialEditorState,
    props.awarenessData
  );

  createRenderEffect(() => {
    props.collabContext.clientID = props.binding.clientID;
  })

  useYjsHistory(props.editor, () => props.binding);
  useYjsFocusTracking(
    props.editor,
    () => props.provider,
    props.name,
    props.color,
    props.awarenessData
  );

  return <>{cursors}</>;
}
