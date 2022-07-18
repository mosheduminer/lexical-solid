import { createSignal, JSX, mergeProps, onCleanup, onMount } from "solid-js";
import { $ReadOnly } from "utility-types";
import { useLexicalComposerContext } from "./LexicalComposerContext";

type Props = $ReadOnly<{
  ariaActiveDescendantID?: string;
  ariaAutoComplete?: string;
  ariaControls?: string;
  ariaDescribedBy?: string;
  ariaExpanded?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaMultiline?: boolean;
  ariaOwneeID?: string;
  ariaRequired?: string;
  autoCapitalize?: string;
  autoComplete?: boolean;
  autoCorrect?: boolean;
  className?: string;
  id?: string;
  readOnly?: boolean;
  role?: string;
  style?: StyleSheetList;
  spellCheck?: boolean;
  tabIndex?: number;
  testid?: string;
}>;

export function ContentEditable(props: Props): JSX.Element {
  props = mergeProps({ role: "textbox", spellCheck: true }, props);
  const [editor] = useLexicalComposerContext();
  const [isReadOnly, setReadOnly] = createSignal(true);
  const ref = (rootElement: HTMLElement) => {
    editor.setRootElement(rootElement);
  };
  onMount(() => {
    setReadOnly(editor.isReadOnly());
    onCleanup(
      editor.registerReadOnlyListener((currentIsReadOnly) => {
        setReadOnly(currentIsReadOnly);
      })
    );
  });
  function ifNotReadonly<T>(value: T): T | undefined {
    if (isReadOnly()) return undefined;
    return value;
  }
  return (
    <div
      aria-activedescendant={ifNotReadonly(props.ariaActiveDescendantID)}
      aria-autocomplete={ifNotReadonly(props.ariaAutoComplete)}
      aria-controls={ifNotReadonly(props.ariaControls)}
      aria-describedby={props.ariaDescribedBy}
      aria-expanded={ifNotReadonly(
        props.role === "combobox" ? !!props.ariaExpanded : undefined
      )}
      aria-label={props.ariaLabel}
      aria-labelledby={props.ariaLabelledBy}
      aria-multiline={props.ariaMultiline}
      aria-owns={ifNotReadonly(props.ariaOwneeID)}
      aria-required={props.ariaRequired}
      autoCapitalize={props.autoCapitalize !== undefined ? String(props.autoCapitalize) : undefined}
      //@ts-ignore
      autoComplete={props.autoComplete ? "on" : "off"}
      autoCorrect={props.autoCorrect !== undefined ? String(props.autoCorrect) : undefined}
      className={props.className}
      contentEditable={!isReadOnly()}
      data-testid={props.testid}
      id={props.id}
      ref={ref}
      role={ifNotReadonly(props.role)}
      spellcheck={props.spellCheck}
      style={props.style}
      tabIndex={props.tabIndex}
    />
  );
}

export type { Props };
