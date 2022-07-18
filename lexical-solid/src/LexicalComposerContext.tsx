import { createContext, useContext } from "solid-js";
import type { EditorThemeClasses, LexicalEditor } from "lexical";

type LexicalComposerContextType = {
  getTheme: () => EditorThemeClasses | null;
};
type LexicalComposerContextWithEditor = [
  LexicalEditor,
  LexicalComposerContextType
];

function createLexicalComposerContext(
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

const LexicalComposerContext = createContext<
  LexicalComposerContextWithEditor | null | undefined
>(null);

const useLexicalComposerContext =
  (): LexicalComposerContextWithEditor => {
    const composerContext = useContext(LexicalComposerContext);
    if (!composerContext) {
      {
        throw Error(
          `useLexicalComposerContext: cannot find a LexicalComposerContext`
        );
      }
    }
    return composerContext;
  };

export {
  LexicalComposerContext,
  createLexicalComposerContext,
  useLexicalComposerContext,
}
export type {
  LexicalComposerContextWithEditor,
  LexicalComposerContextType,
}