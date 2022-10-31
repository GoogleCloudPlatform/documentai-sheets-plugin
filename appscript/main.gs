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

// For resolving module.exports in the awp build file.
let module = {};
let cache = CacheService.getScriptCache();
this.core = cache.get('core');

function getCore() {
  this.core = cache.get('core');

  if (!this.core) {
    console.log('Creating new Core instance...');
    this.core = new DataGathererFramework({
      connector: 'sheets',
      helper: 'sheets',
      gatherers: ['docai'],
      extensions: ['sheets'],
      // Connector-specific config below
      sheets: {
        envVarsTabId: 'Settings',
        systemTabId: 'System',
        tabs: {
          'Docs': {
            dataAxis: 'row',
            propertyLookup: 3, // Starts at 1
            skipColumns: 0,
            skipRows: 3,
          },
          'Entities': {
            dataAxis: 'row',
            propertyLookup: 3, // Starts at 1
            skipColumns: 0,
            skipRows: 4,
          },
          'Document Types': {
            dataAxis: 'row',
            propertyLookup: 2, // Starts at 1
            skipColumns: 0,
            skipRows: 3,
          },
          'Document Fields': {
            dataAxis: 'row',
            propertyLookup: 2, // Starts at 1
            skipColumns: 0,
            skipRows: 3,
          },
          'Settings': {
            dataAxis: 'column',
            propertyLookup: 2, // Starts at 1
            skipColumns: 2,
            skipRows: 2,
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
      verbose: true,
      debug: true,
    });
  }

  return this.core;
};

/**
 * Construct the main menu when opening the spreadsheet.
 */
function onOpen() {
  var entries = [
    // {name: 'Authorize tool', functionName: 'onAuthorize'},
    {name: 'About Document AI Sheets Plugin', functionName: 'about'},
    {name: 'Initialize DocSheet', functionName: 'initialize'},
    null,
    {name: 'Select a sample document', functionName: 'submitDocument'},
    {name: 'Select a Driver Folder', functionName: 'submitDocument'},
    null,
    {name: 'Retrieve Document Field Keys', functionName: 'getDocumentKeys'},
    {name: 'Test', functionName: 'test'},
  ];
  SpreadsheetApp.getActive().addMenu('Document AI', entries);
}

/**
 * Initialize the tool.
 */
function initialize() {
  UrlFetchApp.fetch('https://google.com');
  Browser.msgBox('This sheet has been authorized!');

  getCore().connector.init();

  console.log('EnvVars:');
  console.log(getCore().getEnvVars());
}

/**
 * Submit selected PSI Tests, manually executed by users.
 */
async function submitDocument() {
  const jsonString = HtmlService.createHtmlOutputFromFile("sample_docai_response.json").getContent();
  const jsonObject = JSON.parse(jsonString);

  let keyRemapList =   await getCore().getDataList('Document Fields');
  keyRemapList.forEach(item => {
    item.key = item.docai.data.key;
    item.newKey = item.docai.data.newKey;
  });

  console.log(keyRemapList);

  await getCore().run({
    gatherer: ['docai'],
    srcData: jsonObject,
    destDatasetId: 'Entities',
    docai: {
      keyRemapList: keyRemapList,
    },
  });
}

/**
 * Submit selected PSI Tests, manually executed by users.
 */
async function getDocumentKeys() {
  const jsonString = HtmlService.createHtmlOutputFromFile("sample_docai_response.json").getContent();
  const jsonObject = JSON.parse(jsonString);

  await getCore().run({
    gatherer: ['docai'],
    srcData: jsonObject,
    destDatasetId: 'Document Fields',
    multiRowsGatherer: 'docai',
    docai: {
      documentType: 'type_test',
      fieldKeyOnly: true,
    },
  });
}

/**
 * Clear all results in a specific tab.
 * @param {!string} tabId
 */
function clearList(tabId) {
  getCore().connector.clearList(tabId);
}

/**
 * Helper function to prevent changes during executing a function.
 * @param {!string} funcName
 */
function runWithServiceLock(funcName, callback) {
  if (!callback) return;

  var lock = LockService.getScriptLock();
  var success = lock.tryLock(100);
  if (!success) {
    var message = `Other existing ${funcName} is still running.`;
    console.log(message);
    return;
  }

  callback();
  lock.releaseLock();
}
