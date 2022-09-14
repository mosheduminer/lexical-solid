# Lexical-Solid

> SolidJS port of `@lexical/react`

Currently based on [@lexical/react](https://www.npmjs.com/package/@lexical/react) version `0.3.8`.

# Installing

`npm install lexical-solid`

You will need to add the following to your vite config (assuming you are using vite):

```js
  optimizeDeps: {
    include: [
      "lexical-solid",
      "lexical-solid > lexical",
      "lexical-solid > @lexical/clipboard",
      "lexical-solid > @lexical/code",
      "lexical-solid > @lexical/dragon",
      "lexical-solid > @lexical/hashtag",
      "lexical-solid > @lexical/history",
      "lexical-solid > @lexical/link",
      "lexical-solid > @lexical/list",
      "lexical-solid > @lexical/mark",
      "lexical-solid > @lexical/markdown",
      "lexical-solid > @lexical/overflow",
      "lexical-solid > @lexical/plain-text",
      "lexical-solid > @lexical/rich-text",
      "lexical-solid > @lexical/selection",
      "lexical-solid > @lexical/table",
      "lexical-solid > @lexical/text",
      "lexical-solid > @lexical/utils",
    ]
  }
```

# License

This code in this repository is very similar to the source react code, with modifications for use with SolidJS. The license distributed with `@lexical/react` can be found in [LICENSE-UPSTREAM](./LICENSE-UPSTREAM).
