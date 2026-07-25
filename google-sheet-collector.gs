/**
 * The Dossier — signup collector
 * Appends each signup from the landing page to the bound Google Sheet.
 *
 * SETUP
 *  1. Create a Google Sheet (this is where signups land).
 *  2. In that sheet: Extensions -> Apps Script. Delete the placeholder
 *     code and paste this whole file in. The script MUST be created from
 *     inside the sheet — that binding is what getActiveSpreadsheet() uses.
 *  3. Deploy -> New deployment -> gear icon -> Web app.
 *       Execute as:        Me
 *       Who has access:    Anyone
 *     "Anyone" is required. "Anyone with Google account" will silently
 *     reject posts from visitors who aren't signed in.
 *  4. Authorise when prompted. Google shows an "unverified app" warning
 *     because the script is your own: Advanced -> Go to <name> (unsafe).
 *  5. Copy the deployment's /exec URL and paste it into index.html as
 *     SUBSCRIBE_ENDPOINT.
 *
 * After ANY edit to this file, run Deploy -> Manage deployments -> edit ->
 * Version: New version. Without that, the live URL keeps serving the old
 * code and new columns or fixes never take effect.
 */

var SHEET_NAME = 'Signups';
var HEADERS = ['Timestamp', 'Email', 'Source', 'Referrer'];

function doPost(e) {
  // The page fires these off in parallel with a redirect; the lock keeps
  // two simultaneous signups from claiming the same row.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json({ ok: false, error: 'busy' });
  }

  try {
    var data = {};
    try {
      data = JSON.parse(e && e.postData ? e.postData.contents : '{}');
    } catch (err) {
      data = {};
    }

    var email = String(data.email || '').trim();
    if (!email || email.indexOf('@') < 1) {
      return json({ ok: false, error: 'invalid email' });
    }

    getSheet().appendRow([
      new Date(),
      email,
      String(data.source || ''),
      String(data.ref || '')
    ]);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Lets you confirm the deployment is live by opening the /exec URL in a tab.
function doGet() {
  return json({ ok: true, service: 'dossier-signups' });
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run this once from the Apps Script editor (select testAppend -> Run) to
 * confirm the sheet binding and authorisation work before going live.
 */
function testAppend() {
  getSheet().appendRow([new Date(), 'test@example.com', 'manual-test', '']);
}
