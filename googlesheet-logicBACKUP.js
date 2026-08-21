const RECAPTCHA_SECRET_KEY = '6Lcv940tAAAAAEtlQVXTS6t258W4_Im842c5IoPE';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const recaptchaResponse = data.recaptcha_response;

    // 1. Verify reCAPTCHA token with Google's server
    if (!verifyRecaptcha(recaptchaResponse)) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: 'reCAPTCHA verification failed.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. If reCAPTCHA is valid, proceed with saving the order to Google Sheets / Drive
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // (Optional: handle your Base64 image upload to Google Drive here if you haven't already)
    let imageUrl = "";
    if (data.proof_of_payment) {
      imageUrl = saveBase64ToDrive(data.proof_of_payment, data.customer.name);
    }

    sheet.appendRow([
      data.timestamp,
      data.customer.name,
      data.customer.phone,
      data.customer.address,
      data.items,
      data.total,
      imageUrl
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', message: 'Order recorded successfully!' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Helper function to talk to Google's siteverify API
function verifyRecaptcha(token) {
  if (!token) return false;

  const url = 'https://www.google.com/recaptcha/api/siteverify';
  const payload = {
    secret: RECAPTCHA_SECRET_KEY,
    response: token
  };

  const options = {
    method: 'post',
    payload: payload
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    return result.success === true;
  } catch (err) {
    console.error('reCAPTCHA connection error: ' + err);
    return false;
  }
}

// Helper function to save Base64 string as an image file in Google Drive
function saveBase64ToDrive(base64Data, customerName) {
  try {
    const split = base64Data.split(',');
    const contentType = split[0].match(/:(.*?);/)[1];
    const decoded = Utilities.base64Decode(split[1]);
    const blob = Utilities.newBlob(decoded, contentType, `Proof_${customerName}_${Date.now()}.png`);
    
    // Change this folder ID if you want them saved to a specific Google Drive folder, 
    // otherwise it saves to the root of your Drive.
    const folder = DriveApp.getRootFolder(); 
    const file = folder.createFile(blob);
    
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) {
    console.error("Error saving file to drive: " + e.toString());
    return "Error saving image";
  }
}