/**
 * Copyright 2022 Google LLC
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

'use strict';

const Status = require('./common/status');
const assert = require('./utils/assert');
const ApiHandler = require('./helpers/api-handler');

/**
 * DataGathererFramework main class.
 * Please check README.md for more details of the usage DataGathererFramework instance.
 *
 * Exmaples of creating a new instance of DataGathererFramework:
 *   let core = new DataGathererFramework({
 *     connector: 'JSON',
 *     helper: 'Node',
 *     gathererNames: ['webpagetest'],
 *     extensions: extensions,
 *     json: { // Config for JSON connector.
 *       sources: argv['tests'],
 *       results: argv['results'],
 *     },
 *     verbose: verbose,
 *     debug: debug,
 *   });
 */
class DataGathererFramework {
  /**
   * @param {object} coreConfig The overall config object, including sub-configs
   *     for connetor, helpers, gatherers, and extension modules.
   */
  constructor(coreConfig) {
    this.debug = coreConfig.debug || false;
    this.verbose = coreConfig.verbose || false;
    this.quiet = coreConfig.quiet || false;
    this.config = {};

    assert(coreConfig, 'coreConfig is missing');

    this.coreConfig = coreConfig;
    this.overallGathererNames = ['docai'];

    // Initialize helper. Use Node helper by default.
    coreConfig.helper = coreConfig.helper || 'sheets';
    this.log(`Use helper: ${coreConfig.helper}`);
    switch (coreConfig.helper.toLowerCase()) {
      case 'sheets':
        let { SheetsApiHandler } = require('./helpers/sheets-helper');
        this.apiHandler = new SheetsApiHandler();
        break;

      case 'fake':
        // Use a dummy ApiHandler for test purpose.
        let ApiHandler = require('./helpers/api-handler');
        this.apiHandler = new ApiHandler();
        break;

      default:
        throw new Error(
          `Helper ${coreConfig.helper} is not supported.`);
        break;
    }

    if (coreConfig.connector === 'fake') {
      this.connector = {
        getEnvVars: () => { },
      };
    } else {
      this.connector = this.getConnector(coreConfig["sheets"]);
    }
    this.envVars = this.connector.getEnvVars();

    // Initialize extensions.
    this.log(`Use extensions: ${coreConfig.extensions}`);
    this.extensions = {};
    if (coreConfig.extensions) {
      coreConfig.extensions.forEach(extension => {
        let ExtensionClass;
        let extConfig = coreConfig[extension] || {};

        // Adding mandatory properties.
        extConfig.connector = this.connector;
        extConfig.apiHandler = this.apiHandler;
        extConfig.debug = this.debug;

        switch (extension) {
          case 'sheets':
            ExtensionClass = require('./extensions/sheets-extension');
            break;

          case 'docai':
            ExtensionClass = require('./extensions/docai-extension');
            break;

          default:
            try {
              ExtensionClass = require('./extensions/' + extension);
            } catch (e) {
              console.error(e);
              throw new Error(`Unable to load extension: ./extensions/${extension}`);
            }
            break;
        }
        this.extensions[extension] = new ExtensionClass(extConfig,
          this.envVars);
      });
    }

    // Initialize overall gatherers from coreConfig.
    this.gatherers = {};

    // The frequency of when to write data back via a connector.
    // E.g. batchUpdateBuffer = 10 means for every 10 run or retrieve, it will
    // update the data by calling connector.updateSourceList or updateResultList.
    // When batchUpdateBuffer is 0, it will write back after all iteration.
    this.batchUpdateBuffer = coreConfig.batchUpdateBuffer || 10;
  }

  /**
   * Return the singleton connector instance with given name.
   * @param {string} name Connector name. E.g. 'json'.
   * @return {object} Connector instance.
   */
  getConnector(connectorConfig) {
    let ConnectorClass = require('./connectors/sheets-connector');
    return new ConnectorClass(connectorConfig, this.apiHandler);
  }

  /**
   * Return the singleton gatherer instance with given name.
   * @param {string} name Gatherer name. E.g. 'webpagetest'.
   * @return {object} Gatherer instance.
   */
  getGatherer(name) {
    let options = {
      verbose: this.verbose,
      debug: this.debug,
    };

    if (!name) return null;
    if (!this.gatherers[name]) {
      let GathererClass = null;
      let gathererConfig = this.coreConfig[name] || {};

      switch (name) {
        case 'docai':
          GathererClass = require('./gatherers/docai');
          break;

        case 'fake':
          // Return dummy gatherer for testing purpose.
          GathererClass = require('./gatherers/fake');
          break;

        default:
          try {
            GathererClass = require('./gatherers/' + name);
          } catch (e) {
            console.error(e);
            throw new Error(`Unable to load gatherer: ./gatherers/${name}`);
          }
          break;
      }
      this.gatherers[name] = new GathererClass(gathererConfig, this.envVars,
        this.apiHandler, options);
    }
    return this.gatherers[name];
  }

  /**
   * Parse the given gatherer name in a single string, comma-separated or
   * array format, and return an array of gathererNames.
   * @param {object} gathererName
   * @return {Array<string>} Array of gatherer names.
   */
  parseGathererNames(gathererName) {
    if (!gathererName) return [];

    if (Array.isArray(gathererName)) {
      return gathererName;
    } else {
      return gathererName.split(',');
    }
  }

  /**
   * Run sources and writes output to results.
   * @param {object} options
   * @return {object} Processed Sources and Results.
   *
   * Available options:
   * - filters {Array<string>}: Use `options.filters` to filter
   *     sources that match conditions. See `src/utils/pattern-filter.js` for
   *     more details.
   * - verbose {boolean}: Whether to show verbose messages in terminal.
   * - debug {boolean}: Whether to show debug messages in terminal.
   */
  async run(options) {
    options = options || {};
    let extensions = options.extensions || Object.keys(this.extensions);
    let extResponse, overallErrors = [];
    let overrideResults = options.overrideResults || false;
    let envVars = this.connector.getEnvVars();
    let sources;

    if (options['srcDatasetId']) {
      sources = await this.connector.getDataList(options['srcDatasetId'], options);
    } else {
      sources = [options['srcData']]
    }

    options.envVars = envVars;

    // Before all runs.
    extResponse = this.runExtensions(extensions, 'beforeAllRuns', { sources: sources }, options);
    overallErrors = overallErrors.concat(extResponse.errors);

    // Run gatherer.
    let newResults = await this.execute(options['destDatasetId'], sources, options);

    // Collect all errors.
    newResults.forEach(result => {
      if (result.errors && result.errors.length > 0) {
        overallErrors = overallErrors.concat(result.errors);
      }
    });

    // After all runs.
    extResponse = this.runExtensions(extensions, 'afterAllRuns', {
      sources: sources,
      results: newResults,
    }, options);
    overallErrors = overallErrors.concat(extResponse.errors);

    if (!this.quiet) {
      if (overallErrors.length > 0) {
        console.log(`Run completed for ${sources.length} sources with errors:`);
        console.log(overallErrors);
      } else {
        console.log(`Run completed for ${sources.length} sources.`);
      }
    }

    return {
      sources: sources,
      results: newResults,
      errors: overallErrors,
    };
  }

  /**
   * Run a single gatherer and return a detailed response from a gatherer.
   * @param {string} destDatasetId
   * @param {object} sources
   * @param {object} options
   *
   * Available options:
   * - filters {Array<string>}: Use `options.filters` to filter
   *     sources that match conditions. See `src/utils/pattern-filter.js` for
   *     more details.
   * - verbose {boolean}: Whether to show verbose messages in terminal.
   * - debug {boolean}: Whether to show debug messages in terminal.
   * @return {type}          description
   */
  async execute(destDatasetId, sources, options) {
    options = options || {};
    let extensions = options.extensions || Object.keys(this.extensions);
    let resultsToUpdate = [], allNewResults = [];
    let extResponse;

    assert(destDatasetId, 'destDatasetId is missing');

    // Before each run.
    sources.forEach(source => {
      extResponse = this.runExtensions(extensions, 'beforeRun', { source: source });
      source.errors = extResponse.errors;
    });

    // Run one source at a time and collect metrics from all gatherers.
    for (let i = 0; i < sources.length; i++) {
      let source = sources[i];
      let statuses = [];

      // Create a dummy Result.
      let newResult = this.createNewResult(source, options);

      // Collect metrics from all gatherers.
      let gathererNames = this.parseGathererNames(source.gatherer);
      gathererNames = gathererNames.concat(this.parseGathererNames(options.gatherer));
      [...new Set(gathererNames)].forEach(gathererName => {
        let response = this.runGatherer(source, gathererName, options);
        if (response) {
          newResult[gathererName] = response;
          statuses.push(newResult[gathererName].status);
        }
      });

      // Update overall status.
      newResult.status = this.getOverallStatus(statuses);

      // Collect errors from all gatherers.
      newResult.errors = this.getOverallErrors(newResult);

      // After each run
      extResponse = this.runExtensions(extensions, 'afterRun', {
        source: source,
        result: newResult,
      });
      newResult.errors = newResult.errors.concat(extResponse.errors);

      // Collect sources and results for batch update if applicable.
      resultsToUpdate.push(newResult);
      allNewResults.push(newResult);

      // Batch update to the connector if the buffer is full.
      if (this.batchUpdateBuffer &&
        resultsToUpdate.length >= this.batchUpdateBuffer) {
        await this.connector.appendDataList(destDatasetId, resultsToUpdate, options);
        this.log(`DataGathererFramework::retrieve, batch appends ` +
          `${resultsToUpdate.length} results.`);
        resultsToUpdate = [];
      }
    }

    // Update the remaining.
    await this.connector.appendDataList(destDatasetId, resultsToUpdate, options);

    return allNewResults;
  }

  /**
   * Run through all extensions.
   * @param {Array<string>} extensions Array of extension names
   * @param {string} functionName The function to execute in the extention.
   * @param {object} context Context object that includes sources and results.
   * @param {object} options
   *
   * Available options:
   * - filters {Array<string>}: Use `options.filters` to filter
   *     sources that match conditions. See `src/utils/pattern-filter.js` for
   *     more details.
   * - verbose {boolean}: Whether to show verbose messages in terminal.
   * - debug {boolean}: Whether to show debug messages in terminal.
   */
  runExtensions(extensions, functionName, context, options) {
    let errors = [];

    extensions.forEach(extName => {
      try {
        if (!this.extensions[extName]) return;
        let extension = this.extensions[extName];
        if (extension[functionName]) extension[functionName](context, options);
      } catch (e) {
        if (this.debug) {
          console.error(e.stack);
        }
        errors.push(e);
      }
    });

    return {
      errors: errors
    };
  }

  /**
   * Run a single gatherer and return a detailed response from a gatherer.
   * @param {object} source Source object to run.
   * @param {object} options
   *
   * Available options:
   * - filters {Array<string>}: Use `options.filters` to filter
   *     sources that match conditions. See `src/utils/pattern-filter.js` for
   *     more details.
   * - verbose {boolean}: Whether to show verbose messages in terminal.
   * - debug {boolean}: Whether to show debug messages in terminal.
   */
  runGatherer(source, gathererName, options) {
    options = options || {};

    try {
      let gatherer = this.getGatherer(gathererName);
      let response = gatherer.run(source, options);
      return response;

    } catch (error) {
      return {
        status: Status.ERROR,
        statusText: error.message,
        metadata: {},
        metrics: {},
        errors: [error],
      }
    }
  }

  /**
   * Return an empty Result object.
   * @param {object} source Source object to run.
   * @param {object} options
   * @return {objet} An empty Result object.
   */
  createNewResult(source, options) {
    let nowtime = Date.now();

    let newResult = {
      id: nowtime,
      gatherer: source.gatherer,
      status: Status.SUBMITTED,
      label: source.label,
      createdTimestamp: nowtime,
      modifiedTimestamp: nowtime,
      errors: source.errors || [],
    }

    return newResult;
  }

  /**
   * Return all data rows.
   * @param {string} datasetId
   * @param {object} options
   * @return {Array<object>} Row objects.
   *
   * Available options:
   * - filters {Array<string>}: Use `options.filters` to filter
   *     sources that match conditions. See `src/utils/pattern-filter.js` for
   *     more details.
   * - verbose {boolean}: Whether to show verbose messages in terminal.
   * - debug {boolean}: Whether to show debug messages in terminal.
   */
  async getDataList(datasetId, options) {
    options = options || {};
    let results = await this.connector.getDataList(datasetId, options);
    return results;
  }

  /**
   * Return all data rows as JSON format.
   * @param {string} datasetId
   * @param {object} options
   * @return {Array<object>} Row objects.
   *
   * Available options:
   * - filters {Array<string>}: Use `options.filters` to filter
   *     sources that match conditions. See `src/utils/pattern-filter.js` for
   *     more details.
   * - verbose {boolean}: Whether to show verbose messages in terminal.
   * - debug {boolean}: Whether to show debug messages in terminal.
   */
  async getDataJson(datasetId, options) {
    options = options || {};
    let results = await this.connector.getDataList(datasetId, options);
    return results;
  }

  /**
   * Returns the overall status with given list of Gatherers' statuses.
   * @param {Array<string>} statuses
   * @return {string} Overall status
   */
  getOverallStatus(statuses) {
    // The overall status depends on the aggregation of all gatherers.
    // If all gatherers returne retrieved, the overall status is retrieved.
    // If any of the data source return error, the overall status is error.
    // Otherwise, it's pending.
    if (statuses.filter(s => s === Status.RETRIEVED).length === statuses.length) {
      return Status.RETRIEVED;
    } else if (statuses.filter(s => s === Status.ERROR).length > 0) {
      return Status.ERROR;
    } else {
      return Status.SUBMITTED;
    }
  }

  /**
   * Get overall errors from a Result.
   * @param {Array<object>} errors Overall error array.
   */
  getOverallErrors(result) {
    let overallErrors = [];

    // Collect errors from all gatherers.
    let gathererNames = this.parseGathererNames(result.gatherer);
    gathererNames = gathererNames.concat(this.overallGathererNames);
    [...new Set(gathererNames)].forEach(gathererName => {
      if (!result[gathererName]) return;

      let errors = result[gathererName].errors || [];
      if (!Array.isArray(errors)) errors = [errors];

      // Add data source prefix to all error messages.
      (errors || []).forEach(error => {
        if (error && error.message) {
          overallErrors.push(`[${gathererName}] ` + error.message);
        } else {
          overallErrors.push(`[${gathererName}] ` + error);
        }
      });
    });
    return overallErrors.filter(e => e);
  }

  /**
   * Log a message with console.log.
   * @param {string} message
   */
  log(message) {
    if (!this.verbose) return;
    console.log(message);
  }

  /**
   * Log debug message.
   * @param {string} message
   */
  logDebug(message) {
    if (!this.debug) return;
    console.log(message);
  }
}

module.exports = DataGathererFramework;
