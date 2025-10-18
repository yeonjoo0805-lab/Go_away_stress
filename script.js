// =======================
// 설정 (여기만 바꿔주세요)
// =======================
// 배포한 Google Apps Script 웹앱 URL (doGet/doPost 처리)
// 🚨🚨🚨 배포 관리에서 새로 생성된 URL을 여기에 붙여넣어야 합니다. 🚨🚨🚨
const GAS_URL = "https://script.google.com/macros/s/AKfycbzIQ2Gg9ToX5Nb3CXmd6awE_OlnT21y0w8Xz-j4kzQ5nyoa9JsWIqiUOUFy1x6v7muB/exec";
// =======================

let charts = {};
// 차트 색상 설정
const CHART_COLORS = [
  '#26a69a','#80cbc4','#b2dfdb','#4db6ac','#009688',
  '#00897b','#00796b','#00695c','#4dd0e1','#00bcd4'
];

/**
 * 탭 전환
 */
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

/**
 * 기타 입력 필드 토글 설정
 */
function setupEtcToggle() {
  document.querySelectorAll('input[type="checkbox"][data-etc-input]').forEach(checkbox => {
    const etcInputId = checkbox.getAttribute('data-etc-input');
    const etcInput = document.getElementById(etcInputId);
    // 초기 상태 설정
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

/**
 * Q1 선택 제한 (최대 2개)
 */
function setupQ1Limit(maxChecked = 2) {
  const q1Group = document.getElementById('q1-checkbox-group');
  // 'q1-checkbox-group' ID가 없으면 동작하지 않습니다. (HTML ID 확인 필요)
  if (!q1Group) return; 

  const checkboxes = q1Group.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      const checkedCount = [...checkboxes].filter(c => c.checked).length;
      if (checkedCount > maxChecked) {
        e.target.checked = false;
        alert(`✅ 이 질문은 최대 ${maxChecked}개까지만 선택할 수 있습니다.`);
        // 기타 입력창이 체크된 항목의 등일경우 초기화
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

/**
 * 폼 데이터 수집 -> GAS 서버가 기대하는 JSON 형식으로 변환
 */
function collectFormData(formEl) {
  const fd = new FormData(formEl);
  // FormData에서 해당 이름의 모든 값을 배열로 가져와서 trim 후 빈 값 제거
  const toArray = (name) => fd.getAll(name).map(s => s.trim()).filter(Boolean);
  
  const record = {};
  // Q1: 스트레스 상황 (배열)
  record.stress_situation = toArray('stress_situation');
  record.stress_situation_etc = (fd.get('stress_situation_etc') || '').trim();
  // Q2: 스트레스 해소 행동 (배열)
  record.stress_action = toArray('stress_action');
  record.stress_action_etc = (fd.get('stress_action_etc') || '').trim();
  // Q3: 스트레스 풀기 좋은 시간대 (단일 값)
  record.best_time = fd.get('best_time') || '';
  // Q4: 콘텐츠 서비스 (배열)
  record.content_service = toArray('content_service');
  record.content_service_etc = (fd.get('content_service_etc') || '').trim();
  // Q5: 특별한 해소 방법 (주관식)
  record.special_method = (fd.get('special_method') || '').trim();
  
  return record;
}

/**
 * 폼 제출 데이터를 Apps Script에 POST 요청
 */
async function postToGAS(payload) {
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      // CORS 문제 해결을 위해 Content-Type 명시 (Apps Script에서 JSON.parse를 위해 필수)
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'cors'
    });
    // Apps Script가 JSON 응답을 반환할 때만 .json()으로 파싱 가능
    return await res.json();
  } catch (err) {
    console.error('GAS post error', err);
    throw err; // 오류를 다시 던져서 최종 에러 메시지("제출 실패")를 띄우도록 함
  }
}

/**
 * Apps Script에서 집계된 통계 JSON 데이터 요청
 */
async function fetchStatsFromGAS() {
  try {
    // GET 요청 시 ?action=getStats 쿼리 파라미터 사용
    const res = await fetch(GAS_URL + '?action=getStats', { method: 'GET', mode: 'cors' });
    return await res.json();
  } catch (err) {
    console.error('GAS get error', err);
    throw err;
  }
}

/* --- 차트 렌더링 유틸리티 (생략 가능, 통계 탭을 위해 필요) --- */
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

/**
 * 통계 탭 데이터 로드 및 차트 업데이트
 */
async function updateStatisticsTab() {
  try {
    const stats = await fetchStatsFromGAS();
    document.getElementById('total-participants').textContent = stats.total || 0;

    if ((stats.total || 0) === 0) {
      // 데이터가 없을 때 차트 영역 초기화 로직 (생략)
      document.getElementById('special-methods-list').innerHTML = '<li>아직 제출된 답변이 없습니다.</li>';
      return;
    }

    // Q1, Q2 -> 막대 차트
    renderBarChart('chart-q1', stats.q1 || {}, stats.total);
    renderBarChart('chart-q2', stats.q2 || {}, stats.total);
    // Q3, Q4 -> 파이 차트
    renderPieChart('chart-q3', stats.q3 || {});
    renderPieChart('chart-q4', stats.q4 || {});
    
    // Q5 리스트 (주관식)
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
    // 통계 로드 시 오류는 서버 연결 문제이므로 사용자에게 알림
    alert('통계 로드 중 오류가 발생했습니다. Apps Script 배포 상태를 확인하세요.');
  }
}
/* --- 차트 렌더링 유틸리티 끝 --- */


/**
 * 폼 제출 이벤트 핸들러
 */
document.getElementById('stress-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const record = collectFormData(form);
  
  // 기본 검증: Q1 최소 1개 선택 확인
  if (!record.stress_situation || record.stress_situation.length === 0) {
    alert('1번 질문은 최소 1개 이상 선택해야 합니다.');
    return;
  }
  
  try {
    const res = await postToGAS(record);
    
    // Apps Script의 doPost 함수에서 { result: 'success' }를 기대
    if (res && res.result === 'success') { 
      alert('🌿 설문이 제출되었습니다. 참여해주셔서 감사합니다!');
      form.reset();
      
      // 제출 후 자동으로 통계 탭으로 이동
      showTab('stats', true);
    } else {
      alert('제출 중 문제가 발생했습니다. 다시 시도해주세요.');
    }
  } catch (err) {
    console.error('제출 오류:', err);
    alert('제출 실패: 서버 연결을 확인해주세요.');
  }
});

/**
 * 페이지 로드 시 초기화
 */
document.addEventListener('DOMContentLoaded', () => {
  setupEtcToggle();
  setupQ1Limit(2);
});