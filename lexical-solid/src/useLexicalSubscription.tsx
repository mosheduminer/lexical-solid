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
 * @param subscription - The function to create the {@link LexicalSubscription}. This function's identity must be stable (e.g. defined at module scope or with useCallback).
 */
export function useLexicalSubscription<T>(
  subscription: (editor: LexicalEditor) => LexicalSubscription<T>
): Accessor<T> {
  const [editor] = useLexicalComposerContext();
  const initializedSubscription = createMemo(() => subscription(editor));
  const [value, setValue] = createSignal<T>(
    initializedSubscription().initialValueFn()
  );
  const valueRef = { current: value() };
  createEffect(() => {
    const { initialValueFn, subscribe } = initializedSubscription();
    const currentValue = initialValueFn();
    if (valueRef.current !== currentValue) {
      valueRef.current = currentValue;
      setValue(() => currentValue);
    }

    onCleanup(
      subscribe((newValue: T) => {
        valueRef.current = newValue;
        setValue(() => newValue);
      })
    );
  });

  return value;
}
