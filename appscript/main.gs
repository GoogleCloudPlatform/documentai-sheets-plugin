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
let coreInstance = cache.get('core');

function getCore() {
  // coreInstance = cache.get('core');

  if (!coreInstance) {
    console.log('Creating new Core instance...');
    coreInstance = new DataGathererFramework({
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
          'Fields': {
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

  return coreInstance;
};

/**
 * Construct the main menu when opening the spreadsheet.
 */
function onOpen() {
  var entries = [
    // {name: 'Authorize tool', functionName: 'onAuthorize'},
    {name: 'Select a document from Drive', functionName: 'showPicker'},
    null,
    {name: 'About Document AI Sheets Plugin', functionName: 'about'},
    {name: 'Initialize DocSheet', functionName: 'initialize'},
    {name: 'Submit sample document', functionName: 'submitDocument'},
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
 * Submit selected document.
 */
async function submitDocument() {
  const jsonObject = JSON.parse(HtmlService.createHtmlOutputFromFile("sample_docai_request.json").getContent());
  const contentBase64 = jsonObject.rawDocument.content;

  let keyRemapList =   await getCore().getDataList('Fields');
  keyRemapList.forEach(item => {
    item.key = item.docai.data.key;
    item.newKey = item.docai.data.newKey;
  });

  let settings = await getCore().getDataJson('Settings');

  await getCore().run({
    gatherer: ['docai'],
    srcData: {
      documentType: 'fake-document-type',
      contentBase64: contentBase64,
    },
    destDatasetId: 'Entities',
    docai: {
      authorization: 'Bearer ' + settings.oauthToken,
      projectId: settings.projectId,
      processorId: 'cecddca3d1ca87e5',
      keyRemapList: keyRemapList,
    },
  });
}

/**
 * Submit selected PSI Tests, manually executed by users.
 */
async function getDocumentKeys() {
  const srcData = JSON.parse(HtmlService.createHtmlOutputFromFile("sample_docai_response.json").getContent());

  await getCore().run({
    gatherer: ['docai'],
    srcData: srcData,
    destDatasetId: 'Fields',
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
 * Displays an HTML-service dialog in Google Sheets that contains client-side
 * JavaScript code for the Google Picker API.
 */
function showPicker() {
  var html = HtmlService.createHtmlOutputFromFile('FilePicker.html')
    .setWidth(600)
    .setHeight(425)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi().showModalDialog(html, 'Select File to Parse');
}

function getOAuthToken() {
  DriveApp.getRootFolder();
  return ScriptApp.getOAuthToken();
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
