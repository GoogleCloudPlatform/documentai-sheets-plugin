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

const Status = require('../common/status');
const Gatherer = require('./gatherer');

class FakeGatherer extends Gatherer {
  constructor(config, envVars, apiHandler) {
    super();
  }

  run(source, options) {
    return {
      status: Status.RETRIEVED,
      statusText: 'Success',
      metadata: {},
      url: source.fake.url,
      data: {
        name: 'test',
        address: 'test-address',
        phone: 'phone',
      },
      errors: [],
    }
  }
}

module.exports = FakeGatherer;
