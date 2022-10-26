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

const assert = require('../utils/assert');
const Status = require('../common/status');
const setObject = require('../utils/set-object');
const Extension = require('./extension');
const { SheetsHelper, SystemVars } = require('../helpers/sheets-helper');

/**
 * The extension for providing additional actions for AWP on AppScript.
 * In a nutshell, it provides the following additions:
 * - Before each run, convert location name to id based on location tab.
 * - After each run, convert location id to name based on location tab.
 * - After all runs, create trigger for retrieving results.
 * - After each retrieve, update modifiedDatetime and send analytic signals to
 *     Google Analytics.
 * - After all retrieves, delete trigger for
 *     retreiving results.
 */
class SheetsExtension extends Extension {
  /**
   * @param {object} config The config for this extension, as the "sheets"
   *     property in awpConfig loaded from src/awp-core.js.
   */
  constructor(config, envVars) {
    super();
    assert(config.connector, 'connector is missing in config.');
    assert(config.apiHandler, 'apiHandler is missing in config.');

    this.envVars = envVars;
    this.connector = config.connector;
    this.apiHandler = config.apiHandler;
    this.spreadsheetId = SheetsHelper.getSpreadsheetId();
    this.locations = null;
    this.debug = config.debug || false;
    this.userTimeZone = envVars['userTimezone'] || 'America/New_York';

    // Default values mappings.
    this.defaultResultValues = {
      'selected': false,
    };
  }

  /**
   * beforeRun - Convert location name to id based on location tab.
   * @param {object} context
   */
  beforeRun(context, options) {
    let source = context.source;
    // TODO: Add steps here.
  }

  /**
   * afterRun - Convert location id to name based on location tab.
   * @param {object} context Context object that contains Test and Result objects.
   */
  afterRun(context, options) {
    let source = context.source;
    let result = context.result;

    if (result) {
      // Format createdDatetime
      if (result.createdTimestamp) {
        result.createdDatetime = SheetsHelper.getFormattedDate(
          new Date(result.createdTimestamp), this.userTimeZone, 'MM/dd/YYYY HH:mm:ss');
      }
      // Format modifiedDatetime
      if (result.modifiedTimestamp) {
        result.modifiedDatetime = SheetsHelper.getFormattedDate(
          new Date(result.modifiedTimestamp), this.userTimeZone, 'MM/dd/YYYY HH:mm:ss');
      }

      // Set default values if there's no value assigned for specific properties.
      Object.keys(this.defaultResultValues).forEach(key => {
        if (!result[key]) result[key] = this.defaultResultValues[key];
      });
    }
  }

  /**
   * afterAllRuns - create a trigger for retrieving results if not exists.
   * @param {object} context Context object that contains all processed Tests
   *     and Result objects.
   */
  afterAllRuns(context, options) {
    let tests = context.tests || [];
    let results = context.results || [];
    options = options || {};

    // let pendingResults = results.filter(result => {
    //   return result.status === Status.SUBMITTED;
    // });
  }

  /**
   * Returns the SheetsHelper for unit test purpose.
   * @return {object}
   */
  getSheetsHelper() {
    return SheetsHelper;
  }
}

module.exports = SheetsExtension;
