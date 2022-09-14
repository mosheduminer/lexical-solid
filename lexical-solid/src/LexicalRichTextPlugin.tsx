import { JSX, Show } from "solid-js";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import { useRichTextSetup } from "./shared/useRichTextSetup";
import { InitialEditorStateType } from "./shared/PlainRichTextUtils";
import { useCanShowPlaceholder } from "./shared/useCanShowPlaceholder";
import useDecorators from "./shared/useDecorators";

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