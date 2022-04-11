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

const ResultFramework = require('../src/core');
const Connector = require('../src/connectors/connector');
const Gatherer = require('../src/gatherers/gatherer');
const Extension = require('../src/extensions/extension');
const Status = require('../src/common/status');

let generateFakeTests = function(amount, options) {
  options = options || {};
  let tests = [];
  let count = 1;
  while (count <= amount) {
    let test = {
      id: 'test-' + count,
      url: 'url-' + count,
      label: 'label-' + count,
      gatherer: 'fake',
      fake: {
        settings: {
          connection: '4G',
        },
      },
    };
    if (options.recurring) {
      test.recurring = {
        frequency: options.recurring.frequency,
      };
    }

    tests.push(test);
    count ++;
  }
  return tests;
}

let generateFakeResults = function(amount, options) {
  options = options || {};
  let results = [];
  let offset = options.idOffset || 0;
  let count = 1;
  while (count <= amount) {
    let result = {
      id: 'result-' + (count + offset),
      type: 'Single',
      url: 'url-' + count,
      label: 'label-' + count,
      status: Status.SUBMITTED,
      gatherer: 'fake',
      fake: {
        status: Status.SUBMITTED,
        settings: {
          connection: '4G',
        },
      },
      errors: [],
    };

    if (options.status) {
      result.status = options.status;
      result.fake.status = options.status;
      result.fake.metrics = {
        SpeedIndex: 500,
      };
    }

    results.push(result);
    count ++;
  }
  return results;
}

let cleanFakeResults = function(results) {
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
    this.tests = [];
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
  getTestList() {
    return this.tests;
  }
  updateTestList(newTests) {
    this.tests.forEach(test => {
      return newTests.filter(x => test.id === x.id)[0];
    });
  }
  getResultList() {
    return this.results;
  }
  appendResultList(newResults) {
    this.results = this.results.concat(newResults);
  }
  updateResultList(newResults) {
    this.results.forEach(result => {
      return newResults.filter(x => result.id === x.id)[0];
    });
  }
}

class FakeGatherer extends Gatherer {
  run(test) {
    return {
      status: Status.SUBMITTED,
      settings: test.fake.settings,
    };
  }
  async runBatch(tests) {
    let responseList = tests.map(test => {
      return {
        status: Status.RETRIEVED,
        settings: test.fake.settings,
        metrics: {
          SpeedIndex: 500,
        }
      };
    });
    return responseList;
  }
  retrieve(result) {
    return {
      status: Status.RETRIEVED,
      metadata: result.fake.metadata,
      settings: result.fake.settings,
      metrics: {
        SpeedIndex: 500,
      },
    };
  }
  retrieveBatch(results){}
}

class FakeExtension extends Extension {
  beforeRun(test) {}
  afterRun(test, result) {}
  beforeAllRuns(tests, results) {}
  afterAllRuns(tests, results) {}
  beforeRetrieve(result) {}
  afterRetrieve(result) {}
  beforeAllRetrieves(results) {}
  afterAllRetrieves(results) {}
}

const fakeApiHandler = function(url) {
  return {};
}

describe('ResultFramework with fake modules', () => {
  let core;

  beforeEach(() => {
    let coreConfig = {
      tests: {
        connector: 'fake',
        path: 'fake/path'
      },
      results: {
        connector: 'fake',
        path: 'fake/path'
      },
      helper: 'fake',
    };
    core = new ResultFramework(coreConfig);
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

  it('runs through a list of tests and gets initial results.', async () => {
    core.connector.tests = generateFakeTests(10);
    await core.run();

    cleanFakeResults(core.connector.results);
    let expectedResults = generateFakeResults(10);
    expect(await core.getResults()).toEqual(expectedResults);

    await core.run();

    cleanFakeResults(core.connector.results);
    expectedResults = expectedResults.concat(generateFakeResults(10, {
      idOffset: 10,
    }));
    expect(await core.getResults()).toEqual(expectedResults);
  });

  it('runs recurring and gets initial Results.', async () => {
    let nowtime = Date.now();

    // Activate recurring Tests.
    core.connector.tests = generateFakeTests(10);
    let test = core.connector.tests[0];
    test.recurring = {
      frequency: 'daily',
    }

    // Run recurring.
    test.recurring.nextTriggerTimestamp = nowtime;
    await core.recurring();
    cleanFakeResults(core.connector.results);

    let expectedResults = generateFakeResults(1);
    expectedResults[0].type = 'Recurring';
    expect(await core.getResults()).toEqual(expectedResults);
  });

  it('retrieves non-complete results.', async () => {
    core.connector.tests = generateFakeTests(1);
    await core.run();
    await core.retrieve();

    cleanFakeResults(core.connector.results);
    let expectedResults = generateFakeResults(1, {status: Status.RETRIEVED});

    let results = await core.getResults();
    expect(results).toEqual(expectedResults);
    expect(results[0].fake.metrics.SpeedIndex).toEqual(500);
  });

  it('retrieves all non-complete results.', async () => {
    core.connector.tests = generateFakeTests(10);
    await core.run();
    await core.retrieve();

    cleanFakeResults(core.connector.results);
    let expectedResults = generateFakeResults(10, {status: Status.RETRIEVED});

    let results = await core.getResults();
    expect(results).toEqual(expectedResults);
    expect(results[0].fake.metrics.SpeedIndex).toEqual(500);
  });

  it('runs and retrieves all results with partial updates with long list.',
      async () => {
    let expectedResults;
    core.connector.tests = generateFakeTests(95);
    core.batchUpdateBuffer = 10;

    expectedResults = generateFakeResults(95);
    await core.run();
    cleanFakeResults(core.connector.results);
    expect(await core.getResults()).toEqual(expectedResults);

    await core.retrieve();
    cleanFakeResults(core.connector.results);
    expectedResults = generateFakeResults(95, {status: Status.RETRIEVED});
    expect(await core.getResults()).toEqual(expectedResults);
  });

  it('runs and retrieves all results with partial updates with short list.',
      async () => {
    let expectedResults;
    core.connector.tests = generateFakeTests(22);
    core.batchUpdateBuffer = 5;

    expectedResults = generateFakeResults(22);
    await core.run();
    cleanFakeResults(core.connector.results);
    expect(await core.getResults()).toEqual(expectedResults);

    await core.retrieve();
    cleanFakeResults(core.connector.results);
    expectedResults = generateFakeResults(22, {status: Status.RETRIEVED});
    expect(await core.getResults()).toEqual(expectedResults);
  });

  it('runs and retrieves all recurring results with partial updates.', async () => {
    core.connector.tests = generateFakeTests(22);
    core.batchUpdateBuffer = 5;
    let nowtime = Date.now();
    core.connector.tests.forEach(test => {
      test.recurring = {
        frequency: 'daily',
      }
    });

    await core.recurring();
    core.connector.tests.forEach(test => {
      test.recurring .nextTriggerTimestamp = nowtime;
    });
    cleanFakeResults(core.connector.results);

    let expectedResults = generateFakeResults(22);
    expectedResults.forEach(result => {result.type = 'Recurring'});
    let actualResults = await core.getResults();
    expect(actualResults).toEqual(expectedResults);
  });

  it('runs through a list of tests and executes extensions.', async () => {
    core.connector.tests = generateFakeTests(10);
    await core.run();
    expect(core.extensions.fake.beforeAllRuns.mock.calls.length).toBe(1);
    expect(core.extensions.fake.afterAllRuns.mock.calls.length).toBe(1);
    expect(core.extensions.fake.beforeRun.mock.calls.length).toBe(10);
    expect(core.extensions.fake.afterRun.mock.calls.length).toBe(10);
  });

  it('runs activateOnly recurring and executes extensions.', async () => {
    core.connector.tests = generateFakeTests(10, {
      recurring: {frequency: 'daily'},
    });

    await core.recurring();
    expect(core.extensions.fake.beforeAllRuns.mock.calls.length).toBe(1);
    expect(core.extensions.fake.afterAllRuns.mock.calls.length).toBe(1);
    expect(core.extensions.fake.beforeRun.mock.calls.length).toBe(10);
    expect(core.extensions.fake.afterRun.mock.calls.length).toBe(10);
  });

  it('runs recurring through a list of tests and executes extensions.',
      async () => {
    core.connector.tests = generateFakeTests(10, {
      recurring: {frequency: 'daily'},
    });

    await core.recurring();
    expect(core.extensions.fake.beforeAllRuns.mock.calls.length).toBe(1);
    expect(core.extensions.fake.beforeRun.mock.calls.length).toBe(10);
    expect(core.extensions.fake.afterRun.mock.calls.length).toBe(10);
    expect(core.extensions.fake.afterAllRuns.mock.calls.length).toBe(1);
  });

  it('runs recurring through a list of tests that passed nextTriggerTimestamp',
      async () => {
    core.connector.tests = generateFakeTests(10, {
      recurring: {frequency: 'daily'},
    });

    let futureTime = Date.now() + 1000000;
    core.connector.tests[0].recurring.nextTriggerTimestamp = futureTime;
    core.connector.tests[1].recurring.nextTriggerTimestamp = futureTime;

    let {tests, results} = await core.recurring();
    expect(tests.length).toBe(8);
    expect(results.length).toBe(8);
  });

  it('retrieves a list of results and executes extensions.', async () => {
    core.connector.tests = generateFakeTests(10);
    await core.run();
    await core.retrieve();
    expect(core.extensions.fake.beforeAllRetrieves.mock.calls.length).toBe(1);
    expect(core.extensions.fake.afterAllRetrieves.mock.calls.length).toBe(1);
    expect(core.extensions.fake.beforeRetrieve.mock.calls.length).toBe(10);
    expect(core.extensions.fake.afterRetrieve.mock.calls.length).toBe(10);
  });

  it('retrieves a list of metrics for each Result in batch mode.', async () => {
    core.connector.tests = generateFakeTests(10);
    await core.run({runByBatch: true});

    let results = core.connector.results;
    expect(results.length).toEqual(10);

    results.forEach(result => {
      if(result.fake) {
        let metrics = result.fake.metrics;
        expect(metrics).not.toBe(undefined);
      }
    })
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
    core.connector.tests = generateFakeTests(1);
    core.connector.tests[0].gatherer = ['fake1', 'fake2', 'fake3'];
    core.gatherers = {
      fake1: genGatherer(Status.SUBMITTED),
      fake2: genGatherer(Status.SUBMITTED),
      fake3: genGatherer(Status.SUBMITTED),
    }
    await core.run();

    result = (await core.getResults())[0];
    expect(result.fake1).toBeDefined();
    expect(result.fake2).toBeDefined();
    expect(result.fake3).toBeDefined();
    expect(result.status).toEqual(Status.SUBMITTED);

    // When some gatherers return submitted.
    core.connector.tests = generateFakeTests(1);
    core.connector.tests[0].gatherer = ['fake1', 'fake2', 'fake3'];
    core.gatherers = {
      fake1: genGatherer(Status.RETRIEVED),
      fake2: genGatherer(Status.RETRIEVED),
      fake3: genGatherer(Status.SUBMITTED),
    }
    await core.run();

    result = (await core.getResults())[1];
    expect(result.fake1).toBeDefined();
    expect(result.fake2).toBeDefined();
    expect(result.fake3).toBeDefined();
    expect(result.status).toEqual(Status.SUBMITTED);

    // When all gatherers return retrieved.
    core.connector.tests = generateFakeTests(1);
    core.connector.tests[0].gatherer = ['fake1', 'fake2', 'fake3'];
    core.gatherers = {
      fake1: genGatherer(Status.RETRIEVED),
      fake2: genGatherer(Status.RETRIEVED),
      fake3: genGatherer(Status.RETRIEVED),
    }
    await core.run();

    result = (await core.getResults())[2];
    expect(result.fake1).toBeDefined();
    expect(result.fake2).toBeDefined();
    expect(result.fake3).toBeDefined();
    expect(result.status).toEqual(Status.RETRIEVED);

    // When any gatherer returns error.
    core.connector.tests = generateFakeTests(1);
    core.connector.tests[0].gatherer = ['fake1', 'fake2', 'fake3'];
    core.gatherers = {
      fake1: genGatherer(Status.RETRIEVED),
      fake2: genGatherer(Status.ERROR),
      fake3: genGatherer(Status.RETRIEVED),
    }
    await core.run();

    result = (await core.getResults())[3];
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
});
