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

class DocaiGatherer extends Gatherer {
  constructor(config, envVars, apiHandler) {
    super();
    assert(config, 'Parameter config is missing.');
    assert(envVars, 'Parameter apiHandler is missing.');
    assert(apiHandler, 'Parameter apiHandler is missing.');

    this.runApiEndpoint = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    this.apiKey = envVars.GCP_APIKEY;
    this.apiHandler = apiHandler;
  };

  getDocumentEntities(jsonData, options) {
    document = jsonData.document;

    let formFields = [];
    document.pages.forEach(page => {
      formFields = formFields.concat(page.formFields);
    })

    let fieldsKeyValue = {};
    formFields.forEach(field => {
      let key = field.fieldName.textAnchor.content;
      let valueType = field.valueType;
      let value = null;
      let error = null;

      switch (valueType) {
        case 'filled_checkbox':
          value = true;
          break;

        case 'unfilled_checkbox':
          value = false;
          break;

        default:
          try {
            value = field.fieldValue.textAnchor.content;
          } catch (e) {
            error = e.message;
          }

          break;
      }

      // Remove linebreaks.
      key = key.replace(/(\r\n|\n|\r)/gm, '');
      if (typeof value === 'string') {
        value = value.replace(/(\r\n|\n|\r)/gm, '')
      };

      fieldsKeyValue[key] = {
        value: value,
        confidence: field.fieldValue.confidence,
        error: error,
      };
    });

    return fieldsKeyValue;
  }

  remapKeys(keyMap) {
    let newFieldsKeyValue = {};
  }

  run(source, options) {
    let errors = [];

    // let jsonData = require('../../examples/docai_response.json'); //(with path)

    return {
      status: Status.RETRIEVED,
      statusText: 'Success',
      metadata: {},
      data: {
        name: 'test',
        address: 'test-address',
        phone: 'phone',
      },
      errors: errors,
    }
  }
}

module.exports = DocaiGatherer;
