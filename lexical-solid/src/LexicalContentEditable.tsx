import type { Props as ElementProps } from "./shared/LexicalContentEditableElement";
import type { LexicalEditor } from "lexical";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  createEffect,
  createMemo,
  createSignal,
  JSX,
  onCleanup,
  Show,
  splitProps,
} from "solid-js";
import { ContentEditableElement } from "./shared/LexicalContentEditableElement";
import { useCanShowPlaceholder } from "./shared/useCanShowPlaceholder";

export type ContentEditableProps = Omit<ElementProps, "editor"> &
  (
    | {
        "aria-placeholder"?: void;
        placeholder?: null;
      }
    | {
        "aria-placeholder": string;
        placeholder: (isEditable: boolean) => null | JSX.Element;
      }
  );

/**
 * @deprecated This type has been renamed to `ContentEditableProps` to provide a clearer and more descriptive name.
 * For backward compatibility, this type is still exported as `Props`, but it is recommended to migrate to using `ContentEditableProps` instead.
 *
 * @note This alias is maintained for compatibility purposes but may be removed in future versions.
 * Please update your codebase to use `ContentEditableProps` to ensure long-term maintainability.
 */
export type Props = ContentEditableProps;

export function ContentEditable(props: Props): JSX.Element {
  const [, rest] = splitProps(props, ["placeholder"]);
  const [editor] = useLexicalComposerContext();

  return (
    <>
      <ContentEditableElement editor={editor} {...rest} ref={props.ref} />
      {props.placeholder != null && (
        <Placeholder editor={editor} content={props.placeholder} />
      )}
    </>
  );
}

function Placeholder(props: {
  editor: LexicalEditor;
  content: (isEditable: boolean) => null | JSX.Element;
}): JSX.Element {
  const showPlaceholder = useCanShowPlaceholder(props.editor);

  const [isEditable, setEditable] = createSignal(props.editor.isEditable());
  createEffect(() => {
    setEditable(props.editor.isEditable());
    onCleanup(
      props.editor.registerEditableListener((currentIsEditable) => {
        setEditable(currentIsEditable);
      })
    );
  });
  const placeholder = createMemo(() => props.content(isEditable()));

  if (placeholder === null) {
    return null;
  }
  return (
    <Show when={showPlaceholder() && placeholder()}>
      <div aria-hidden={true}>{placeholder()}</div>
    </Show>
  );
}
