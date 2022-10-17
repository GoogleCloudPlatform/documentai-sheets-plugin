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
const Gatherer = require('./gatherer');

class DocAIGatherer extends Gatherer {
  constructor(config, envVars, apiHandler) {
    super();
    assert(config, 'Parameter config is missing.');
    assert(envVars, 'Parameter apiHandler is missing.');
    assert(apiHandler, 'Parameter apiHandler is missing.');

    this.runApiEndpoint = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    this.resultApiEndpoint = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    this.apiKey = envVars.PSI_APIKEY || envVars.psiApiKey;
    this.apiHandler = apiHandler;

    // TODO: Metadata keys should be standardized.
    this.metadataMap = {
      'testId': 'id',
      'requestedUrl': 'lighthouseResult.requestedUrl',
      'finalUrl': 'lighthouseResult.finalUrl',
      'lighthouseVersion': 'lighthouseResult.lighthouseVersion',
      'userAgent': 'lighthouseResult.userAgent',
      'fetchTime': 'lighthouseResult.fetchTime',
    };
  }

  retrieve(resultObj, options) {
    // return this.run(resultObj, options);
  }
}

module.exports = DocAIGatherer;
