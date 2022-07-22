import { JSX, Show } from "solid-js";
import { useLexicalComposerContext } from "lexical-solid/LexicalComposerContext";
import { useRichTextSetup } from "lexical-solid/shared/useRichTextSetup";
import { InitialEditorStateType } from "lexical-solid/shared/PlainRichTextUtils";
import { useCanShowPlaceholder } from "lexical-solid/shared/useCanShowPlaceholder";
import useDecorators from "lexical-solid/shared/useDecorators";

export function RichTextPlugin(props: {
  contentEditable: JSX.Element;
  initialEditorState?: InitialEditorStateType;
  placeholder: JSX.Element;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const showPlaceholder = useCanShowPlaceholder(editor);
  useRichTextSetup(editor, props.initialEditorState);
  const decorators = useDecorators(editor);
  return (
    <>
      {props.contentEditable}
      <Show when={showPlaceholder()}>{props.placeholder}</Show>
      {decorators()}
    </>
  );
}