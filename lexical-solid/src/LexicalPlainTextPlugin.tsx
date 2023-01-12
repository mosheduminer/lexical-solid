import { useLexicalComposerContext } from "./LexicalComposerContext";
import { useLexicalEditable } from "./useLexicalEditable";
import { useCanShowPlaceholder } from "./shared/useCanShowPlaceholder";
import { ErrorBoundaryType, useDecorators } from "./shared/useDecorators";
import { usePlainTextSetup } from "./shared/usePlainTextSetup";
import { JSX } from "solid-js";

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

function Placeholder(props: {
  content: ((isEditable: boolean) => null | JSX.Element) | null | JSX.Element;
}): null | JSX.Element {
  const [editor] = useLexicalComposerContext();
  const showPlaceholder = useCanShowPlaceholder(editor);
  const editable = useLexicalEditable();

  if (!showPlaceholder()) {
    return null;
  }

  if (typeof props.content === "function") {
    return props.content(editable);
  } else {
    return props.content;
  }
}
