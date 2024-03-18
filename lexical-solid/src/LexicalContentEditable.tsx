import { createSignal, JSX, mergeProps, onCleanup, onMount } from "solid-js";
import { useLexicalComposerContext } from "./LexicalComposerContext";

type Props = Readonly<{
  ariaActiveDescendant?: string;
  ariaAutoComplete?: JSX.HTMLAttributes<HTMLDivElement>["aria-autocomplete"];
  ariaControls?: string;
  ariaDescribedBy?: string;
  ariaExpanded?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaMultiline?: boolean;
  ariaOwns?: string;
  ariaRequired?: JSX.HTMLAttributes<HTMLDivElement>["aria-required"];
  autoCapitalize?: JSX.HTMLAutocapitalize;
  autoComplete?: boolean;
  autoCorrect?: boolean;
  class?: string;
  id?: string;
  readOnly?: boolean;
  role?: string;
  style?: JSX.HTMLAttributes<HTMLDivElement>["style"];
  spellCheck?: boolean;
  tabIndex?: number;
  testid?: string;
}>;

export function ContentEditable(props: Props): JSX.Element {
  props = mergeProps({ role: "textbox", spellCheck: true }, props);
  const [editor] = useLexicalComposerContext();
  const [isEditable, setEditable] = createSignal(false);
  let rootElementRef!: HTMLDivElement;
  onMount(() => {
    // defaultView is required for a root element.
    // In multi-window setups, the defaultView may not exist at certain points.
    if (
      rootElementRef &&
      rootElementRef.ownerDocument &&
      rootElementRef.ownerDocument.defaultView
    ) {
      editor.setRootElement(rootElementRef);
    }
  });
  onMount(() => {
    setEditable(editor.isEditable());
    onCleanup(
      editor.registerEditableListener((currentIsReadOnly) => {
        setEditable(currentIsReadOnly);
      })
    );
  });
  function ifNotReadonly<T, U = undefined>(
    value: T,
    fallback?: U
  ): T | U | undefined {
    if (!isEditable()) return fallback;
    return value;
  }
  return (
    <div
      aria-activedescendant={ifNotReadonly(props.ariaActiveDescendant)}
      aria-autocomplete={ifNotReadonly(props.ariaAutoComplete, "none")}
      aria-controls={ifNotReadonly(props.ariaControls)}
      aria-describedby={props.ariaDescribedBy}
      aria-expanded={ifNotReadonly(
        props.role === "combobox" ? !!props.ariaExpanded : undefined
      )}
      aria-label={props.ariaLabel}
      aria-labelledby={props.ariaLabelledBy}
      aria-multiline={props.ariaMultiline}
      aria-owns={ifNotReadonly(props.ariaOwns)}
      aria-readonly={isEditable() ? true : undefined}
      aria-required={props.ariaRequired}
      autoCapitalize={props.autoCapitalize}
      class={props.class}
      contentEditable={isEditable()}
      data-testid={props.testid}
      id={props.id}
      ref={rootElementRef}
      role={props.role as JSX.HTMLAttributes<HTMLDivElement>["role"]}
      spellcheck={props.spellCheck}
      style={props.style}
      tabIndex={props.tabIndex}
    />
  );
}

export type { Props };
