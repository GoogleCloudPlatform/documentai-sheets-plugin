# DocumentAI Sheets Plugin

> A demo for Google Spreadsheet to run Document AI to extract documents and add entities to the sheet. This demo is a proof-of-concept to showcase the capability of Document AI technology.

<img width="672" alt="image" src="https://user-images.githubusercontent.com/1644724/201578220-0d0aa2c9-bc21-4211-b3c4-4c87ae451c4c.png">
<img width="964" alt="image" src="https://user-images.githubusercontent.com/1644724/201576778-5956e8c7-812b-4645-95d6-370489dca981.png">

## Setting Started

This section covers the steps to set up the DocumentAI Sheets Plugin demo using the sample Gogole Sheets.

### Make a copy of the Demo Spreadsheet

- Go to [bit.ly/documentai-sheets-demo](https://bit.ly/documentai-sheets-demo) and make a copy of the Sheets.

### Setting Up

- Initialize the spreadsheet: Select Menu > Document AI > Initialize
<img width="784" alt="image" src="https://user-images.githubusercontent.com/1644724/201574565-c388721d-85de-4c5d-93ef-65a63cb7052f.png">

- Click "Continue" to authorize the Sheets.
<img width="482" alt="image" src="https://user-images.githubusercontent.com/1644724/201576127-527e462c-7be4-4937-beb2-41ee02b133a0.png">

Setting up with your Google Cloud Project ID
- Filling your Google Cloud Project ID in the README tab in the sample Spreadsheet.
<img width="808" alt="image" src="https://user-images.githubusercontent.com/1644724/201578062-bd21db50-459f-42a2-a636-657dab79019c.png">

Setting up OAuth token
- Go to Google Cloud Console and open up [Cloud Shell](https://shell.cloud.google.com/?hl=en_US&fromcloudshell=true&show=terminal&project=)

  <img width="997" alt="image" src="https://user-images.githubusercontent.com/1644724/201546876-e3d094f5-9e41-4b28-9cf4-6f0e9dc55eed.png">

- Go to Google Cloud Console and open up [Cloud Shell](https://shell.cloud.google.com/?hl=en_US&fromcloudshell=true&show=terminal&project=)
- Run the following command in Cloud Shell to retrieve the Oauth Token:
```
$ gcloud auth print-access-token
```
- Copy and paste the Oauth token to the field on the Sheet.

<img width="1016" alt="image" src="https://user-images.githubusercontent.com/1644724/201546910-a31c2c71-abd6-4dfa-907e-b89af8914ccb.png">

> **Note**
> OAuth Token will usually expire in 60 minutes. For this demo, you will need to re-generate new Oauth token periodically.

### Set up Document AI processors

- Go to Google Cloud Console and Enable Document AI API: https://console.cloud.google.com/apis/library/documentai.googleapis.com
<img width="799" alt="image" src="https://user-images.githubusercontent.com/1644724/201547038-53f601d9-e6bb-4bff-86d3-a0a756b13cf4.png">

- Go to Google Cloud Console and Enable Document AI API: https://console.cloud.google.com/apis/library/documentai.googleapis.com
- In the Document AI page, create one or more Document AI processsors: https://console.cloud.google.com/ai/document-ai/processors
<img width="799" alt="image" src="https://user-images.githubusercontent.com/1644724/201547082-8cb8fa3f-a2d3-411c-9d0d-ed85d735513f.png">

- Go to Document Types tab, add your Document Type and the Document AI processor ID like below.
<img width="798" alt="image" src="https://user-images.githubusercontent.com/1644724/201547119-882aee54-2c6d-483a-827c-60f267d5177f.png">

### List all Field Keys in a Document
- Select Menu > Document AI > Process a document in Drive
- Select a file in your Drive, or search with keywords.
- Select a document type from the list (defined in the Document Types tab)
- Click "Retrieve Field Keys" button. This will populate and append all fields in the "Fields" tab.
- Go to "Fields" tab and update the "New Field Key" column, which will be used as the field keys in the destination tab. (e.g. Application Form tab)

### Customize your result tabs

In each Result tab (e.g. Application Form tab), the field key column are automatically populated based on the "Fields" Tab. To customize your result tab, there are a few options:

- Update the Field Key mapping in the "Fields" tab. For example, you can run and Retrieve all original field keys from a document first (See section 3)
- Remove some fields rows that you don't need.
- Then, update the "New Key Field" column for each row to whatever you prefer.
- Last, reorder the fields to the order you prefer to show in the result tab.

### Process a document from Drive
- Select Menu > Document AI > Process a document in Drive
- Select a file in your Drive, or search with keywords.
<img width="440" alt="image" src="https://user-images.githubusercontent.com/1644724/201547136-8abfe100-1db8-46bf-b285-c01bb20591ee.png">

- Select a document type from the list (this is defined in the Document Types tab)
<img width="434" alt="image" src="https://user-images.githubusercontent.com/1644724/201547158-6384f9cc-b96f-4db3-9351-d1a1d35e5431.png">

- Click "Submit" button. This will process the document via Document AI and populate all fields to the corresponding tab.

> **Note**
> Note: The mapping of Document Type to result tab is defined in the "Document Types" tab.

- Once processed, you will see a new row showed up in the result tab.
<img width="1156" alt="image" src="https://user-images.githubusercontent.com/1644724/201547183-638d4acb-2869-49d4-8c3e-7b4d5f6c341f.png">

