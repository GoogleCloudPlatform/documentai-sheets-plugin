# DocumentAI Sheets Plugin

> A demo for Google Spreadsheet to run Document AI to extract documents and add entities to the sheet. This demo is a proof-of-concept to showcase the capability of Document AI technology.

## Setting Started

This section covers the steps to set up the DocumentAI Sheets Plugin demo using the sample Gogole Sheets.

### Make a copy of the Demo Spreadsheet

- Go to [bit.ly/documentai-sheets-demo](https://bit.ly/documentai-sheets-demo) and make a copy of the Sheets.

### Setting Up

Setting up with your Google Cloud Project ID
- Filling your Google Cloud Project ID

Setting up OAuth token
- Go to Google Cloud Console and open up [Cloud Shell](https://shell.cloud.google.com/?hl=en_US&fromcloudshell=true&show=terminal&project=)
- Run the following command in Cloud Shell to retrieve the Oauth Token:
```
$ gcloud auth print-access-token
```
- Copy and paste the Oauth token to the field on the Sheet.

> **Note**
> OAuth Token will usually expire in 60 minutes. For this demo, you will need to re-generate new Oauth token periodically.

### Set up Document AI processors

- Go to Google Cloud Console and Enable Document AI API: https://console.cloud.google.com/apis/library/documentai.googleapis.com?project=
- In the Document AI page, create one or more Document AI processsors: https://console.cloud.google.com/ai/document-ai/processors?project=
- Go to Document Types tab, add your Document Type and the Document AI processor ID like below.

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
- Select a document type from the list (this is defined in the Document Types tab)
- Click "Submit" button. This will process the document via Document AI and populate all fields to the corresponding tab.

> **Note**
> Note: The mapping of Document Type to result tab is defined in the "Document Types" tab.

- Once processed, you will see a new row showed up in the result tab, e.g. Application form.
