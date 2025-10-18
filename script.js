// =======================
// 설정 (여기만 바꿔주세요)
// =======================
const GAS_URL = "https://script.google.com/macros/s/AKfycbzYMSB03bUlEQFQWhTAn2s4cTViyKsO54OykeGLRIjad95otX1R2On1m8JBEBhCLoaPaA/exec";
// =======================

let charts = {};
const CHART_COLORS = [
  '#26a69a','#80cbc4','#b2dfdb','#4db6ac','#009688',
  '#00897b','#00695c','#4dd0e1','#00bcd4'
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
 * ✅ postToGAS (iframe 통신 안정화 버전)
 */
function postToGAS(formData) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = GAS_URL + "?v=" + Date.now(); // 캐시 방지

    let responded = false;

    const cleanup = () => {
      try { document.body.removeChild(iframe); } catch (e) {}
      window.removeEventListener("message", onMessage);
    };

    const onMessage = (event) => {
      const data = event.data;
      if (!data) return;

      // iframe에서 준비 완료 신호 수신
      if (data.status === "iframe_ready") {
        try {
          iframe.contentWindow.postMessage({ formData }, "*");
        } catch (err) {
          responded = true;
          cleanup();
          reject({ result: "error", message: "postMessage 전송 실패: " + err.message });
        }
        return;
      }

      // 서버 응답 수신
      if (data.result === "success" || data.result === "error") {
        responded = true;
        cleanup();
        if (data.result === "success") {
          resolve(data);
        } else {
          reject(data);
        }
      }
    };

    // 안전장치: 15초 내 응답 없으면 실패 처리
    const timer = setTimeout(() => {
      if (!responded) {
        cleanup();
        reject({ result: "error", message: "⏰ 서버 응답 시간 초과 (15초). Apps Script 배포 권한을 확인하세요." });
      }
    }, 15000);

    iframe.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject({ result: "error", message: "iframe 로드 실패. GAS_URL을 확인하세요." });
    };

    window.addEventListener("message", onMessage);
    document.body.appendChild(iframe);
  });
}

/**
 * 통계 데이터 불러오기
 */
async function fetchStatsFromGAS() {
  try {
    const res = await fetch(GAS_URL + '?action=getStats', { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('GAS get error', err);
    throw err;
  }
}

/* --- 폼 유틸리티 --- */
function setupEtcToggle() {
  document.querySelectorAll('input[type="checkbox"][data-etc-input]').forEach(cb => {
    const target = document.getElementById(cb.dataset.etcInput);
    if (cb.checked) target.classList.add('visible');
    cb.addEventListener('change', e => {
      if (e.target.checked) {
        target.classList.add('visible');
        target.focus();
      } else {
        target.classList.remove('visible');
        target.value = '';
      }
    });
  });
}

function setupQ1Limit(max = 2) {
  const group = document.getElementById('q1-checkbox-group');
  if (!group) return;
  const boxes = group.querySelectorAll('input[type="checkbox"]');
  boxes.forEach(cb => {
    cb.addEventListener('change', e => {
      const count = [...boxes].filter(x => x.checked).length;
      if (count > max) {
        e.target.checked = false;
        alert(`✅ 이 문항은 최대 ${max}개까지만 선택할 수 있습니다.`);
        const etcId = e.target.dataset.etcInput;
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
  const arr = (name) => fd.getAll(name).map(v => v.trim()).filter(Boolean);
  return {
    stress_situation: arr('stress_situation'),
    stress_situation_etc: (fd.get('stress_situation_etc') || '').trim(),
    stress_action: arr('stress_action'),
    stress_action_etc: (fd.get('stress_action_etc') || '').trim(),
    best_time: fd.get('best_time') || '',
    content_service: arr('content_service'),
    content_service_etc: (fd.get('content_service_etc') || '').trim(),
    special_method: (fd.get('special_method') || '').trim()
  };
}

/* --- 차트 렌더링 --- */
function renderBarChart(id, dataObj, total) {
  const labels = Object.keys(dataObj).sort((a,b)=>dataObj[b]-dataObj[a]);
  const values = labels.map(l => dataObj[l]);
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, {
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
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.x}명 (${total ? ((ctx.parsed.x/total)*100).toFixed(1) : 0}%)`
          }
        }
      },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function renderPieChart(id, dataObj) {
  const labels = Object.keys(dataObj);
  const values = labels.map(l => dataObj[l]);
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: CHART_COLORS,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed || 0;
              const total = values.reduce((a,b)=>a+b,0);
              const pct = total ? ((v/total)*100).toFixed(1) : 0;
              return `${ctx.label}: ${v}명 (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

/**
 * 통계 업데이트
 */
async function updateStatisticsTab() {
  try {
    const stats = await fetchStatsFromGAS();
    document.getElementById('total-participants').textContent = stats.total || 0;
    if (!stats.total) {
      document.getElementById('special-methods-list').innerHTML = '<li>아직 제출된 답변이 없습니다.</li>';
      Object.values(charts).forEach(c => c.destroy());
      charts = {};
      return;
    }
    renderBarChart('chart-q1', stats.q1 || {}, stats.total);
    renderBarChart('chart-q2', stats.q2 || {}, stats.total);
    renderPieChart('chart-q3', stats.q3 || {});
    renderPieChart('chart-q4', stats.q4 || {});

    const list = document.getElementById('special-methods-list');
    list.innerHTML = '';
    if (stats.q5?.length) {
      stats.q5.forEach(t => {
        const li = document.createElement('li');
        li.textContent = t;
        list.appendChild(li);
      });
    } else {
      list.innerHTML = '<li>제출된 특별한 스트레스 해소 방법이 없습니다.</li>';
    }
  } catch (err) {
    console.error(err);
    alert('📊 통계 로드 중 오류가 발생했습니다. Apps Script 배포 상태를 확인하세요.');
  }
}

/**
 * 폼 제출 이벤트
 */
document.getElementById('stress-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const record = collectFormData(form);
  if (!record.stress_situation.length) {
    alert('1번 질문은 최소 1개 이상 선택해야 합니다.');
    return;
  }

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = '제출 중...';

  try {
    await postToGAS(record);
    alert('🌿 설문이 성공적으로 제출되었습니다!');
    form.reset();
    document.querySelectorAll('.etc-input').forEach(i => i.classList.remove('visible'));
    showTab('stats', true);
  } catch (err) {
    console.error(err);
    alert(`⚠️ 제출 실패: ${err.message || '알 수 없는 오류입니다.'}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ 설문 제출하기';
  }
});

/**
 * 페이지 초기화
 */
document.addEventListener('DOMContentLoaded', () => {
  setupEtcToggle();
  setupQ1Limit(2);
  showTab('survey');
});
