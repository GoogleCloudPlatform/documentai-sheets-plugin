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
const assert = require('../../src/utils/assert');

const fakeSheetData = {
  fakeEnvVarsSheetData: [
    ['Name', 'key', 'value'],
    ['API Key', 'apiKey', 'TEST_APIKEY'],
    ['GCP Project ID', 'gcpProjectId', 'TEST_PROJECTID'],
  ],
  fakeSystemSheetData: [
    ['Name', 'key', 'value'],
    ['Retrieve Trigger ID', 'RETRIEVE_TRIGGER_ID', ''],
    ['Submit Recurring Trigger ID', 'RECURRING_TRIGGER_ID', ''],
    ['onEdit trigger ID', 'ONEDIT_TRIGGER_ID', ''],
    ['User\'s TimeZone', 'LAST_INIT_TIMESTAMP', ''],
  ],
  fakeLocationsSheetData: [
    ['Name', 'ID', 'Pending Sources', 'Browsers'],
    ['name', 'id', 'pendingSources', 'browsers'],
    ['Old location', 'location-old', '0', 'should-be-deleted'],
  ],
  fakeSourcesSheetData: [
    ['', '', '', '', '', '', '', ''],
    ['selected', 'fake.url', 'label', 'recurring.frequency',
      'recurring.nextTriggerTimestamp', 'gatherer', 'fake.settings.connection',
      'fake.settings.location'],
    ['', 'URL', 'Label', 'Frequency', 'Next Trigger Timestamp', 'Audit Platforms'],
    [true, 'google.com', 'Google', 'Daily', null, 'fake', '4G', 'TestLocation'],
    [false, 'examples.com', 'Example', null, null, 'fake', '3G', 'TestLocation'],
    [true, 'web.dev', 'Web.Dev', 'Daily', null, 'fake', '3G', 'TestLocation'],
  ],
  fakeResultsSheetData: [
    ['', '', '', '', '', ''],
    ['selected', 'id', 'type', 'status', 'fake.url', 'fake.metrics.SpeedIndex'],
    ['', 'ID', 'Type', 'Status', 'URL', 'WPT SpeedIndex'],
    [true, 'id-1234', 'single', 'Retrieved', 'google.com', 500],
    [false, 'id-5678', 'recurring', 'Retrieved', 'web.dev', 800],
  ],
  fakeEmptyResultsSheetData: [
    ['', '', '', '', '', ''],
    ['selected', 'id', 'type', 'status', 'fake.url', 'fake.metrics.SpeedIndex'],
    ['', 'ID', 'Type', 'Status', 'URL', 'WPT SpeedIndex'],
  ],
  fakeEmptyResultsSheetDataDocAIKeys: [
    ['', ''],
    ['docai.data.key', 'docai.data.newKey'],
    ['Field Name', 'New Field Name'],
  ],
  fakeEmptyResultsSheetDataDocAIEntities: [
    ['', '', '', '', '', '', ''],
    ['selected', 'id', 'status', 'docai.data["First Name"].value', 'docai.data["Last Name"].value', 'docai.data["Social Security Number:"].value', 'docai.data["Mailing Address (No., Street, Apt., P.O. Box)"].value'],
    ['', 'ID', 'Status', 'First Name', 'Last Name', 'Social Security Number', 'Address'],
  ],
}

const initSheetData = (fakeData) => {
  // Backfill rows with non-consistent length of cells.
  let maxColumnLength = Math.max(...fakeData.map(row => row.length));
  fakeData.forEach(row => {
    while (row.length < maxColumnLength) {
      row.push('');
    }
  });
  return [...fakeData];
}

const initFakeSheet = (fakeData) => {
  let sheet = {};

  sheet.fakeData = initSheetData(fakeData)
  sheet.getDataRange = () => {
    return {
      getValues: () => {
        return sheet.fakeData;
      }
    }
  };
  sheet.getRange = (row, column, numRows, numColumns) => {
    return {
      getValues: () => {
        let data = sheet.fakeData.slice(row - 1, row + numRows - 1);
        data = data.map(row => {
          return row.slice(column - 1, column + numColumns);
        });
        return data;
      },
      setValue: (value) => {
        sheet.fakeData[row - 1][column - 1] = value;
      },
      setValues: (values) => {
        while (sheet.fakeData.length < row - 1) {
          sheet.fakeData.push([]);
        }
        let i = row - 1;
        values.forEach(value => {
          if (i < fakeData.length)
            sheet.fakeData[i] = value;
          else
            sheet.fakeData.push(value);
          i++;
        })
      },
      setDataValidation: () => { },
      getLastRow: () => {
        return sheet.fakeData.length;
      },
      clear: () => { },
    }
  };
  sheet.getMaxRows = () => {
    return sheet.fakeData.length;
  };
  sheet.getLastRow = () => {
    return sheet.fakeData.length;
  };
  sheet.getLastColumn = () => {
    return sheet.fakeData[0].length;
  };
  sheet.deleteRows = (row, numRows) => {
    let newFakeData = [];
    for (let i = 0; i < sheet.fakeData.length; i++) {
      if (i < row - 1 || i > row + numRows - 1) {
        newFakeData.push(sheet.fakeData[i]);
      }
    }
    sheet.fakeData = newFakeData;
  };
  sheet.insertRowAfter = (row) => { };
  sheet.setRowHeight = (height) => { };

  sheet.setConditionalFormatRules = jest.fn();
  return sheet;
};

const fakeSheets = {
  'Settings': initFakeSheet(fakeSheetData.fakeEnvVarsSheetData),
  'System': initFakeSheet(fakeSheetData.fakeSystemSheetData),
  'Locations': initFakeSheet(fakeSheetData.fakeLocationsSheetData),
  'Sources-1': initFakeSheet(fakeSheetData.fakeSourcesSheetData),
  'Results-1': initFakeSheet(fakeSheetData.fakeResultsSheetData),
};

const SpreadsheetApp = {
  getActive: () => ({
    getSheetByName: (tabName) => {
      if (tabName === 'NonExistingTab') return null;
      return fakeSheets[tabName];
    },
  }),
  newDataValidation: () => ({
    requireValueInRange: () => ({
      build: () => { },
    })
  }),
  newConditionalFormatRule: () => ({
    setGradientMaxpointWithValue: () => ({
      setGradientMidpointWithValue: () => ({
        setGradientMinpointWithValue: () => ({
          setRanges: () => ({
            build: jest.fn(),
          }),
        })
      })
    }),
  }),
  InterpolationType: {
    NUMBER: '',
  },
};

const Session = {
  getActiveUser: () => ({
    getEmail: () => 'test@gmail.com',
  })
};

const Utilities = {
  computeDigest: () => { return []; },
  DigestAlgorithm: {},
  Charset: {},
  formatDate: () => '2020-01-01',
};

const ScriptApp = {
  getProjectTriggers: () => {
    return [];
  },
  newTrigger: (functionName) => ({
    timeBased: () => ({
      everyMinutes: () => ({
        create: () => ({
          getUniqueId: () => `timeBased-${functionName}`,
        }),
      })
    }),
    forSpreadsheet: () => ({
      onEdit: () => ({
        create: () => ({
          getUniqueId: () => `forSpreadsheet-${functionName}`,
        }),
      })
    }),
  }),
  deleteTrigger: (trigger) => { },
};

const Logger = {
  log: jest.fn(),
};

const Browser = {
  msgBox: jest.fn(),
};

const UrlFetchApp = {
  fetch: () => ({
    getResponseCode: jest.fn(),
    getContentText: jest.fn(),
  }),
}

module.exports = {
  initFakeSheet,
  fakeSheetData,
  fakeSheets,
  SpreadsheetApp,
  Session,
  Utilities,
  ScriptApp,
  Logger,
  Browser,
  UrlFetchApp,
};
