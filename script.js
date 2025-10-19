// =======================
// 설정 (여기만 바꿔주세요)
// =======================
const GAS_URL = "https://script.google.com/macros/s/AKfycbxOhJ8tjUI3IL2Do5TmuZdArfFd8Zs0X0AkS4uAnKq2XBxC99zaPE6r1X0mBROfnhZ2/exec"; // 본인의 GAS URL로 설정하세요
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

function setupQ2Limit(maxChecked = 2) {
  const q2Group = document.getElementById('q2-checkbox-group');
  if (!q2Group) return; 

  const checkboxes = q2Group.querySelectorAll('input[type="checkbox"]');
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
  record.stress_level = fd.get('stress_level') || ''; 
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
  // Q1(스트레스 수준) 데이터는 점수(key) 순서대로 정렬
  let labels, values;
  if (canvasId === 'chart-q1') {
      labels = Object.keys(dataObj).sort(); // "1점", "2점"... 순으로 정렬
      values = labels.map(l => dataObj[l]);
  } else {
      // 다른 차트들은 응답 수(value)가 많은 순서대로 정렬
      labels = Object.keys(dataObj).sort((a,b)=>dataObj[b]-dataObj[a]);
      values = labels.map(l => dataObj[l]);
  }

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

// (수정) Q1 정렬 로직 제거 (더 이상 Pie 차트가 아님)
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

    // ===================================
    // (수정) Q1과 Q5를 renderBarChart로 변경
    // ===================================
    renderBarChart('chart-q1', stats.q1 || {}, stats.total); // 새 Q1 (Bar)
    renderBarChart('chart-q2', stats.q2 || {}, stats.total); // Q2 (Bar)
    renderBarChart('chart-q3', stats.q3 || {}, stats.total); // Q3 (Bar)
    renderPieChart('chart-q4', stats.q4 || {});       // Q4 (Pie)
    renderBarChart('chart-q5', stats.q5 || {}, stats.total); // Q5 (Bar)
    // ===================================
    
    const listElement = document.getElementById('special-methods-list');
    listElement.innerHTML = '';
    // Q6 (특별한 방법)
    if (Array.isArray(stats.q6) && stats.q6.length) {
      stats.q6.forEach(m => {
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

document.getElementById('stress-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const record = collectFormData(form);
  
  if (!record.stress_level) {
    alert('1번 질문(스트레스 수준)에 응답해주세요.');
    return;
  }
  
  if (!record.stress_situation || record.stress_situation.length === 0) {
    alert('2번 질문(스트레스 상황)은 최소 1개 이상 선택해야 합니다.');
    return;
  }
  
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = '제출 중...';
  
  // 1. "Fire-and-forget": GAS로 전송 요청을 보내되, 응답을 기다리지 않습니다.
  postToGAS(record)
    .then(() => {
      console.log("GAS 응답 수신 성공.");
    })
    .catch(err => {
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

document.addEventListener('DOMContentLoaded', () => {
  setupEtcToggle();
  setupQ2Limit(2); 
});