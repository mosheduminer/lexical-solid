import { LexicalEditor } from "lexical";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";

export type LexicalSubscription<T> = {
  initialValueFn: () => T;
  subscribe: (callback: (value: T) => void) => () => void;
};

/**
 * Shortcut to Lexical subscriptions when values are used for render.
 */
export function useLexicalSubscription<T>(
  subscription: (editor: LexicalEditor) => LexicalSubscription<T>
): Accessor<T> {
  const [editor] = useLexicalComposerContext();
  const initializedSubscription = createMemo(() => subscription(editor));
  let valueRef = initializedSubscription().initialValueFn();
  const [value, setValue] = createSignal<T>(valueRef);
  createEffect(() => {
    const { initialValueFn, subscribe } = initializedSubscription();
    const currentValue = initialValueFn();
    if (valueRef !== currentValue) {
      valueRef = currentValue;
      setValue(() => currentValue);
    }

    onCleanup(
      subscribe((newValue: T) => {
        valueRef = newValue;
        setValue(() => newValue);
      })
    );
  });

  return value;
}
