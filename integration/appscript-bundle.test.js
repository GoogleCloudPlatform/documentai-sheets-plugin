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

const fs = require('fs');
const DataCollectionFramework = require('../build/appscript-bundle');
const { initFakeSheet, fakeSheetData, SpreadsheetApp, Session, Utilities,
  ScriptApp, Logger, Browser, UrlFetchApp } = require('../test/connectors/appscript-test-utils');
const { Frequency, FrequencyInMinutes } = require('../src/common/frequency');

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

describe('DataCollectionFramework bundle for AppScript', () => {
  beforeEach(() => {
    fakeSheets = {
      'EnvVars': initFakeSheet(fakeSheetData.fakeEnvVarsSheetData),
      'System': initFakeSheet(fakeSheetData.fakeSystemSheetData),
      'Locations': initFakeSheet(fakeSheetData.fakeLocationsSheetData),
      'Sources-1': initFakeSheet(fakeSheetData.fakeSourcesSheetData),
      'Results-1': initFakeSheet(fakeSheetData.fakeEmptyResultsSheetData),
      'Sources-2': initFakeSheet(fakeSheetData.fakeSourcesSheetData),
      'Results-2': initFakeSheet(fakeSheetData.fakeEmptyResultsSheetData),
    };

    let coreConfig = {
      sources: {
        connector: 'appscript',
      },
      results: {
        connector: 'appscript',
      },
      helper: 'appscript',
      extensions: [
        'budgets',
        'appscript',
      ],
      // specific configs below
      appscript: {
        defaultSourcesTab: 'Sources-1',
        defaultResultsTab: 'Results-1',
        tabs: [{
          tabName: 'Sources-1',
          tabRole: 'tests',
          dataAxis: 'row',
          propertyLookup: 2, // Starts at 1
          skipColumns: 0,
          skipRows: 3,
        }, {
          tabName: 'Results-1',
          tabRole: 'results',
          dataAxis: 'row',
          propertyLookup: 2, // Starts at 1
          skipColumns: 0,
          skipRows: 3,
        }, {
          tabName: 'Sources-2',
          tabRole: 'tests',
          dataAxis: 'row',
          propertyLookup: 2, // Starts at 1
          skipColumns: 0,
          skipRows: 3,
        }, {
          tabName: 'Results-2',
          tabRole: 'results',
          dataAxis: 'row',
          propertyLookup: 2, // Starts at 1
          skipColumns: 0,
          skipRows: 3,
        }, {
          tabName: 'EnvVars',
          tabRole: 'envVars',
          dataAxis: 'column',
          propertyLookup: 2, // Starts at 1
          skipRows: 1,
          skipColumns: 2,
        }, {
          tabName: 'System',
          tabRole: 'system',
          dataAxis: 'column',
          propertyLookup: 2, // Starts at 1
          skipRows: 1,
          skipColumns: 2,
        }, {
          tabName: 'Locations',
          tabRole: 'locations',
          dataAxis: 'row',
          propertyLookup: 2, // Starts at 1
          skipRows: 2,
          skipColumns: 0,
        }],
        // For GA tracking
        gaAccount: 'UA-123456789-1',
        coreVersion: 'awp-dev',
        isSendTrackEvent: false,
      },
      budgets: {
        dataSource: 'webpagetest',
      },
      batchUpdateBuffer: 10,
      verbose: false,
      debug: false,
    };

    core = new DataCollectionFramework(coreConfig);
  });

  it('creates DataCollectionFramework instance', () => {
    expect(core).not.toBe(null);
  });

  it('initializes DataCollectionFramework for AppScript via connector init()', () => {
    core.connector.apiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: JSON.stringify({
          'data': {
            'location-1': {
              labelShort: 'Location 1',
              PendingSources: { Total: 10 },
              Browsers: 'chrome',
            },
            'location-2': {
              labelShort: 'Location 2',
              PendingSources: { Total: 20 },
              Browsers: 'firefox',
            }
          }
        })
      }
    };
    core.connector.init();

    // Ensure it creates triggers for 'submitRecurringSources' and 'onEditFunc'.
    let systemData = fakeSheets['System'].fakeData;
    expect(systemData[2][2]).toEqual('timeBased-submitRecurringSources');

    // Ensure it updates the last init timestamp.
    expect(systemData[4][2]).not.toBe('');
    expect(systemData[4][2]).toBeGreaterThan(0);
  });

  it('submits selected sources and writes results to specific tabs', async () => {
    let resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(3);

    let systemData = [
      ['Name', 'key', 'value'],
      ['Retrieve Trigger ID', 'RETRIEVE_TRIGGER_ID', ''],
    ];
    fakeSheets['System'] = initFakeSheet(systemData);

    // Running sources and writing to Results-2 tab.
    await core.run({
      filters: ['selected'],
      appscript: {
        sourcesTab: 'Sources-1',
        resultsTab: 'Results-2',
      },
    });

    // Ensure there's no additional rows written to Results-1 tab.
    expect(resultsData.length).toEqual(3);

    // Running sources and writing to Results-1 tab.
    await core.run({
      filters: ['selected'],
      appscript: {
        sourcesTab: 'Sources-1',
        resultsTab: 'Results-1',
      },
    });
    // Ensure there are two additional rows in the Results tab.
    expect(resultsData.length).toEqual(5);

    // Verify each result row's status and URL.
    expect(resultsData[3][3]).toEqual('Submitted');
    expect(resultsData[3][4]).toEqual('google.com');
    expect(resultsData[4][3]).toEqual('Submitted');
    expect(resultsData[4][4]).toEqual('web.dev');

    // Ensure it creates Retrieve trigger and records it in System tab.
    systemData = fakeSheets['System'].fakeData;
    expect(systemData[1][2]).toEqual('timeBased-retrievePendingResults');
  });

  it('submits selected sources in batch mode and writes results', async () => {
    let resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(3);

    let systemData = [
      ['Name', 'key', 'value'],
      ['Retrieve Trigger ID', 'RETRIEVE_TRIGGER_ID', ''],
    ];
    fakeSheets['System'] = initFakeSheet(systemData);

    // Running sources and writing to Results-2 tab.
    await core.run({
      filters: ['selected'],
      appscript: {
        sourcesTab: 'Sources-1',
        resultsTab: 'Results-2',
      },
      runByBatch: true, // Run with batch mode for all gatherers.
    });

    // Ensure there's no additional rows written to Results-1 tab.
    expect(resultsData.length).toEqual(3);

    // Running sources and writing to Results-1 tab.
    await core.run({
      filters: ['selected'],
      appscript: {
        sourcesTab: 'Sources-1',
        resultsTab: 'Results-1',
      },
    });
    // Ensure there are two additional rows in the Results tab.
    expect(resultsData.length).toEqual(5);

    // Verify each result row's status and URL.
    expect(resultsData[3][3]).toEqual('Submitted');
    expect(resultsData[3][4]).toEqual('google.com');
    expect(resultsData[4][3]).toEqual('Submitted');
    expect(resultsData[4][4]).toEqual('web.dev');

    // Ensure it creates Retrieve trigger and records it in System tab.
    systemData = fakeSheets['System'].fakeData;
    expect(systemData[1][2]).toEqual('timeBased-retrievePendingResults');
  });

  it('submits selected sources and writes results with spreadArrayProperty',
    async () => {
      let testsData = [
        ['', ''],
        ['selected', 'cruxbigquery.origin'],
        ['', 'Origin'],
        [true, 'https://example.com'],
        [true, 'https://web.dev'],
      ];
      let resultsData = [
        ['', '', '', ''],
        ['cruxbigquery.metrics.Date', 'cruxbigquery.metrics.Origin',
          'cruxbigquery.metrics.Device', 'cruxbigquery.metrics.FirstContentfulPaint.p75'],
        ['Date', 'Origin', 'Device', 'FCP p75'],
      ];
      fakeSheets['Sources-1'] = initFakeSheet(testsData);
      fakeSheets['Results-1'] = initFakeSheet(resultsData);

      // Running sources and writing to Results-1 tab.
      await core.run({
        filters: ['selected'],
        runByBatch: true, // Mandatory for Cruxbigquery gatherer.
        gatherer: 'cruxbigquery',
        appscript: {
          sourcesTab: 'Sources-1',
          resultsTab: 'Results-1',
          spreadArrayProperty: 'cruxbigquery.metrics',
        },
      });

      resultsData = fakeSheets['Results-1'].fakeData;

      console.log(resultsData);
      expect(resultsData.length).toEqual(6);
      expect(resultsData[3][1]).toBe('https://example.com');
      expect(resultsData[3][2]).toBe('mobile');
      expect(resultsData[3][3]).toBe(900);
      expect(resultsData[4][1]).toBe('https://web.dev');
      expect(resultsData[4][2]).toBe('mobile');
      expect(resultsData[4][3]).toBe(1000);
      expect(resultsData[5][1]).toBe('https://web.dev');
      expect(resultsData[5][2]).toBe('mobile');
      expect(resultsData[5][3]).toBe(1100);
    });

  it('submits selected sources without values of spreadArrayProperty', async () => {
    let testsData = [
      ['', '', '', '', '', ''],
      ['selected', 'url', 'label', 'webpagetest.settings.connection'],
      ['', 'URL', 'Label', 'Frequency', 'WPT Connection'],
      [true, 'example.com', 'Example', '4G'],
      [true, 'web.dev', 'Example', '4G'],
    ];
    let resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url'],
      ['', 'ID', 'Type', 'Status', 'URL'],
    ];
    fakeSheets['Sources-1'] = initFakeSheet(testsData);
    fakeSheets['Results-1'] = initFakeSheet(resultsData);

    // Running sources and writing to Results-1 tab.
    await core.run({
      filters: ['selected'],
      runByBatch: true, // Mandatory for CrUXBigQuery gatherer.
      appscript: {
        sourcesTab: 'Sources-1',
        resultsTab: 'Results-1',
        spreadArrayProperty: 'something.else',
      },
    });

    resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(5);
    expect(resultsData[3][4]).toBe('example.com');
    expect(resultsData[4][4]).toBe('web.dev');
  });

  it('submits recurring sources and updates next frequency timestamp in ' +
    'activateOnly mode', async () => {
      // Running recurring sources with activateOnly mode.
      await core.recurring({
        activateOnly: true,
        appscript: {
          sourcesTab: 'Sources-1',
          resultsTab: 'Results-1',
        },
      });

      let testsData = fakeSheets['Sources-1'].fakeData;

      // Verify the udpated Sources rows with new next trigger timestamp.
      let nowtime = Date.now();
      expect(testsData[3][4]).toBeGreaterThan(nowtime);
      expect(testsData[4][4]).toBe(null);
      expect(testsData[5][4]).toBeGreaterThan(nowtime);

      // Ensure there's no new rows in Results tab.
      let resultsData = fakeSheets['Results-1'].fakeData;
      expect(resultsData.length).toEqual(3);
    });

  it('submits recurring sources and updates in the correct tabs', async () => {
    let testsData = [
      ['', '', '', '', '', ''],
      ['selected', 'url', 'label', 'recurring.frequency', 'recurring.nextTriggerTimestamp', 'webpagetest.settings.connection'],
      ['', 'URL', 'Label', 'Frequency', 'Next Trigger Timestamp', 'WPT Connection'],
      [true, 'example.com', 'Example', 'Daily', null, '3G'],
    ];
    let testsData2 = [
      ['', '', '', '', '', ''],
      ['selected', 'url', 'label', 'recurring.frequency', 'recurring.nextTriggerTimestamp', 'webpagetest.settings.connection'],
      ['', 'URL', 'Label', 'Frequency', 'Next Trigger Timestamp', 'WPT Connection'],
      [true, 'correct.com', 'Correct', 'Daily', null, '3G'],
    ];
    fakeSheets['Sources-1'] = initFakeSheet(testsData);
    fakeSheets['Sources-2'] = initFakeSheet(testsData2);

    // Running recurring sources with activateOnly mode.
    await core.recurring({
      filters: ['appscript.rowIndex===4'],
      activateOnly: true,
      appscript: {
        sourcesTab: 'Sources-2',
        resultsTab: 'Results-2',
      },
    });

    testsData = fakeSheets['Sources-1'].fakeData;
    testsData2 = fakeSheets['Sources-2'].fakeData;

    // Ensure that there's no change in Sources-1 tab
    let nowtime = Date.now();
    expect(testsData[3][1]).toEqual('example.com');
    expect(testsData[3][2]).toEqual('Example');
    expect(testsData[3][4]).toBe(null);

    // Ensure that the target
    expect(testsData2[3][1]).toEqual('correct.com');
    expect(testsData2[3][2]).toEqual('Correct');
    expect(testsData2[3][4]).toBeGreaterThan(nowtime);
  });

  it('submits recurring sources and creates results rows', async () => {
    let testsData = [
      ['', '', '', '', '', ''],
      ['selected', 'url', 'label', 'recurring.frequency', 'recurring.nextTriggerTimestamp', 'webpagetest.settings.connection'],
      ['', 'URL', 'Label', 'Frequency', 'Next Trigger Timestamp', 'WPT Connection'],
      [true, 'google.com', 'Google', 'Daily', 1234, '4G'],
      [false, 'examples.com', 'Example', null, null, '3G'],
      [true, 'web.dev', 'Web.Dev', 'Daily', 1234, '3G'],
    ];
    fakeSheets['Sources-1'] = initFakeSheet(testsData);

    // Running sources and writing to Results-2 tab.
    await core.recurring({
      appscript: {
        sourcesTab: 'Sources-1',
        resultsTab: 'Results-1',
      },
    });
    testsData = fakeSheets['Sources-1'].fakeData;

    // Verify the udpated Sources rows with new next trigger timestamp.
    let nowtime = Date.now();
    expect(testsData[3][4]).toBeGreaterThan(nowtime);
    expect(testsData[4][4]).toBe(null);
    expect(testsData[5][4]).toBeGreaterThan(nowtime);

    // Ensure there are two new rows in Results tab.
    let resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(5);
    expect(resultsData[3][2]).toEqual('Recurring');
    expect(resultsData[3][4]).toEqual('google.com');
    expect(resultsData[4][2]).toEqual('Recurring');
    expect(resultsData[4][4]).toEqual('web.dev');
  });

  it('retrieve and updates results for selected results', async () => {
    let resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url', 'webpagetest.metadata.id', 'webpagetest.metrics.SpeedIndex'],
      ['', 'ID', 'Type', 'Status', 'URL', 'WPT ID', 'WPT SpeedIndex'],
      [true, 'id-1234', 'single', 'Submitted', 'google.com', 'id-1234', 500],
      [false, 'id-5678', 'recurring', 'Retrieved', 'web.dev', 'id-5678', 800],
    ];
    fakeSheets['Results-1'] = initFakeSheet(resultsData);

    core.connector.apiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: fs.readFileSync('./test/fakedata/wpt-retrieve-response.json')
      }
    };

    await core.retrieve({
      filters: ['selected'],
      appscript: {
        sourcesTab: 'Sources-1',
        resultsTab: 'Results-1',
      },
    });

    // Ensure there are no additional rows in the Results tab.
    resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(5);
    expect(resultsData[3][3]).toEqual('Retrieved');
  });

  it('retrieve and updates results for selected results with errors',
    async () => {
      let resultsData = [
        ['', '', '', '', '', ''],
        ['selected', 'id', 'type', 'status', 'url', 'webpagetest.metadata.id', 'errors'],
        ['', 'ID', 'Type', 'Status', 'URL', 'WPT ID', 'WPT SpeedIndex'],
        [true, 'id-1234', 'single', 'Submitted', 'google.com', 'id-1234', ''],
      ];
      fakeSheets['Results-1'] = initFakeSheet(resultsData);

      core.connector.apiHandler.fetch = () => {
        return {
          statusCode: 400,
          statusText: 'Some error',
        }
      };

      await core.retrieve({
        filters: ['selected'],
        appscript: {
          sourcesTab: 'Sources-1',
          resultsTab: 'Results-1',
        },
      });

      // Ensure there are no additional rows in the Results tab.
      resultsData = fakeSheets['Results-1'].fakeData;
      expect(resultsData.length).toEqual(4);
      expect(resultsData[3][3]).toEqual('Error');
      expect(resultsData[3][6]).toEqual(['[webpagetest] Some error']);
    });

  it('retrieve all pending results and deletes Retrieve trigger', async () => {
    let resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url', 'webpagetest.metadata.id', 'webpagetest.metrics.SpeedIndex'],
      ['', 'ID', 'Type', 'Status', 'URL', 'WPT ID', 'WPT SpeedIndex'],
      [false, 'id-1234', 'single', 'Submitted', 'google.com', 'id-1234', 500],
      [false, 'id-5678', 'recurring', 'Retrieved', 'web.dev', 'id-5678', 800],
    ];
    fakeSheets['Results-1'] = initFakeSheet(resultsData);

    let systemData = [
      ['Name', 'key', 'value'],
      ['Retrieve Trigger ID', 'RETRIEVE_TRIGGER_ID', 'trigger-1'],
      ['Submit Recurring Trigger ID', 'RECURRING_TRIGGER_ID', 'trigger-2'],
      ['User\'s TimeZone', 'LAST_INIT_TIMESTAMP', 'GMT'],
    ];
    fakeSheets['System'] = initFakeSheet(systemData);

    core.connector.apiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: fs.readFileSync('./test/fakedata/wpt-retrieve-response.json')
      }
    };

    await core.retrieve({
      filters: ['status!==""', 'status!=="Retrieved"', 'status!=="Error"'],
      appscript: {
        sourcesTab: 'Sources-1',
        resultsTab: 'Results-1',
      },
    });

    resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(5);
    expect(resultsData[4][3]).toEqual('Retrieved');
    expect(resultsData[4][3]).toEqual('Retrieved');

    systemData = fakeSheets['System'].fakeData;
    expect(systemData[1][2]).toEqual('');
  });
});
