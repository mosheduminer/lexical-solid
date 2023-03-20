import { useLexicalComposerContext } from "./LexicalComposerContext";
import { useLexicalEditable } from "./useLexicalEditable";
import { useCanShowPlaceholder } from "./shared/useCanShowPlaceholder";
import { ErrorBoundaryType, useDecorators } from "./shared/useDecorators";
import { useRichTextSetup } from "./shared/useRichTextSetup";
import { JSX, Show, createMemo } from "solid-js";
import { untrack } from "solid-js";

export function RichTextPlugin(props: {
  contentEditable: JSX.Element;
  placeholder:
    | ((isEditable: boolean) => null | JSX.Element)
    | null
    | JSX.Element;
  errorBoundary: ErrorBoundaryType;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const decorators = useDecorators(editor, props.errorBoundary);
  useRichTextSetup(editor);

  return (
    <>
      {props.contentEditable}
      <Placeholder content={props.placeholder} />
      {decorators}
    </>
  );
}

type ContentFunction = (isEditable: boolean) => null | JSX.Element;

function Placeholder(props: {
  content: ContentFunction | null | JSX.Element;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const showPlaceholder = useCanShowPlaceholder(editor);
  const editable = useLexicalEditable();
  const content = createMemo(() => props.content);

  return (
    <Show when={showPlaceholder()}>
      <Show
        when={typeof content() === "function"}
        fallback={content() as JSX.Element}
      >
        {untrack(() => (content() as ContentFunction)(editable()))}
      </Show>
    </Show>
  );
}
