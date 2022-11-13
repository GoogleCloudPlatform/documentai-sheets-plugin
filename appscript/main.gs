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
let documentTypeMap = {};
let documentTypes = null;

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

    documentTypes = coreInstance.getDataList('Document Types');
    cache.put('documentTypes', documentTypes);

    documentTypes.forEach(documentTypeItem => {
      documentTypeMap[documentTypeItem.documentType] = documentTypeItem;
      coreInstance.coreConfig.sheets.tabs[documentTypeItem.destDatasetId] = {
        dataAxis: 'row',
        propertyLookup: 3, // Starts at 1
        skipColumns: 0,
        skipRows: 3,
      };
    });
  }

  return coreInstance;
};

/**
 * Construct the main menu when opening the spreadsheet.
 */
function onOpen() {
  var entries = [
    {name: 'About this plugin', functionName: 'about'},
    null,
    {name: 'Initialize', functionName: 'initialize'},
    {name: 'Process a document in Drive', functionName: 'showFilePicker'},
    // null,
    // {name: '🧪 Process sample document', functionName: 'submitSampleDocument'},
    // {name: '🧪 Retrieve sample document fields', functionName: 'submitSampleDocumentFields'},
    // {name: 'Test', functionName: 'test'},
  ];
  SpreadsheetApp.getActive().addMenu('📄 Document AI', entries);
}

/**
 * Initialize the tool.
 */
function initialize() {
  UrlFetchApp.fetch('https://google.com');
  Browser.msgBox('This sheet has been authorized!');
  getCore().connector.init();
}

async function submitDocument(documentType, fileId) {
  let file = DriveApp.getFileById(fileId);
  let contentBase64 = Utilities.base64Encode(file.getBlob().getBytes());
  await processDocument(documentType, contentBase64);
}

/**
 * Submit selected document.
 */
async function submitSampleDocument() {
  const jsonObject = JSON.parse(HtmlService.createHtmlOutputFromFile("sample_docai_request.json").getContent());
  const contentBase64 = jsonObject.rawDocument.content;
  await processDocument('Application Form', contentBase64);
}

/**
 * Process selected base64 document string.
 */
async function processDocument(documentType, contentBase64, isGetDocumentFields) {
  let keyRemapList = getCore().getDataList('Fields');
  keyRemapList.forEach(item => {
    item.key = item.docai.data.key;
    item.newKey = item.docai.data.newKey;
  });

  let settings = getCore().getDataJson('Settings');
  let response = await getCore().run({
    gatherer: ['docai'],
    srcData: {
      documentType: documentType,
      contentBase64: contentBase64,
    },
    destDatasetId: documentTypeMap[documentType].destDatasetId,
    docai: {
      authorization: 'Bearer ' + settings.oauthToken,
      projectId: settings.projectId,
      processorId: documentTypeMap[documentType].processorId,
      keyRemapList: keyRemapList,
    },
  });

  if (isGetDocumentFields) {
    await getDocumentFields();
  }

  if (response.errors && response.errors.length > 0) {
    SpreadsheetApp.getUi().alert(response.errors);
  }
}

/**
 * Submit a document and process document fields
 */
async function submitDocumentFields(documentType, fileId) {
  console.log('fileId: ' + fileId);
  console.log('documentType: ' + documentType);

  let file = DriveApp.getFileById(fileId);
  let contentBase64 = Utilities.base64Encode(file.getBlob().getBytes());
  await processDocumentFields(documentType, contentBase64);
}

/**
 * Submit a sample document and process document fields
 */
async function submitSampleDocumentFields() {
  const jsonObject = JSON.parse(HtmlService.createHtmlOutputFromFile("sample_docai_request.json").getContent());
  const contentBase64 = jsonObject.rawDocument.content;
  await processDocumentFields('Application Form', contentBase64);
}

/**
 * Retreive document fields and add rows to Fields tab.
 */
async function processDocumentFields(documentType, contentBase64) {
  let settings = getCore().getDataJson('Settings');
  let response = await getCore().run({
    gatherer: ['docai'],
    srcData: {
      documentType: documentType,
      contentBase64: contentBase64,
    },
    destDatasetId: 'Fields',
    multiRowsGatherer: 'docai',
    docai: {
      authorization: 'Bearer ' + settings.oauthToken,
      projectId: settings.projectId,
      processorId: documentTypeMap[documentType].processorId,
      fieldKeyOnly: true,
    },
  });

  console.log(response.results);

  if (response.errors && response.errors.length > 0) {
    SpreadsheetApp.getUi().alert(response.errors);
  }
}

function refreshDocumentTypes() {
  documentTypes = getCore().getDataList('Document Types');
  cache.put('documentTypes', documentTypes);
  return documentTypes;
}

function getDocumentTypes() {
  documentTypes = cache.get('documentTypes');
  if (documentTypes && Array.isArray(documentTypes) && documentTypes.length > 0) {
    return documentTypes;
  }
  return refreshDocumentTypes();
}

/**
 * Displays an HTML-service dialog in Google Sheets that contains client-side
 * JavaScript code for the Google Picker API.
 */
function showFilePicker() {
  var html = HtmlService.createHtmlOutputFromFile('FilePicker.html')
    .setWidth(600)
    .setHeight(425)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi().showModalDialog(html, 'Select a File');
}

/**
 * Displays an HTML-service dialog in Google Sheets that contains client-side
 * JavaScript code for the Google Picker API.
 */
function showProcessorPicker() {
  let html = HtmlService.createTemplateFromFile('ProcessorPicker.html');
  html.fileId = null;
  html.fileName = null;
  html.fileUrl = null;
  html = html.evaluate();
  html.setWidth(600)
    .setHeight(425)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi().showModalDialog(html, 'Process with Document AI');
}

/**
 * Displays an HTML-service dialog in Google Sheets that contains client-side
 * JavaScript code for the Google Picker API.
 */
function showFinalDialog(fileId, fileName, fileUrl, documentType) {
  let html = HtmlService.createTemplateFromFile('ProcessorPicker.html');
  html.fileId = fileId;
  html.fileName = fileName;
  html.fileUrl = fileUrl;
  html.documentType = documentType;
  html = html.evaluate()
  html.setWidth(600)
    .setHeight(425)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi().showModalDialog(html, 'Process a Document');
}

/**
 * Callback function from file picker.
 */
function pickerCallbackFunc(fileId, fileName, fileUrl) {
  let documentType = cache.get('selectedDocumentType');
  showFinalDialog(fileId, fileName, fileUrl, documentType);
}

/**
 * Clear all results in a specific tab.
 * @param {!string} tabId
 */
function clearList(tabId) {
  getCore().connector.clearList(tabId);
}

/**
 * Oauth token retriever in file picker dialog.
 */
function getOAuthToken() {
  DriveApp.getRootFolder();
  return ScriptApp.getOAuthToken();
}

function setCacheValue(key, value) {
  cache.put(key, value);
}

function getCacheValue(key) {
  return cache.get(key);
}

/**
 * Open the Github open source page in a new tab in the browser.
 */
function about() {
  let url = 'https://github.com/googlestaging/docai-sheets';
  let html = HtmlService.createHtmlOutput('<!DOCTYPE html><html><script>'
  +'window.close = function(){window.setTimeout(function(){google.script.host.close()},9)};'
  +'var a = document.createElement("a"); a.href="'+url+'"; a.target="_blank";'
  +'if(document.createEvent){'
  +'  var event=document.createEvent("MouseEvents");'
  +'  if(navigator.userAgent.toLowerCase().indexOf("firefox")>-1){window.document.body.append(a)}'
  +'  event.initEvent("click",true,true); a.dispatchEvent(event);'
  +'}else{ a.click() }'
  +'close();'
  +'</script>'
  // Offer URL as clickable link in case above code fails.
  +'<body style="word-break:break-word;font-family:sans-serif;">Failed to open automatically.  Click below:<br/><a href="'+url+'" target="_blank" onclick="window.close()">Click here to proceed</a>.</body>'
  +'<script>google.script.host.setHeight(55);google.script.host.setWidth(410)</script>'
  +'</html>')
  .setWidth( 90 ).setHeight( 1 );
  SpreadsheetApp.getUi().showModalDialog( html, "Opening ..." );
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
