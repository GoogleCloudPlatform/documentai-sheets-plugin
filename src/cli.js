/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const DataCollectionFramework = require('./core');
const argv = require('minimist')(process.argv.slice(2));
const assert = require('./utils/assert');
const { NodeHelper } = require('./helpers/node-helper');

const printUsage = () => {
  let usage = `
Usage: ./docsheet <ACTION> <TESTS> <RESULTS> [OPTIONS...]

Available Actions:
  run\t\tExecute audits in a test list.
  continue\t\tContinuously execute recurring audits in a test list.
  recurring\t\tExecute recurring audits in a test list.
  retrieve\tRetrieve pending results in a results list.

Mandatory arguments:
  tests\t\tThe path to the sources list in JSON. E.g. examples/tests.json. To specify a different connector, use <connector>:<path>. E.g. csv:example/tests.csv.
  results\t\tThe path to the results output in JSON. E.g. output/results.json. To specify a different connector, use <connector>:<path>. E.g. csv:tmp/results.csv.

Options (*denotes default value if not passed in):
  gatherers\t\ttComma-separated list of data sources. Default: psi.
  extensions\t\tComma-separated list of extensions. Default: null.
  config\t\tLoad a custom coreConfig. See examples/awp-config.json for example. If the config parameter is given, the sources and results parameters will be ignored.
  override-results\tWhether to append results to the existing result list. Default: false.
  timer-interval\tSet the timer interval for executing recurring continuously.
  verbose\t\tPrint out verbose logs.
  debug\t\tPrint out debug console logs.

Examples:
  # List CLI options
  ./docsheet --help

  # Run tests
  ./docsheet run examples/tests.json output/results.json

  # Run sources from a CSV file and writes results to a JSON file.
  ./docsheet run csv:examples/tests.csv json:output/results.json

  # Run recurring sources continuously. Press CTRL/Command+C to stop.
  ./docsheet continue examples/tests-recurring.json output/results.json

  # Run PageSpeedInsight sources with an API Key.
  PSI_APIKEY=<YOUR_API_KEY> ./docsheet run examples/tests.json output/results.json

  # Run WebPageTest sources with an API Key.
  WPT_APIKEY=<YOUR_API_KEY> ./docsheet run examples/tests-wpt.json output/results.json

  # Retrieve pending results (For WebPageTest usage)
  WPT_APIKEY=<YOUR_API_KEY> ./docsheet retrieve examples/tests-wpt.json output/results.json

  # Retrieve from CrUX API
  CRUX_APIKEY=<YOUR_API_KEY> ./docsheet run examples/tests-cruxapi.json output/results.json

  # Run sources with budget extension
  ./docsheet run examples/tests.json output/results.json --extensions=budgets

  # Run sources and override existing results in the output file.
  ./docsheet run examples/tests.json output/results.json --override-results

  # Run a single test with a specific URL via URL-Connector.
  ./docsheet run --gatherers=psi url:https://web.dev json:output/results.json

  # Run with a custom coreConfig.
  ./docsheet run --config=examples/awp-config.json

  `;
  console.log(usage);
}

/**
 * Helper function for parsing envVars.
 * @param {string} varString Variable strings in the format of "a=1,b=2"
 */
const parseVars = (varString) => {
  if (!varString) return null;

  let keyValues = {};
  let varPairs = varString.split(',');
  varPairs.forEach(varPair => {
    [key, value] = varPair.split('=');
    keyValues[key] = value;
  });
  return keyValues;
}

/**
 * Main CLI function.
 */
async function begin() {
  let action = argv['_'][0], output = argv['output'];
  let sourcesPath = argv['_'][1];
  let resultsPath = argv['_'][2];
  let config = argv['config'];
  let overrideResults = argv['override-results'];
  let timerInterval = argv['timer-interval'];
  let activateOnly = argv['activate-only'];
  let gatherers = argv['gatherers'] ? argv['gatherers'].split(',') : null;
  let extensions = argv['extensions'] ? argv['extensions'].split(',') : [];
  let runByBatch = argv['batch-mode'] ? true : false;
  // let envVars = parseVars(argv['envVars']);
  let debug = argv['debug'];
  let verbose = argv['verbose'];
  let filters = [], coreConfig;

  // Get environment variables.
  let envVars = process.env;
  let envVarsFromParam = parseVars(argv['envVars']) || {};
  Object.keys(envVarsFromParam).forEach(key => {
    envVars[key] = envVarsFromParam[key];
  });

  // Assert mandatory parameters, except if the config is given.
  if (!config && (!action || !sourcesPath || !resultsPath)) {
    printUsage();
    return;
  }

  if (config) {
    coreConfig = NodeHelper.getJsonFromFile(config);

  } else {
    assert(sourcesPath, `'tests' parameter is missing.`);
    assert(resultsPath, `'results' parameter is missing.`);

    if (argv['selectedOnly']) filters.push('selected');

    // Parse connector names.
    let sourcesConnector = 'json', resultsConnector = 'json';
    if (sourcesPath.indexOf(':') >= 0) {
      sourcesConnector = sourcesPath.slice(0, sourcesPath.indexOf(':'));
      sourcesPath = sourcesPath.slice(sourcesPath.indexOf(':') + 1);
    }
    if (resultsPath.indexOf(':') >= 0) {
      resultsConnector = resultsPath.slice(0, resultsPath.indexOf(':'));;
      resultsPath = resultsPath.slice(resultsPath.indexOf(':') + 1);;
    }

    // Construct overall DataCollectionFramework config and individual connector's config.
    coreConfig = {
      sources: {
        connector: sourcesConnector,
        path: sourcesPath,
      },
      results: {
        connector: resultsConnector,
        path: resultsPath,
      },
      helper: 'node',
      extensions: extensions,
      envVars: envVars,
      verbose: verbose,
      debug: debug,
    };
  }

  if (verbose) {
    console.log('Use coreConfig:');
    console.log(JSON.stringify(coreConfig, null, 2));
  }

  // Create DataCollectionFramework instance.
  let core = new DataCollectionFramework(coreConfig);

  let options = {
    filters: filters,
    runByBatch: runByBatch,
    overrideResults: overrideResults,
    timerInterval: timerInterval,
    activateOnly: activateOnly,
    gatherer: gatherers,
    verbose: verbose,
    debug: debug,
  };

  switch (action) {
    case 'run':
      await core.run(options);
      break;

    case 'recurring':
      await core.recurring(options);
      break;

    case 'continue':
      await core.continue(options);

    case 'retrieve':
      await core.retrieve(options);
      break;

    default:
      printUsage();
      break;
  }
}

module.exports = {
  begin,
};
