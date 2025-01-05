# Lexical-Solid

SolidJS port of `@lexical/react`

This is a SolidJS port of [@lexical/react](https://www.npmjs.com/package/@lexical/react) (always based on the same `@lexical/react` version as the pinned [lexical-dependencies](#lexical-dependencies), see that section of the README for the current version).

If you're using this library, I'd appreciate it if you let me know (in github discussions or in the lexical discord)!

# Installing

`npm install lexical-solid`

or using the package manager of your choice.

This repository uses `pnpm`, but if you are only a consumer of this library, you do not need it.

# Lexical Dependencies

Currently using lexical packages version `0.23.0`, and ported from [@lexical/react](https://www.npmjs.com/package/@lexical/react) of the same version tag.

This package pins `lexical` and the `@lexical/*` packages to specific minor versions. This means that you can only upgrade your lexical version to the latest _patch_ version compatible with the current version. Attempting to upgrade the minor version will result in a broken state due to mismatched packages. See [#5](https://github.com/mosheduminer/lexical-solid/issues/5) for some discussion of the pinning strategy.

# License

This code in this repository is very similar to the source react code, with modifications for use with SolidJS. The license distributed with `@lexical/react` can be found in [LICENSE-UPSTREAM](./LICENSE-UPSTREAM).
