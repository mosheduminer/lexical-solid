# Lexical-Solid

> SolidJS port of `@lexical/react`

Currently based on [@lexical/react](https://www.npmjs.com/package/@lexical/react) version `0.14.2`.

# Installing

`npm install lexical-solid`

You _may_ need to add `lexical-solid` and the lexical packages (such as `lexical-solid > lexical`) to the `optimizeDeps.include` section of your vite config (assuming you are using vite).

# Lexical Dependencies

This package pins `lexical` and the `@lexical/*` packages to specific minor versions. This means that you cannot upgrade your lexical version without upgrading `lexical-solid` (well, maybe you could, but it'd be buggy). See [#5](https://github.com/mosheduminer/lexical-solid/issues/5) for some discussion.

# License

This code in this repository is very similar to the source react code, with modifications for use with SolidJS. The license distributed with `@lexical/react` can be found in [LICENSE-UPSTREAM](./LICENSE-UPSTREAM).
