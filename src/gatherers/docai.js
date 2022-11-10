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
  constructor(config, envVars, apiHandler, gathererOptions) {
    super();
    assert(config, 'Parameter config is missing.');
    assert(envVars, 'Parameter apiHandler is missing.');
    assert(apiHandler, 'Parameter apiHandler is missing.');

    this.runApiEndpoint = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    this.apiKey = envVars.GCP_APIKEY;
    this.apiHandler = apiHandler;
  };

  getDocumentEntities(jsonData) {
    let document = jsonData.document;

    // Get entities from a specialized parser result.
    if (document.entities) {
      return this.getSpecialParserEntities(document.entities);

      // Get entities from a Form Parser result.
    } else {
      let formFields = [];
      (document.pages || []).forEach(page => {
        formFields = formFields.concat(page.formFields);
      })
      return this.getFormEntities(formFields);
    }
  }

  getSpecialParserEntities(entities) {
    let fieldsKeyValue = {};
    entities.forEach(entity => {
      let key = entity.type;
      let value = entity.mentionText;
      let error = null;

      // Remove linebreaks.
      key = key.replace(/(\r\n|\n|\r)/gm, ' ').trim();
      if (typeof value === 'string') {
        value = value.replace(/(\r\n|\n|\r)/gm, ' ').trim();
      };

      fieldsKeyValue[key] = {
        value: value,
        confidence: entity.confidence,
        error: error,
      };
    });

    return fieldsKeyValue;
  }

  getFormEntities(formFields) {
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
      key = key.replace(/(\r\n|\n|\r)/gm, ' ').trim();
      if (typeof value === 'string') {
        value = value.replace(/(\r\n|\n|\r)/gm, ' ').trim();
      };

      fieldsKeyValue[key] = {
        value: value,
        confidence: field.fieldValue.confidence,
        error: error,
      };
    });
    return fieldsKeyValue;
  }

  remapKeys(data, keyRemapList) {
    let newData = {};
    let keyMap = {};

    (keyRemapList || []).forEach(item => {
      keyMap[item['key']] = item;
    });

    Object.keys(data).forEach(key => {
      if (keyMap[key] && keyMap[key].newKey) {
        newData[keyMap[key].newKey] = data[key];
      } else {
        newData[key] = data[key];
      }
    });

    return newData;
  }

  run(source, gathererOptions) {
    try {
      let fieldKeyOnly = gathererOptions.fieldKeyOnly;
      let keyRemapList = gathererOptions.keyRemapList;
      let projectId = gathererOptions.projectId;
      let processorId = gathererOptions.processorId;
      let authorization = gathererOptions.authorization;
      let documentType = source.documentType;
      let contentBase64 = source.contentBase64;
      let outputData = {};

      assert(projectId, 'projectId is missing in gathererOptions');
      assert(processorId, 'processorId is missing in gathererOptions');
      assert(authorization, 'authorization is missing in gathererOptions');
      assert(contentBase64, 'contentBase64 is missing in gathererOptions');

      // Make API call to DocAI endpoint.
      let requestOptions = {
        'payload': {
          'rawDocument': {
            'mimeType': 'application/pdf',
            'content': contentBase64,
          }
        },
        'headers': {
          'Authorization': authorization,
        },
      };
      let url = `https://us-documentai.googleapis.com/v1/projects/${projectId}/locations/us/processors/${processorId}:process`;
      let response = this.apiHandler.post(url, requestOptions);
      if (response.statusCode !== 200) {
        return {
          status: Status.ERROR,
          statusText: 'Error',
          metadata: {},
          error: this.getErrorMessage(response),
          errorDetail: response,
        };
      }

      let responseJson = JSON.parse(response.body);
      let entities = this.getDocumentEntities(responseJson);

      if (fieldKeyOnly) {
        outputData = [];

        Object.keys(entities).forEach(key => {
          outputData.push({
            documentType: documentType,
            key: key,
            newKey: key,
            sampleValue: entities[key].value,
          });
        });
      } else {
        outputData = entities;
        if (keyRemapList) outputData = this.remapKeys(outputData, keyRemapList);
      }

      return {
        status: Status.RETRIEVED,
        statusText: 'Success',
        metadata: {},
        data: outputData,
      }

    } catch (e) {
      // console.error(e);

      return {
        status: Status.ERROR,
        statusText: 'Error',
        error: e.message,
        errorDetail: e,
      }
    }
  }

  getErrorMessage(response) {
    if (response.error.message.includes('Request is missing required authentication credential')) {
      return 'Missing required authentication token. Please check your OAuth token.';
    }
    return response.error.message;
  }
}

module.exports = DocaiGatherer;
