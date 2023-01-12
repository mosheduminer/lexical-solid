import { defineConfig } from "vite";
import solid from "solid-start/vite";

export default defineConfig({
  plugins: [
    {
      ...(await import("@mdx-js/rollup")).default({
        jsx: true,
        jsxImportSource: "solid-js",
        providerImportSource: "solid-mdx",
      }),
      enforce: "pre",
    },
    solid({
      extensions: [".mdx", ".md"],
    }),
  ],
  // optimizeDeps: {
  //   include: [
  //     "lexical",
  //     "@lexical/clipboard",
  //     "@lexical/code",
  //     "@lexical/dragon",
  //     "@lexical/hashtag",
  //     "@lexical/history",
  //     "@lexical/link",
  //     "@lexical/list",
  //     "@lexical/mark",
  //     "@lexical/markdown",
  //     "@lexical/overflow",
  //     "@lexical/plain-text",
  //     "@lexical/rich-text",
  //     "@lexical/selection",
  //     "@lexical/table",
  //     "@lexical/text",
  //     "@lexical/utils",
  //     "@lexical/yjs",
  //   ],
  // },
});
