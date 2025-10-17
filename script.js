// 탭 기능 제거 (결과 페이지로 이동 버전)
const SCRIPT_URL = "https://script.google.com/macros/s/여기에_배포_URL을_붙여넣기/exec";

document.getElementById('stress-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const formData = new FormData(this);

  // 여러 체크박스 값들을 배열로 수집
  const getCheckedValues = name =>
    Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(i => i.value);

  const data = {
    stress_situation: getCheckedValues('stress_situation'),
    stress_situation_etc: formData.get('stress_situation_etc'),
    stress_action: getCheckedValues('stress_action'),
    stress_action_etc: formData.get('stress_action_etc'),
    best_time: formData.get('best_time'),
    content_service: getCheckedValues('content_service'),
    content_service_etc: formData.get('content_service_etc'),
    special_method: formData.get('special_method')
  };

  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    });

    const result = await res.json();

    if (result.result === 'success') {
      alert('🌿 설문이 제출되었습니다. 감사합니다!');
      window.location.href = "result.html"; // ✅ 결과 페이지로 이동
    } else {
      alert('⚠️ 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  } catch (err) {
    console.error(err);
    alert('⚠️ 전송 실패! 인터넷 연결을 확인해주세요.');
  }
});
