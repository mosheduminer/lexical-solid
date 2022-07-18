import { JSX, Show } from "solid-js";
import { useLexicalComposerContext } from "./LexicalComposerContext";

import useDecorators from "./shared/useDecorators";
import { usePlainTextSetup } from "./shared/usePlainTextSetup";
import { useCanShowPlaceholder } from "./shared/useCanShowPlaceholder";
import { InitialEditorStateType } from "./shared/PlainRichTextUtils";

export function PlainTextPlugin(props: {
  contentEditable: JSX.Element;
  initialEditorState?: InitialEditorStateType;
  placeholder: JSX.Element;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const showPlaceholder = useCanShowPlaceholder(editor);
  usePlainTextSetup(editor, props.initialEditorState);
  const decorators = useDecorators(editor);
  return (
    <>
      {props.contentEditable}
      <Show when={showPlaceholder()}>{props.placeholder}</Show>
      {decorators()}
    </>
  );
}
