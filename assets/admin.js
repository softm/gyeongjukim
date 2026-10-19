import { demoProfile } from './data.js';
import { formatKoreanDate, safeText } from './domain.js';

const sourceStatus = '내 브라우저 시연 자료';
const applicants = [
  { id: 'demo-member-01', name: '시연 종친 가', branch: '시연 가문 A', note: '실제 신청자가 아닌 가입 심사 연습용 자료입니다.' },
  { id: 'demo-member-02', name: '시연 종친 나', branch: '시연 가문 B', note: '실제 계정이나 종친 인증과 연결되지 않는 가상 자료입니다.' },
];
const tabs = { notices: '공지 관리', events: '행사 관리', approvals: '회원 승인 체험', corrections: '족보 수정 요청' };
const today = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const newId = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) > 0 && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const validTime = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

export function createAdmin(ctx) {
  const { db, people, events, notices, icon, esc, paragraphs, button, showModal, closeModal, toast, refresh, persist } = ctx;
  let activeTab = 'notices';
  let resetRequested = false;
  const list = value => Array.isArray(value) ? value : [];
  const merged = (base, added) => [...new Map([...list(base), ...list(added)].map(item => [item.id, item])).values()];
  const allEvents = () => merged(events, db.customEvents);
  const allNotices = () => merged(notices, db.customNotices).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const empty = (title, text) => `<div class="empty-state">${icon('list')}<h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
  const callout = () => `<div class="info-callout">${icon('info')}<div><strong>운영 화면 체험 · 이 브라우저의 시연 자료만 변경</strong>실제 회원 승인, 다른 종친에게 공개, 문자 발송은 연결되어 있지 않습니다.</div></div>`;
  const heading = (title, text) => `<div class="page-heading"><div><p class="eyebrow">OUR COMMUNITY</p><h1>${esc(title)}</h1><p class="page-intro">${esc(text)}</p></div></div>`;
  const statusLabel = value => ({ pending: '검토 대기', accepted: '검토 수락', approved: '승인 체험 완료', rejected: '반려 체험 완료' })[typeof value === 'object' ? value?.status : value] || '검토 대기';
  const rsvpLabel = value => ({ yes: '참석', attending: '참석', attend: '참석', no: '불참', declined: '불참', not_attending: '불참', maybe: '미정', tentative: '미정', undecided: '미정' })[value] || String(value || '미정');
  const footer = () => button('취소', 'account-cancel');
  const formEnd = label => `<p class="form-error full-width" data-form-error role="alert" tabindex="-1"></p><div class="full-width"><button class="button primary" type="submit">${esc(label)}</button></div></form>`;
  const field = (name, label, html, full = false) => `<div class="field${full ? ' full-width' : ''}"><label for="${name}">${label}</label>${html}</div>`;
  const input = (name, label, type = 'text', attributes = '', value = '') => field(name, label, `<input id="${name}" name="${name}" type="${type}" ${attributes} value="${esc(value)}">`);
  const textarea = (name, label, max = 3000, value = '') => field(name, label, `<textarea id="${name}" name="${name}" maxlength="${max}" rows="5">${esc(value)}</textarea>`, true);
  const select = (name, label, options, selected = '') => field(name, label, `<select id="${name}" name="${name}" required>${options.map(([value, text]) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(text)}</option>`).join('')}</select>`);

  function change(update, message, close = false) {
    const before = JSON.parse(JSON.stringify(db));
    try {
      update();
      if (!persist()) throw new Error('storage-unavailable');
    } catch {
      for (const key of Object.keys(db)) delete db[key];
      Object.assign(db, before);
      toast('브라우저에 저장하지 못해 변경을 취소했어요. 저장 공간과 브라우저 설정을 확인해 주세요.');
      return false;
    }
    if (close) closeModal();
    refresh();
    toast(message);
    return true;
  }

  function renderAccount() {
    const profile = db.profile || demoProfile;
    const responses = Object.entries(db.rsvps || {}).map(([id, response]) => ({ event: allEvents().find(event => event.id === id), response })).filter(row => row.event);
    return `<section class="page-wrap">${heading('내 종친 공간', '나의 체험 프로필과 참석 기록을 한곳에서 확인하세요.')}
      <div class="profile-card"><div class="person-avatar">${esc((profile.name || '나').slice(0, 1))}</div><div><span class="badge">브라우저 체험 프로필</span><h2>${esc(profile.name || '시연 종친')}</h2><p>${esc(profile.branch || '가상 계보 미선택')} · ${esc(profile.region || '지역 미등록')}</p></div>${button('프로필 수정', 'account-profile')}</div>
      <div class="info-callout">${icon('info')}<div><strong>현재 브라우저에 저장한 내 기록</strong>실제 로그인 계정이 아닙니다. 다른 기기로 동기화되거나 다른 종친에게 공유되지 않습니다.</div></div>
      <div class="profile-stats"><div><strong>${responses.length}</strong>참석 여부를 남긴 행사</div><div><strong>${list(db.posts).length}</strong>내가 작성한 체험 글</div><div><strong>${list(db.requests).length}</strong>계보 수정 요청</div></div>
      <div class="section-heading"><div><h2>내 행사 일정</h2><p>행사를 열어 참석 여부를 변경할 수 있어요.</p></div><a class="text-link" href="#/events">행사 둘러보기 ${icon('arrow')}</a></div>
      <div class="panel">${responses.length ? responses.map(({ event, response }) => `<div class="approval-row"><div><strong>${esc(event.title)}</strong><p>${esc(formatKoreanDate(event.date))} · ${esc(rsvpLabel(response?.status))}${['yes', 'attending', 'attend'].includes(response?.status) ? ` · ${esc(response.count || 1)}명` : ''}</p></div>${button('행사 보기', 'event-open', event.id, 'secondary small')}</div>`).join('') : empty('아직 선택한 행사가 없어요', '관심 있는 행사에서 참석 여부를 남기면 이곳에 모아 보여 드립니다.')}</div>
      <div class="section-heading" style="margin-top:30px"><h2>내 기록 관리</h2></div><div class="settings-list">
        <button class="settings-row" type="button" data-action="account-backup"><div><strong>내 체험 기록 내려받기</strong><p>프로필·참석·작성 글·운영 체험 기록을 JSON 파일로 저장합니다.</p></div>${icon('download')}</button>
        <a class="settings-row" href="#/admin"><div><strong>종친회 운영 화면 체험</strong><p>가상 공지·행사 등록과 회원 승인 과정을 살펴보세요.</p></div>${icon('chevron')}</a>
        <button class="settings-row" type="button" data-action="account-reset"><div><strong>체험 기록 초기화</strong><p>이 브라우저의 입력 내용과 보기 설정을 초기 상태로 되돌립니다.</p></div>${icon('trash')}</button>
      </div></section>`;
  }

  function renderAdmin() {
    let content = '';
    if (activeTab === 'notices') content = `<div class="section-heading"><div><h2>종친회 공지</h2><p>기본 시연 공지와 이 브라우저에서 추가한 공지입니다.</p></div>${button('공지 작성', 'admin-new-notice', '', 'primary')}</div><div class="panel">${allNotices().map(notice => `<div class="approval-row"><div><strong>${esc(notice.title)}</strong><p>${esc(notice.date)} · ${esc(notice.sourceStatus || '시연 자료')}</p></div>${button('내용 보기', 'admin-notice-open', notice.id, 'secondary small')}</div>`).join('') || empty('등록된 공지가 없어요', '공지 작성으로 새로운 시연 안내를 남겨 보세요.')}</div>`;
    if (activeTab === 'events') content = `<div class="section-heading"><div><h2>행사 일정</h2><p>실제 행사가 아닌 일정 등록 체험입니다.</p></div>${button('행사 등록', 'admin-new-event', '', 'primary')}</div><div class="panel">${allEvents().map(event => `<div class="approval-row"><div><strong>${esc(event.title)}</strong><p>${esc(formatKoreanDate(event.date))} · 정원 ${esc(event.capacity)}명 · ${esc(event.sourceStatus || '시연 자료')}</p></div>${button('행사 보기', 'event-open', event.id, 'secondary small')}</div>`).join('') || empty('등록된 행사가 없어요', '행사 등록으로 날짜와 신청 조건을 설정해 보세요.')}</div>`;
    if (activeTab === 'approvals') content = `<div class="section-heading"><div><h2>가상 회원 신청 2건</h2><p>버튼을 눌러도 실제 종친 인증이나 계정 권한은 변경되지 않습니다.</p></div></div><div class="panel">${applicants.map(person => `<div class="approval-row"><div><strong>${esc(person.name)} · ${esc(person.branch)}</strong><p>${esc(person.note)}</p><p>${esc(statusLabel(db.approvals?.[person.id]))}</p></div><div>${!db.approvals?.[person.id] ? `${button('승인 체험', 'admin-approve', person.id, 'primary small')}${button('반려 체험', 'admin-reject', person.id, 'secondary small')}` : '<span class="badge muted">처리 완료 · 시연</span>'}</div></div>`).join('')}</div>`;
    if (activeTab === 'corrections') content = `<div class="section-heading"><div><h2>계보 수정 요청</h2><p>요청의 검토 상태만 변경합니다. 인물과 관계는 자동 수정하지 않습니다.</p></div></div>${list(db.requests).length ? `<div class="panel">${list(db.requests).map(request => `<div class="approval-row"><div><strong>${esc(request.personName || '시연 인물')} · ${esc(statusLabel(request.status))}</strong><p>${esc(request.date || '')}</p><div class="detail-content">${paragraphs(request.content || '')}</div></div><div>${!['accepted', 'rejected'].includes(request.status) ? `${button('검토 수락', 'admin-correction-accept', request.id, 'primary small')}${button('반려', 'admin-correction-reject', request.id, 'secondary small')}` : '<span class="badge muted">검토 완료 · 계보 미변경</span>'}</div></div>`).join('')}</div>` : empty('접수된 수정 요청이 없어요', '족보에서 인물의 상세 정보를 열고 수정 요청을 남겨 보세요.')}`;
    return `<section class="page-wrap">${heading('종친회 운영', '공지와 행사를 준비하고, 회원과 계보 기록의 검토 흐름을 살펴보세요.')}${callout()}<nav class="admin-tabs" aria-label="운영 화면 분류">${Object.entries(tabs).map(([id, label]) => `<button type="button" data-action="admin-tab" data-id="${id}" aria-pressed="${activeTab === id}" class="${activeTab === id ? 'active' : ''}">${label}</button>`).join('')}</nav>${content}</section>`;
  }

  function profileForm() {
    const profile = db.profile || demoProfile;
    const selectedId = people.some(person => person.id === profile.personId) ? profile.personId : demoProfile.personId;
    showModal('체험 프로필 수정', `<p class="page-intro">별명과 가상 계보의 기준 인물만으로 체험할 수 있어요. 실제 연락처는 입력하지 않습니다.</p><form id="account-profile-form" class="form-grid">${input('account-name', '별명', 'text', 'required maxlength="30" autocomplete="off"', profile.name)}${select('account-person', '가상 계보 기준 인물', people.map(person => [person.id, `${person.name} · ${person.branch}`]), selectedId)}${input('account-region', '지역 (선택)', 'text', 'maxlength="30" placeholder="예: 서울, 경주"', profile.region)}${textarea('account-introduction', '짧은 소개 (선택)', 300, profile.introduction)}${formEnd('프로필 저장')}`, footer(), '이 브라우저의 시연 프로필에만 반영됩니다.');
  }

  function noticeForm() {
    showModal('공지 작성 체험', `${callout()}<form id="admin-notice-form" class="form-grid">${input('admin-notice-title', '공지 제목', 'text', 'required minlength="2" maxlength="80"')}${select('admin-notice-category', '분류', ['이용 안내', '행사 안내', '족보 안내', '종친회 소식'].map(value => [value, value]))}${textarea('admin-notice-body', '공지 내용', 5000)}<label class="checkbox-row full-width"><input name="admin-notice-pinned" type="checkbox">중요 공지로 표시</label>${formEnd('이 브라우저에 공지 저장')}`, footer());
  }

  function eventForm() {
    showModal('행사 등록 체험', `${callout()}<form id="admin-event-form" class="form-grid">${input('admin-event-title', '행사 이름', 'text', 'required minlength="2" maxlength="80"')}${select('admin-event-category', '분류', ['친목 모임', '기록·문화', '세대 교류', '종친회 모임'].map(value => [value, value]))}${input('admin-event-date', '행사 날짜', 'date', 'required')}${input('admin-event-deadline', '신청 마감일 (행사일 이전)', 'date', 'required')}${input('admin-event-start', '시작 시간', 'time', 'required', '10:00')}${input('admin-event-end', '종료 시간 (같은 날)', 'time', 'required', '12:00')}${input('admin-event-location', '시연 장소', 'text', 'required maxlength="100" placeholder="예: 시연 모임 공간"')}${input('admin-event-capacity', '정원', 'number', 'required min="1" max="10000" step="1"', '30')}${textarea('admin-event-description', '행사 안내', 3000)}${formEnd('이 브라우저에 행사 저장')}`, footer());
  }

  function backup() {
    try {
      const payload = { app: 'gyeongju-kim-clan', version: 1, exportedAt: new Date().toISOString(), sourceStatus, data: db };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `gyeongjukim-demo-backup-${today()}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('체험 기록 파일을 내려받기 시작했어요.');
    } catch {
      toast('파일을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  function handleClick(action, element) {
    const id = element?.dataset?.id || '';
    if (action === 'account-profile') { profileForm(); return true; }
    if (action === 'account-backup') { backup(); return true; }
    if (action === 'account-cancel' || action === 'admin-cancel') { resetRequested = false; closeModal(); return true; }
    if (action === 'account-reset') {
      resetRequested = true;
      showModal('체험 기록을 초기화할까요?', '<p>이 브라우저의 프로필, 행사 참석, 작성 글·댓글, 좋아요·북마크, 추가한 공지·행사, 가입 승인 체험, 계보 수정 요청과 큰 글씨 설정을 초기 상태로 되돌립니다.</p><p>남겨 둘 기록은 내 공간에서 JSON 파일로 내려받아 주세요.</p>', `${footer()}${button('초기화', 'account-reset-confirm', '', 'danger')}`);
      return true;
    }
    if (action === 'account-reset-confirm') {
      if (resetRequested && change(() => Object.assign(db, { profile: { ...demoProfile }, rsvps: {}, posts: [], comments: {}, likes: [], bookmarks: [], customEvents: [], customNotices: [], requests: [], approvals: {}, fontLarge: false }), '체험 기록을 초기화했어요.', true)) resetRequested = false;
      return true;
    }
    if (action === 'admin-tab' && Object.hasOwn(tabs, id)) { activeTab = id; refresh(); return true; }
    if (action === 'admin-new-notice') { noticeForm(); return true; }
    if (action === 'admin-new-event') { eventForm(); return true; }
    if (action === 'admin-notice-open') {
      const notice = allNotices().find(item => item.id === id);
      if (notice) showModal(notice.title, `<div class="detail-meta">${esc(notice.date)} · ${esc(notice.sourceStatus)}</div><div class="detail-content">${paragraphs(notice.body)}</div>`, button('닫기', 'account-cancel'), '공지 내용 · 시연 자료');
      return true;
    }
    if (action === 'admin-approve' || action === 'admin-reject') {
      if (!applicants.some(person => person.id === id) || db.approvals?.[id]) return true;
      const status = action === 'admin-approve' ? 'approved' : 'rejected';
      change(() => { db.approvals = { ...db.approvals, [id]: { status, reviewedAt: new Date().toISOString() } }; }, `${status === 'approved' ? '승인' : '반려'} 체험을 저장했어요. 실제 계정 권한은 변경되지 않습니다.`);
      return true;
    }
    if (action === 'admin-correction-accept' || action === 'admin-correction-reject') {
      if (!list(db.requests).some(request => request.id === id && !['accepted', 'rejected'].includes(request.status))) return true;
      const status = action === 'admin-correction-accept' ? 'accepted' : 'rejected';
      change(() => { db.requests = db.requests.map(request => request.id === id ? { ...request, status, reviewedAt: new Date().toISOString() } : request); }, '검토 상태를 저장했어요. 계보의 인물과 관계는 변경하지 않았습니다.');
      return true;
    }
    return false;
  }

  function handleSubmit(form) {
    if (!['account-profile-form', 'admin-notice-form', 'admin-event-form'].includes(form?.id)) return false;
    if (typeof form.reportValidity === 'function' && !form.reportValidity()) return true;
    const data = new FormData(form);
    const value = name => safeText(data.get(name), 6000).trim();
    const error = message => { const output = form.querySelector('[data-form-error]'); if (output) { output.textContent = message; output.focus(); } else toast(message); return true; };
    if (form.id === 'account-profile-form') {
      const name = value('account-name'), personId = value('account-person'), region = value('account-region'), introduction = value('account-introduction');
      const person = people.find(item => item.id === personId);
      if (!name || Array.from(name).length > 30) return error('별명을 1~30자로 입력해 주세요.');
      if (!person) return error('목록에 있는 가상 인물을 선택해 주세요.');
      if (Array.from(region).length > 30 || Array.from(introduction).length > 300) return error('지역은 30자, 소개는 300자 이내로 입력해 주세요.');
      change(() => { db.profile = { ...db.profile, name, personId, branch: person.branch, region, introduction }; }, '이 브라우저의 체험 프로필을 저장했어요.', true);
      return true;
    }
    const isNotice = form.id === 'admin-notice-form';
    const prefix = isNotice ? 'admin-notice' : 'admin-event';
    const title = value(`${prefix}-title`), category = value(`${prefix}-category`), body = value(isNotice ? 'admin-notice-body' : 'admin-event-description');
    if (Array.from(title).length < 2 || Array.from(title).length > 80) return error('제목을 2~80자로 입력해 주세요.');
    if (Array.from(body).length < 5 || Array.from(body).length > (isNotice ? 5000 : 3000)) return error(`내용을 5~${isNotice ? '5,000' : '3,000'}자로 입력해 주세요.`);
    if (!category || Array.from(category).length > 30) return error('분류를 선택해 주세요.');
    if (isNotice) {
      const notice = { id: newId('local-notice'), title, category, body, excerpt: Array.from(body.replace(/\s+/g, ' ')).slice(0, 100).join(''), date: today(), pinned: data.has('admin-notice-pinned'), author: '내 브라우저 운영 체험', sourceStatus };
      change(() => { db.customNotices = [notice, ...list(db.customNotices)]; }, '새 공지를 이 브라우저에 저장했어요.', true);
      return true;
    }
    const date = value('admin-event-date'), deadline = value('admin-event-deadline'), startTime = value('admin-event-start'), endTime = value('admin-event-end'), location = value('admin-event-location'), capacity = Number(value('admin-event-capacity'));
    if (!validDate(date) || !validDate(deadline)) return error('행사일과 신청 마감일을 올바른 날짜로 입력해 주세요.');
    if (deadline >= date) return error('신청 마감일은 행사일보다 앞선 날짜여야 합니다.');
    if (!validTime(startTime) || !validTime(endTime) || endTime <= startTime) return error('종료 시간은 같은 날의 시작 시간보다 늦어야 합니다.');
    if (!location || Array.from(location).length > 100) return error('시연 장소를 1~100자로 입력해 주세요.');
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) return error('정원은 1~10,000명 사이의 정수로 입력해 주세요.');
    const event = { id: newId('local-event'), title, category, date, startTime, endTime, deadline, location, capacity, attending: 0, description: body, host: '내 브라우저 운영 체험', theme: 'forest', sourceStatus };
    change(() => { db.customEvents = [event, ...list(db.customEvents)]; }, '새 행사를 이 브라우저에 저장했어요.', true);
    return true;
  }

  return { renderAccount, renderAdmin, handleClick, handleSubmit };
}
