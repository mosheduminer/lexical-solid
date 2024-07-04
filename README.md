# Lexical-Solid

> SolidJS port of `@lexical/react`

Currently based on [@lexical/react](https://www.npmjs.com/package/@lexical/react) version `0.16.1`.

# Installing

`npm install lexical-solid`

or using the package manager of your choice.

This repository uses `pnpm`, but if you are only a consumer of this library, you do not need it.

# Lexical Dependencies

This package pins `lexical` and the `@lexical/*` packages to specific minor versions. This means that you cannot upgrade your lexical version without upgrading `lexical-solid` (well, maybe you could, but it'd be buggy). See [#5](https://github.com/mosheduminer/lexical-solid/issues/5) for some discussion.

# License

This code in this repository is very similar to the source react code, with modifications for use with SolidJS. The license distributed with `@lexical/react` can be found in [LICENSE-UPSTREAM](./LICENSE-UPSTREAM).
