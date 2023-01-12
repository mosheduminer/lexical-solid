import { useLexicalComposerContext } from "./LexicalComposerContext";
import { useLexicalEditable } from "./useLexicalEditable";
import { useCanShowPlaceholder } from "./shared/useCanShowPlaceholder";
import { ErrorBoundaryType, useDecorators } from "./shared/useDecorators";
import { usePlainTextSetup } from "./shared/usePlainTextSetup";
import { JSX, Show } from "solid-js";

export function PlainTextPlugin(params: {
  contentEditable: JSX.Element;
  placeholder:
    | ((isEditable: boolean) => null | JSX.Element)
    | null
    | JSX.Element;
  errorBoundary: ErrorBoundaryType;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const decorators = useDecorators(editor, params.errorBoundary);
  usePlainTextSetup(editor);

  return (
    <>
      {params.contentEditable}
      <Placeholder content={params.placeholder} />
      {decorators}
    </>
  );
}

type ContentFunction = (isEditable: boolean) => null | JSX.Element;

function Placeholder(props: {
  content: ContentFunction | null | JSX.Element;
}): null | JSX.Element {
  const [editor] = useLexicalComposerContext();
  const showPlaceholder = useCanShowPlaceholder(editor);
  const editable = useLexicalEditable();

  return (
    <Show when={showPlaceholder()}>
      <Show
        when={typeof props.content === "function"}
        fallback={props.content as JSX.Element}
      >
        {(props.content as ContentFunction)(editable)}
      </Show>
    </Show>
  );
}
