// Must Script Property list
// allowUsers      : [nnnnnnnnn, nnnnnnnnn, nnnnnnnnn,]
// bot_token       : [Telegram bot token]
// openai_api_key  : [openai_api_key]
// openai_api_url  : https://platform.openai.com/docs/models/model-endpoint-compatibility
// openai_api_model: https://platform.openai.com/docs/models/model-endpoint-compatibility 
// ssID            : [SpreadSheetID]
// webhook_url     : [This Project web app URL]
// 
var userProperties = PropertiesService.getScriptProperties();

// A list of user IDs that are allowed to chat with the bot
// to get your user id, message @userinfobot from your user in Telegram
var ALLOWED_USER_IDS = userProperties.getProperty('allowUsers')

// Get Script Properties defined in Settings > Script Properties
// You will have to save your Telegram 'bot_token' and OpenAI 'openai_api_key' here.
// https://developers.google.com/apps-script/reference/properties?hl=en
var BOT_TOKEN = userProperties.getProperty('bot_token');           // @BotFather in Telegram
var OPENAI_API_KEY = userProperties.getProperty('openai_api_key'); // https://beta.openai.com/account/api-keys
var OPENAI_API_URL = "https://api.openai.com" + userProperties.getProperty('openai_api_url');
var OPENAI_API_MODEL = userProperties.getProperty('openai_api_model');

// Replace SPREADSHEET_ID with the ID of your Google Sheets document
// To get this, go to your sheet URL and grab the id from here: https://docs.google.com/spreadsheets/d/{ID_HERE}/edit
var SPREADSHEET_ID = userProperties.getProperty('ssID');

// Replace WEBHOOK_URL with the URL of your webhook handler
// After deploying the script as web app, copy the URL and paste it here. It will look something like this: https://script.google.com/macros/s/XXX/exec"
var WEBHOOK_URL = userProperties.getProperty('webhook_url');

var telegramUrl = "https://api.telegram.org/bot" + BOT_TOKEN;



function getMe() {
  var url = telegramUrl + "/getMe";
  var response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());
}

function setWebhook() {
  // Set up the request options
  var options = {
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "payload": JSON.stringify({
      "url": WEBHOOK_URL
    })
  };

  // Google Sheet Initialize
  checkSheetHeader()

  // Send the request
  var response = UrlFetchApp.fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/setWebhook", options);
  Logger.log(response.getContentText());
}

function doPost(request) {
  
  try {
    // Parse the request body
    var requestBody = JSON.parse(request.postData.contents);
    
    // Get the message from the request
    var message = requestBody.message;

    // Get the user ID of the sender
    var userId = message.from.id;

    // Get the chat ID from the message
    var chatId = message.chat.id;    
    // Check if the user ID is in the list of allowed user IDs
    if (ALLOWED_USER_IDS.includes(userId)) {


      // Get the text of the message
      var text = message.text;

      // Write the question to the 'question' column in the Google Sheets document
      writeToSheet(text, "question");

      // Send the question to the OpenAI API
      // var response = 'Testing sample response from OpenAI...';
      var response = sendToOpenAI(text);

      // Write the answer to the 'answer' column in the Google Sheets document
      writeToSheet(response, "answer");

      // Send the answer back to the Telegram chat
      sendToTelegram(response, chatId);
    } 
    else {
      // Log a message indicating that the user is not allowed to chat
      Logger.log("User with ID " + userId + " is not allowed to chat with the bot.");
      sendToTelegram("Sorry, you are not allowed to chat with this bot.", chatId);
      writeToSheet("User with ID " + userId + " is not allowed to chat with the bot.", "error");
    }
  } catch (error) {
    // Log the error message
    Logger.log(error.message);
    writeToSheet('Error in doPost(): '+error.message, "error");
    // Return an error response
    // return ContentService.createTextOutput(JSON.stringify({"success": false, "error": error.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

// Function to test OpenAI request in the debugger
function testOpenAI(){
  var message = 'Are you alive?';

  var options = {
    "method": "POST",
    "headers": {
      "Authorization": "Bearer " + OPENAI_API_KEY,
      "Content-Type" : "application/json",
    },
    "payload": JSON.stringify({
      "model": OPENAI_API_MODEL,
      "messages": [{"role": "user", "content": message}],
      "max_tokens": 200,
      "temperature": 0.7,
      "top_p": 1,
      "frequency_penalty": 0,
      "presence_penalty": 0
    })
  };  
  var response = UrlFetchApp.fetch(OPENAI_API_URL, options);
  Logger.log(response);
}


// Sends a message to the OpenAI API and returns the response
function sendToOpenAI(message) {
  try {
    // Set up the request options
    var options = {
      "method": "POST",
      "headers": {
        "Authorization": "Bearer " + OPENAI_API_KEY,
        "Content-Type" : "application/json",
      },
      "payload": JSON.stringify({
        "model": OPENAI_API_MODEL,
        "messages": [{"role": "user", "content": message}],
        "max_tokens": 200,
        "temperature": 0.7,
        "top_p": 1,
        "frequency_penalty": 0,
        "presence_penalty": 0
      })
    }; 

    // Send the request and parse the response
    var response = JSON.parse(UrlFetchApp.fetch(OPENAI_API_URL, options));
    
    // Initialize the response text
    var responseText = "";

    // Loop through the choices array
    for (var i = 0; i < response.choices.length; i++) {
      // Get the text of the current choice
      var choiceText = response.choices[i].text;

      // Add the text to the response text
      responseText += choiceText;
    }

    // Return the response text
    return responseText;
  } catch (error) {
    // Log the error message
    Logger.log(error.message);
  
    // Return an error message
    return "An error occurred while sending the request to the OpenAI API. Error: "+JSON.stringify(error);
  }
}


// Sends a message to the specified Telegram chat
function sendToTelegram(message, chatId) {
  var url = telegramUrl + "/sendMessage?chat_id=" + chatId + "&text=" + encodeURIComponent(message);
  var response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());  
}

// Writes a value to the specified column in the Google Sheets document
function writeToSheet(value, column) {
  // Get the Google Sheets document
  var sheets = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Get the first sheet in the document
  var sheet = sheets.getSheets()[0];

  // Get the next empty row in the sheet
  var lastRow = sheet.getLastRow();

  if(column == 'answer'){
    var nextRow = lastRow;
  }
  else {  
    var nextRow = lastRow + 1;
  }

  // Write the value
  // Write the value to the specified column in the sheet
  sheet.getRange(nextRow, getColumnNumber(column)).setValue(value);
}

// Returns the number of the column with the specified name
function getColumnNumber(columnName) {
  // Get the Google Sheets document
  var sheets = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Get the first sheet in the document
  var sheet = sheets.getSheets()[0];

  // Get the range of the sheet
  var range = sheet.getRange(1, 1, 1, sheet.getLastColumn());

  // Get the values of the range
  var values = range.getValues();

  // Loop through the values and return the column number when the column name is found
  for (var i = 0; i < values[0].length; i++) {
    if (values[0][i] == columnName) {
      return i + 1;
    }
  }
}

function checkSheetHeader() {
  // Get the Google Sheets document
  var sheets = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Get the first sheet in the document
  var sheet = sheets.getSheets()[0];

  // Get the range of the sheet
  var range = sheet.getRange(1, 1, 1, 3);

  // Get the values of the range
  var headers = range.getValues()[0];

  // no header
  if (headers.every(function(header) { return header === ''; })) {
    var newHeaders = ['question', 'answer', 'error']; // set header

    range.setValues([newHeaders]);
    SpreadsheetApp.flush(); // modify commit

    Logger.log('Sheet first row Add Header.');
  } else {
    Logger.log('Sheet Header is already.');
  }
}
