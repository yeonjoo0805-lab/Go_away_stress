// =======================
// 설정 (여기만 바꿔주세요)
// =======================
// 🚨 [중요!] 아래 URL을 Apps Script에서 [새 배포] 후 받은 새 URL로 교체해야 합니다.
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
 * ✅ 최종 FIX: SecurityError를 유발하는 코드 제거 및 50ms 지연 도입으로 통신 안정화
 */
function postToGAS(formData) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = GAS_URL; 
    
    // 통신 타임아웃 설정: 10초
    const timeout = setTimeout(() => {
        window.removeEventListener("message", handler);
        document.body.removeChild(iframe);
        reject({result: 'error', message: "서버 응답 시간 초과 (10초)"});
    }, 10000); 

    // ✅ 응답 수신 리스너 
    window.addEventListener("message", function handler(event) {
        if (event.data && (event.data.result === 'success' || event.data.result === 'error')) {
            clearTimeout(timeout); 
            window.removeEventListener("message", handler);
            document.body.removeChild(iframe);
            
            // Apps Script에서 보낸 응답이 맞는지 origin 체크
            if (event.origin.includes('google.com') || event.origin.includes('googleusercontent.com')) {
                 resolve(event.data);
            } else {
                 console.warn("Ignoring message from untrusted source:", event.origin);
            }
        }
    });

    document.body.appendChild(iframe);

    // ✅ 최종 수정 핵심: iframe 로드 후 **50ms의 아주 짧은 지연**을 주어 Apps Script의 내부 보안(Warden)이 준비될 시간을 줍니다.
    iframe.onload = () => {
        setTimeout(() => {
            // 이 시점에는 postMessage를 통한 데이터 전송만 안전하게 허용됩니다.
            iframe.contentWindow.postMessage(formData, "*");
        }, 50); // 50밀리초 지연
    };
  });
}

/**
 * 통계 데이터를 가져오는 함수 (Apps Script의 getStats 호출)
 * ✅ [수정] /dev URL 대신 정식 GAS_URL (/exec)을 사용하도록 변경
 */
async function fetchStatsFromGAS() {
  try {
    // '/dev' URL 대신 '/exec' URL (GAS_URL)을 직접 사용하고 '?action=getStats'를 붙입니다.
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
      // 차트가 있다면 클리어 (선택 사항)
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
 */
document.getElementById('stress-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const record = collectFormData(form);
  
  if (!record.stress_situation || record.stress_situation.length === 0) {
    alert('1번 질문은 최소 1개 이상 선택해야 합니다.');
    return;
  }
  
  // 버튼 비활성화 (중복 제출 방지)
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = '제출 중...';

  try {
    const res = await postToGAS(record);
    
    // 서버 응답이 성공(success)일 경우에만 결과 탭으로 전환
    if (res && res.result === 'success') { 
      alert('🌿 설문이 제출되었습니다. 참여해주셔서 감사합니다!');
      form.reset();
      document.querySelectorAll('.etc-input').forEach(i => i.classList.remove('visible'));
      showTab('stats', true);
    } else {
      console.error(res);
      alert('제출 중 문제가 발생했습니다. (서버 응답 오류)');
    }
  } catch (err) {
    alert('제출 실패. 네트워크 연결 또는 서버 설정을 확인하세요.');
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