// Replace this with your Google reCAPTCHA Secret Key
const RECAPTCHA_SECRET_KEY = "6LduMZMtAAAAAL-TDMoL1IhqQqZT1udtGRpnSpfG"; 

function doPost(e) {
  try {
    // Parse incoming JSON payload from the frontend
    const data = JSON.parse(e.postData.contents);
    Logger.log("Received order data for: " + JSON.stringify(data.customer));
    
    // 1. Verify reCAPTCHA token with Google API
    const recaptchaResponse = data.recaptcha_response;
    const isCaptchaValid = verifyRecaptcha(recaptchaResponse);
    Logger.log("reCAPTCHA validation result: " + isCaptchaValid);
    
    if (!isCaptchaValid) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: "error", message: "reCAPTCHA verification failed." }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. Open active Spreadsheet and Sheet 
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Sheet1");
    
    if (!sheet) {
      Logger.log("Sheet1 not found! Creating or grabbing the first sheet.");
      sheet = ss.getSheets()[0]; // Fallback to the very first tab in the sheet
    }
    
    // 3. Handle Base64 Image Upload to Google Drive (if proof of payment exists)
    let fileUrl = "No Proof Uploaded";
    if (data.proof_of_payment) {
      try {
        fileUrl = saveBase64FileToDrive(data.proof_of_payment, data.customer.name);
      } catch (imgErr) {
        Logger.log("Error saving image to Drive: " + imgErr.toString());
        fileUrl = "Error uploading file";
      }
    }
    
    // 4. Append order details to Google Sheet
    sheet.appendRow([
      data.timestamp,
      data.customer.name,
      data.customer.phone,
      data.customer.address,
      data.items,
      data.total,
      fileUrl
    ]);
    
    Logger.log("Successfully appended row to sheet!");
    
    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", message: "Order recorded successfully!" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log("CRITICAL ERROR in doPost: " + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function verifyRecaptcha(token) {
  const url = "https://www.google.com/recaptcha/api/siteverify";
  const payload = {
    secret: RECAPTCHA_SECRET_KEY,
    response: token
  };
  
  const options = {
    method: "post",
    payload: payload,
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    Logger.log("Google reCAPTCHA API response: " + JSON.stringify(result));
    return result.success === true;
  } catch (err) {
    Logger.log("reCAPTCHA fetch error: " + err.toString());
    return false;
  }
}

function saveBase64FileToDrive(base64Data, customerName) {
  const splitData = base64Data.split(",");
  const contentType = splitData[0].match(/:(.*?);/)[1];
  const decodedBytes = Utilities.base64Decode(splitData[1]);
  
  const blob = Utilities.newBlob(decodedBytes, contentType, `Proof_${customerName}_${Date.now()}`);
  const folder = DriveApp.getRootFolder(); 
  const file = folder.createFile(blob);
  
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}
