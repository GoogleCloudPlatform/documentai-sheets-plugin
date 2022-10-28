let jsonData = require('../integration/fixtures/docai_response.json'); //(with path)

// console.log(jsonData);
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

console.log(fieldsKeyValue);

let testValue = eval('fieldsKeyValue["Verified SSN"]');
console.log(testValue);