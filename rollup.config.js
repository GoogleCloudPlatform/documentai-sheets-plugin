import commonjs from 'rollup-plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import replace from '@rollup/plugin-replace';
import banner from 'rollup-plugin-banner';
import npmPackageJson from './package.json';

export default [{
  input: 'rollup/core-rollup.js',
  output: {
    file: 'build/core-bundle.js',
    format: 'cjs',
    esModule: false,
  },
  treeshake: false,
  plugins: [
    commonjs({
      ignore: [
        'sync-request',
        'fs-extra',
        'fs',
        'path',
        'google-spreadsheet',
        // './connectors/sheets-connector',
        './helpers/node-helper',
        './helpers/gcp-handler',
        '@google-cloud/bigquery',
      ],
    }),
    babel({
      exclude: 'node_modules/**'
    }),
    resolve({
      preferBuiltins: false,
      jail: './src',
      dedupe: [],
    }),
    // replace({
    //   'module.exports = coreRollup': 'if (module) module.exports = coreRollup',
    // }),
    banner(`
  @license Copyright 2022 Google Inc. All Rights Reserved.
  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

  Version: ${npmPackageJson.version}
  Built at: ${new Date().toUTCString()}
      `),
  ]
}];
