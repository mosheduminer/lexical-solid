import { rollup } from 'rollup';
import ts from 'typescript';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { resolve, basename } from 'path';
import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import fg from 'fast-glob';

const lexicalSolidModules =
  fg.sync('./src/**')
    .map((module) => {
      const fileName =
        (module.includes('shared') ? 'shared/' : '') + basename(basename(module, '.ts'), '.tsx');
      return {
        sourceFileName: module,
        outputFileName: fileName
      };
    })

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
  'solid-js/web',
  'solid-js/store',
  'yjs',
  'y-websocket',
  ...(lexicalSolidModules.map(n => './' + n.outputFileName)),
  ...(lexicalSolidModules.map(n => '../' + n.outputFileName)),
]

if (existsSync('./dist')) rmSync(resolve('./dist'), { recursive: true });
mkdirSync('./dist')

for (const module of lexicalSolidModules) {
  let inputFile = resolve(module.sourceFileName);
  const inputOptions = (generate) => (
    {
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
          ["babel-preset-solid", { generate, hydratable: true }],
          '@babel/preset-typescript',
        ]
      }),
      commonjs()
    ],
    treeshake: true,
  })
  const resultDom = await rollup(inputOptions("dom"));
  resultDom.write({ format: 'esm', file: resolve('dist/esm/' + module.outputFileName) + '.js' }).then(() => resultDom.close())
  const resultSsr = await rollup({...inputOptions("ssr")});
  resultSsr.write({ format: 'cjs', file: resolve('dist/cjs/' + module.outputFileName + '.cjs') }).then(() => resultSsr.close())
}

const program = ts.createProgram(lexicalSolidModules.map(module => module.sourceFileName), {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  jsx: ts.JsxEmit.Preserve,
  jsxImportSource: 'solid-js',
  allowSyntheticDefaultImports: true,
  esModuleInterop: true,
  outDir: `dist/source`,
  declarationDir: `dist/types`,
  declaration: true,
  allowJs: true,
  paths: {
    'lexical-solid/*': ['./src/*']
  }
});

program.emit();