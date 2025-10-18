// =======================
// 설정 (여기만 바꿔주세요)
// =======================
// 🚨 [필수!] 이전에 [새 배포] 후 받은 새 URL을 그대로 사용하세요.
const GAS_URL = "https://script.google.com/macros/s/AKfycbyzV_z_pgfiVsqZVdlG24k_WNpIoXEgYEWTO2TeD0Y38n2dPQvlvKyWl2qZ6Asiv8n1jA/exec"; 
// =======================

let charts = {};
const CHART_COLORS = [
  '#26a69a','#80cbc4','#b2dfdb','#4db6ac','#009688',
  '#00796b','#00796b','#00695c','#4dd0e1','#00bcd4'
];

/**
 * 탭 전환 함수
 */
function showTab(tabName, updateChart = false) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const targetTab = document.getElementById(tabName);
  const targetNav = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
  if (targetTab && targetNav) {
    targetTab.classList.add('active');
    targetNav.classList.add('active');
  }
  if (updateChart) updateStatisticsTab();
}

/**
 * ✅ [버그 수정] postToGAS 함수 (핸드셰이크 방식)
 * 'handler'가 정의되기 전에 'setTimeout'에서 참조되던 'ReferenceError'를 수정했습니다.
 */
function postToGAS(formData) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = GAS_URL; // GAS 웹앱 URL

    let timeout; // 타임아웃 변수 선언
    let handler; // 핸들러 변수 선언

    // ✅ [수정] 핸들러 함수를 먼저 정의합니다.
    handler = function(event) {
        // GAS (google.com)에서 온 메시지만 처리
        if (!(event.origin.includes('google.com') || event.origin.includes('googleusercontent.com'))) {
            return;
        }

        const data = event.data;

        // 1. iframe이 "준비 완료" 신호를 보냈을 때
        if (data && data.status === 'iframe_ready') {
            try {
                // 2. 폼 데이터를 iframe으로 전송합니다.
                iframe.contentWindow.postMessage({ formData: formData }, "*");
            } catch (e) {
                clearTimeout(timeout);
                window.removeEventListener("message", handler);
                try { document.body.removeChild(iframe); } catch(e2) {}
                reject({ result: 'error', message: `postMessage 실패: ${e.message}` });
            }
            return; // 최종 응답을 기다립니다.
        }

        // 3. iframe이 'doPostLogic'의 최종 응답을 보냈을 때
        if (data && (data.result === 'success' || data.result === 'error')) {
            // 4. 프로미스를 완료하고 모든 것을 정리합니다.
            clearTimeout(timeout); 
            window.removeEventListener("message", handler);
            try { document.body.removeChild(iframe); } catch(e) {}
            
            if (data.result === 'success') {
                resolve(data);
            } else {
                reject(data);
            }
        }
    };
    
    // ✅ [수정] 핸들러가 정의된 후에 타임아웃을 설정합니다.
    timeout = setTimeout(() => {
        window.removeEventListener("message", handler); // 이제 'handler'를 찾을 수 있습니다.
        try { document.body.removeChild(iframe); } catch(e) {}
        reject({result: 'error', message: "서버 응답 시간 초과 (15초). Apps Script 배포를 확인하세요."});
    }, 15000); 

    // 메시지 리스너 등록
    window.addEventListener("message", handler);

    // iframe 로드 시작
    document.body.appendChild(iframe);

    // iframe 로드 자체 실패 시
    iframe.onerror = (e) => {
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        try { document.body.removeChild(iframe); } catch(e2) {}
        reject({ result: 'error', message: `iframe 로드 실패. GAS_URL을 확인하세요.` });
    };
  });
}

/**
 * 통계 데이터를 가져오는 함수 (수정 없음)
 */
async function fetchStatsFromGAS() {
  try {
    const res = await fetch(GAS_URL + '?action=getStats', { method: 'GET' });
    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('GAS get error', err);
    throw err;
  }
}

/* --- 폼 유틸리티 (수정 없음) --- */
function setupEtcToggle() {
  document.querySelectorAll('input[type="checkbox"][data-etc-input]').forEach(checkbox => {
    const etcInputId = checkbox.getAttribute('data-etc-input');
    const etcInput = document.getElementById(etcInputId);
    if (checkbox.checked) etcInput.classList.add('visible');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        etcInput.classList.add('visible');
        etcInput.focus();
      } else {
        etcInput.classList.remove('visible');
        etcInput.value = '';
      }
    });
  });
}
function setupQ1Limit(maxChecked = 2) {
  const q1Group = document.getElementById('q1-checkbox-group');
  if (!q1Group) return; 
  const checkboxes = q1Group.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      const checkedCount = [...checkboxes].filter(c => c.checked).length;
      if (checkedCount > maxChecked) {
        e.target.checked = false;
        alert(`✅ 이 질문은 최대 ${maxChecked}개까지만 선택할 수 있습니다.`);
        const etcId = e.target.getAttribute('data-etc-input');
        if (etcId) {
          const el = document.getElementById(etcId);
          el.classList.remove('visible');
          el.value = '';
        }
      }
    });
  });
}
function collectFormData(formEl) {
  const fd = new FormData(formEl);
  const toArray = (name) => fd.getAll(name).map(s => s.trim()).filter(Boolean);
  const record = {
    stress_situation: toArray('stress_situation'),
    stress_situation_etc: (fd.get('stress_situation_etc') || '').trim(),
    stress_action: toArray('stress_action'),
    stress_action_etc: (fd.get('stress_action_etc') || '').trim(),
    best_time: fd.get('best_time') || '',
    content_service: toArray('content_service'),
    content_service_etc: (fd.get('content_service_etc') || '').trim(),
    special_method: (fd.get('special_method') || '').trim()
  };
  return record;
}

/* --- 차트 렌더링 (수정 없음) --- */
function renderBarChart(canvasId, dataObj, total) {
  const labels = Object.keys(dataObj).sort((a,b)=>dataObj[b]-dataObj[a]);
  const values = labels.map(l => dataObj[l]);
  if (charts[canvasId]) charts[canvasId].destroy();
  const ctx = document.getElementById(canvasId).getContext('2d');
  charts[canvasId] = new Chart(ctx, {
    type: 'bar', data: { labels, datasets: [{ label: '응답 수', data: values, backgroundColor: CHART_COLORS.map(c => c + 'b3'), borderColor: CHART_COLORS, borderWidth: 1 }] },
    options: { responsive: true, maintainAspectRatio: true, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.parsed.x}명 (${ total ? ((c.parsed.x/total)*100).toFixed(1) : 0 }%)` } } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}
function renderPieChart(canvasId, dataObj) {
  const labels = Object.keys(dataObj);
  const values = labels.map(l => dataObj[l]);
  if (charts[canvasId]) charts[canvasId].destroy();
  const ctx = document.getElementById(canvasId).getContext('2d');
  charts[canvasId] = new Chart(ctx, {
    type: 'pie', data: { labels, datasets: [{ data: values, backgroundColor: CHART_COLORS, hoverOffset: 4 }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { padding: 16 } }, tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed}명 (${((c.parsed/values.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)` } } } }
    }
  });
}
async function updateStatisticsTab() {
  try {
    const stats = await fetchStatsFromGAS();
    document.getElementById('total-participants').textContent = stats.total || 0;
    if ((stats.total || 0) === 0) {
      document.getElementById('special-methods-list').innerHTML = '<li>아직 제출된 답변이 없습니다.</li>';
      Object.keys(charts).forEach(key => charts[key].destroy()); charts = {}; return;
    }
    renderBarChart('chart-q1', stats.q1 || {}, stats.total);
    renderBarChart('chart-q2', stats.q2 || {}, stats.total);
    renderPieChart('chart-q3', stats.q3 || {});
    renderPieChart('chart-q4', stats.q4 || {});
    const listElement = document.getElementById('special-methods-list');
    listElement.innerHTML = '';
    if (Array.isArray(stats.q5) && stats.q5.length) {
      stats.q5.forEach(m => { const li = document.createElement('li'); li.textContent = m; listElement.appendChild(li); });
    } else {
      listElement.innerHTML = '<li>제출된 특별한 스트레스 해소 방법이 없습니다.</li>';
    }
  } catch (err) { console.error(err); alert('통계 로드 중 오류가 발생했습니다. Apps Script 배포 상태를 확인하세요.'); }
}

/**
 * 폼 제출 이벤트 핸들러 (수정 없음)
 */
document.getElementById('stress-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const record = collectFormData(form);
  
  if (!record.stress_situation || record.stress_situation.length === 0) {
    alert('1번 질문은 최소 1개 이상 선택해야 합니다.');
    return;
  }
  
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = '제출 중...';

  try {
    const res = await postToGAS(record); 
    alert('🌿 설문이 제출되었습니다. 참여해주셔서 감사합니다!');
    form.reset();
    document.querySelectorAll('.etc-input').forEach(i => i.classList.remove('visible'));
    showTab('stats', true);

  } catch (err) {
    console.error(err);
    alert(`제출 실패: ${err.message || '알 수 없는 오류입니다. 콘솔을 확인하세요.'}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '✅ 설문 제출하기';
  }
});

/**
 * 페이지 로드 시 초기화 (수정 없음)
 */
document.addEventListener('DOMContentLoaded', () => {
  setupEtcToggle();
  setupQ1Limit(2); 
  showTab('survey');
});