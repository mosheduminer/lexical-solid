import { useLexicalComposerContext } from "./LexicalComposerContext";
import { useCharacterLimit } from "./shared/useCharacterLimit";
import { createMemo, createSignal, JSX, mergeProps } from "solid-js";

const CHARACTER_LIMIT = 5;
let textEncoderInstance: null | TextEncoder = null;

function textEncoder(): null | TextEncoder {
  if (window.TextEncoder === undefined) {
    return null;
  }

  if (textEncoderInstance === null) {
    textEncoderInstance = new window.TextEncoder();
  }

  return textEncoderInstance;
}

function utf8Length(text: string) {
  const currentTextEncoder = textEncoder();

  if (currentTextEncoder === null) {
    // http://stackoverflow.com/a/5515960/210370
    const m = encodeURIComponent(text).match(/%[89ABab]/g);
    return text.length + (m ? m.length : 0);
  }

  return currentTextEncoder.encode(text).length;
}

export function CharacterLimitPlugin(props: {
  charset: "UTF-8" | "UTF-16";
  maxLength: number;
}): JSX.Element {
  props = mergeProps({ charset: "UTF-16", maxLength: CHARACTER_LIMIT }, props);
  const [editor] = useLexicalComposerContext();

  const [remainingCharacters, setRemainingCharacters] = createSignal(
    props.maxLength
  );

  const characterLimitProps = createMemo(() => ({
    remainingCharacters: setRemainingCharacters,
    strlen: (text: string) => {
      if (props.charset === "UTF-8") {
        return utf8Length(text);
      } else if (props.charset === "UTF-16") {
        return text.length;
      } else {
        throw new Error("Unrecognized charset");
      }
    },
  }));

  useCharacterLimit(editor, props.maxLength, characterLimitProps);

  return (
    <span
      class={`characters-limit ${
        remainingCharacters() < 0 ? "characters-limit-exceeded" : ""
      }`}
    >
      {remainingCharacters()}
    </span>
  );
}
