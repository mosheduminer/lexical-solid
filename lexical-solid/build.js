import { rollup } from 'rollup';
import ts from "typescript";
import { readdirSync, rmdirSync } from "fs";
import { resolve, basename, join } from "path";
import { babel } from "@rollup/plugin-babel";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

const lexicalSolidModules =
  readdirSync(resolve('./src'))
    .filter(
      (str) =>
        !str.includes('__tests__') &&
        !str.includes('shared') &&
        !str.includes('test-utils'),
    ).map((module) => {
      const fileName = basename(basename(module, '.ts'), '.tsx');
      return {
        sourceFileName: module,
        outputFileName: fileName
      };
    });

const externals = [
  'lexical',
  '@lexical/list',
  '@lexical/table',
  '@lexical/file',
  '@lexical/clipboard',
  '@lexical/hashtag',
  '@lexical/headless',
  '@lexical/html',
  '@lexical/history',
  '@lexical/selection',
  '@lexical/text',
  '@lexical/offset',
  '@lexical/utils',
  '@lexical/code',
  '@lexical/yjs',
  '@lexical/plain-text',
  '@lexical/rich-text',
  '@lexical/mark',
  '@lexical/dragon',
  '@lexical/overflow',
  '@lexical/link',
  '@lexical/markdown',
  'solid-js',
  'yjs',
  'y-websocket',
]

rmdirSync(resolve('./dist'), { recursive: true });
const src = resolve('./src');
for (const module of lexicalSolidModules) {
  let inputFile = resolve(join(`${src}/${module.sourceFileName}`));
  const inputOptions = {
    external(modulePath, src) {
      return externals.includes(modulePath);
    },
    input: inputFile,
    plugins: [
      nodeResolve({
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      }),
      babel({
        babelHelpers: 'bundled',
        babelrc: false,
        configFile: false,
        exclude: '/**/node_modules/**',
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        presets: [
          '@babel/preset-typescript',
          'babel-preset-solid',
        ]
      }),
      commonjs()
    ],
    treeshake: true,
  }
  const result = await rollup(inputOptions);
  result.write({ format: "cjs", file: resolve('dist/cjs/' + module.outputFileName + '.cjs') })
  result.write({ format: "esm", file: resolve('dist/esm/' + module.outputFileName) + '.js' })
  result.close()
}

console.log(lexicalSolidModules.map(module => module.sourceFileName))

const program = ts.createProgram(lexicalSolidModules.map(module => './src/' + module.sourceFileName), {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  jsx: ts.JsxEmit.Preserve,
  jsxImportSource: "solid-js",
  allowSyntheticDefaultImports: true,
  esModuleInterop: true,
  outDir: `dist/source`,
  declarationDir: `dist/types`,
  declaration: true,
  allowJs: true,
});

let emitResult = program.emit();

let allDiagnostics = ts
  .getPreEmitDiagnostics(program)
  .concat(emitResult.diagnostics);

allDiagnostics.forEach(diagnostic => {
  if (diagnostic.file) {
    let { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
    let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
  } else {
    console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
  }
});

let exitCode = emitResult.emitSkipped ? 1 : 0;
console.log(`Process exiting with code '${exitCode}'.`); 