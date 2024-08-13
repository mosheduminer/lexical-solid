import type { LexicalEditor } from "lexical";

import { mergeRefs } from "./mergeRefs";
import { JSX } from "solid-js/jsx-runtime";
import {
  createEffect,
  createSignal,
  mergeProps,
  onCleanup,
  splitProps,
} from "solid-js";
import { useLexicalComposerContext } from "../LexicalComposerContext";

export type Props = {
  editor: LexicalEditor;
  ariaActiveDescendant?: JSX.HTMLAttributes<HTMLDivElement>["aria-activedescendant"];
  ariaAutoComplete?: JSX.HTMLAttributes<HTMLDivElement>["aria-autocomplete"];
  ariaControls?: JSX.HTMLAttributes<HTMLDivElement>["aria-controls"];
  ariaDescribedBy?: JSX.HTMLAttributes<HTMLDivElement>["aria-describedby"];
  ariaExpanded?: JSX.HTMLAttributes<HTMLDivElement>["aria-expanded"];
  ariaLabel?: JSX.HTMLAttributes<HTMLDivElement>["aria-label"];
  ariaLabelledBy?: JSX.HTMLAttributes<HTMLDivElement>["aria-labelledby"];
  ariaMultiline?: JSX.HTMLAttributes<HTMLDivElement>["aria-multiline"];
  ariaOwns?: JSX.HTMLAttributes<HTMLDivElement>["aria-owns"];
  ariaRequired?: JSX.HTMLAttributes<HTMLDivElement>["aria-required"];
  autoCapitalize?: HTMLDivElement["autocapitalize"];
  "data-testid"?: string | null | undefined;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "placeholder">;

export function ContentEditableElement(props: Props): JSX.Element {
  props = mergeProps(
    {
      role: "textbox" as JSX.HTMLAttributes<HTMLDivElement>["role"],
      spellCheck: true,
    },
    props
  );
  const [, rest] = splitProps(props, [
    "ariaActiveDescendant",
    "ariaAutoComplete",
    "ariaControls",
    "ariaDescribedBy",
    "ariaExpanded",
    "ariaLabel",
    "ariaLabelledBy",
    "ariaMultiline",
    "ariaOwns",
    "ariaRequired",
    "autoCapitalize",
    "class",
    "data-testid",
    "id",
    "ref",
    "role",
    "spellcheck",
    "style",
    "tabIndex",
  ]);
  const [editor] = useLexicalComposerContext();
  const [isEditable, setEditable] = createSignal(editor.isEditable());

  const handleRef = (rootElement: null | HTMLElement) => {
    // defaultView is required for a root element.
    // In multi-window setups, the defaultView may not exist at certain points.
    if (
      rootElement &&
      rootElement.ownerDocument &&
      rootElement.ownerDocument.defaultView
    ) {
      editor.setRootElement(rootElement);
    } else {
      editor.setRootElement(null);
    }
  };

  createEffect(() => {
    setEditable(editor.isEditable());
    onCleanup(
      editor.registerEditableListener((currentIsEditable) => {
        setEditable(currentIsEditable);
      })
    );
  });

  return (
    <div
      {...rest}
      aria-activedescendant={
        isEditable() ? props.ariaActiveDescendant : undefined
      }
      aria-autocomplete={isEditable() ? props.ariaAutoComplete : "none"}
      aria-controls={isEditable() ? props.ariaControls : undefined}
      aria-describedby={props.ariaDescribedBy}
      aria-expanded={
        isEditable() && props.role === "combobox"
          ? !!props.ariaExpanded
          : undefined
      }
      aria-label={props.ariaLabel}
      aria-labelledby={props.ariaLabelledBy}
      aria-multiline={props.ariaMultiline}
      aria-owns={isEditable() ? props.ariaOwns : undefined}
      aria-readonly={isEditable() ? undefined : true}
      aria-required={props.ariaRequired}
      autoCapitalize={props.autoCapitalize}
      class={props.class}
      contentEditable={isEditable()}
      data-testid={props["data-testid"]}
      id={props.id}
      ref={mergeRefs(props.ref as (arg: HTMLDivElement) => void, handleRef)}
      role={isEditable() ? props.role : undefined}
      spellcheck={props.spellcheck}
      style={props.style}
      tabIndex={props.tabIndex}
    />
  );
}
