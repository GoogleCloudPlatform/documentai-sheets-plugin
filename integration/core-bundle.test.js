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

const fs = require('fs');
const DataGathererFramework = require('../build/core-bundle');
const { initFakeSheet, fakeSheetData, SpreadsheetApp, Session, Utilities,
  ScriptApp, Logger, Browser, UrlFetchApp } = require('../test/connectors/sheets-test-utils');

let core = null;
let fakeSheets = {};

global.SpreadsheetApp = SpreadsheetApp;
global.SpreadsheetApp.getActive = () => ({
  getSheetByName: (tabName) => {
    if (!fakeSheets[tabName]) {
      throw new Error(`${tabName} not initialized with initFakeSheet yet.`);
    }
    return fakeSheets[tabName];
  },
  getId: () => 'sheet-1234',
});
global.Session = Session;
global.Utilities = Utilities;
global.ScriptApp = ScriptApp;
global.Logger = Logger;
global.Browser = Browser;
global.UrlFetchApp = UrlFetchApp;

describe('DataGathererFramework bundle for Sheets', () => {
  beforeEach(() => {
    fakeSheets = {
      'Settings': initFakeSheet(fakeSheetData.fakeEnvVarsSheetData),
      'System': initFakeSheet(fakeSheetData.fakeSystemSheetData),
      'Locations': initFakeSheet(fakeSheetData.fakeLocationsSheetData),
      'Sources-1': initFakeSheet(fakeSheetData.fakeSourcesSheetData),
      'Results-1': initFakeSheet(fakeSheetData.fakeEmptyResultsSheetData),
      'Sources-2': initFakeSheet(fakeSheetData.fakeSourcesSheetData),
      'Results-2': initFakeSheet(fakeSheetData.fakeEmptyResultsSheetData),
      'Results-DocKeys': initFakeSheet(fakeSheetData.fakeEmptyResultsSheetDataDocAIKeys),
      'Results-DocEntities': initFakeSheet(fakeSheetData.fakeEmptyResultsSheetDataDocAIEntities),
      'Results-DriverLicense': initFakeSheet(fakeSheetData.fakeEmptyResultsSheetDataDriverLicenseEntities),
    };

    let coreConfig = {
      helper: 'sheets',
      extensions: [
        'sheets',
      ],
      gatherers: ['docai'],
      // Connector-specific configs below
      sheets: {
        envVarsTabId: 'Settings',
        systemTabId: 'System',
        tabs: {
          'Sources-1': {
            dataAxis: 'row',
            propertyLookup: 2, // Starts at 1
            skipColumns: 0,
            skipRows: 3,
          },
          'Sources-2': {
            dataAxis: 'row',
            propertyLookup: 2, // Starts at 1
            skipColumns: 0,
            skipRows: 3,
          },
          'Results-1': {
            dataAxis: 'row',
            propertyLookup: 2, // Starts at 1
            skipColumns: 0,
            skipRows: 3,
          },
          'Results-2': {
            dataAxis: 'row',
            propertyLookup: 2, // Starts at 1
            skipColumns: 0,
            skipRows: 3,
          },
          'Results-DocKeys': {
            dataAxis: 'row',
            propertyLookup: 2, // Starts at 1
            skipColumns: 0,
            skipRows: 3,
          },
          'Results-DocEntities': {
            dataAxis: 'row',
            propertyLookup: 2, // Starts at 1
            skipColumns: 0,
            skipRows: 3,
          },
          'Results-DriverLicense': {
            dataAxis: 'row',
            propertyLookup: 2, // Starts at 1
            skipColumns: 0,
            skipRows: 3,
          },
          'Settings': {
            dataAxis: 'column',
            propertyLookup: 2, // Starts at 1
            skipColumns: 2,
            skipRows: 1,
          },
          'System': {
            dataAxis: 'column',
            propertyLookup: 2, // Starts at 1
            skipColumns: 2,
            skipRows: 1,
          },
        },
      },
      batchUpdateBuffer: 10,
      verbose: false,
      debug: false,
      quiet: true,
    };

    core = new DataGathererFramework(coreConfig);
  });

  it('creates DataGathererFramework instance', () => {
    expect(core).not.toBe(null);
  });

  it('initializes DataGathererFramework for Sheets via connector init', () => {
    core.connector.apiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: JSON.stringify({
          'data': {}
        })
      }
    };
    core.connector.init();

    // Ensure it creates triggers for 'submitRecurringSources' and 'onEditFunc'.
    let systemData = fakeSheets['System'].fakeData;

    // Ensure it updates the last init timestamp.
    expect(systemData[4][2]).not.toBe('');
    expect(systemData[4][2]).toBeGreaterThan(0);
  });

  it('submits selected source rows and writes results to specific tabs', async () => {
    let resultsData1 = fakeSheets['Results-1'].fakeData;
    let resultsData2 = fakeSheets['Results-2'].fakeData;
    expect(resultsData1.length).toEqual(3);
    expect(resultsData2.length).toEqual(3);

    let systemData = [
      ['Name', 'key', 'value'],
      ['Retrieve Trigger ID', 'RETRIEVE_TRIGGER_ID', ''],
    ];
    fakeSheets['System'] = initFakeSheet(systemData);

    // Running sources and writing to Results-2 tab.
    await core.run({
      srcDatasetId: 'Sources-1',
      destDatasetId: 'Results-2', // Results-2 tab.
      filters: ['selected'],
    });
    // Ensure there's no additional rows written to Results-1 tab.
    expect(resultsData1.length).toEqual(3);

    // Ensure two additional rows written to Results-2 tab.
    expect(resultsData2.length).toEqual(5);

    // Running sources and writing to Results-1 tab.
    await core.run({
      srcDatasetId: 'Sources-1',
      destDatasetId: 'Results-1',
      filters: ['selected'],
    });
    // Ensure there are two additional rows in the Results tab.
    expect(resultsData1.length).toEqual(5);

    // Ensure there's no additional rows written to Results-2 tab.
    expect(resultsData2.length).toEqual(5);

    // Verify each result row's status and URL.
    expect(resultsData1[3][3]).toEqual('Retrieved');
    expect(resultsData1[3][4]).toEqual('google.com');
    expect(resultsData1[4][3]).toEqual('Retrieved');
    expect(resultsData1[4][4]).toEqual('web.dev');
  });

  it('submits source rows and override results to specific tabs', async () => {
    let resultsData1;

    // Running sources and writing to Results-1 tab.
    await core.run({
      srcDatasetId: 'Sources-1',
      destDatasetId: 'Results-1',
    });
    // Ensure there are two additional rows in the Results tab.
    resultsData1 = fakeSheets['Results-1'].fakeData;
    expect(resultsData1.length).toEqual(6);

    // Running sources and writing to Results-1 tab.
    await core.run({
      srcDatasetId: 'Sources-1',
      destDatasetId: 'Results-1',
    });
    resultsData1 = fakeSheets['Results-1'].fakeData;
    expect(resultsData1.length).toEqual(9);

    // Running sources and writing to Results-1 tab.
    await core.run({
      srcDatasetId: 'Sources-1',
      destDatasetId: 'Results-1',
      overrideResults: true,
    });
    resultsData1 = fakeSheets['Results-1'].fakeData;
    expect(resultsData1.length).toEqual(6);
  });

  it('retrieve JSON from system tab', async () => {
    // Running sources and writing to Results-1 tab.
    let jsonData = await core.connector.getDataJson('Settings');

    expect(jsonData).toEqual({
      "apiKey": "TEST_APIKEY",
      "gcpProjectId": "TEST_PROJECTID",
      "sheets": { "rowIndex": 2 }
    });
  });

  it('submits DocAI source json and writes DocAI field keys to specific tab', async () => {
    let contentBase64 = require('./fixtures/docai_request.json').rawDocument.content;
    let responseJsonStr = JSON.stringify(require('./fixtures/docai_response.json'));

    // Mocker API response.
    core.connector.apiHandler.post = () => {
      return {
        statusCode: 200,
        body: responseJsonStr,
      };
    };

    await core.run({
      gatherer: ['docai'],
      srcData: {
        documentType: 'fake-document-type',
        contentBase64: contentBase64,
      },
      destDatasetId: 'Results-DocKeys',
      overrideResults: true,
      multiRowsGatherer: 'docai',
      docai: {
        authorization: 'fake-oauth-token',
        projectId: 'fake-id',
        processorId: 'fake-id',
        fieldKeyOnly: true,
      },
    });

    let fieldKeysData = fakeSheets['Results-DocKeys'].fakeData;
    expect(fieldKeysData.length).toEqual(52);
    expect(fieldKeysData[3][0]).toEqual('fake-document-type');
    expect(fieldKeysData[3][1]).toEqual('First Name');
    expect(fieldKeysData[4][1]).toEqual('Year');
    expect(fieldKeysData[5][1]).toEqual('Social Security Number:');
  });

  it('submits DocAI source json and writes DocAI result rows to specific tab', async () => {
    let contentBase64 = require('./fixtures/docai_request.json').rawDocument.content;
    let responseJsonStr = JSON.stringify(require('./fixtures/docai_response.json'));

    // Mocker API response.
    core.connector.apiHandler.post = () => {
      return {
        statusCode: 200,
        body: responseJsonStr,
      };
    };

    await core.run({
      gatherer: ['docai'],
      srcData: {
        documentType: 'fake-document-type',
        contentBase64: contentBase64,
      },
      destDatasetId: 'Results-DocEntities',
      overrideResults: true,
      docai: {
        authorization: 'fake-oauth-token',
        projectId: 'fake-id',
        processorId: 'fake-id',
      },
    });

    let docEntityData = fakeSheets['Results-DocEntities'].fakeData;
    expect(docEntityData.length).toEqual(4);
    expect(docEntityData[3][3]).toEqual('Adam');
    expect(docEntityData[3][4]).toEqual('Darker');
    expect(docEntityData[3][5]).toEqual('999-99-9999');
  });

  it('submits DocAI source json and and remap DocAI keys', async () => {
    let contentBase64 = require('./fixtures/docai_request.json').rawDocument.content;
    let responseJsonStr = JSON.stringify(require('./fixtures/docai_response.json'));

    // Mocker API response.
    core.connector.apiHandler.post = () => {
      return {
        statusCode: 200,
        body: responseJsonStr,
      };
    };

    await core.run({
      gatherer: ['docai'],
      srcData: {
        documentType: 'fake-document-type',
        contentBase64: contentBase64,
      },
      destDatasetId: 'Results-DocEntities',
      overrideResults: true,
      docai: {
        authorization: 'fake-oauth-token',
        projectId: 'fake-id',
        processorId: 'fake-id',
        keyRemapList: [{
          key: 'Mailing Address (No., Street, Apt., P.O. Box)',
          newKey: 'address',
        }]
      },
    });

    let docEntityData = fakeSheets['Results-DocEntities'].fakeData;
    expect(docEntityData.length).toEqual(4);
    expect(docEntityData[3][3]).toEqual('Adam');
    expect(docEntityData[3][4]).toEqual('Darker');
    expect(docEntityData[3][5]).toEqual('999-99-9999');
    expect(docEntityData[3][6]).toEqual('298 Stephen Circle Apt. 118 Deggyburgh, NM 01894');
  });

  it('submits DocAI with driver license and writes DocAI result rows to specific tab', async () => {
    let contentBase64 = require('./fixtures/docai_request.json').rawDocument.content;
    let responseJsonStr = JSON.stringify(require('./fixtures/docai_response_driver_license.json'));

    // Mocker API response.
    core.connector.apiHandler.post = () => {
      return {
        statusCode: 200,
        body: responseJsonStr,
      };
    };

    await core.run({
      gatherer: ['docai'],
      srcData: {
        documentType: 'fake-document-type',
        contentBase64: contentBase64,
      },
      destDatasetId: 'Results-DriverLicense',
      overrideResults: true,
      docai: {
        authorization: 'fake-oauth-token',
        projectId: 'fake-id',
        processorId: 'fake-id',
      },
    });

    let docEntityData = fakeSheets['Results-DriverLicense'].fakeData;
    expect(docEntityData.length).toEqual(4);
    expect(docEntityData[3][3]).toEqual('Adam Jason');
    expect(docEntityData[3][4]).toEqual('Parker');
    expect(docEntityData[3][5]).toEqual('298 Stephen Circle Apt. 118 Peggyburgh, NM 01894');
  });

  it('submits DocAI source json and collects overall errors', async () => {
    core.connector.apiHandler.post = () => {
      return {
        statusCode: 500,
      };
    };

    await core.run({
      gatherer: ['docai'],
      srcData: {
        documentType: 'fake-document-type',
      },
      destDatasetId: 'Results-DocEntities',
      overrideResults: true,
      docai: {},
    });
    let docEntityData = fakeSheets['Results-DocEntities'].fakeData;
    expect(docEntityData.length).toEqual(4);
    expect(docEntityData[3][7]).toEqual(['[docai] projectId is missing in gathererOptions']);
  });

});
