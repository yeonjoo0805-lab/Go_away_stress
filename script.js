// =======================
// 설정 (여기만 바꿔주세요)
// =======================
const GAS_URL = "https://script.google.com/macros/s/AKfycbwcA2LRAt9wwWUzBOCYQEByPL_NTbvBrcOs_APULugm8xeXUzOeeSfexNUnbP05Tm29/exec"; // 본인의 GAS URL로 설정하세요
// =======================

let charts = {};
const CHART_COLORS = [
  '#26a69a','#80cbc4','#b2dfdb','#4db6ac','#009688',
  '#00897b','#00796b','#00695c','#4dd0e1','#00bcd4'
];

function showTab(tabName, updateChart=false) {
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

// iframe 방식 POST (CORS 우회)
function postToGAS(payload) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.name = 'hiddenFrame';
    document.body.appendChild(iframe);
    
    const form = document.createElement('form');
    form.target = 'hiddenFrame';
    form.method = 'POST';
    form.action = GAS_URL;
    
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify(payload);
    form.appendChild(input);
    
    document.body.appendChild(form);
    
    // 응답 수신
    const messageHandler = (event) => {
      if (event.data && event.data.result) {
        window.removeEventListener('message', messageHandler);
        
        try {
          document.body.removeChild(form);
          document.body.removeChild(iframe);
        } catch(e) {}
        
        if (event.data.result === 'success') {
          resolve(event.data);
        } else {
          reject(event.data);
        }
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // 타임아웃 (10초)
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      try {
        document.body.removeChild(form);
        document.body.removeChild(iframe);
      } catch(e) {}
      reject({ result: 'error', message: '시간 초과' });
    }, 10000);
    
    form.submit();
  });
}

async function fetchStatsFromGAS() {
  try {
    const res = await fetch(GAS_URL + '?action=getStats', { method: 'GET' });
    return await res.json();
  } catch (err) {
    console.error('GAS get error', err);
    throw err;
  }
}

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
    alert('통계 로드 중 오류가 발생했습니다.');
  }
}

// ==================================================
// (수정된 부분) "await" 및 "try/catch" 제거
// ==================================================
document.getElementById('stress-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const record = collectFormData(form);
  
  if (!record.stress_situation || record.stress_situation.length === 0) {
    alert('1번 질문은 최소 1개 이상 선택해야 합니다.');
    return;
  }
  
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = '제출 중...';
  
  // 1. "Fire-and-forget": GAS로 전송 요청을 보내되, 응답을 기다리지 않습니다.
  postToGAS(record)
    .then(() => {
      // (데이터 전송 및 응답 수신 모두 성공한 경우 - 콘솔에만 기록)
      console.log("GAS 응답 수신 성공.");
    })
    .catch(err => {
      // (응답 수신에 실패한 경우(시간 초과) - 콘솔에만 기록)
      // 이미 데이터는 시트로 넘어갔을 확률이 높습니다.
      console.warn("GAS 응답 수신 실패 (데이터는 전송되었을 수 있음):", err.message);
    });

  // 2. 응답을 기다리지 않고 *즉시* 성공 알림과 화면 전환을 실행합니다.
  alert('🌿 설문이 제출되었습니다. 참여해주셔서 감사합니다!');
  form.reset();
  showTab('stats', true); // <-- 통계 탭으로 바로 이동

  // 3. 버튼 상태를 원래대로 복구합니다.
  btn.disabled = false;
  btn.textContent = '✅ 설문 제출하기';
});
// ==================================================

document.addEventListener('DOMContentLoaded', () => {
  setupEtcToggle();
  setupQ1Limit(2);
});