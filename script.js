// 스프레드시트 ID와 시트 이름 설정
const SPREADSHEET_ID = '1HFTxzek8UdqEKwhpryfqXsx09vlDI1Mnjx_edrf7veI';
const SHEET_NAME = 'responses';

// POST 요청 처리 (설문 제출)
function doPost(e) {
  try {
    const json = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        'timestamp',
        'stress_situation', 'stress_situation_etc',
        'stress_action', 'stress_action_etc',
        'best_time',
        'content_service', 'content_service_etc',
        'special_method'
      ]);
    }

    const timestamp = new Date().toISOString();
    const row = [
      timestamp,
      (json.stress_situation || []).join('|'),
      json.stress_situation_etc || '',
      (json.stress_action || []).join('|'),
      json.stress_action_etc || '',
      json.best_time || '',
      (json.content_service || []).join('|'),
      json.content_service_etc || '',
      json.special_method || ''
    ];
    sheet.appendRow(row);

    return jsonResponse({ result: 'success', message: 'Saved' });
  } catch (err) {
    return jsonResponse({ result: 'error', message: err.toString() });
  }
}

// GET 요청 처리 (통계 확인)
function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || '';
    if (action === 'getStats') {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = ss.getSheetByName(SHEET_NAME);
      if (!sheet) return jsonResponse({ total:0, q1:{}, q2:{}, q3:{}, q4:{}, q5:[] });

      const values = sheet.getDataRange().getValues();
      if (values.length <= 1) return jsonResponse({ total:0, q1:{}, q2:{}, q3:{}, q4:{}, q5:[] });

      const rows = values.slice(1);
      const stats = { q1:{}, q2:{}, q3:{}, q4:{}, q5:[], total: rows.length };

      rows.forEach(r => {
        const q1Arr = (r[1] || '').toString().split('|').map(s=>s.trim()).filter(Boolean);
        q1Arr.forEach(v => stats.q1[v]=(stats.q1[v]||0)+1);
        if(r[2]) stats.q1['✏️ 기타: '+r[2]]=(stats.q1['✏️ 기타: '+r[2]]||0)+1;

        const q2Arr = (r[3] || '').toString().split('|').map(s=>s.trim()).filter(Boolean);
        q2Arr.forEach(v => stats.q2[v]=(stats.q2[v]||0)+1);
        if(r[4]) stats.q2['✏️ 기타: '+r[4]]=(stats.q2['✏️ 기타: '+r[4]]||0)+1;

        const best = (r[5]||'').toString().trim();
        if(best) stats.q3[best]=(stats.q3[best]||0)+1;

        const q4Arr = (r[6]||'').toString().split('|').map(s=>s.trim()).filter(Boolean);
        q4Arr.forEach(v => stats.q4[v]=(stats.q4[v]||0)+1);
        if(r[7]) stats.q4['✏️ 기타: '+r[7]]=(stats.q4['✏️ 기타: '+r[7]]||0)+1;

        const special = (r[8]||'').toString().trim();
        if(special) stats.q5.push(special);
      });

      return jsonResponse(stats);
    } else {
      return jsonResponse({ message:'Use ?action=getStats' });
    }
  } catch(err) {
    return jsonResponse({ error: err.toString() });
  }
}

// OPTIONS 요청 처리 (CORS preflight)
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin','*')
    .setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS')
    .setHeader('Access-Control-Allow-Headers','Content-Type');
}

// JSON 응답 + CORS 헤더 포함
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin','*')
    .setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS')
    .setHeader('Access-Control-Allow-Headers','Content-Type');
}
