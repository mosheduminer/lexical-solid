import { useLexicalComposerContext } from "./LexicalComposerContext";
import { useLexicalEditable } from "./useLexicalEditable";
import { useCanShowPlaceholder } from "./shared/useCanShowPlaceholder";
import { ErrorBoundaryType, useDecorators } from "./shared/useDecorators";
import { useRichTextSetup } from "./shared/useRichTextSetup";
import { JSX } from "solid-js";

export function RichTextPlugin(params: {
  contentEditable: JSX.Element;
  placeholder:
    | ((isEditable: boolean) => null | JSX.Element)
    | null
    | JSX.Element;
  errorBoundary: ErrorBoundaryType;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const decorators = useDecorators(editor, params.errorBoundary);
  useRichTextSetup(editor);

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
