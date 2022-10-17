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
const patternFilter = require('../utils/pattern-filter');
const Status = require('../common/status');
const setObject = require('../utils/set-object');
const transpose = require('../utils/transpose');
const Connector = require('./connector');
const { AppScriptHelper, SystemVars } = require('../helpers/appscript-helper');

const DataAxis = {
  ROW: 'row',
  COLUMN: 'column',
};

/**
 * the connector handles read and write actions with GoogleSheets as a data
 * store. This connector works together with
 * `src/extensions/appscript-extensions.js` and
 * `src/helpers/appscript-helper.js`.
 */
class AppScriptConnector extends Connector {
  /**
   * constructor - Initilize the instance  with given config object and
   * singleton ApiHandler instance. The config object is a sub-property from
   * the coreConfig object at the top level.
   * @param  {Object} config The config object for initializing this connector.
   * @param  {Object} apiHandler ApiHandler instance initialized in core.
   */
  constructor(config, apiHandler) {
    super();
    assert(config.tabs, 'tabs is missing in config.');

    this.config = config
    this.apiHandler = apiHandler;
    this.activeSpreadsheet = SpreadsheetApp.getActive();
    this.tabs = config.tabs;

    // Caching for preventing querying the same data repeatedly.
    this.propertyLookupCache = {};

    this.healthCheck();
  }

  /**
   * init - Initializing the DataGathererFramework on Spreadsheets, including adding triggers,
   * get all locations from WebPageTest, init conditional formatting, and get
   * user timeozone.
   */
  init() {
    // Init user timezone.
    this.initUserTimeZone();

    // Record the last timestamp of init.
    this.setSystemVar(SystemVars.LAST_INIT_TIMESTAMP, Date.now());
  }

  /**
   * getData - The helper function for getting items in a sheet tab.
   * @param  {type} tabId The keys of tabConfigs. E.g. "envVarsTab"
   * @param  {type} options Options: appendRowIndex, verbose or debug.
   */
  getDataList(tabId, options) {
    options = options || {};
    let tabConfig = this.tabs[tabId];
    let data = this.getSheet(tabId).getDataRange().getValues();

    let skipRows = tabConfig.skipRows || 0;
    let skipColumns = tabConfig.skipColumns || 0;

    if (tabConfig.dataAxis === DataAxis.COLUMN) {
      data = transpose(data);
      skipRows = tabConfig.skipColumns;
      skipColumns = tabConfig.skipRows;
    }

    let propertyLookup = data[tabConfig.propertyLookupRow - 1];
    data = data.slice(skipRows, data.length);

    let items = [];
    for (let i = 0; i < data.length; i++) {
      let newItem = {};
      for (let j = skipColumns; j < data[i].length; j++) {
        if (propertyLookup[j]) {
          if (typeof propertyLookup[j] !== 'string') {
            throw new Error(
              `${tabId} Tab: Property lookup ${propertyLookup[j]} is not a string`);
          }

          setObject(newItem, propertyLookup[j], data[i][j]);
        }
      }

      // Add metadata for GoogleSheets.
      newItem.appscript = {
        rowIndex: i + tabConfig.skipRows + 1,
      };
      items.push(newItem);
    }

    items = patternFilter(items, options.filters);
    return items;
  }

  /**
   * updateSourceList - Update the array of new Sources to the original Sources,
   * based on the RowIndex of each Test in the "Sources" Sheet.
   * @param  {Array<object>} newItems The array of new items.
   * @param  {object} options Options: filters, verbose and debug.
   */
  updateDataList(tabId, newItems, options) {
    options = options || {};
    let appscript = options.appscript || {};

    // If tabId is not specified, use the default Sources tabId.
    this.updateDataListExec(tabId, newItems,
      (item, rowIndex) => {
        // item.appscript.rowIndex in each item is added in getDataList().
        return item.appscript.rowIndex;
      } /* rowIndexFunc */);
  }

  /**
   * appendDataList - Append new results to the end of the existing Results.
   * @param  {Array<object>} newItems Array of new items
   *
   * Available options:
   * - options.appscript.spreadArrayProperty {string}: To specify a property
   *     key for spreading an array of metrics into multiple rows of single
   *     metric object.
   */
  appendDataList(tabId, newItems, options) {
    options = options || {};
    let appscript = options.appscript || {};

    // Use the last row index as base for appending items.
    let lastRowIndex = this.getTabLastRow(tabId) + 1;
    this.appendDataListExec(tabId, newItems, (item, rowIndex) => {
      rowIndex = lastRowIndex;
      lastRowIndex++;
      return rowIndex;
    } /* rowIndexFunc */);
  }

  /**
   * getRowRange - The helper function get the GoogleSheets Range object for the
   * entire row with given row index.
   * @param  {string} tabId The keys of tabConfigs. E.g. "sourcesTab"
   * @param  {number} rowIndex The row index in a sheet. (starting from 1)
   * @return {object} GoogleSheets Range object
   */
  getRowRange(tabId, rowIndex, numRows) {
    let sheet = this.getSheet(tabId);
    let lastColumn = sheet.getLastColumn();
    return sheet.getRange(rowIndex, 1, numRows || 1, lastColumn);
  }

  /**
   * getColumnRange - Return the GoogleSheets Range object for
   * the entire column with given propertyKey.
   * @param  {string} tabId The keys of tabConfigs. E.g. "sourcesTab"
   * @param  {string} propertyKey The property key for the column. E.g. "webpagetest.metrics.CSS"
   * @return {object} GoogleSheets Range object
   */
  getColumnRange(tabId, propertyKey, includeSkipRows) {
    let tabConfig = this.tabs[tabId];
    let sheet = this.getSheet(tabId);
    let columnIndex = this.getPropertyIndex(tabId, propertyKey);
    let numRows = includeSkipRows ?
      sheet.getLastRow() : sheet.getLastRow() - tabConfig.skipRows;
    let rowStart = includeSkipRows ? 1 : tabConfig.skipRows + 1;

    assert(columnIndex, `Unable to get column index for property '${propertyKey}'`);
    assert(numRows >= 1, 'The number of rows in the range must be at least 1');

    let range = sheet.getRange(rowStart, columnIndex, numRows, 1);
    return range;
  }

  /**
   * getLastRow - Return the last row with at least one value of a specific tab.
   * @param  {string} tabId The keys of tabConfigs. E.g. "sourcesTab"
   * @return {number} Index of the last row with values.
   */
  getTabLastRow(tabId) {
    let tabConfig = this.tabs[tabId];
    let sheet = this.getSheet(tabId);
    let sheetValues = sheet.getDataRange().getValues();
    sheetValues = sheetValues.map(rowValues => {
      let values = rowValues.join('').trim();
      return !!values;
    });

    let rowIndex = sheetValues.length;
    while (!sheetValues[rowIndex - 1]) {
      rowIndex--;
    }
    return rowIndex;
  }

  /**
   * getPropertyLookup - Return an array of property keys from the Row of
   * PropertyLookup.
   * @param  {string} tabId The keys of tabConfigs. E.g. "sourcesTab"
   * @return {Array<string>} Array of property keys.
   */
  getPropertyLookup(tabId) {
    // Return cached value if already queried.
    if (this.propertyLookupCache[tabId]) return this.propertyLookupCache[tabId];

    let tabConfig = this.tabs[tabId];
    let sheet = this.getSheet(tabId);
    let skipRows = tabConfig.skipRows || 0;
    let skipColumns = tabConfig.skipColumns || 0;
    let propertyLookup;

    if (tabConfig.dataAxis === DataAxis.ROW) {
      let data = sheet.getRange(
        tabConfig.propertyLookupRow, skipColumns + 1,
        1, sheet.getLastColumn() - skipColumns).getValues();
      propertyLookup = data[0];

    } else {
      let data = sheet.getRange(
        skipRows + 1, tabConfig.propertyLookupRow,
        sheet.getLastRow() - skipRows, 1).getValues();
      propertyLookup = data.map(x => x[0]);
    }

    this.propertyLookupCache[tabId] = propertyLookup;
    return propertyLookup;
  }

  /**
   * getPropertyIndex - Return the index with a given property key. E.g.
   * getPropertyIndex('webpagetest.metrics.CSS') returns the column inex for
   * CSS metric column.
   * @param  {string} tabId The keys of tabConfigs. E.g. "sourcesTab"
   * @param  {string} lookupKey Property key of the column to look up.
   * @return {number} Column index.
   */
  getPropertyIndex(tabId, lookupKey) {
    let propertyLookup = this.getPropertyLookup(tabId);
    for (let i = 0; i < propertyLookup.length; i++) {
      if (propertyLookup[i] === lookupKey) {
        return i + 1;
      }
    }
  }

  /**
   * updateDataList - The helper function to update arbitrary items, like Sources,
   * Results, or Config items.
   * @param  {string} tabId The keys of tabConfigs. E.g. "sourcesTab"
   * @param  {Array<object>} items Array of new items.
   * @param  {Function} rowIndexFunc The function that returns rowIndex for each item.
   */
  updateDataListExec(tabId, items, rowIndexFunc) {
    if (!items || items.length === 0) return;

    let tabConfig = this.tabs[tabId];
    let propertyLookup = this.getPropertyLookup(tabId);

    let rowIndex = tabConfig.skipRows + 1;
    items.forEach(item => {
      let values = [];
      propertyLookup.forEach(lookup => {
        if (typeof lookup !== 'string') {
          throw new Error(
            `${tabId} Tab: Property lookup ${lookup} is not a string`);
        }
        try {
          let value = lookup ? eval(`item.${lookup}`) : '';
          values.push(value);
        } catch (error) {
          values.push('');
        }
      });

      let targetRowIndex = rowIndexFunc ? rowIndexFunc(item, rowIndex) : rowIndex;
      let range = this.getRowRange(tabId, targetRowIndex);
      range.setValues([values]);
      rowIndex++;
    });
  }

  /**
   * appendDataListExec - The helper function to append arbitrary items, like Sources,
   * Results, or Config items.
   * @param  {string} tabId The keys of tabConfigs. E.g. "sourcesTab"
   * @param  {Array<object>} items Array of new items.
   * @param  {Function} rowIndexFunc The function that returns rowIndex for each item.
   */
  appendDataListExec(tabId, items, rowIndexFunc) {
    if (!items || items.length === 0) return;

    let tabConfig = this.tabs[tabId];
    let propertyLookup = this.getPropertyLookup(tabId);
    let firstRowIndex, allValues = [];
    let rowIndex = tabConfig.skipRows + 1;

    items.forEach(item => {
      let values = [];
      propertyLookup.forEach(lookup => {
        if (typeof lookup !== 'string') {
          throw new Error(
            `${tabId} Tab: Property lookup ${lookup} is not a string`);
        }
        try {
          let value = lookup ? eval(`item.${lookup}`) : '';
          values.push(value);
        } catch (error) {
          values.push('');
        }
      });

      if (!firstRowIndex) {
        firstRowIndex = rowIndexFunc ? rowIndexFunc(item, rowIndex) : rowIndex;
      }
      allValues.push(values);
      rowIndex++;
    });

    // Update in batch.
    let range = this.getRowRange(tabId, firstRowIndex, items.length);
    range.setValues(allValues);
  }

  /**
   * clearDataList - Clear the entire list of a specific tab.
   * @param {string} tabId The keys of tabConfigs. E.g. "sourcesTab"
   */
  clearDataList(tabId) {
    let tabConfig = this.tabs[tabId];
    let sheet = this.getSheet(tabId);
    let lastRow = sheet.getLastRow();

    if (lastRow > tabConfig.skipRows) {
      sheet.deleteRows(tabConfig.skipRows + 1, lastRow - tabConfig.skipRows);
      sheet.insertRowAfter(tabConfig.skipRows);

      // Reset the format of the last row.
      sheet.setRowHeight(tabConfig.skipRows + 1, 24 /* Pixels */);
      let lastRowRange = this.getRowRange(tabId, tabConfig.skipRows + 1);
      lastRowRange.clear();
    }
  }

  /**
   * getSystemVar - Returns a specific variable from the System tab.
   * @param  {string} key description
   * @param  {string} value
   */
  getSystemVar(key) {
    return this.getVarFromTab(this.config.systemTabId, key);
  }

  /**
   * setSystemVar - Set a value to a specific variable in the System tab.
   * @param  {string} key
   * @param  {string} value
   */
  setSystemVar(key, value) {
    this.setVarToTab(this.config.systemTabId, key, value);
  }

  /**
   * getEnvVars - Returns the entire Config as an object.
   * @return {object} Config object.
   */
  getEnvVars() {
    let envVars = this.getDataList(this.config.envVarsTabId);
    envVars = envVars ? envVars[0] : null;
    delete envVars['appscript'];
    return envVars;
  }

  /**
   * getSystemVar - Returns a specific variable from the System tab.
   * @param  {string} key description
   * @param  {string} value
   */
  getEnvVar(key) {
    return this.getVarFromTab(this.config.envVarsTabId, key);
  }

  /**
   * setSystemVar - Set a value to a specific variable in the System tab.
   * @param  {string} key
   * @param  {string} value
   */
  setEnvVar(key, value) {
    this.setVarToTab(this.config.envVarsTabId, key, value);
  }

  /**
   * getVarFromTab - A generic helper function to get the value of a varible in
   * a specific tab.
   * @param  {string} tabId The keys of tabConfigs. E.g. "envVarsTab"
   * @param  {string} key
   * @return {type} value
   */
  getVarFromTab(tabId, key) {
    let object = (this.getDataList(tabId) || [])[0];

    try {
      return eval('object.' + key);
    } catch (e) {
      return null;
    }
  }

  /**
   * setVarToTab - A generic helper function to set a value of a varible in
   * a specific tab.
   * @param  {string} tabId The keys of tabConfigs. E.g. "envVarsTab"
   * @param  {type} key
   * @param  {type} value
   */
  setVarToTab(tabId, key, value) {
    let tabConfig = this.tabs[tabId];
    let sheet = this.getSheet(tabId);
    let data = sheet.getDataRange().getValues();
    let propertyLookup = this.getPropertyLookup(tabId);

    let i = 1;
    propertyLookup.forEach(property => {
      if (property === key) {
        let range = sheet.getRange(
          tabConfig.skipRows + i, tabConfig.skipColumns + 1);
        range.setValue(value);
      }
      i++;
    });
  }

  /**
   * Return the sheet object of the given tabId.
   * @param  {string} tabId Tab ID in the tabConfigs object.
   * @return {object} AppScript sheet object.
   */
  getSheet(tabId) {
    let sheet = this.activeSpreadsheet.getSheetByName(tabId);
    assert(sheet, `Sheet "${tabId}" not found.`);
    return sheet;
  }

  /**
   * initUserTimeZone - Set the user timezone to System tab.
   */
  initUserTimeZone() {
    let userTimeZone = AppScriptHelper.getUserTimeZone();
    this.setSystemVar('USER_TIMEZONE', userTimeZone);
  }


  /**
   * healthCheck - For integration test. WIP.
   */
  healthCheck() {
    // TODO: validate data type in sheets, e.g. check string type for propertyLookup.
  }
}

module.exports = AppScriptConnector;
