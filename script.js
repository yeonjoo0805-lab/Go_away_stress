// ✅ Apps Script Web App URL (반드시 /exec 로 끝나야 함)
const GAS_URL = "https://script.google.com/macros/s/AKfycbxNqCM9fUlcM15AgpmTE1QUmyIw2uFx1Sm2NOSp33-r37AZ_aXVzOjMW3ELDgWcbGQ_eA/exec";

/**
 * ✅ CORS 완전 우회 방식 (iframe + postMessage)
 */
function postToGAS(formData) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = GAS_URL;

    // ✅ 응답 수신
    window.addEventListener("message", function handler(event) {
      if (event.data && event.data.result) {
        window.removeEventListener("message", handler);
        document.body.removeChild(iframe);
        resolve(event.data);
      }
    });

    document.body.appendChild(iframe);

    // ✅ 약간의 지연 후 데이터 전달
    setTimeout(() => {
      iframe.contentWindow.postMessage(formData, "*");
    }, 1000);
  });
}
// 탭 전환 함수
function showTab(tabName, fetchStats = false) {
  // 모든 탭 버튼 상태 초기화
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // 모든 탭 콘텐츠 숨기기
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // 선택된 탭 보이기
  const selectedTab = document.getElementById(tabName);
  if (selectedTab) selectedTab.classList.add('active');

  // 통계 탭이면 데이터 불러오기
  if (fetchStats) {
    if (typeof loadStatistics === 'function') {
      loadStatistics();
    }
  }
}
