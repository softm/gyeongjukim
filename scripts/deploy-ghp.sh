#!/usr/bin/env bash
# Run deliberately: creates a public sample-only repository and deploys its app.
set -euo pipefail

repository='softm/gyeongjukim'
repository_url="https://github.com/${repository}.git"
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
export GH_HOST=github.com

die() { printf '중단: %s\n' "$*" >&2; exit 1; }
note() { printf '%s\n' "$*"; }
git_authenticated() {
  git -c credential.helper= -c 'credential.https://github.com.helper=!gh auth git-credential' "$@"
}
allowed_source() {
  case "$1" in
    README.md|package.json|manifest.webmanifest|index.html|.gitignore|assets/*|docs/*|scripts/*|tests/*|.github/*) return 0 ;;
    *) return 1 ;;
  esac
}
allowed_remote() {
  case "$1" in
    "${repository_url}"|"https://github.com/${repository}"|"git@github.com:${repository}.git"|"git@github.com:${repository}"|"ssh://git@github.com/${repository}.git") return 0 ;;
    *) return 1 ;;
  esac
}

for required in gh git node npm; do
  command -v "$required" >/dev/null 2>&1 || die "${required} 설치가 필요합니다. README의 배포 준비를 확인해 주세요."
done
account_login="$(gh api user --jq '.login' 2>/dev/null)" || die 'GitHub 인증이 필요합니다. gh auth login --hostname github.com 을 실행해 주세요.'
[[ "$account_login" == 'softm' ]] || die 'GitHub의 활성 계정이 softm이 아닙니다. gh auth switch --hostname github.com --user softm 으로 확인해 주세요.'
cd -- "$project_dir"
node -e 'if(Number(process.versions.node.split(".")[0]) < 22) process.exit(1)' || die 'Node.js 22 이상이 필요합니다. Node.js 24를 권장합니다.'
node --input-type=module -e 'import {readFileSync} from "node:fs"; if(JSON.parse(readFileSync("package.json", "utf8")).name !== "gyeongjukim") process.exit(1)' || die '이 프로젝트의 package.json을 확인할 수 없습니다.'

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  [[ "$(git rev-parse --show-toplevel)" == "$project_dir" ]] || die '상위의 다른 Git 저장소 안에 있습니다. 이 프로젝트를 독립된 폴더로 옮겨 실행해 주세요.'
else
  git init -b main >/dev/null
fi
[[ "$(git symbolic-ref --quiet --short HEAD)" == 'main' ]] || die 'main 브랜치에서 실행해 주세요. 브랜치나 기존 작업을 자동 변경하지 않습니다.'
while IFS= read -r remote_name; do
  [[ -n "$remote_name" ]] || continue
  while IFS= read -r remote_url; do
    allowed_remote "$remote_url" || die '다른 저장소를 가리키는 Git 원격 설정이 있습니다. 기존 설정을 직접 확인해 주세요.'
  done < <(git remote get-url --all "$remote_name"; git remote get-url --push --all "$remote_name")
done < <(git remote)
while IFS= read -r -d '' tracked_path; do
  allowed_source "$tracked_path" || die '허용된 앱 소스 외의 파일이 이미 추적·스테이징되어 있습니다. 기존 Git 작업을 직접 확인해 주세요.'
done < <(git ls-files -z)

note '1/5 앱 검사와 빌드를 실행합니다.'
npm run check
npm test
npm run build

deploy_temp="$(mktemp -d "${TMPDIR:-/tmp}/gyeongju-kim-deploy.XXXXXX")"
trap 'rm -rf -- "$deploy_temp"' EXIT
note '2/5 저장소와 기존 main 이력을 확인합니다.'
if gh api "repos/${repository}" --jq '.private' >"${deploy_temp}/private" 2>"${deploy_temp}/api-error"; then
  [[ "$(cat "${deploy_temp}/private")" == 'false' ]] || die '기존 저장소가 비공개입니다. 이 공개 시연 배포 스크립트로 공개 범위를 변경하지 않습니다.'
else
  api_error="$(cat "${deploy_temp}/api-error")"
  [[ "$api_error" == *'HTTP 404'* ]] || die '저장소 조회에 실패했습니다. GitHub 연결과 저장소 관리 권한을 확인해 주세요.'
  gh repo create "$repository" --public --description '경주김씨 종친회 통합 앱 · 가상 자료를 이용한 공개 시연' >/dev/null || die '저장소 생성에 실패했습니다. softm 계정의 저장소 생성 권한을 확인해 주세요.'
fi
remote_refs="$(git_authenticated ls-remote "$repository_url")" || die '원격 이력을 읽지 못했습니다. GitHub 인증과 연결을 확인해 주세요.'
remote_main=''
while IFS=$'\t' read -r remote_sha remote_ref; do
  [[ "$remote_ref" != 'refs/heads/main' ]] || remote_main="$remote_sha"
done <<< "$remote_refs"
if [[ -n "$remote_refs" ]]; then
  [[ -n "$remote_main" ]] || die '원격에 main 이외의 기존 이력이 있습니다. 기존 저장소를 복제해 수동으로 통합한 뒤 실행해 주세요.'
  git rev-parse --verify HEAD >/dev/null 2>&1 || die '원격 저장소에 기존 커밋이 있습니다. 저장소를 복제하고 이 앱 파일을 통합한 뒤 실행해 주세요.'
  git_authenticated fetch --no-tags "$repository_url" refs/heads/main >/dev/null || die '원격 main을 가져오지 못했습니다.'
  git merge-base --is-ancestor FETCH_HEAD HEAD || die '원격 main의 변경이 로컬 이력에 포함되지 않았습니다. 먼저 기존 변경을 통합해 주세요. 강제 푸시하지 않습니다.'
fi
if ! git remote get-url origin >/dev/null 2>&1; then git remote add origin "$repository_url"; fi
if ! git config user.name >/dev/null 2>&1; then git config --local user.name softm; fi
if ! git config user.email >/dev/null 2>&1; then
  account_id="$(gh api user --jq '.id')" || die '커밋 작성자 설정에 필요한 계정 ID를 확인하지 못했습니다.'
  [[ "$account_id" =~ ^[0-9]+$ ]] || die 'GitHub 계정 ID가 올바르지 않습니다.'
  git config --local user.email "${account_id}+softm@users.noreply.github.com"
fi

note '3/5 공개 앱 소스만 커밋하고 main으로 푸시합니다.'
git add -- README.md docs scripts tests .github package.json manifest.webmanifest index.html assets .gitignore
while IFS= read -r -d '' staged_path; do
  allowed_source "$staged_path" || die '배포 대상이 아닌 스테이징 파일이 있습니다. Git 인덱스를 확인해 주세요.'
done < <(git diff --cached --name-only -z)
if ! git diff --cached --quiet; then git commit -m 'Implement Gyeongju Kim clan community app'; fi
local_sha="$(git rev-parse HEAD)"
latest_run() {
  gh run list --repo "github.com/${repository}" --workflow pages.yml --event workflow_dispatch --branch main --commit "$local_sha" --limit 1 --json databaseId --jq '.[0].databaseId // empty' 2>/dev/null || true
}
previous_run="$(latest_run)"
git_authenticated push "$repository_url" main:main || die '푸시에 실패했습니다. 원격 변경·브랜치 보호·workflow 쓰기 권한을 확인해 주세요.'
note '4/5 Pages 배포 소스를 GitHub Actions로 설정합니다.'
if pages_type="$(gh api "repos/${repository}/pages" --jq '.build_type' 2>"${deploy_temp}/api-error")"; then
  if [[ "$pages_type" != 'workflow' ]]; then
    gh api --method PUT "repos/${repository}/pages" -f build_type=workflow >/dev/null || die '기존 Pages 소스를 Actions로 변경하지 못했습니다. Pages 관리 권한을 확인해 주세요.'
  fi
else
  api_error="$(cat "${deploy_temp}/api-error")"
  [[ "$api_error" == *'HTTP 404'* ]] || die 'Pages 상태 조회에 실패했습니다. Pages 읽기 권한을 확인해 주세요.'
  gh api --method POST "repos/${repository}/pages" -f build_type=workflow >/dev/null || die 'Pages 생성에 실패했습니다. 저장소의 Pages·Administration 권한 및 Pages 사용 가능 여부를 확인해 주세요.'
fi

# Dispatch after Pages is enabled, including the first push to an empty repository.
# The push event uses the same workflow; watch this explicit dispatch for a definite result.
gh workflow run pages.yml --repo "github.com/${repository}" --ref main || die '배포 워크플로를 실행하지 못했습니다. Actions 권한을 확인해 주세요.'

note '5/5 방금 올린 커밋의 배포를 확인합니다. 최대 10분 동안 기다립니다.'
run_id=''
for ((attempt = 0; attempt < 12; attempt++)); do
  candidate="$(latest_run)"
  if [[ -n "$candidate" && "$candidate" != "$previous_run" ]]; then run_id="$candidate"; break; fi
  sleep 5
done
[[ -n "$run_id" ]] || die '배포 실행을 아직 확인하지 못했습니다. GitHub Actions에서 pages.yml의 실행 상태를 확인해 주세요.'
if ! node --input-type=module - "$run_id" "$repository" <<'NODE'
import { spawnSync } from 'node:child_process';
const result = spawnSync('gh', ['run', 'watch', process.argv[2], '--repo', `github.com/${process.argv[3]}`, '--exit-status', '--interval', '5'], { stdio: 'inherit', timeout: 600000 });
if (result.error?.code === 'ETIMEDOUT') console.error('배포 완료 확인의 10분 제한에 도달했습니다. 원격 워크플로는 취소하지 않았습니다.');
process.exit(result.status ?? 1);
NODE
then
  die '배포 성공을 확인하지 못했습니다. GitHub Actions의 실패 단계·환경 승인·인증 권한을 확인해 주세요.'
fi
site_url="$(gh api "repos/${repository}/pages" --jq '.html_url')" || die '실제 Pages 주소를 조회하지 못했습니다.'
[[ "$site_url" == https://* ]] || die 'Pages에서 유효한 HTTPS 주소가 반환되지 않았습니다.'
if command -v curl >/dev/null 2>&1; then
  curl --fail --silent --show-error --location --max-time 30 --retry 3 --output /dev/null "$site_url" || die '워크플로는 성공했지만 사이트의 정상 HTTP 응답은 아직 확인하지 못했습니다. 잠시 후 다시 실행해 주세요.'
else
  node --input-type=module - "$site_url" <<'NODE'
try {
  const response = await fetch(process.argv[2], { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  await response.body?.cancel();
} catch { console.error('사이트의 정상 HTTP 응답을 확인하지 못했습니다. 잠시 후 다시 실행해 주세요.'); process.exit(1); }
NODE
fi
printf '\n배포와 HTTP 응답 확인 완료\n%s\n' "$site_url"
