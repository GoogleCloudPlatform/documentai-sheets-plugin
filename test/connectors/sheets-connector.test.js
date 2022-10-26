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

const SheetsConnector = require('../../src/connectors/sheets-connector');
const assert = require('../../src/utils/assert');
const setObject = require('../../src/utils/set-object');
const Status = require('../../src/common/status');
const { initFakeSheet, fakeSheets, fakeSheetData, SpreadsheetApp } = require('./sheets-test-utils');

global.SpreadsheetApp = SpreadsheetApp;

let connectorConfig = {
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
};

let fakeSources = [
  {
    selected: true,
    label: 'Google',
    recurring: {
      frequency: 'Daily',
      nextTriggerTimestamp: null,
    },
    gatherer: 'fake',
    fake: {
      url: 'google.com',
      settings: {
        connection: '4G',
        location: 'TestLocation',
      }
    },
    sheets: {
      rowIndex: 4,
    }
  },
  {
    selected: false,
    label: 'Example',
    recurring: {
      frequency: null,
      nextTriggerTimestamp: null,
    },
    gatherer: 'fake',
    fake: {
      url: 'examples.com',
      settings: {
        connection: '3G',
        location: 'TestLocation',
      }
    },
    sheets: {
      rowIndex: 5,
    }
  },
  {
    selected: true,
    label: 'Web.Dev',
    recurring: {
      frequency: 'Daily',
      nextTriggerTimestamp: null,
    },
    gatherer: 'fake',
    fake: {
      url: 'web.dev',
      settings: {
        connection: '3G',
        location: 'TestLocation',
      }
    },
    sheets: {
      rowIndex: 6,
    }
  }
];

let fakeResults = [
  {
    selected: true,
    id: 'id-1234',
    type: 'single',
    status: Status.RETRIEVED,
    fake: {
      url: 'google.com',
      metrics: {
        SpeedIndex: 500,
      },
    },
    sheets: {
      rowIndex: 4,
    }
  },
  {
    selected: false,
    id: 'id-5678',
    type: 'recurring',
    status: Status.RETRIEVED,
    fake: {
      url: 'web.dev',
      metrics: {
        SpeedIndex: 800,
      },
    },
    sheets: {
      rowIndex: 5,
    }
  },
];


let connector;

/* eslint-env jest */

describe('SheetsConnector Sources tab', () => {
  beforeEach(() => {
    // Overrides properties for testing.
    fakeSheets['Sources-1'] = initFakeSheet(fakeSheetData.fakeSourcesSheetData);
    fakeSheets['Sources-2'] = initFakeSheet(fakeSheetData.fakeSourcesSheetData);
    connector = new SheetsConnector(connectorConfig, {} /* apiHandler */);
  });

  it('returns all sources from a specific sheet', async () => {
    let sources = connector.getDataList('Sources-2');
    expect(sources).toEqual(fakeSources);
  });

  it('returns a selection of sources from the Sources sheet with filters',
    async () => {

      // Filtering test.selected = true
      let sources = connector.getDataList('Sources-1', {
        filters: ['selected'],
      });
      expect(sources).toEqual([
        fakeSources[0],
        fakeSources[2],
      ]);

      // Filtering test.recurring.frequency
      sources = connector.getDataList('Sources-1', {
        filters: ['recurring.frequency'],
      });
      expect(sources).toEqual([
        fakeSources[0],
        fakeSources[2],
      ]);

      // Filtering test.selected = true
      sources = connector.getDataList('Sources-1', {
        filters: ['fake.settings.connection==="4G"'],
      });
      expect(sources).toEqual([
        fakeSources[0],
      ]);
    });

  it('updates sources to the Sources sheet', async () => {
    let sources = connector.getDataList('Sources-1');
    sources[0].label = 'Updated Label';

    connector.updateDataList('Sources-1', sources);
    let updatedSources = connector.getDataList('Sources-1');

    expect(updatedSources).toEqual(sources);
  });

  it('filters sources based on rowIndex', async () => {
    let sources = connector.getDataList('Sources-1', {
      filters: ['sheets.rowIndex===6']
    });

    expect(sources).toEqual([
      fakeSources[2],
    ]);
  });
});

describe('SheetsConnector Results tab', () => {
  beforeEach(() => {
    fakeSheets['Results-1'] = initFakeSheet(fakeSheetData.fakeResultsSheetData);
    connector = new SheetsConnector(connectorConfig, {} /* apiHandler */);
  });

  it('returns list of results from the Results sheet', async () => {
    let results = connector.getDataList('Results-1');
    expect(results).toEqual(fakeResults);
  });

  it('returns a selection of results from the Results sheet with filters',
    async () => {
      let results, expecteResults;

      results = connector.getDataList('Results-1', {
        filters: ['selected'],
      });
      expect(results).toEqual([
        fakeResults[0],
      ]);
    });

  it('appends a new set of results to an empty Results sheet', async () => {
    let resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url', 'fake.metrics.FirstContentfulPaint'],
      ['', 'ID', 'Type', 'Status', 'URL', 'WPT FirstContentfulPaint'],
    ];
    fakeSheets['Results-1'] = initFakeSheet(resultsData);

    let newResult = {
      selected: true,
      id: 'id-9999',
      type: 'single',
      url: 'google.com',
      status: Status.RETRIEVED,
      fake: {
        metrics: {
          SpeedIndex: 500,
        },
      },
    };

    connector.appendDataList('Results-1', [newResult]);
    let expecteResults = connector.getDataList('Results-1');
    expect(expecteResults.length).toEqual(1);
    expect(expecteResults[0].id).toEqual('id-9999');
    expect(expecteResults[0].url).toEqual('google.com');
  });

  it('appends a new set of results to the Results sheet', async () => {
    let results, expecteResults;
    results = connector.getDataList('Results-1');

    let newResult = {
      selected: true,
      id: 'id-9999',
      type: 'single',
      status: Status.RETRIEVED,
      fake: {
        url: 'google.com',
        metrics: {
          SpeedIndex: 500,
        },
      },
      sheets: {
        rowIndex: 6,
      }
    };
    connector.appendDataList('Results-1', [newResult]);
    expecteResults = connector.getDataList('Results-1');
    expect(expecteResults.length).toEqual(3);
    expect(expecteResults).toEqual(results.concat(newResult));
  });

  it('updates results to the Results sheet', async () => {
    let results, actualResults;
    results = connector.getDataList('Results-1');

    let result = {
      selected: true,
      id: 'id-1234',
      type: 'recurring',
      status: Status.ERROR,
      fake: {
        url: 'web.dev',
        metrics: {
          SpeedIndex: 800,
        },
      },
      sheets: {
        rowIndex: 5,
      }
    };
    connector.updateDataList('Results-1', [result]);
    actualResults = connector.getDataList('Results-1');

    expect(actualResults.length).toEqual(2);
    expect(actualResults[1].status).toEqual(Status.ERROR);
    expect(actualResults[1].fake.url).toEqual('web.dev');
  });

  it('gets Env Vars in JSON format.', async () => {
    let envVars = await connector.getEnvVars();
    let expectedEnvVars = {
      apiKey: 'TEST_APIKEY',
      gcpProjectId: 'TEST_PROJECTID'
    };
    expect(envVars).toEqual(expectedEnvVars);
  });
});

describe('SheetsConnector System tab', () => {
  beforeEach(() => {
    // Overrides properties for testing.
    fakeSheets['System'] = initFakeSheet(fakeSheetData.fakeSystemSheetData);
    connector = new SheetsConnector(connectorConfig, {} /* apiHandler */);
  });

  it('returns a specific system variable from the System sheet', async () => {
    expect(connector.getSystemVar('RETRIEVE_TRIGGER_ID')).toEqual('');
    expect(connector.getSystemVar('RECURRING_TRIGGER_ID')).toEqual('');
  });

  it('sets value to a specific system var to the System sheet', async () => {
    connector.setSystemVar('RETRIEVE_TRIGGER_ID', 'trigger-1');
    expect(connector.getSystemVar('RETRIEVE_TRIGGER_ID')).toEqual('trigger-1');
    expect(connector.getSystemVar('RECURRING_TRIGGER_ID')).toEqual('');
  });
});

describe('SheetsConnector Locations tab', () => {
  beforeEach(() => {
    // Overrides properties for testing.
    fakeSheets['Locations'] = initFakeSheet(fakeSheetData.fakeLocationsSheetData);
    connector = new SheetsConnector(connectorConfig, {} /* apiHandler */);
  });

  it('updates locations to LocationsTab', async () => {
    connector.apiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: JSON.stringify({
          'data': {
            'location-1': {
              labelShort: 'Location 1',
              pendingResults: { Total: 10 },
              Browsers: 'chrome',
            },
            'location-2': {
              labelShort: 'Location 2',
              pendingResults: { Total: 20 },
              Browsers: 'firefox',
            }
          }
        })
      }
    };
  });
});

describe('SheetsConnector additional functions', () => {
  beforeEach(() => {
    // Overrides properties for testing.
    fakeSheets['EnvVars'] = initFakeSheet(fakeSheetData.fakeEnvVarsSheetData);
    fakeSheets['System'] = initFakeSheet(fakeSheetData.fakeSystemSheetData);
    fakeSheets['Sources-1'] = initFakeSheet(fakeSheetData.fakeSourcesSheetData);
    fakeSheets['Results-1'] = initFakeSheet(fakeSheetData.fakeResultsSheetData);
    connector = new SheetsConnector(connectorConfig, {} /* apiHandler */);
  });

  it('returns property lookup values for sheet with DataAxis.ROW', async () => {
    let propertyLookup;
    propertyLookup = connector.getPropertyLookup('Sources-1');
    expect(propertyLookup).toEqual(fakeSheetData.fakeSourcesSheetData[1]);

    propertyLookup = connector.getPropertyLookup('Results-1');
    expect(propertyLookup).toEqual(fakeSheetData.fakeResultsSheetData[1]);
  });

  it('returns property lookup values for sheet with DataAxis.COLUMN', async () => {
    let propertyLookup;
    propertyLookup = connector.getPropertyLookup('Sources-1');
    expect(propertyLookup).toEqual([
      'selected',
      'fake.url',
      'label',
      'recurring.frequency',
      'recurring.nextTriggerTimestamp',
      'gatherer',
      'fake.settings.connection',
      'fake.settings.location',
    ]);
  });

  it('returns property index with given property key', async () => {
    let index;
    index = connector.getPropertyIndex('Results-1', 'status');
    expect(index).toEqual(4);
  });

  it('throws error if not able to find a specific sheet', () => {
    expect(() => { connector.getSheet('NonExistingTab') }).toThrow(Error);
  });

  it('returns the last row with values', () => {
    let resultsData, lastRowIndex;
    resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url', 'cruxbigquery.metrics.SpeedIndex', 'psi.metrics.SpeedIndex'],
      ['Selected', 'ID', 'Type', 'Status', 'URL', 'CrUX SpeedIndex', 'PSI SpeedIndex'],
      ['', '', '', '', '', ''],
      ['', '', '', '', '', ''],
      ['', '', '', '', '', ''],
    ];
    fakeSheets['Results-1'] = initFakeSheet(resultsData);
    lastRowIndex = connector.getTabLastRow('Results-1');
    expect(lastRowIndex).toEqual(3);

    resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url', 'cruxbigquery.metrics.SpeedIndex'],
      ['Selected', 'ID', 'Type', 'Status', 'URL', 'CrUX SpeedIndex'],
      ['true', 'id-1234', 'test', 'Retrieved', 'web.dev', '1234'],
      ['true', 'id-5678', 'test', 'Retrieved', 'web.dev', '1234'],
      ['', '', '', '', '', ''],
    ];
    fakeSheets['Results-1'] = initFakeSheet(resultsData);
    lastRowIndex = connector.getTabLastRow('Results-1');
    expect(lastRowIndex).toEqual(5);
  });
});
