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

'use strict';

const assert = require('../utils/assert');
const Connector = require('./connector');

/**
 * the connector handles read and write actions with local JSON files as a data
 * store. This connector works together with `src/helpers/node-helper.js`.
 * @param  {Object} config The config object for initializing this connector.
 * @param  {Object} apiHandler ApiHandler instance initialized in core.
 */
class JsonDataConnector extends Connector {
  constructor(config, apiHandler, envVars) {
    super(config, apiHandler, envVars);
    this.tests = null;
    this.results = null;
  }

  getTestsJson() {
    if (this.tests) return this.tests;
    assert(this.testsPath, 'testsPath is not defined.');
    assert(!Array.isArray(this.testsPath), 'testsPath has to be either string or object')

    if (typeof this.testsPath === 'object') return this.testsPath;

    return JSON.parse(this.testsPath);
  }

  getResultsJson() {
    if (this.results) return this.results;
    assert(!Array.isArray(this.resultsPath), 'resultsPath has to be either string or object')

    if (typeof this.resultsPath === 'object') return this.resultsPath;
    return JSON.parse(this.resultsPath);
  }

  getEnvVars() {
    let tests = this.getTestsJson();
    let envVars = (tests || {}).envVars;
    return envVars;
  }

  getTestList(options) {
    let tests = this.getTestsJson();

    // Manually add index to all test objects.
    let index = 0;
    tests.tests.forEach(test => {
      test.json = {
        index: index++,
      }
    });

    return tests.tests;
  }

  updateTestList(newTests) {
    let filepath = path.resolve(`${this.testsPath}`);
    let tests = this.getTestList();

    let rowIndexToTests = {};
    newTests.forEach(newTest => {
      rowIndexToTests[newTest.json.index] = newTest;
    });

    let index = 0;
    let testsToUpdate = [];
    tests.forEach(test => {
      test = rowIndexToTests[index] || test;
      delete test.json;
      testsToUpdate.push(test);
      index++;
    })

    outputJson = {
      envVars: this.getEnvVars(),
      tests: testsToUpdate,
    };

    // Reset the tests json cache.
    this.tests = null;
    return outputJson;
  }

  getResultList(options) {
    let results = [];
    try {
      let json = this.getResultsJson();
      results = json.results || [];

    } catch (error) {
      console.log(error);

    } finally {
      return results;
    }
  }

  appendResultList(newResults, options) {
    options = options || {};
    let results = options.overrideResults ? [] : this.getResultList();

    outputJson = {
      results: results.concat(newResults),
    };

    // Reset the results json cache.
    this.results = null;
    return outputJson;
  }

  updateResultList(newResults, options) {
    let results = this.getResultList();
    let idToResults = {};

    newResults.forEach(result => {
      idToResults[result.id] = result;
    });

    results = results.map(result => {
      return idToResults[result.id] || result;
    });

    outputJson = {
      results: results,
    };

    // Reset the results json cache.
    this.results = null;
    return outputJson;
  }
}

module.exports = JsonDataConnector;
