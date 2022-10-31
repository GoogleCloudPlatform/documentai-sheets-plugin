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

const DataGathererFramework = require('../src/core');
const Connector = require('../src/connectors/connector');
const Gatherer = require('../src/gatherers/gatherer');
const Extension = require('../src/extensions/extension');
const Status = require('../src/common/status');

let generateFakeSources = function (amount, options) {
  options = options || {};
  let sources = [];
  let count = 1;
  while (count <= amount) {
    let source = {
      id: 'source-' + count,
      label: 'label-' + count,
      gatherer: 'fake',
      fake: {
        metadata: {
          connection: '4G',
        },
      },
    };
    if (options.recurring) {
      source.recurring = {
        frequency: options.recurring.frequency,
      };
    }

    sources.push(source);
    count++;
  }
  return sources;
}

let generateFakeResults = function (amount, options) {
  options = options || {};
  let results = [];
  let offset = options.idOffset || 0;
  let count = 1;
  while (count <= amount) {
    let result = {
      id: 'result-' + (count + offset),
      label: 'label-' + count,
      status: Status.RETRIEVED,
      gatherer: 'fake',
      fake: {
        status: Status.RETRIEVED,
        metadata: {
          connection: '4G',
        },
        data: {
          key: 'test',
        }
      },
      errors: [],
    };

    if (options.status) {
      result.status = options.status;
      result.fake.status = options.status;
    }

    results.push(result);
    count++;
  }
  return results;
}

let cleanFakeResults = function (results) {
  let count = 1;
  return results.map(result => {
    result.id = 'result-' + count;
    delete result.createdTimestamp;
    delete result.modifiedTimestamp;
    count++;
    return result;
  });
}

class FakeConnector extends Connector {
  constructor(config) {
    super();
    this.sources = [];
    this.results = [];
  }
  getEnvVars() {
    return {
      envVars: {
        webPageTestApiKey: 'TEST_APIKEY',
        psiApiKey: 'TEST_APIKEY',
        gcpProjectId: 'TEST_PROJECTID'
      }
    };
  }
  getDataList(datasetId) {
    if (datasetId === 'Sources-1') {
      return this.sources;
    } else if (datasetId === 'Results-1') {
      return this.results;
    }
    return [];
  }
  updateDataList(datasetId, newItems) {
    if (datasetId === 'Sources-1') {
      if (datasetId === 'Sources-1') {
        return this.sources;
      } else if (datasetId === 'Results-1') {
        return this.results;
      }
    } else if (datasetId === 'Results-1') {
      this.results.forEach(result => {
        return newItems.filter(x => result.id === x.id)[0];
      });
    }
  }
  appendDataList(datasetId, newItems) {
    if (datasetId === 'Sources-1') {
      this.sources = this.sources.concat(newItems);
    } else if (datasetId === 'Results-1') {
      this.results = this.results.concat(newItems);
    }
  }
  clearDataList(datasetId) {
    this.results = [];
  }
}

class FakeGatherer extends Gatherer {
  run(source) {
    let data;
    if (source.multiRowsData) {
      data = [{
        key: 'test1',
      }, {
        key: 'test2',
      }]
    } else {
      data = {
        key: 'test',
      };
    }

    return {
      status: Status.RETRIEVED,
      metadata: (source.fake || {}).metadata,
      data: data,
    };
  }
}

class FakeExtension extends Extension {
  beforeRun(source) { }
  afterRun(source, result) { }
  beforeAllRuns(sources, results) { }
  afterAllRuns(sources, results) { }
}

const fakeApiHandler = function (url) {
  return {};
}

describe('DataGathererFramework with fake modules', () => {
  let core;

  beforeEach(() => {
    let coreConfig = {
      helper: 'fake',
      connector: 'fake',
      quiet: true,
    };
    core = new DataGathererFramework(coreConfig);
    core.connector = new FakeConnector();
    core.apiHandler = fakeApiHandler;
    core.gatherers = {
      fake: new FakeGatherer(),
    }
    core.extensions = {
      fake: new FakeExtension(),
    };

    // Mock functions
    ['beforeRun', 'afterRun', 'beforeRetrieve', 'afterRetrieve',
      'beforeAllRuns', 'afterAllRuns', 'beforeAllRetrieves',
      'afterAllRetrieves'].forEach(funcName => {
        core.extensions.fake[funcName] = jest.fn();
      });
  });

  it('initializes normally.', async () => {
    expect(core).not.toBe(null);
  });

  it('runs with a single source data and gets result.', async () => {
    let fakeSources = generateFakeSources(1);
    await core.run({
      srcData: fakeSources[0],
      destDatasetId: 'Results-1',
    });

    let expectedResults = generateFakeResults(1);
    let actualResults = await core.getDataList('Results-1');
    actualResults = cleanFakeResults(actualResults);
    expect(actualResults).toEqual(expectedResults);
  });

  it('runs through a list of sources and gets results.', async () => {
    let sources = generateFakeSources(10);
    core.connector.appendDataList('Sources-1', sources);
    await core.run({
      srcDatasetId: 'Sources-1',
      destDatasetId: 'Results-1',
    });

    let expectedResults = generateFakeResults(10);
    let actualResults = await core.getDataList('Results-1');
    actualResults = cleanFakeResults(actualResults);
    expect(actualResults).toEqual(expectedResults);
  });

  it('retrieves non-complete results.', async () => {
    core.connector.sources = generateFakeSources(1);
    await core.run({
      srcDatasetId: 'Sources-1',
      destDatasetId: 'Results-1',
    });

    cleanFakeResults(core.connector.results);
    let expectedResults = generateFakeResults(1, { status: Status.RETRIEVED });

    let results = await core.getDataList('Results-1');
    expect(results).toEqual(expectedResults);
  });

  it('retrieves all non-complete results.', async () => {
    core.connector.sources = generateFakeSources(10);
    await core.run({
      srcDatasetId: 'Sources-1',
      destDatasetId: 'Results-1',
    });

    cleanFakeResults(core.connector.results);
    let expectedResults = generateFakeResults(10, { status: Status.RETRIEVED });

    let results = await core.getDataList('Results-1');
    expect(results).toEqual(expectedResults);
  });

  it('runs and retrieves all results with partial updates with long list.',
    async () => {
      let expectedResults;
      core.connector.sources = generateFakeSources(95);
      core.batchUpdateBuffer = 10;

      expectedResults = generateFakeResults(95);
      await core.run({
        srcDatasetId: 'Sources-1',
        destDatasetId: 'Results-1',
      });

      cleanFakeResults(core.connector.results);
      expect(await core.getDataList('Results-1')).toEqual(expectedResults);
    });

  it('runs and retrieves all results with partial updates with short list.',
    async () => {
      let expectedResults;
      core.connector.sources = generateFakeSources(22);
      core.batchUpdateBuffer = 5;

      expectedResults = generateFakeResults(22);
      await core.run({
        srcDatasetId: 'Sources-1',
        destDatasetId: 'Results-1',
      });

      cleanFakeResults(core.connector.results);
      expect(await core.getDataList('Results-1')).toEqual(expectedResults);
    });

  it('runs through a list of sources and executes extensions.', async () => {
    core.connector.sources = generateFakeSources(10);
    await core.run({
      srcDatasetId: 'Sources-1',
      destDatasetId: 'Results-1',
    });

    expect(core.extensions.fake.beforeAllRuns.mock.calls.length).toBe(1);
    expect(core.extensions.fake.afterAllRuns.mock.calls.length).toBe(1);
    expect(core.extensions.fake.beforeRun.mock.calls.length).toBe(10);
    expect(core.extensions.fake.afterRun.mock.calls.length).toBe(10);
  });

  it('updates overall status based on responses from data sources.',
    async () => {
      let result;
      let fakeGatherer1 = new FakeGatherer();
      let fakeGatherer2 = new FakeGatherer();
      let fakeGatherer3 = new FakeGatherer();

      let genGatherer = (expectedStatus) => {
        return {
          run: (test) => {
            return {
              status: expectedStatus,
            };
          },
          retrieve: (result) => {
            return {
              status: expectedStatus,
            };
          }
        }
      };
      core.envVars = {
        webPageTestApiKey: 'TEST_APIKEY',
        psiApiKey: 'TEST_APIKEY',
        gcpProjectId: 'TEST_PROJECTID'
      };

      // When all gatherers return submitted.
      core.connector.sources = generateFakeSources(1);
      core.connector.sources[0].gatherer = ['fake1', 'fake2', 'fake3'];
      core.gatherers = {
        fake1: genGatherer(Status.SUBMITTED),
        fake2: genGatherer(Status.SUBMITTED),
        fake3: genGatherer(Status.SUBMITTED),
      }
      await core.run({
        srcDatasetId: 'Sources-1',
        destDatasetId: 'Results-1',
      });

      result = (await core.getDataList('Results-1'))[0];
      expect(result.fake1).toBeDefined();
      expect(result.fake2).toBeDefined();
      expect(result.fake3).toBeDefined();
      expect(result.status).toEqual(Status.SUBMITTED);

      // When some gatherers return submitted.
      core.connector.sources = generateFakeSources(1);
      core.connector.sources[0].gatherer = ['fake1', 'fake2', 'fake3'];
      core.gatherers = {
        fake1: genGatherer(Status.RETRIEVED),
        fake2: genGatherer(Status.RETRIEVED),
        fake3: genGatherer(Status.SUBMITTED),
      }
      await core.run({
        srcDatasetId: 'Sources-1',
        destDatasetId: 'Results-1',
      });

      result = (await core.getDataList('Results-1'))[1];
      expect(result.fake1).toBeDefined();
      expect(result.fake2).toBeDefined();
      expect(result.fake3).toBeDefined();
      expect(result.status).toEqual(Status.SUBMITTED);

      // When all gatherers return retrieved.
      core.connector.sources = generateFakeSources(1);
      core.connector.sources[0].gatherer = ['fake1', 'fake2', 'fake3'];
      core.gatherers = {
        fake1: genGatherer(Status.RETRIEVED),
        fake2: genGatherer(Status.RETRIEVED),
        fake3: genGatherer(Status.RETRIEVED),
      }
      await core.run({
        srcDatasetId: 'Sources-1',
        destDatasetId: 'Results-1',
      });

      result = (await core.getDataList('Results-1'))[2];
      expect(result.fake1).toBeDefined();
      expect(result.fake2).toBeDefined();
      expect(result.fake3).toBeDefined();
      expect(result.status).toEqual(Status.RETRIEVED);

      // When any gatherer returns error.
      core.connector.sources = generateFakeSources(1);
      core.connector.sources[0].gatherer = ['fake1', 'fake2', 'fake3'];
      core.gatherers = {
        fake1: genGatherer(Status.RETRIEVED),
        fake2: genGatherer(Status.ERROR),
        fake3: genGatherer(Status.RETRIEVED),
      }
      await core.run({
        srcDatasetId: 'Sources-1',
        destDatasetId: 'Results-1',
      });

      result = (await core.getDataList('Results-1'))[3];
      expect(result.fake1).toBeDefined();
      expect(result.fake2).toBeDefined();
      expect(result.fake3).toBeDefined();
      expect(result.status).toEqual(Status.ERROR);
    });

  it('gets overall errors from all gatherers.', () => {
    core.overallGathererNames = ['fake'];

    let result, errors;
    result = {
      url: 'example.com',
      gatherer: 'fake',
      fake: {
        status: Status.ERROR,
        errors: [new Error('Fake error')],
      },
    };
    errors = core.getOverallErrors(result);
    expect(errors.length).toBe(1);
    expect(errors[0]).toEqual('[fake] Fake error');

    result = {
      url: 'example.com',
      fake: {
        status: Status.RETRIEVED,
        statusText: 'Done',
      },
    };
    errors = core.getOverallErrors(result);
    expect(errors.length).toBe(0);
  });

  it('override results with overrideResults flag', async () => {
    let results;
    core.connector.sources = generateFakeSources(1);
    await core.run({
      srcDatasetId: 'Sources-1',
      destDatasetId: 'Results-1',
    });

    results = await core.getDataList('Results-1');
    expect(results.length).toEqual(1);

    await core.run({
      srcDatasetId: 'Sources-1',
      destDatasetId: 'Results-1',
    });
    results = await core.getDataList('Results-1');
    expect(results.length).toEqual(2);

    await core.run({
      srcDatasetId: 'Sources-1',
      destDatasetId: 'Results-1',
      overrideResults: true,
    });
    results = await core.getDataList('Results-1');
    expect(results.length).toEqual(1);
  });

  it('generate multiple rows with multiRowsGatherer flag', async () => {
    let results;
    core.connector.sources = generateFakeSources(1);
    await core.run({
      srcData: {
        gatherer: 'fake',
        metadata: {},
        multiRowsData: true,
      },
      destDatasetId: 'Results-1',
      multiRowsGatherer: 'fake',
    });
    results = await core.getDataList('Results-1');
    expect(results.length).toEqual(2);
    expect(results[0].fake.data.key).toEqual('test1');
    expect(results[1].fake.data.key).toEqual('test2');
  });

});
