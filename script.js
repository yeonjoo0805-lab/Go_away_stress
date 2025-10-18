// =======================
// 설정 (여기는 절대 바꾸지 마세요)
// =======================
// 🚨 (이전 단계에서 배포한 URL을 그대로 사용하세요)
const GAS_URL = "https://script.google.com/macros/s/AKfycbyzV_z_pgfiVsqZVdlG24k_WNpIoXEgYEWTO2TeD0Y38n2dPQvlvKyWl2qZ6Asiv8n1jA/exec"; 
// =======================

let charts = {};
const CHART_COLORS = [
  '#26a69a','#80cbc4','#b2dfdb','#4db6ac','#009688',
  '#00897b','#00796b','#00695c','#4dd0e1','#00bcd4'
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
 * ✅ [수정] postToGAS 함수 (레이스 컨디션 해결)
 * iframe 로드 후 50ms 지연을 주어 Apps Script 샌드박스가 
 * postMessage를 수신할 준비를 마치도록 보장합니다.
 */
function postToGAS(formData) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = GAS_URL; 
    
    // 통신 타임아웃 설정: 10초
    const timeout = setTimeout(() => {
        window.removeEventListener("message", handler);
        try { document.body.removeChild(iframe); } catch(e) {}
        reject({result: 'error', message: "서버 응답 시간 초과 (10초)"});
    }, 10000); 

    // 응답 수신 리스너 
    const handler = function(event) {
        // Apps Script에서 보낸 응답이 맞는지 origin 체크
        if (event.origin.includes('google.com') || event.origin.includes('googleusercontent.com')) {
            if (event.data && (event.data.result === 'success' || event.data.result === 'error')) {
                clearTimeout(timeout); 
                window.removeEventListener("message", handler);
                try { document.body.removeChild(iframe); } catch(e) {}
                resolve(event.data);
            }
        }
    };
    window.addEventListener("message", handler);

    // iframe을 body에 추가
    document.body.appendChild(iframe);

    // ✅ [수정된 부분]
    // iframe.onload가 실행된 후, 50ms의 아주 짧은 지연을 주어
    // iframe 내부의 스크립트(google.script.run)가 초기화될 시간을 줍니다.
    iframe.onload = () => {
        setTimeout(() => {
            try {
                // 이 시점에 postMessage를 보내야 안전하게 수신됩니다.
                iframe.contentWindow.postMessage(formData, "*");
            } catch (e) {
                // 오류 발생 시 즉시 reject
                clearTimeout(timeout);
                window.removeEventListener("message", handler);
                try { document.body.removeChild(iframe); } catch(e2) {}
                reject({ result: 'error', message: `postMessage 실패: ${e.message}` });
            }
        }, 50); // 50밀리초(0.05초) 지연
    };

    // iframe 로드 자체에 실패했을 경우
    iframe.onerror = (e) => {
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        try { document.body.removeChild(iframe); } catch(e2) {}
        reject({ result: 'error', message: `iframe 로드 실패. GAS_URL을 확인하세요.` });
    };
  });
}

/**
 * 통계 데이터를 가져오는 함수 (Apps Script의 getStats 호출)
 * (수정 없음 - 정상)
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

/* --- 폼 유틸리티 --- */
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
  
  const record = {};
  record.stress_situation = toArray('stress_situation');
  record.stress_situation_etc = (fd.get('stress_situation_etc') || '').trim();
  record.stress_action = toArray('stress_action');
  record.stress_action_etc = (fd.get('stress_action_etc') || '').trim();
  record.best_time = fd.get('best_time') || '';
  record.content_service = toArray('content_service');
  record.content_service_etc = (fd.get('content_service_etc') || '').trim();
  record.special_method = (fd.get('special_method') || '').trim();
  
  return record;
}

/* --- 차트 렌더링 유틸리티 --- */
function renderBarChart(canvasId, dataObj, total) {
  const labels = Object.keys(dataObj).sort((a,b)=>dataObj[b]-dataObj[a]);
  const values = labels.map(l => dataObj[l]);
  if (charts[canvasId]) charts[canvasId].destroy();
  const ctx = document.getElementById(canvasId).getContext('2d');
  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '응답 수',
        data: values,
        backgroundColor: CHART_COLORS.map(c => c + 'b3'),
        borderColor: CHART_COLORS,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              const n = context.parsed.x || 0;
              return `${n}명 (${ total ? ((n/total)*100).toFixed(1) : 0 }%)`;
            }
          }
        }
      },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function renderPieChart(canvasId, dataObj) {
  const labels = Object.keys(dataObj);
  const values = labels.map(l => dataObj[l]);
  if (charts[canvasId]) charts[canvasId].destroy();
  const ctx = document.getElementById(canvasId).getContext('2d');
  charts[canvasId] = new Chart(ctx, {
    type: 'pie',
    data: { labels, datasets: [{ data: values, backgroundColor: CHART_COLORS, hoverOffset: 4 }] },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16 } },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed || 0;
              const total = values.reduce((a,b)=>a+b,0);
              const pct = total ? ((value/total)*100).toFixed(1) : 0;
              return `${context.label}: ${value}명 (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

async function updateStatisticsTab() {
  try {
    const stats = await fetchStatsFromGAS();
    document.getElementById('total-participants').textContent = stats.total || 0;

    if ((stats.total || 0) === 0) {
      document.getElementById('special-methods-list').innerHTML = '<li>아직 제출된 답변이 없습니다.</li>';
      Object.keys(charts).forEach(key => charts[key].destroy());
      charts = {};
      return;
    }

    renderBarChart('chart-q1', stats.q1 || {}, stats.total);
    renderBarChart('chart-q2', stats.q2 || {}, stats.total);
    renderPieChart('chart-q3', stats.q3 || {});
    renderPieChart('chart-q4', stats.q4 || {});
    
    const listElement = document.getElementById('special-methods-list');
    listElement.innerHTML = '';
    if (Array.isArray(stats.q5) && stats.q5.length) {
      stats.q5.forEach(m => {
        const li = document.createElement('li');
        li.textContent = m;
        listElement.appendChild(li);
      });
    } else {
      listElement.innerHTML = '<li>제출된 특별한 스트레스 해소 방법이 없습니다.</li>';
    }
  } catch (err) {
    console.error(err);
    alert('통계 로드 중 오류가 발생했습니다. Apps Script 배포 상태를 확인하세요.');
  }
}


/**
 * 폼 제출 이벤트 핸들러 (제출 후 화면 전환 담당)
 * (수정 없음 - 정상)
 */
document.getElementById('stress-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const record = collectFormData(form);
  
  if (!record.stress_situation || record.stress_situation.length === 0) {
    alert('1번 질문은 최소 1개 이상 선택해야 합니다.');
    return;
  }
  
  // 버튼 비활성화
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = '제출 중...';

  try {
    const res = await postToGAS(record);
    
    if (res && res.result === 'success') { 
      alert('🌿 설문이 제출되었습니다. 참여해주셔서 감사합니다!');
      form.reset();
      document.querySelectorAll('.etc-input').forEach(i => i.classList.remove('visible'));
      showTab('stats', true);
    } else {
      console.error(res);
      alert(`제출 중 문제가 발생했습니다: ${res.message || '알 수 없는 오류'}`);
    }
  } catch (err) {
    console.error(err);
    alert(`제출 실패: ${err.message || '네트워크 연결 또는 서버 설정을 확인하세요.'}`);
  } finally {
    // 버튼 다시 활성화
    submitBtn.disabled = false;
    submitBtn.textContent = '✅ 설문 제출하기';
  }
});

/**
 * 페이지 로드 시 초기화
 */
document.addEventListener('DOMContentLoaded', () => {
  setupEtcToggle();
  setupQ1Limit(2); 
  showTab('survey');
});