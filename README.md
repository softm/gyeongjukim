# 경주김씨 종친회

족보와 가족 관계를 찾아보고, 종친회 소식과 행사에 참여하며, 세대가 함께 기록을 이어가는 모바일·웹 통합 서비스입니다.

현재 저장소는 **가상 자료로 주요 이용 흐름을 실행하는 GitHub Pages용 웹앱**입니다. 족보 검색과 화면 탐색은 정적 예시 자료를 사용하며, 행사 참석 여부와 사용자가 작성한 내용 등은 현재 브라우저에 저장합니다. 실제 종친회 데이터베이스와 연결되어 있지 않습니다.

**배포 대상 저장소는 [softm/gyeongjukim](https://github.com/softm/gyeongjukim)입니다.** 최신 게시 상태와 접속 주소는 [GitHub Actions 배포 결과](https://github.com/softm/gyeongjukim/actions/workflows/pages.yml)에서 확인합니다. 단일 HTML 미리보기는 `node scripts/export-preview.mjs preview.html`로 생성할 수 있습니다.

## 바로가기

| 용도 | 링크 |
| --- | --- |
| 이름이 입력된 저장소 생성 화면 | [gyeongjukim 생성](https://github.com/new?owner=softm&name=gyeongjukim&description=Gyeongju+Kim+Clan+community+web+app) |
| 저장소 | [softm/gyeongjukim](https://github.com/softm/gyeongjukim) |
| 기본 Pages 주소·배포 성공 후 접속 | [경주김씨 종친회](https://softm.github.io/gyeongjukim/) |
| Pages 배포 소스 설정 | [Settings → Pages](https://github.com/softm/gyeongjukim/settings/pages) |
| 배포 실행·오류 확인 | [GitHub Actions](https://github.com/softm/gyeongjukim/actions/workflows/pages.yml) |
| 제품 범위와 지표 | [제품 명세](docs/PRODUCT.md) |
| 실회원 운영을 위한 확장 | [백엔드 연동 설계](docs/BACKEND.md) |

## 구현 범위

| 기능 | 현재 버전의 동작 | 실제 운영에 필요한 확장 |
| --- | --- | --- |
| 홈·공지 | 예시 공지와 행사 탐색, 상세 내용 확인 | 승인된 운영자의 게시·수정·배포 |
| 족보 찾기 | 가상 인물 검색, 계보·관계 탐색 | 원본 검증, 실회원 접근 권한, 비공개 검색 API |
| 행사 | 예시 행사 조회, 현재 브라우저에서 참석 여부 저장 | 회원별 중복 방지, 정원·마감 관리, 참석자 공동 집계 |
| 종친 소통 | 예시 글 탐색, 작성 내용의 브라우저 저장 | 공동 게시판, 신고·관리, 파일 업로드 |
| 역사·문화 | 서비스 이용과 계보 이해를 돕는 예시 콘텐츠 | 자료 출처·이용권 확인, 자료 담당자의 검수 |
| 보기 설정 | 큰 글씨, 모바일·넓은 화면에 맞는 배치 | 실제 고령 사용자 이용 검증 |
| 회원 인증·승인 | 서버 기능 미연동 | 휴대전화 인증, 가입 심사, 세션·권한 검증 |
| 알림 | 현재 화면의 피드백과 일정 이용 흐름 | 문자·푸시 발송, 수신 동의·예약·실패 재처리 |
| 회원별 정보 보호 | 공개 가능한 가상 자료만 사용 | 서버에서 검증하는 역할·분파·항목별 공개 범위 |

**화면에서 역할을 선택하거나 메뉴를 숨기는 방식은 접근 제어가 아닙니다.** 현재 화면의 회원·운영 역할은 이용 흐름을 설명하는 데모이며, 인증된 계정이나 운영 권한을 만들지 않습니다.

GitHub Pages는 정적 HTML·CSS·JavaScript를 제공하는 호스팅입니다. 공개 Pages로 전달되는 파일은 누구나 내려받을 수 있습니다. 이름·연락처·생년월일·가족 관계 등 실회원 자료와 비밀키를 `assets/`, HTML, JavaScript, 공개 저장소에 넣지 마세요. 비공개 저장소를 사용한다고 Pages 접근까지 자동으로 비공개가 되는 것도 아닙니다. [GitHub 공식 설명](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [공개 범위와 배포 소스 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 사용해 보기

1. ZIP을 풀고 `preview.html`을 브라우저에서 엽니다. 이 파일은 서버 없이 화면을 확인하는 단일 파일 미리보기입니다. 배포가 완료된 뒤에는 웹 주소를 이용합니다.
2. 족보 메뉴에서 예시 인물을 검색하고 선택하여 가족 관계를 살펴봅니다. 검색에 쓰이는 인물은 실제 족보가 아닙니다.
3. 행사 상세에서 참석 여부를 선택한 뒤 새로고침하여 저장 상태를 확인합니다.
4. 소통 메뉴에서 시험용 글을 작성합니다. 다른 기기나 다른 종친에게 전달되지 않습니다.
5. 큰 글씨 설정을 켜고 같은 공지와 행사를 읽어 봅니다.

브라우저 저장 내용은 같은 사이트 주소·같은 브라우저에서만 유지됩니다. 브라우저의 사이트 데이터를 지우거나 비공개 창을 닫으면 사라질 수 있으며, 다른 기기로 자동 동기화되지 않습니다. 공용 기기에는 실제 개인정보를 입력하지 마세요.

## 로컬 실행

개발·배포에는 **Node.js 24를 권장**합니다(Node.js 22 이상 지원). 외부 npm 패키지가 없어 설치 단계 없이 검사와 빌드를 실행할 수 있습니다. 개발 서버도 Node.js로 실행하므로 Python이 필요하지 않습니다. GitHub Actions는 Node.js 24를 사용합니다.

```bash
cd gyeongjukim
npm run check
npm test
npm run build
npm run dev
```

다운로드한 ZIP을 푼 폴더에서 위 명령을 실행한 뒤 [로컬 미리보기](http://localhost:4173/)를 엽니다. [실제 Pages 프로젝트 경로로 확인](http://localhost:4173/gyeongjukim/)도 가능합니다. `npm run dev`는 `scripts/serve.mjs`로 `dist/`를 제공하므로 소스를 바꾸면 `npm run build`를 다시 실행합니다. 배포된 서비스를 이용하는 종친은 개발 서버를 실행할 필요가 없습니다.

소스의 `index.html`은 ES 모듈을 사용하므로 HTTP 주소로 확인합니다. 서버 없이 파일을 바로 열어 보는 용도는 ZIP의 `preview.html`을 사용하세요. 이 미리보기 파일의 브라우저 저장 동작은 브라우저의 로컬 파일 정책에 따라 제한될 수 있습니다.

| 명령 | 확인 내용 |
| --- | --- |
| `npm run check` | JavaScript 구문, 로컬 자원 참조, 프로젝트 상대 경로, 모바일 문서·manifest 설정 |
| `npm test` | `tests/domain.test.js`에 정의된 계보·행사 등 도메인 로직 |
| `npm run build` | 공개할 정적 파일만 `dist/`로 구성 |
| `npm run dev` | 빌드한 `dist/`를 Node.js 개발 서버로 제공 |
| `bash scripts/deploy-ghp.sh` | 계정·이력 확인 후 저장소 생성, 소스 푸시, Pages 설정, 배포·HTTP 응답 확인 |

검사 명령이 존재한다는 사실과 실제 서비스 전체를 검증했다는 것은 다릅니다. 브라우저 상호작용, 접근성, 운영 데이터·서버 연동, 외부 배포의 결과는 해당 환경에서 따로 확인해야 합니다.

## GitHub Pages 배포

### 스크립트로 생성·배포

필요한 도구는 [Git](https://git-scm.com/downloads), [Node.js 24](https://nodejs.org/en/download), [GitHub CLI](https://cli.github.com/)입니다. `gh`에 `softm` 계정으로 로그인한 뒤 프로젝트 폴더에서 실행합니다. 이 명령을 실행하면 공개 저장소 생성·커밋·푸시·Pages 설정 변경이 실제로 이루어집니다.

```bash
gh auth login --hostname github.com --git-protocol https
gh api user --jq .login
bash scripts/deploy-ghp.sh
```

이미 로그인되어 있다면 로그인 단계를 반복할 필요가 없습니다. 계정 확인 결과는 `softm`이어야 합니다. 다른 계정이 활성화되어 있으면 `gh auth switch --hostname github.com --user softm`으로 전환합니다. 토큰을 채팅·소스·스크립트에 붙여 넣지 않고 GitHub CLI의 인증을 사용합니다.

| 자동 처리 | 동작 |
| --- | --- |
| 계정 확인 | 실제 GitHub API 응답의 로그인 이름이 `softm`인지 확인 |
| 소스 검사 | `npm run check`, `npm test`, `npm run build` 성공 후 진행 |
| 저장소 생성 | 없으면 `softm/gyeongjukim` 공개 저장소 생성; 기존 비공개 저장소의 공개 범위는 변경하지 않음 |
| 이력 보호 | 다른 원격 저장소, 다른 브랜치, 원격의 변경을 포함하지 않은 로컬 이력은 중단 |
| Pages 설정 | 소스를 푸시한 뒤 배포 소스를 GitHub Actions로 지정하고 워크플로 실행 |
| 소스 푸시 | 명시한 앱 소스만 스테이징하고 변경이 있을 때 한 번 커밋; 강제 푸시·자동 초기화 없음 |
| 결과 확인 | 해당 커밋의 Pages 워크플로 성공과 사이트 HTTP 응답을 확인한 뒤 실제 주소 출력 |

이 스크립트의 기본 대상은 **새 저장소 또는 커밋이 없는 빈 저장소**입니다. 웹에서 저장소를 먼저 만든다면 README·라이선스 등의 초기 파일을 추가하지 마세요. 이미 파일이 있는 저장소는 직접 복제하고 변경을 통합한 뒤 사용합니다. 복잡한 기존 이력을 자동으로 합치거나 덮어쓰지 않습니다.

커밋 작성자 설정이 없을 때만 해당 저장소의 로컬 설정에 `softm`과 GitHub의 noreply 주소를 지정합니다. 전역 Git 설정은 변경하지 않습니다. `preview.html`·`dist/`·임시 파일은 스테이징 대상에 넣지 않습니다.

Pages API를 사용하려면 저장소의 Pages·Administration 관리 권한이 필요하며, 소스·워크플로 푸시와 Actions 실행 권한도 있어야 합니다. 일반적인 `gh auth login`으로 계정을 연결하는 방식을 권장합니다. `gh run watch`는 현재 세분화된 PAT 인증을 지원하지 않으므로, 해당 토큰을 사용하는 환경에서는 워크플로가 실행되더라도 자동 완료 확인이 중단될 수 있습니다. [Pages API 권한](https://docs.github.com/en/rest/pages/pages#create-a-github-pages-site), [실행 확인 명령의 인증 안내](https://cli.github.com/manual/gh_run_watch)

### GitHub 화면에서 직접 설정

1. [gyeongjukim 생성 화면](https://github.com/new?owner=softm&name=gyeongjukim&description=Gyeongju+Kim+Clan+community+web+app)에서 소유자 `softm`, 이름 `gyeongjukim`을 확인합니다. 가상 자료와 공개 앱 소스만 넣는 저장소입니다.
2. 이 프로젝트 파일을 저장소의 `main` 브랜치에 올립니다. 파일을 웹에서 올리는 경우 숨겨진 `.github/workflows/pages.yml`도 포함해야 합니다.
3. [Settings → Pages](https://github.com/softm/gyeongjukim/settings/pages)에서 **Build and deployment → Source → GitHub Actions**를 선택합니다.
4. [배포 워크플로](https://github.com/softm/gyeongjukim/actions/workflows/pages.yml)에서 **Run workflow → main**을 실행합니다. 이후 `main`에 푸시하면 같은 워크플로가 자동 실행됩니다.
5. `build`와 `deploy`가 모두 성공하면 배포 결과에 표시된 URL을 엽니다. 기본 프로젝트 주소는 `https://softm.github.io/gyeongjukim/`입니다. 계정에 사용자 도메인이 연결된 경우 실제 결과 주소를 우선합니다.

배포는 `.github/workflows/pages.yml` 한 개로 관리합니다. 별도의 `gh-pages` 브랜치 푸시, 루트 폴더 배포, 추가 예약 배포를 함께 켜지 않습니다. 워크플로는 정적 검사 → 도메인 테스트 → `dist/` 빌드 → Pages 아티팩트 업로드 → 배포 순서로 진행합니다. 빌드가 실패하면 배포 작업을 실행하지 않습니다.

`dist/`에는 `index.html`, `assets/`, `manifest.webmanifest`, `.nojekyll`만 들어갑니다. 소스의 `docs/`, `tests/`, `scripts/`는 사이트에 복사하지 않습니다. **`assets/`에 들어간 모든 자료는 배포 대상**이므로 원본 족보나 실회원 내보내기 파일은 이 경로에 저장하지 않습니다.

### 문제 해결

| 증상 | 확인·조치 |
| --- | --- |
| 최초 배포에서 Pages를 찾을 수 없다는 오류 | Settings → Pages의 Source를 GitHub Actions로 지정한 뒤 다시 실행 |
| 주소가 404 | Actions의 `deploy` 성공 여부와 결과 URL 확인, 프로젝트명·끝의 `/` 확인 |
| 화면은 열리지만 스타일이나 스크립트가 404 | 자원 경로를 `./assets/...` 같은 상대 경로로 유지하고 `npm run check` 실행 |
| `Resource not accessible by integration` | 저장소의 Actions 사용 정책, Pages 허용 여부, 워크플로 권한과 `github-pages` 환경 규칙 확인 |
| 예전 화면이 표시됨 | 가장 최근 배포 커밋과 실행 결과 확인 후 새로고침 |
| 다른 기기에서 참석·작성 글이 안 보임 | 현재 버전은 브라우저별 저장이며 서버 동기화가 구현되지 않은 상태 |

## 코드 구성

| 경로 | 역할 |
| --- | --- |
| `index.html` | 화면 진입점과 문서 메타데이터 |
| `assets/app.js` | 화면 렌더링·입력·브라우저 저장 |
| `assets/domain.js` | 화면과 분리된 검색·관계·일정 처리 |
| `assets/data.js` | 가상 인물·행사·공지 등 예시 자료 |
| `assets/style.css` | 반응형 배치와 큰 글씨 |
| `assets/icons.js` | 화면 아이콘 |
| `manifest.webmanifest` | 웹앱 이름·진입 주소·아이콘 |
| `tests/domain.test.js` | 도메인 로직의 회귀 검사 |
| `scripts/` | 의존성 없는 검사·정적 빌드 |
| `scripts/serve.mjs` | Node.js 로컬 미리보기 서버 |
| `scripts/deploy-ghp.sh` | `softm` 계정 전용 저장소 생성·Pages 배포 스크립트 |
| `.github/workflows/pages.yml` | 단일 Pages 배포 경로 |

## 운영 버전으로 발전시키기

실제 종친 인증, 승인 회원 디렉터리, 비공개 족보, 여러 사람이 함께 사용하는 게시판·행사는 별도 API와 데이터베이스를 붙여야 합니다. [백엔드 연동 설계](docs/BACKEND.md)에 서버 권한, 관계 데이터의 변경 이력, 수정 요청·이견 처리, 삭제 및 알림 처리 요구사항을 정리했습니다. 가상 자료를 실명 자료로 바꾸는 작업보다 인증·권한·자료 검수 절차를 먼저 구현합니다.

## 공식 배포 참고 자료

- [GitHub Pages의 정적 호스팅과 프로젝트 URL](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Pages 배포 소스를 GitHub Actions로 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [사용자 정의 Pages 워크플로와 권한](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [configure-pages 공식 릴리스](https://github.com/actions/configure-pages/releases)
- [upload-pages-artifact 공식 릴리스](https://github.com/actions/upload-pages-artifact/releases)
- [deploy-pages 공식 릴리스](https://github.com/actions/deploy-pages/releases)

Actions 버전은 2026-10-19 확인한 공식 저장소를 기준으로 구성했습니다.
