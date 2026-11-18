# 🏡 우리 가족 대시보드

엄마·아빠 스마트폰과 거실 태블릿에서 함께 쓰는 가족 대시보드 웹앱입니다.
GitHub Pages에 올리면 무료로 바로 쓸 수 있고, Firebase Realtime Database(무료 플랜)를 연결하면 모든 기기가 **실시간으로 동기화**돼요.

| 기능 | 내용 |
|---|---|
| 📅 학원·방과후 스케줄 | 오늘 일정 강조, 월~일 주간 시간표, 학원별 준비물, (부모 모드) 학원 추가·수정과 월 학원비 합계 |
| 📚 오늘 공부 & 학습지 | 루틴 체크리스트와 달성률, 눈높이 등 학습지별 단계·진도, 오늘 분량 체크 |
| 🌟 별 스티커판 & 🎁 보상 상점 | 완료하면 별 적립, 30칸 스티커판, 별로 간식·보드게임·나들이 선택권 교환 (교환 시 부모 PIN 확인) |
| 🎂 가족 행사 D-Day | 생일·할머니 생신·학교 행사 D-Day를 날짜순으로 정렬, 매년 반복 |
| 🍚 저녁 메뉴 & 🧺 주말 계획 | 오늘·어제 저녁 기록, 이번 주말 계획 카드 체크·수정 |
| 💌 가족 우체통 & 🙋 엄마·아빠 상태 | 말로 메모 남기기(음성 입력), 소리로 읽어주기(TTS), 일하는 중/퇴근 중/집 상태 표시와 귀여운 모션 |
| 🎵 음악 듣기 | 말로 노래 검색, 멜론·유튜브 뮤직 바로가기, 자주 듣는 곡 즐겨찾기 |

- **부모 모드 / 아이 모드**: 오른쪽 위 버튼으로 바꿔요. 부모 모드로 바꿀 때는 PIN이 필요해요. 아이 모드에서는 학원비와 수정 버튼이 숨겨져요.
- **PWA**: 휴대폰·태블릿 '홈 화면에 추가'로 앱처럼 쓸 수 있어요.
- **Firebase 없이도** 바로 열어 볼 수 있어요. 이때는 '데모 모드'라 그 기기에만 저장돼요.

---

## 1단계 · GitHub에 올리고 Pages로 배포하기

### 방법 A. 웹 브라우저만으로 (가장 쉬움)

1. [github.com](https://github.com)에 로그인하고 오른쪽 위 **＋ → New repository**를 누릅니다.
2. Repository name에 `family-dashboard`를 적고, **Public**을 고른 뒤 **Create repository**를 누릅니다.
   (무료 계정의 GitHub Pages는 Public 저장소에서 쓸 수 있어요.)
3. 새 저장소 화면에서 **uploading an existing file** 링크를 누릅니다.
4. 이 폴더(압축을 푼 `family-dashboard` 폴더) **안의 모든 파일과 폴더**를 끌어다 놓습니다.
   `index.html`이 저장소 맨 위에 있어야 해요. 그다음 **Commit changes**를 누릅니다.
5. 저장소의 **Settings → Pages**로 갑니다.
6. **Build and deployment**의 Source를 **Deploy from a branch**로, Branch를 **main** / **/(root)** 로 고르고 **Save**를 누릅니다.
7. 1~2분 뒤 같은 화면 위쪽에 주소가 나타나요: `https://<내아이디>.github.io/family-dashboard/`

> 숨김 파일 `.nojekyll`이 끌어 놓기에서 빠져도 앱은 정상 동작해요.

### 방법 B. 명령어로 (git을 쓰는 경우)

```bash
cd family-dashboard
git init -b main
git add .
git commit -m "우리 가족 대시보드"
git remote add origin https://github.com/<내아이디>/family-dashboard.git
git push -u origin main
```

GitHub CLI가 있다면 `gh repo create family-dashboard --public --source=. --push`로 한 번에 만들 수 있어요. 그다음 위 5~7번처럼 Pages를 켜 주세요.

---

## 2단계 · Firebase 설정 (무료 Spark 플랜)

### ① 프로젝트 만들기
1. [console.firebase.google.com](https://console.firebase.google.com)에 구글 계정으로 들어갑니다.
2. **프로젝트 만들기(프로젝트 추가)** → 이름(예: `our-family-dashboard`) 입력 → 계속.
3. Google 애널리틱스는 **사용 안 함**으로 두어도 돼요 → **프로젝트 만들기**.
   결제 정보를 넣지 않으면 자동으로 무료(Spark) 플랜이에요.

### ② Realtime Database 만들기
1. 왼쪽 메뉴 **빌드(Build) → Realtime Database** → **데이터베이스 만들기**.
2. 위치는 **싱가포르(asia-southeast1)** 처럼 가까운 곳을 고릅니다.
3. 보안 규칙은 **잠금 모드로 시작**을 고르고 **사용 설정**.
4. 위쪽 **규칙(Rules)** 탭을 열고, 내용을 모두 지운 뒤 이 저장소의 `database.rules.json` 내용을 붙여 넣고 **게시**를 누릅니다.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "families": {
      "$familyId": {
        ".read": "auth != null && $familyId.length >= 8",
        ".write": "auth != null && $familyId.length >= 8"
      }
    }
  }
}
```

### ③ 익명 로그인 켜기
1. 왼쪽 메뉴 **빌드 → Authentication** → **시작하기**.
2. **로그인 방법(Sign-in method)** 탭 → **익명(Anonymous)** → **사용 설정** → 저장.
   (가족이 따로 회원가입하지 않아도, 앱이 자동으로 익명 로그인해서 데이터에 접근해요.)
3. 같은 Authentication의 **설정 → 승인된 도메인**에 `<내아이디>.github.io`를 추가해 두세요.

### ④ 웹 앱 등록하고 config 값 복사하기
1. 왼쪽 위 **톱니바퀴 → 프로젝트 설정**.
2. 아래쪽 **내 앱**에서 **웹 아이콘 `</>`** 를 누릅니다.
3. 앱 닉네임(예: `family-web`)을 적고 **앱 등록**. (Firebase 호스팅은 체크하지 않아도 돼요.)
4. 화면에 나온 `const firebaseConfig = { ... }` 안의 값을 복사합니다.

### ⑤ config 값을 앱에 넣기
1. GitHub 저장소에서 `js/firebase-config.js` 파일을 열고 연필(✏️) 아이콘을 누릅니다.
2. 비어 있는 값들을 복사한 값으로 바꿉니다. 예:

```js
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "our-family-dashboard.firebaseapp.com",
  databaseURL: "https://our-family-dashboard-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "our-family-dashboard",
  storageBucket: "our-family-dashboard.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
```

> ⚠️ **`databaseURL`이 꼭 있어야 해요.** 복사한 값에 없으면 Realtime Database 화면 맨 위의 주소(`https://...firebasedatabase.app`)를 그대로 넣어 주세요.

3. **Commit changes**를 누르면 1~2분 뒤 사이트에 반영돼요.

---

## 3단계 · 가족 기기 연결하기

1. **첫 기기**(예: 엄마 폰)에서 사이트를 엽니다. '처음 설정' 창에 **가족 코드**가 자동으로 만들어져 있어요.
   이 코드를 메모해 두고, 이 기기를 쓰는 사람(엄마)을 고른 뒤 **시작하기**.
2. **아빠 폰, 거실 태블릿**에서도 사이트를 열고 **같은 가족 코드**를 입력합니다. 기기 주인을 고르세요.
   - 거실 태블릿은 '거실 태블릿'으로 고르면 새 메모를 자동으로 읽어줘요.
3. 오른쪽 위 배지가 **🟢 실시간 동기화**로 바뀌면 연결 끝!
4. 처음 **부모 PIN은 `0000`** 이에요. 부모 모드로 바꾼 뒤 **⚙️ 설정 → 새 부모 PIN**에서 꼭 바꿔 주세요.

> 가족 코드는 우리 가족 데이터의 '열쇠'예요. 가족끼리만 공유하세요. 코드를 바꾸면 새 빈 대시보드가 만들어져요.

---

## (선택) 구글 캘린더 연결

D-Day 카드에 구글 캘린더의 **이번 달 일정**(예: 29일 공연 예매)을 함께 보여줘요.
부모 한 명이 부모 모드에서 **📆 구글 캘린더 가져오기**를 누르면 이번 달·다음 달 일정을 읽어 와 가족 데이터에 저장하고, 모든 기기(거실 태블릿·아이 화면 포함)에 보여요. 권한은 **읽기 전용**이에요.

1. [console.cloud.google.com](https://console.cloud.google.com)에서 위쪽 프로젝트 선택을 **Firebase 프로젝트와 같은 프로젝트**로 바꿉니다.
2. **API 및 서비스 → 라이브러리** → `Google Calendar API` 검색 → **사용**.
3. **Google 인증 플랫폼(OAuth 동의 화면)** → **시작하기**
   - 앱 이름: `우리 가족 대시보드`, 지원 이메일: 내 이메일
   - 대상: **외부**(개인 Gmail 캘린더도 쓰려면) → 연락처 이메일 → 동의 → 만들기
   - **대상(Audience) → 테스트 사용자 → 사용자 추가**에 캘린더를 가져올 엄마·아빠 구글 계정을 넣습니다.
4. **클라이언트 → 클라이언트 만들기**
   - 애플리케이션 유형: **웹 애플리케이션**
   - **승인된 JavaScript 원본**: `https://mong-arch.github.io`
   - 만들기 → 나오는 **클라이언트 ID**(`…apps.googleusercontent.com`)를 복사합니다.
5. `js/google-config.js`의 `GOOGLE_CLIENT_ID = ""` 따옴표 안에 붙여 넣고 저장(커밋)합니다.
6. 사이트에서 부모 모드 → D-Day 카드 아래 **📆 구글 캘린더 가져오기** → 구글 로그인 → 가져올 캘린더 선택.
   - "Google에서 확인하지 않은 앱" 경고가 나오면 **고급 → (안전하지 않음)으로 이동**을 눌러요. 우리 가족만 쓰는 테스트 앱이라 나오는 안내예요.
   - 회사 일정이 섞인 캘린더는 빼거나, **제목에 특정 단어가 들어간 일정만** 가져오기(예: `공연, 예매, 가족`)를 고르세요.
7. 일정이 바뀌면 **다시 가져오기**를 눌러 주세요. (자동으로 계속 동기화되지는 않아요)

---

## 4단계 · 홈 화면에 추가하기 (앱처럼 쓰기)

- **아이폰/아이패드 (Safari)**: 공유 버튼(□↑) → **홈 화면에 추가**
- **안드로이드 폰/태블릿 (Chrome)**: 오른쪽 위 ⋮ → **홈 화면에 추가** 또는 **앱 설치**
- 거실 태블릿은 화면 꺼짐 시간을 길게 해 두면 대시보드처럼 쓰기 좋아요.

---

## 알아 두면 좋은 점

- **음성 입력**: 안드로이드 크롬·PC 크롬에서 가장 잘 돼요. 아이폰 Safari는 iOS 버전에 따라 안 될 수 있어요. 처음 누를 때 마이크 권한을 허용해 주세요.
- **읽어주기(TTS)**: 브라우저 정책상, 기기에서 화면을 한 번 이상 터치한 뒤부터 자동 읽기가 돼요.
- **등원 준비 도우미**: 부모 모드 ⚙️ 설정 → 🌅 등원 준비 도우미 설정에서 켜고 시간·요일·할 일을 정해요. 그 시간이 되면 아이 모드인 기기와 '거실 태블릿'·'아이'로 설정한 기기에서 화면 전체가 도우미로 바뀌어요(부모 모드인 엄마·아빠 폰은 그대로). 다 끝내거나 출발 시간이 지나면 닫을 수 있고, 급할 땐 🔒 버튼과 부모 PIN으로 닫아요.
- **날씨**: [Open-Meteo](https://open-meteo.com) 무료 날씨·대기질 정보를 써요(가정용·비상업 용도 무료, 키 필요 없음). 부모 모드에서 날씨 카드의 '지역 바꾸기'로 동네를 정해요. 내일 비 올 확률이 50% 이상이면 준비물에 우산이, 오늘 미세먼지가 나쁨이면 마스크가 자동으로 들어가요.
- **멜론/유튜브 뮤직 버튼**: 검색 결과 페이지를 열어요. 휴대폰에 앱이 깔려 있으면 앱으로 넘어가기도 하고, 브라우저에서 '앱에서 열기'를 고를 수도 있어요.
- **음력 생신**: 매년 양력 날짜가 바뀌므로 '매년 반복'을 끄고 그해 양력 날짜로 넣어 주세요.
- **무료 플랜 한도**: Spark 플랜은 저장 1GB, 동시 접속 100개 수준이라 가족이 쓰기에는 넉넉해요. (정확한 한도는 Firebase 요금제 페이지를 확인하세요.)
- **보안**: 웹 config 값은 원래 공개되는 값이에요. 데이터는 '익명 로그인 + 가족 코드 + 보안 규칙'으로 보호돼요. 부모 PIN은 아이가 실수로 바꾸지 않게 하는 잠금 장치라서, 은행 비밀번호 수준의 보안은 아니에요.
- **수정 후 배포**: 파일을 고쳤는데 기기에 예전 화면이 보이면 `sw.js` 맨 위의 `VERSION`을 `v2`, `v3`…으로 올려서 다시 올려 주세요.

## 내 컴퓨터에서 먼저 열어 보기

```bash
cd family-dashboard
python3 -m http.server 8080
# 브라우저에서 http://localhost:8080 열기
```

`index.html`을 더블클릭해서 열면 일부 기능(모듈, 서비스 워커)이 동작하지 않으니 위처럼 열어 주세요.

## 파일 구성

```
index.html              화면 뼈대
css/style.css           파스텔 디자인, 반응형
js/app.js               기능 전체(화면 그리기, 버튼 동작)
js/store.js             Firebase 실시간 동기화 / 데모 모드 저장
js/firebase-config.js   ← Firebase 값을 넣는 곳
js/seed.js              처음 실행 시 예시 데이터
js/speech.js            음성 입력·읽어주기
manifest.webmanifest    PWA 설정
sw.js                   오프라인 캐시(서비스 워커)
icons/                  앱 아이콘
database.rules.json     Firebase 보안 규칙
```

## 데이터 구조 (참고)

```
families/{가족코드}/
  settings      아이 이름, 부모 PIN(해시)
  academies     학원: 이름, 요일, 시간, 등·하원 담당, 학원비
  routines      매일 루틴
  worksheets    학습지: 단계, 진도, 하루 분량
  daily/{날짜}  그날 체크한 루틴·학습지
  starsLog      별 적립(+)·사용(−) 기록
  rewards       보상 상점
  events        가족 행사(D-Day)
  meals/{날짜}  저녁 메뉴
  weekend/{토요일 날짜}  주말 계획
  mailbox       가족 우체통 메모
  status        엄마·아빠 현재 상태
  music/favorites  즐겨찾기 노래
```
