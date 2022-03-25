import { createContext, useContext } from "solid-js";
import type { EditorThemeClasses, LexicalEditor } from "lexical";

export type LexicalComposerContextType = {
  getTheme: () => EditorThemeClasses | null | undefined;
};
export type LexicalComposerContextWithEditor = [
  LexicalEditor,
  LexicalComposerContextType
];

export function createLexicalComposerContext(
  parent: LexicalComposerContextWithEditor | null | undefined,
  theme: EditorThemeClasses | null | undefined
): LexicalComposerContextType {
  let parentContext: LexicalComposerContextType | null = null;

  if (parent != null) {
    parentContext = parent[1];
  }

  function getTheme() {
    if (theme != null) {
      return theme;
    }
    return parentContext != null ? parentContext.getTheme() : null;
  }

  return {
    getTheme,
  };
}

export const LexicalComposerContext = createContext<
  LexicalComposerContextWithEditor | null | undefined
>(null);

export const useLexicalComposerContext =
  (): LexicalComposerContextWithEditor => {
    const composerContext = useContext(LexicalComposerContext);
    if (!composerContext) {
      {
        throw Error(
          `LexicalComposerContext.useLexicalComposerContext: cannot find a LexicalComposerContext`
        );
      }
    }
    return composerContext;
  };
