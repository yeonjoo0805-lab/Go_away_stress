document.addEventListener('DOMContentLoaded', () => {
    // !!! 중요: README.md 파일을 읽고, 배포된 자신의 Google Apps Script 웹 앱 URL로 변경하세요.
    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwNNhVG0kqzBiLaP9Ry1GcSIIZhjB9ytc-yQf4yC8g2c1Lz6dOa11xz08-hYcl__VPx/exec';

    const recordForm = document.getElementById('record-form');
    const recordsContainer = document.getElementById('records-container');
    const dateInput = document.getElementById('date');
    const exportButton = document.getElementById('export-excel');
    const moodChartCanvas = document.getElementById('mood-chart');
    let recordsCache = []; // 데이터 캐싱
    let moodChart;

    // 페이지 로드 시 오늘 날짜로 기본 설정
    dateInput.value = new Date().toISOString().split('T')[0];

    // 데이터 로드 및 화면 업데이트
    const loadRecords = async () => {
        try {
            const response = await fetch(WEB_APP_URL, { method: 'GET', redirect: 'follow' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            recordsCache = await response.json();

            // 서버에서 받은 데이터가 배열인지 확인합니다. 배열이 아니면 Apps Script 에러일 가능성이 높습니다.
            if (!Array.isArray(recordsCache)) {
                console.error("Error data received from Google Apps Script:", recordsCache);
                throw new Error('Google Apps Script에서 에러가 발생했습니다. 개발자 도구(F12)의 Console 탭에서 상세 정보를 확인하세요.');
            }
            
            recordsContainer.innerHTML = '<p>데이터를 불러오는 중...</p>';
            // 최신순으로 정렬
            // Timestamp 기준으로 정렬 (더 정확함)
            recordsCache.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
            
            recordsContainer.innerHTML = ''; // 로딩 메시지 제거
            recordsCache.forEach(addRecordToDOM);
            renderMoodChart();

        } catch (error) {
            console.error('Error loading records:', error);
            recordsContainer.innerHTML = `<p style="color: red;">데이터를 불러오는 데 실패했습니다. README.md 파일을 확인하여 설정을 완료했는지 확인하세요.</p>`;
        }
    };

    // DOM에 기록 목록 행 추가
    const addRecordToDOM = (record) => {
        const row = document.createElement('div');
        row.classList.add('record-row');

        const moodEmojis = { '행복': '😄', '보통': '😐', '우울': '😔', '분노': '😡' };
        const typeText = { 'deed': '😊 2km', 'help': '💖 5km' };

        row.innerHTML = `
            <div class="record-type ${record.Type}">${typeText[record.Type] || record.Type}</div>
            <div class="record-content" title="${record.Content}">${record.Content}</div>
            <div class="record-reaction" title="${record.Reaction}">${record.Reaction || '-'}</div>
            <div class="record-date">${new Date(record.Date).toLocaleDateString()}</div>
            <div class="record-mood">${moodEmojis[record.Mood] || ''}</div>
        `;
        recordsContainer.appendChild(row);
    };

    // 기분 통계 차트 렌더링
    const renderMoodChart = () => {
        const moodCounts = recordsCache.reduce((acc, record) => {
            acc[record.Mood] = (acc[record.Mood] || 0) + 1;
            return acc;
        }, {});

        const chartData = {
            labels: Object.keys(moodCounts),
            datasets: [{
                label: '기분별 횟수',
                data: Object.values(moodCounts),
                backgroundColor: ['#FFC107', '#FF7043', '#8BC34A', '#2196F3', '#9C27B0'],
                hoverOffset: 4
            }]
        };

        if (moodChart) {
            moodChart.destroy(); // 기존 차트 파괴
        }

        moodChart = new Chart(moodChartCanvas, {
            type: 'pie',
            data: chartData,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: '전체 기분 통계'
                    }
                }
            }
        });
    };

    // 폼 제출 이벤트 처리
    recordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = '저장 중...';

        const formData = new FormData(recordForm);
        const data = {
            type: formData.get('type'),
            date: formData.get('date'),
            content: formData.get('content'),
            mood: formData.get('mood'),
            reaction: formData.get('reaction')
        };

        try {
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors', // Apps Script는 no-cors 모드 또는 복잡한 CORS 설정이 필요할 수 있습니다.
                cache: 'no-cache',
                redirect: 'follow',
                body: JSON.stringify(data)
            });

            // no-cors 모드에서는 응답을 직접 읽을 수 없으므로, 성공적으로 전송되었다고 가정합니다.
            alert('성공적으로 기록되었습니다!');
            recordForm.reset();
            dateInput.value = new Date().toISOString().split('T')[0];
            loadRecords(); // 데이터 다시 불러오기

        } catch (error) {
            console.error('Error submitting record:', error);
            alert('기록 저장에 실패했습니다. 인터넷 연결을 확인하세요.');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = '기록하기';
        }
    });

    // 엑셀 내보내기 이벤트 처리
    exportButton.addEventListener('click', () => {
        if (recordsCache.length === 0) {
            alert('내보낼 데이터가 없습니다.');
            return;
        }

        // 데이터 시트 생성
        const worksheet = XLSX.utils.json_to_sheet(recordsCache);
        // 새 워크북 생성
        const workbook = XLSX.utils.book_new();
        // 워크북에 데이터 시트 추가
        XLSX.utils.book_append_sheet(workbook, worksheet, "우리의 기록");

        // 헤더 스타일링 (선택 사항)
        const headers = Object.keys(recordsCache[0]);
        const header_styles = { font: { bold: true } };
        for(let i = 0; i < headers.length; i++){
            const cell_ref = XLSX.utils.encode_cell({c:i, r:0});
            if(worksheet[cell_ref]) {
                worksheet[cell_ref].s = header_styles;
            }
        }

        // 엑셀 파일 내보내기
        XLSX.writeFile(workbook, "our_kindness_records.xlsx");
    });

    // 초기 데이터 로드
    loadRecords();
});
