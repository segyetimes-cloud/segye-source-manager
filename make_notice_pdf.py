"""
세계일보 취재원관리시스템 사내 공지문 PDF 생성
"""
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY

# ── 폰트 등록 ────────────────────────────────────────────────────────────────
pdfmetrics.registerFont(TTFont('Malgun',   'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('MalgunBd', 'C:/Windows/Fonts/malgunbd.ttf'))
pdfmetrics.registerFont(TTFont('MalgunSl', 'C:/Windows/Fonts/malgunsl.ttf'))

# ── 색상 정의 ────────────────────────────────────────────────────────────────
NAVY        = colors.HexColor('#0D1F40')
BLUE        = colors.HexColor('#1D4E8F')
LIGHT_BLUE  = colors.HexColor('#E8EFF8')
ACCENT      = colors.HexColor('#2563B0')
GOLD        = colors.HexColor('#8B6914')
RED_DARK    = colors.HexColor('#8B1A1A')
GREEN_DARK  = colors.HexColor('#1A6B3A')
ORANGE      = colors.HexColor('#7A4F1A')
GRAY_DARK   = colors.HexColor('#2C3A4A')
GRAY_MID    = colors.HexColor('#4A5568')
GRAY_LIGHT  = colors.HexColor('#F0F4F8')
BORDER      = colors.HexColor('#CBD5E0')
WHITE       = colors.white
WARN_BG     = colors.HexColor('#FFF8E8')
WARN_BORDER = colors.HexColor('#C8943A')

# ── 스타일 정의 ──────────────────────────────────────────────────────────────
def S(name, **kw):
    return ParagraphStyle(name, **kw)

sTitle = S('Title',
    fontName='MalgunBd', fontSize=20, leading=28,
    textColor=WHITE, alignment=TA_CENTER, spaceAfter=2)

sSubtitle = S('Subtitle',
    fontName='Malgun', fontSize=11, leading=16,
    textColor=colors.HexColor('#B8CCE8'), alignment=TA_CENTER, spaceAfter=0)

sMeta = S('Meta',
    fontName='Malgun', fontSize=9.5, leading=15,
    textColor=GRAY_DARK, alignment=TA_LEFT)

sMetaBold = S('MetaBold',
    fontName='MalgunBd', fontSize=9.5, leading=15,
    textColor=GRAY_DARK, alignment=TA_LEFT)

sSection = S('Section',
    fontName='MalgunBd', fontSize=12.5, leading=18,
    textColor=WHITE, spaceAfter=0, spaceBefore=0)

sBody = S('Body',
    fontName='Malgun', fontSize=9.5, leading=15,
    textColor=GRAY_DARK, alignment=TA_JUSTIFY, spaceAfter=4)

sBold = S('Bold',
    fontName='MalgunBd', fontSize=9.5, leading=15,
    textColor=GRAY_DARK, spaceAfter=2)

sMethod = S('Method',
    fontName='MalgunBd', fontSize=10, leading=15,
    textColor=BLUE)

sMethodSub = S('MethodSub',
    fontName='Malgun', fontSize=9, leading=14,
    textColor=GRAY_MID)

sTip = S('Tip',
    fontName='Malgun', fontSize=8.8, leading=14,
    textColor=ORANGE)

sTableHeader = S('TH',
    fontName='MalgunBd', fontSize=9, leading=13,
    textColor=WHITE, alignment=TA_CENTER)

sTableCell = S('TC',
    fontName='Malgun', fontSize=9, leading=13,
    textColor=GRAY_DARK, alignment=TA_LEFT)

sTableCellC = S('TCC',
    fontName='Malgun', fontSize=9, leading=13,
    textColor=GRAY_DARK, alignment=TA_CENTER)

sNote = S('Note',
    fontName='Malgun', fontSize=8.5, leading=13,
    textColor=GRAY_MID)

sFooter = S('Footer',
    fontName='Malgun', fontSize=8.5, leading=13,
    textColor=colors.HexColor('#718096'), alignment=TA_CENTER)

sWarn = S('Warn',
    fontName='MalgunBd', fontSize=9, leading=14,
    textColor=RED_DARK)

sGreen = S('Green',
    fontName='Malgun', fontSize=9, leading=14,
    textColor=GREEN_DARK)


# ── 유틸 ─────────────────────────────────────────────────────────────────────
def section_header(num, text):
    """번호 + 제목 헤더 블록"""
    data = [[Paragraph(f'{num}.  {text}', sSection)]]
    t = Table(data, colWidths=[165*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BLUE),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [BLUE]),
        ('TOPPADDING',    (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING',   (0,0), (-1,-1), 12),
        ('RIGHTPADDING',  (0,0), (-1,-1), 8),
        ('ROUNDEDCORNERS', [4]),
    ]))
    return t

def method_card(icon, title, sub):
    data = [[
        Paragraph(icon, S('ic', fontName='Malgun', fontSize=18, leading=22, textColor=BLUE)),
        [Paragraph(title, sMethod), Spacer(1, 2), Paragraph(sub, sMethodSub)],
    ]]
    t = Table(data, colWidths=[14*mm, 151*mm])
    t.setStyle(TableStyle([
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND',    (0,0), (-1,-1), LIGHT_BLUE),
        ('TOPPADDING',    (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING',   (0,0), (0,0),   10),
        ('LEFTPADDING',   (1,0), (1,0),   6),
        ('RIGHTPADDING',  (0,0), (-1,-1), 10),
        ('LINEBELOW',     (0,0), (-1,-1), 0.5, BORDER),
        ('ROUNDEDCORNERS', [3]),
    ]))
    return t

def tip_box(text):
    data = [[Paragraph(text, sTip)]]
    t = Table(data, colWidths=[165*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), colors.HexColor('#FFF9E6')),
        ('TOPPADDING',    (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING',   (0,0), (-1,-1), 12),
        ('RIGHTPADDING',  (0,0), (-1,-1), 12),
        ('LINEBEFORE',    (0,0), (0,-1), 3, colors.HexColor('#C8943A')),
        ('BOX',           (0,0), (-1,-1), 0.5, WARN_BORDER),
        ('ROUNDEDCORNERS', [3]),
    ]))
    return t

def warn_box(text):
    data = [[Paragraph(text, sWarn)]]
    t = Table(data, colWidths=[165*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), colors.HexColor('#FFF0F0')),
        ('TOPPADDING',    (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING',   (0,0), (-1,-1), 12),
        ('RIGHTPADDING',  (0,0), (-1,-1), 12),
        ('LINEBEFORE',    (0,0), (0,-1), 3, RED_DARK),
        ('BOX',           (0,0), (-1,-1), 0.5, colors.HexColor('#E8AAAA')),
        ('ROUNDEDCORNERS', [3]),
    ]))
    return t

def make_table(headers, rows, col_widths):
    header_row = [Paragraph(h, sTableHeader) for h in headers]
    data = [header_row]
    for row in rows:
        data.append([Paragraph(str(c), sTableCell if i == len(row)-1 else sTableCellC)
                     for i, c in enumerate(row)])
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0),   NAVY),
        ('ROWBACKGROUNDS',(0,1), (-1,-1),  [WHITE, GRAY_LIGHT]),
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING',    (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
        ('RIGHTPADDING',  (0,0), (-1,-1), 8),
        ('GRID',          (0,0), (-1,-1), 0.4, BORDER),
        ('ROUNDEDCORNERS', [3]),
    ]))
    return t

def feature_table(rows):
    data = []
    for icon, title, desc in rows:
        data.append([
            Paragraph(icon, S('fi', fontName='Malgun', fontSize=13, leading=16, alignment=TA_CENTER)),
            Paragraph(title, sBold),
            Paragraph(desc,  sBody),
        ])
    t = Table(data, colWidths=[10*mm, 38*mm, 117*mm])
    t.setStyle(TableStyle([
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [WHITE, GRAY_LIGHT]),
        ('VALIGN',         (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING',     (0,0), (-1,-1), 6),
        ('BOTTOMPADDING',  (0,0), (-1,-1), 6),
        ('LEFTPADDING',    (0,0), (-1,-1), 8),
        ('RIGHTPADDING',   (0,0), (-1,-1), 8),
        ('GRID',           (0,0), (-1,-1), 0.4, BORDER),
        ('ROUNDEDCORNERS', [3]),
    ]))
    return t


# ── 문서 조립 ─────────────────────────────────────────────────────────────────
def build():
    out = 'C:/Users/admin/Desktop/segye-source-manager/source_manager_notice.pdf'
    doc = SimpleDocTemplate(
        out, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=18*mm, bottomMargin=18*mm,
    )
    story = []
    W = 165*mm  # 본문 폭

    # ── 헤더 배너 ──────────────────────────────────────────────────────────────
    banner_data = [[
        Paragraph('THE SEGYE TIMES', S('bn', fontName='MalgunBd', fontSize=9,
            textColor=colors.HexColor('#90B8E0'), alignment=TA_CENTER)),
        Paragraph('사 내 공 지', sTitle),
        Paragraph('취재원관리시스템 사용 안내', sSubtitle),
        Spacer(1, 4),
        Paragraph('Source Management System', S('en', fontName='MalgunSl', fontSize=8,
            textColor=colors.HexColor('#6A8AAA'), alignment=TA_CENTER)),
    ]]
    banner = Table([[col] for col in banner_data[0]], colWidths=[W])
    banner.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), NAVY),
        ('TOPPADDING',    (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING',   (0,0), (-1,-1), 0),
        ('RIGHTPADDING',  (0,0), (-1,-1), 0),
    ]))

    banner2_data = [
        [Paragraph('THE SEGYE TIMES', S('bn2', fontName='MalgunBd', fontSize=8.5,
            textColor=colors.HexColor('#90B8E0'), alignment=TA_CENTER))],
        [Paragraph('사 내 공 지', sTitle)],
        [Paragraph('취재원관리시스템(Source Manager) 사용 안내', sSubtitle)],
        [Spacer(1, 6)],
    ]
    banner_tbl = Table(banner2_data, colWidths=[W])
    banner_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), NAVY),
        ('TOPPADDING',    (0,0), (0,0), 14),
        ('TOPPADDING',    (1,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
        ('RIGHTPADDING',  (0,0), (-1,-1), 8),
        ('ROUNDEDCORNERS', [6]),
    ]))
    story.append(banner_tbl)
    story.append(Spacer(1, 5*mm))

    # ── 발신 정보 ──────────────────────────────────────────────────────────────
    meta_rows = [
        ['수  신', '편집국 전 기자 · 데스크'],
        ['발  신', '편집국'],
        ['일  자', '2026년 5월 21일'],
        ['제  목', '취재원관리시스템(Source Manager) 사용 개시 안내'],
    ]
    meta_data = [[Paragraph(k, sMetaBold), Paragraph(v, sMeta)] for k, v in meta_rows]
    meta_tbl = Table(meta_data, colWidths=[22*mm, 143*mm])
    meta_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), GRAY_LIGHT),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (0,-1), 14),
        ('LEFTPADDING',   (1,0), (1,-1), 8),
        ('RIGHTPADDING',  (0,0), (-1,-1), 8),
        ('LINEBELOW',     (0,0), (-1,-2), 0.4, BORDER),
        ('BOX',           (0,0), (-1,-1), 0.8, BLUE),
        ('ROUNDEDCORNERS', [4]),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        '편집국 여러분, 취재원관리시스템이 공식 운영됩니다. '
        '주요 기능과 사용 방법, 보안 원칙을 아래와 같이 안내드립니다. '
        '숙지하신 후 적극 활용해 주시기 바랍니다.',
        sBody))
    story.append(Spacer(1, 4*mm))

    # ── 섹션 1 : 등록 방법 ────────────────────────────────────────────────────
    story.append(KeepTogether([
        section_header('1', '취재원 등록 — 세 가지 빠른 방법'),
        Spacer(1, 3*mm),
        method_card('📋', '연락처 붙여넣기',
            '스마트폰 연락처 앱 또는 네이버 인물 페이지에서 복사 → 붙여넣기만 하면 이름·전화·이메일 자동 입력'),
        method_card('📸', '명함 사진 스캔',
            '카메라 촬영 또는 사진 선택 → AI가 이름·소속·직책·전화번호 자동 추출 (여러 장은 명함 일괄 등록 이용)'),
        method_card('📊', '엑셀 붙여넣기',
            'Excel·Google Sheets 셀(헤더 포함) 복사(Ctrl+C) 후 붙여넣기 → 자동 파싱 (여러 명은 엑셀 가져오기 이용)'),
        Spacer(1, 3*mm),
        tip_box('💡  자동 추출 팁 : 공개·민감 정보란에 뉴스·경력 텍스트를 붙여넣으면 '
                '학력·기수·출신지를 감지해 "필드에 채울까요?" 안내가 뜹니다.'),
        Spacer(1, 3*mm),
        Paragraph('📞  <b>취재원 상세 페이지에서 전화번호를 탭(터치)하면 바로 전화가 걸립니다.</b> '
                  '주 전화 / 보조 전화 모두 지원되며, 모바일 환경에서 특히 편리합니다.',
                  S('ph', fontName='Malgun', fontSize=9.5, leading=15, textColor=GRAY_DARK,
                    alignment=TA_JUSTIFY, spaceAfter=4)),
        Spacer(1, 2*mm),
        Paragraph('입력 항목을 충실히 채울수록 <b>완성도 점수</b>가 올라가고 포인트가 적립됩니다 '
                  '(완성도 55점+ → +30pt, 35점+ → +15pt).', sBody),
    ]))
    story.append(Spacer(1, 5*mm))

    # ── 섹션 2 : 열람 범위 ────────────────────────────────────────────────────
    story.append(section_header('2', '정보 열람 범위 — 직급별 구분'))
    story.append(Spacer(1, 3*mm))
    story.append(make_table(
        ['정보 항목', '열람 가능 범위'],
        [
            ['이름·소속·전화 등 기본 정보',         '편집국 전원'],
            ['공개 정보란  (취재 성향·인터뷰 이력)', '편집국 전원'],
            ['민감 정보란  (친분·가족·개인 성향)',   '차장 이상 / 기자는 데스크 승인 후 열람'],
            ['🔴 민감도 설정 취재원',                '부장 이상'],
        ],
        [85*mm, 80*mm],
    ))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        '취재원 등록 시 <b>취재 동의 상태</b>를 반드시 표시해 주십시오.', sBold))
    story.append(Spacer(1, 2*mm))

    agree_data = [
        ['✅  온더레코드', '실명 인용 가능'],
        ['🟡  백그라운드', '익명 인용만 허용'],
        ['🔴  오프더레코드', '인용 불가'],
    ]
    agree_tbl = Table(
        [[Paragraph(k, S('ak', fontName='MalgunBd', fontSize=9, textColor=GRAY_DARK)),
          Paragraph(v, S('av', fontName='Malgun',   fontSize=9, textColor=GRAY_MID))]
         for k, v in agree_data],
        colWidths=[48*mm, 117*mm],
    )
    agree_tbl.setStyle(TableStyle([
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [WHITE, GRAY_LIGHT]),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 10),
        ('GRID',          (0,0), (-1,-1), 0.4, BORDER),
        ('ROUNDEDCORNERS', [3]),
    ]))
    story.append(agree_tbl)
    story.append(Spacer(1, 5*mm))

    # ── 섹션 3 : 보안 ─────────────────────────────────────────────────────────
    story.append(section_header('3', '보안 규정 — 반드시 숙지하십시오'))
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph('▶ 화면 보안', sBold))
    story.append(Spacer(1, 1.5*mm))
    screen_data = [
        ['스크린샷 감지',  'PrintScreen 키 입력 즉시 화면 잠김'],
        ['창 전환 감지',   'Alt+Tab 등 화면 이탈 시 자동으로 화면 가려짐'],
        ['복사 방지',      '민감 정보 드래그 선택 및 복사 차단'],
        ['워터마크',       '이름·부서·시각이 전체 화면에 반투명하게 표시'],
    ]
    screen_tbl = Table(
        [[Paragraph(k, S('sk', fontName='MalgunBd', fontSize=9, textColor=BLUE)),
          Paragraph(v, S('sv', fontName='Malgun',   fontSize=9, textColor=GRAY_DARK))]
         for k, v in screen_data],
        colWidths=[36*mm, 129*mm],
    )
    screen_tbl.setStyle(TableStyle([
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [WHITE, GRAY_LIGHT]),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 10),
        ('GRID',          (0,0), (-1,-1), 0.4, BORDER),
        ('ROUNDEDCORNERS', [3]),
    ]))
    story.append(screen_tbl)
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph('▶ 자료 내보내기 제한 (역할별 일일 한도)', sBold))
    story.append(Spacer(1, 1.5*mm))
    story.append(make_table(
        ['직급', '1회 최대 건수', '하루 횟수'],
        [
            ['기자',       '100건', '3회'],
            ['차장',       '200건', '5회'],
            ['부장',       '500건', '10회'],
            ['부국장 이상', '1,000~2,000건', '20회'],
        ],
        [55*mm, 55*mm, 55*mm],
    ))
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph('▶ 접속 보안', sBold))
    story.append(Spacer(1, 1.5*mm))
    access_items = [
        '최초 로그인 시 OTP(일회용 인증번호) 인증 필수',
        '등록된 기기에서만 접속 가능',
        '일정 시간 미사용 시 자동 로그아웃',
        '이상 접근 감지 시 계정 잠금',
    ]
    for item in access_items:
        story.append(Paragraph(f'   •  {item}', sBody))
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph('▶ 감사 로그', sBold))
    story.append(Paragraph(
        '열람·수정·삭제·내보내기·민감정보 접근 등 모든 행동이 자동 기록됩니다. '
        '부장 이상이 언제든지 확인할 수 있습니다.', sBody))
    story.append(Spacer(1, 3*mm))

    story.append(warn_box(
        '⚠  업무 외 목적의 취재원 조회, 외부 반출, 무단 캡처는 '
        '취업규칙에 따라 징계 사유가 될 수 있습니다.'))
    story.append(Spacer(1, 5*mm))

    # ── 섹션 4 : 도움 게시판 ─────────────────────────────────────────────────
    story.append(KeepTogether([
        section_header('4', '도움 게시판 — 동료와 정보 나누기'),
        Spacer(1, 3*mm),
        Paragraph(
            '취재 중 막히는 부분이 생기면 동료에게 도움을 요청할 수 있습니다. '
            '요청 유형은 아래 네 가지입니다.', sBody),
        Spacer(1, 2*mm),
    ]))

    help_data = [
        ['📞  연락처',      '"○○장관실 직통 아시는 분?"'],
        ['📋  정보',        '"◇◇부처 예산 관련 배경 아시는 분?"'],
        ['🎤  인터뷰 주선', '"A 교수 인터뷰 연결해주실 수 있나요?"'],
        ['💬  기타',        '그 외 취재 관련 도움 요청'],
    ]
    help_tbl = Table(
        [[Paragraph(k, S('hk', fontName='MalgunBd', fontSize=9.5, textColor=BLUE)),
          Paragraph(v, S('hv', fontName='Malgun',   fontSize=9,   textColor=GRAY_DARK))]
         for k, v in help_data],
        colWidths=[42*mm, 123*mm],
    )
    help_tbl.setStyle(TableStyle([
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [WHITE, GRAY_LIGHT]),
        ('TOPPADDING',    (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING',   (0,0), (-1,-1), 10),
        ('GRID',          (0,0), (-1,-1), 0.4, BORDER),
        ('ROUNDEDCORNERS', [3]),
    ]))
    story.append(help_tbl)
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        '도움을 제공한 기자에게는 데스크가 포인트를 지급합니다. '
        '새 요청이 등록되면 상단 알림 벨로 실시간 알림이 전송됩니다.', sBody))
    story.append(Spacer(1, 5*mm))

    # ── 섹션 5 : 기타 기능 ───────────────────────────────────────────────────
    story.append(section_header('5', '그 외 주요 기능'))
    story.append(Spacer(1, 3*mm))
    story.append(feature_table([
        ('⭐', '북마크',        '자주 연락하는 취재원을 즐겨찾기에 등록'),
        ('🕸', '인맥 네트워크', '취재원 간 소속·학연 관계를 시각적 그래프로 표시'),
        ('📝', '정보보고',      '취재 중 얻은 정보를 보고 형식으로 저장 — 데스크 심사 후 포인트 지급'),
        ('🏆', '포인트 제도',   '취재원 등록·수정·정보보고·도움 제공 시 포인트 적립'),
        ('📜', '수정 이력',     '취재원 정보 변경 전·후 내역 자동 기록'),
        ('📞', '연락 이력',     '해당 취재원과의 통화·접촉 일시 메모'),
        ('🔍', '중복 경고',     '동일 이름·전화번호 취재원 재등록 시 사전 경고'),
        ('📁', '직책 이력',     '과거 소속·직책 변동 내역 관리'),
    ]))
    story.append(Spacer(1, 6*mm))

    # ── 푸터 ─────────────────────────────────────────────────────────────────
    story.append(HRFlowable(width=W, thickness=1, color=BLUE))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        '문의 : 편집국  |  모바일 접속 지원 (Chrome 권장)  |  2026년 5월 21일',
        sFooter))
    story.append(Spacer(1, 1*mm))
    story.append(Paragraph(
        'THE SEGYE TIMES  Source Management System',
        S('fn', fontName='MalgunSl', fontSize=8, leading=12,
          textColor=colors.HexColor('#A0AABB'), alignment=TA_CENTER)))

    doc.build(story)
    print(f'저장 완료: {out}')

build()
