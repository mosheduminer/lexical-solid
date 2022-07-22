import { JSX, Show } from "solid-js";
import { useLexicalComposerContext } from "lexical-solid/LexicalComposerContext";

import useDecorators from "lexical-solid/shared/useDecorators";
import { usePlainTextSetup } from "lexical-solid/shared/usePlainTextSetup";
import { useCanShowPlaceholder } from "lexical-solid/shared/useCanShowPlaceholder";
import { InitialEditorStateType } from "lexical-solid/shared/PlainRichTextUtils";

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
