const {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, convertInchesToTwip,
} = require('docx')
const fs   = require('fs')
const path = require('path')

const tw = convertInchesToTwip
const FONT = 'Malgun Gothic'

// ── 헬퍼 ────────────────────────────────────────────────────────

// 제목 (1단계, 2단계 …)
function h1(text) {
  return new Paragraph({
    spacing: { before: 400, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '1E4D8C' } },
    children: [
      new TextRun({ text, bold: true, size: 28, font: FONT, color: '1E4D8C' }),
    ],
  })
}

// 소제목
function h2(text) {
  return new Paragraph({
    spacing: { before: 240, after: 80 },
    children: [
      new TextRun({ text, bold: true, size: 22, font: FONT, color: '1A1A2E' }),
    ],
  })
}

// 본문
function body(text) {
  return new Paragraph({
    spacing: { after: 100 },
    indent: { left: tw(0.1) },
    children: [new TextRun({ text, size: 21, font: FONT, color: '1A1A2E' })],
  })
}

// 불릿
function bullet(text) {
  return new Paragraph({
    spacing: { after: 70 },
    indent: { left: tw(0.3), hanging: tw(0.15) },
    children: [
      new TextRun({ text: '- ', size: 21, font: FONT, color: '555577' }),
      new TextRun({ text, size: 21, font: FONT, color: '1A1A2E' }),
    ],
  })
}

// 빈 줄
function spacer() {
  return new Paragraph({ spacing: { after: 120 }, children: [] })
}

// ── 문서 조립 ────────────────────────────────────────────────────
const doc = new Document({
  creator: '세계일보 디지털뉴스본부',
  title:   '세계일보 취재원 관리시스템 보안 안내',
  sections: [{
    properties: {
      page: {
        margin: { top: tw(1.1), bottom: tw(1.1), left: tw(1.2), right: tw(1.2) },
      },
    },
    children: [

      // 제목
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 120 },
        children: [
          new TextRun({ text: '세계일보 취재원 관리시스템', bold: true, size: 40, font: FONT, color: '1A3A5C' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: '보안 구조 및 보호 장치 안내', size: 26, font: FONT, color: '1E4D8C' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: '세계일보 디지털뉴스본부  |  2026년 5월', size: 20, font: FONT, color: '888888' })],
      }),
      spacer(),

      body('이 문서는 취재원 관리시스템에 적용된 보안 장치들을 기술 용어 없이 알기 쉽게 설명합니다.'),
      body('이 시스템은 두 가지 원칙으로 설계되어 있습니다.'),
      bullet('취재원 정보를 외부에서 "가져가지 못하게 막는다"'),
      bullet('만약 유출되더라도 "누가 가져갔는지 반드시 밝혀낸다"'),
      spacer(),

      // 1단계
      h1('1단계  |  문 앞에서부터 막는다 — 로그인 보안'),

      h2('두 번 확인하는 자물쇠 (2단계 인증)'),
      body('비밀번호만으로는 들어올 수 없습니다. 로그인 후 반드시 문자나 앱으로 받은 일회용 번호를 추가로 입력해야 합니다.'),
      bullet('비밀번호가 새어나가더라도 본인 휴대폰이 없으면 접속이 불가합니다.'),

      h2('회사 내부 네트워크만 허용 (VPN)'),
      body('VPN(회사 전용 네트워크)을 거치지 않으면 접속 자체가 차단됩니다.'),
      bullet('카페나 집에서 아무 네트워크로 접속해도 로그인 화면조차 열리지 않습니다.'),

      h2('비밀번호 5회 오류 시 계정 잠금'),
      body('로그인 시도가 15분 안에 5회 실패하면 해당 계정이 일시 잠깁니다.'),
      bullet('무작위로 비밀번호를 입력해보는 해킹 공격을 원천 차단합니다.'),

      h2('자리를 비우면 자동 로그아웃'),
      body('15분 동안 아무 활동이 없으면 경고 알림이 뜨고, 2분 안에 반응이 없으면 자동 로그아웃됩니다.'),
      bullet('자리를 비운 사이 다른 사람이 내 화면을 들여다보는 것을 막습니다.'),

      h2('한 사람, 한 기기만 (동시 접속 차단)'),
      body('같은 계정으로 두 곳에서 동시에 접속하면 이전 접속이 강제로 끊깁니다.'),
      bullet('내 계정을 누군가 몰래 사용 중이라면, 내가 로그인하는 순간 상대방이 튕겨납니다.'),

      h2('새 기기 접속 알림'),
      body('처음 쓰는 컴퓨터나 브라우저로 로그인하면 "새 기기에서 접속했습니다" 알림이 자동으로 뜹니다.'),
      bullet('본인이 아닌 다른 사람이 내 계정으로 새 기기에서 접속했을 때 즉시 감지할 수 있습니다.'),
      spacer(),

      // 2단계
      h1('2단계  |  금고 안에 잠근다 — 데이터 보호'),

      h2('중요 정보는 암호화해서 저장'),
      body('전화번호, 이메일, 민감 메모 등은 데이터베이스에 암호화된 형태로 저장됩니다.'),
      bullet('누군가 서버를 해킹해 데이터를 통째로 가져가도, 암호 키 없이는 읽을 수 없는 뒤죽박죽 문자열만 보입니다.'),

      h2('직급별 열람 권한'),
      body('권한이 없는 정보는 URL을 직접 조작해도 서버에서 원천 차단됩니다.'),
      bullet('일반 기자  →  공개 취재원 정보, 공개 노트'),
      bullet('차장 · 데스크  →  위 항목 + 민감 정보, 민감 노트'),
      bullet('국장 · 관리자  →  전체 정보 + 감사 기록, 계정 관리'),

      h2('민감 취재원 열람 신청 제도'),
      body('민감도가 높은 취재원 정보는 데스크 승인을 받아야만 열람할 수 있습니다.'),
      bullet('승인 없이 접근을 시도하면 빈 화면만 표시됩니다. 시도 자체도 기록됩니다.'),
      spacer(),

      // 3단계
      h1('3단계  |  화면에서도 막는다 — 시각적 보호'),

      h2('화면에 항상 이름이 보인다 (가시 워터마크)'),
      body('로그인한 동안 화면 전체에 내 이름과 소속이 투명하게 깔려 있습니다.'),
      bullet('화면을 사진으로 찍어도 누가 열람했는지 기록이 남습니다.'),
      bullet('심리적으로 함부로 촬영하지 못하게 억제하는 효과도 있습니다.'),

      h2('전화번호 · 이메일은 이미지로 표시'),
      body('전화번호, 이메일 등 민감한 연락처는 텍스트가 아닌 그림으로 그려서 보여줍니다.'),
      bullet('마우스로 드래그해도 글자가 선택되지 않습니다.'),
      bullet('복사 · 붙여넣기가 원천적으로 불가합니다.'),
      spacer(),

      // 4단계
      h1('4단계  |  복사조차 허용하지 않는다 — 민감 영역 차단'),

      body('민감 정보(민감 취재원 상세, 정보보고 본문)가 있는 영역에서는 추가 보호가 작동합니다.'),
      bullet('마우스 드래그로 텍스트 선택이 되지 않습니다.'),
      bullet('우클릭 메뉴가 열리지 않습니다.'),
      bullet('Ctrl+A (전체 선택) 단축키가 막힙니다.'),
      body('※ 물리적으로 화면을 사진 찍는 것을 100% 막을 수는 없습니다. 그러나 가장 쉬운 텍스트 복사 경로를 모두 차단하여 실수나 충동적인 유출 시도를 크게 줄입니다.'),
      spacer(),

      // 5단계
      h1('5단계  |  만약 가져가더라도 — 보이지 않는 추적 워터마크'),

      body('복사를 막는 것에는 한계가 있습니다. 이 시스템은 "가져가면 누가 가져갔는지 반드시 특정할 수 있다"는 방향으로 설계되어 있습니다.'),

      h2('보이지 않는 문자 삽입 (1차 추적)'),
      body('텍스트를 복사하는 순간, 클립보드에 저장되는 내용에 눈에 보이지 않는 특수 문자들이 자동으로 섞입니다.'),
      bullet('이 문자들은 화면에도 보이지 않고, 메모장이나 이메일에 붙여넣어도 보이지 않습니다.'),
      bullet('이 패턴은 복사한 사람마다 다릅니다. 유출된 문서가 발견되면 어느 계정에서 복사됐는지 100% 추적 가능합니다.'),
      bullet('경고 문구를 일부러 지우고 보내더라도 보이지 않는 워터마크는 그대로 남아 있습니다.'),

      h2('구두점 패턴 삽입 (2차 추적)'),
      body('보이지 않는 문자 외에도, 쉼표나 마침표가 사람마다 다른 위치에 하나씩 더 들어갑니다.'),
      bullet('눈으로 봐도 잘 모르지만, 다른 사람에게 텍스트를 보낼 때 이 패턴이 살아남아 보조 증거가 됩니다.'),
      bullet('화면을 사진 찍거나 다시 타이핑한 경우에도 구두점 패턴으로 추적을 보조합니다.'),

      h2('복사하면 경고 문구 자동 추가'),
      body('민감 영역의 텍스트를 복사하면, 붙여넣기 시 아래와 같은 문구가 자동으로 따라붙습니다.'),
      bullet('⚠️ 세계일보 취재원관리시스템 내부자료'),
      bullet('열람자: 홍길동  |  일시: 2026-05-20 14:32:10'),
      bullet('무단 외부 유출 시 법적 책임을 집니다.'),
      spacer(),

      // 6단계
      h1('6단계  |  모든 행동이 기록된다 — 감사 로그'),

      body('시스템 안에서 일어나는 모든 주요 행동은 서버에 자동으로 기록됩니다.'),
      bullet('로그인 / 로그아웃  —  접속 IP, 기기 정보 포함'),
      bullet('민감 취재원 열람  —  누가, 언제, 어떤 취재원을'),
      bullet('정보보고 열람 · 작성 · 수정 · 삭제  —  변경 전후 내용 포함'),
      bullet('텍스트 복사  —  복사한 내용의 앞 80자 기록'),
      bullet('엑셀 내보내기  —  누가, 언제, 몇 건'),
      bullet('새 기기 접속  —  기기 정보 자동 감지'),
      bullet('비밀번호 오류 시도  —  시도 횟수, IP 기록'),
      body('※ 감사 기록은 삭제하거나 수정할 수 없습니다. 나중에 문제가 생겼을 때 "누가 언제 무엇을 했는지" 정확하게 확인할 수 있습니다.'),

      h2('내보내기(엑셀) 횟수 제한'),
      body('취재원 목록을 엑셀로 내보내는 기능은 하루에 정해진 횟수 이상 사용할 수 없습니다.'),
      bullet('대량 유출 시도를 자동으로 감지하고 차단합니다.'),
      spacer(),

      // 7단계
      h1('7단계  |  인터넷 구간도 보호한다 — 네트워크 보안'),

      bullet('HTTPS 강제  —  모든 데이터는 암호화된 경로로 전송됩니다. 중간에서 가로채도 읽을 수 없습니다.'),
      bullet('API 요청 제한  —  짧은 시간에 비정상적으로 많은 요청이 들어오면 자동 차단됩니다. 자동화 도구를 이용한 대량 수집을 막습니다.'),
      bullet('스크립트 보안  —  외부에서 악성 스크립트를 심어 정보를 빼가는 공격을 원천 차단합니다.'),
      spacer(),

      // 마무리
      new Paragraph({
        spacing: { before: 200, after: 100 },
        border: { top: { style: BorderStyle.SINGLE, size: 8, color: '1E4D8C' } },
        children: [
          new TextRun({ text: '정리하면', bold: true, size: 24, font: FONT, color: '1A3A5C' }),
        ],
      }),
      body('이 시스템은 "가져가지 못하게 막는 것"과 "만약 가져가더라도 누가 가져갔는지 반드시 밝혀내는 것", 두 가지를 동시에 구현합니다.'),
      body('보안은 처음부터 완벽한 자물쇠보다, 억제 + 추적 + 기록의 조합에서 진짜 힘이 나옵니다.'),
      spacer(),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [
          new TextRun({ text: '세계일보 디지털뉴스본부  |  대외비', size: 18, font: FONT, color: '888888', italics: true }),
        ],
      }),
    ],
  }],
})

// ── 저장 ──────────────────────────────────────────────────────────
const outPath = path.join('C:\\Users\\admin\\Desktop', '세계일보_취재원관리시스템_보안안내.docx')

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf)
  console.log('저장 완료:', outPath)
  console.log('파일 크기:', (buf.length / 1024).toFixed(1), 'KB')
}).catch(err => {
  console.error('오류:', err.message)
  process.exit(1)
})
