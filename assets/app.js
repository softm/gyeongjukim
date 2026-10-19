import {people, events, notices, posts, resources, demoProfile} from './data.js';
import {searchPeople, getPersonRelations, findKinship, formatKoreanDate, createEventICS, escapeHtml, safeText} from './domain.js';
import {icon} from './icons.js';
import {createCommunity} from './community.js';
import {createAdmin} from './admin.js';

const STORAGE_KEY = 'gyeongju-kim-clan:demo:v1';
const newId = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const esc = escapeHtml;
const app = document.querySelector('#app');
const modal = document.querySelector('#app-modal');
let storageWarning = '';
const defaults = () => ({version:1,profile:{...demoProfile},fontLarge:false,rsvps:{},posts:[],comments:{},likes:[],bookmarks:[],customEvents:[],customNotices:[],requests:[],approvals:{}});
const db = defaults();
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved && saved.version === 1) {
    for (const key of ['posts','likes','bookmarks','customEvents','customNotices','requests']) if (Array.isArray(saved[key])) db[key] = saved[key];
    for (const key of ['rsvps','comments','approvals']) if (saved[key] && typeof saved[key] === 'object' && !Array.isArray(saved[key])) db[key] = saved[key];
    if (saved.profile && typeof saved.profile === 'object') db.profile = {...demoProfile,...saved.profile};
    if (!people.some(p=>p.id === db.profile.personId)) db.profile = {...db.profile,personId:demoProfile.personId,branch:demoProfile.branch};
    db.fontLarge = saved.fontLarge === true;
  }
} catch { storageWarning = '저장된 내용을 읽지 못해 기본 시연 화면을 열었습니다. 브라우저의 저장 공간 설정을 확인해 주세요.'; }

let geneTab = 'search';
let eventCategory = '전체';
let eventView = 'list';
let eventQuery = '';
let newsCategory = '전체';
let newsQuery = '';
let activeRoute = '';
let modalOpener = null;
let calendarMonth = events[0].date.slice(0,7);

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); return true; }
  catch { toast('저장하지 못했습니다. 브라우저 저장 공간이 부족하거나 저장이 차단되어 있습니다.'); return false; }
}
function toast(message) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = message;
  document.querySelector('#toasts').replaceChildren(el);
  setTimeout(()=>el.remove(),5000);
}
function paragraphs(text) { return String(text || '').split(/\n\s*\n/).map(p=>`<p>${esc(p).replaceAll('\n','<br>')}</p>`).join(''); }
function button(label,action,id='',kind='secondary') { return `<button type="button" class="button ${esc(kind)}" data-action="${esc(action)}"${id ? ` data-id="${esc(id)}"` : ''}>${label}</button>`; }
function showModal(title,body,footer='',subtitle='') {
  if (!modal.open) modalOpener = document.activeElement;
  modal.innerHTML = `<div class="modal-header"><div><h2 id="modal-title" class="modal-title">${esc(title)}</h2>${subtitle ? `<p class="modal-subtitle">${esc(subtitle)}</p>`:''}</div><button type="button" class="modal-close icon-button" data-action="modal-close" aria-label="닫기">${icon('close')}</button></div><div class="modal-body">${body}</div>${footer ? `<div class="modal-footer">${footer}</div>` : ''}`;
  if (!modal.open) modal.showModal();
}
function closeModal() { if (modal.open) modal.close(); }
modal.addEventListener('close',()=>{ if (modalOpener?.isConnected) modalOpener.focus({preventScroll:true}); });
modal.addEventListener('click',e=>{if (e.target === modal) { const r=modal.getBoundingClientRect(); if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) closeModal(); }});
function getRoute() {
  const raw = location.hash.replace(/^#\/?/,'');
  const [path,query=''] = raw.split('?');
  return {path:path || 'home',params:new URLSearchParams(query)};
}
function go(route) { const hash = '#/'+(route==='home' ? '' : route); if (location.hash === hash) renderApp(); else location.hash = hash; }
function refresh() { renderApp(false); }
function allEvents() { return [...db.customEvents,...events].sort((a,b)=>String(a.date).localeCompare(String(b.date))); }
function allNotices() { return [...db.customNotices,...notices].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||String(b.date).localeCompare(String(a.date))); }
const ctx = {db,people,events,notices,seedPosts:posts,resources,icon,esc,paragraphs,button,showModal,closeModal,toast,refresh,go,persist};
const community = createCommunity(ctx);
const admin = createAdmin(ctx);

function head(title,desc,eyebrow='',action='') { return `<div class="page-heading"><div>${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>`:''}<h1>${esc(title)}</h1><p class="page-intro">${esc(desc)}</p></div>${action}</div>`; }
function section(title,link,route) { return `<div class="section-heading"><h2>${esc(title)}</h2><a class="text-link" href="#/${route}">${esc(link)} ${icon('arrow')}</a></div>`; }
function empty(title,description,action='') { return `<div class="empty-state">${icon('search')}<h3>${esc(title)}</h3><p>${esc(description)}</p>${action}</div>`; }
function noticeRow(n) { return `<button class="notice-row" data-action="notice-open" data-id="${esc(n.id)}"><div><div class="notice-meta"><span class="badge ${n.pinned?'soft':'muted'}">${esc(n.category)}</span>${n.pinned ? `<span class="notice-pin">${icon('pin')}고정</span>`:''}<span>시연 자료</span></div><span class="notice-title">${esc(n.title)}</span></div><span class="notice-date">${esc(String(n.date).slice(5).replace('-','.'))}</span></button>`; }
function miniEvent(e) { return `<a class="event-preview" href="#/events?event=${encodeURIComponent(e.id)}"><span class="event-date"><span>${Number(e.date.slice(5,7))}월</span><strong>${Number(e.date.slice(8))}</strong></span><div class="event-preview-body"><span class="event-preview-title">${esc(e.title)}</span><div class="event-preview-meta"><span>${icon('clock')}${esc(e.startTime)}</span><span>${icon('location')}${esc(e.location)}</span></div></div>${icon('chevron')}</a>`; }

function renderHome() {
  const quick = [['tree','나의 계보','가족의 연결을 한눈에','genealogy?tab=tree'],['calendar','다가오는 행사','함께할 시간을 만나세요','events'],['bell','종친 소식','우리 종친회의 새 소식','news'],['book','역사와 자료','가족의 기록을 배워요','resources']];
  return `<div class="page-wrap home-page"><section class="home-hero" aria-labelledby="home-title"><div class="hero-copy"><span class="eyebrow">${icon('leaf')}세대를 넘어 이어지는 마음</span><h1 class="hero-title" id="home-title">우리의 뿌리,<br><em>함께 이어갈 이야기.</em></h1><p class="hero-description">가족의 기록을 찾고, 반가운 소식을 나누세요.<br>경주김씨 종친이 함께하는 우리들의 공간입니다.</p><div class="hero-search">${icon('search')}<form id="home-search"><label class="sr-only" for="home-query">이름으로 족보 찾기</label><input id="home-query" name="query" type="search" placeholder="이름을 입력해 족보를 찾아보세요" maxlength="80"><button class="button primary" type="submit">족보 찾기</button></form></div><p class="hero-note">${icon('info')}김가온 · 김여울 등 가상 인물로 검색을 체험하세요.</p></div><div class="hero-art"><img src="./assets/heritage.svg" width="800" height="600" alt="산과 소나무, 한옥이 어우러진 종친회 공간 일러스트"><p>뿌리를 기억하고, 내일을 함께합니다.</p></div></section><div class="quick-links">${quick.map(([i,t,d,r])=>`<a class="quick-link" href="#/${r}"><span class="quick-icon">${icon(i)}</span><span><span class="quick-label">${t}</span><span class="quick-description">${d}</span></span>${icon('chevron')}</a>`).join('')}</div><div class="home-columns"><section class="panel">${section('종친회 소식','모든 소식','news')}${allNotices().slice(0,3).map(noticeRow).join('')}</section><section class="panel">${section('함께하는 일정','모든 행사','events')}${allEvents().slice(0,3).map(miniEvent).join('')}</section></div><section>${section('우리의 기록, 차근차근','자료실 둘러보기','resources')}<div class="story-grid">${resources.slice(0,3).map((r,i)=>`<a class="story-card" href="#/resources?article=${encodeURIComponent(r.id)}"><div class="story-art theme-${['green','sand','blue'][i]}">${icon(['tree','photo','book'][i])}</div><div class="story-content"><span class="badge outline">${esc(r.category)}</span><h3>${esc(r.title)}</h3><p>${esc(r.description)}</p><span class="text-link">이야기 읽기 ${icon('arrow')}</span></div></a>`).join('')}</div></section><div class="home-note"><span>${icon('leaf')}오늘의 작은 기록이 내일의 가족 이야기가 됩니다.</span><a class="text-link" href="#/community">첫 이야기 남기기 ${icon('arrow')}</a></div></div>`;
}

function personCard(p) {
  const parents = getPersonRelations(people,p.id).parents;
  return `<article class="person-card"><div class="person-card-top"><span class="person-avatar">${esc(p.name.slice(0,1))}</span><div><h3 class="person-name">${esc(p.name)} ${p.id===db.profile.personId?'<span class="badge soft">나의 기준</span>':''}</h3><p class="person-meta">${esc(p.branch)} · 시연 ${p.generation}세대</p></div><span class="badge muted">가상</span></div><p class="person-lineage">부모 ${parents.length?parents.map(a=>esc(a.name)).join(' · '):'등록된 연결 없음'}</p><div class="person-footer"><span>${icon('location')}${esc(p.region)}</span><div>${button('상세','person-open',p.id,'ghost small')}${button('가계 보기','person-tree',p.id,'secondary small')}</div></div></article>`;
}
function treeNode(p,relation,current=false) { return `<button type="button" class="tree-node${current?' current':''}" data-action="person-tree" data-id="${esc(p.id)}"><span class="relation-chip">${esc(relation)}</span><strong>${esc(p.name)}</strong><small>시연 ${p.generation}세대</small></button>`; }
function familyTree(id) {
  const r=getPersonRelations(people,id);
  if (!r.person) return empty('인물을 찾지 못했습니다.','목록에서 인물을 다시 선택해 주세요.');
  const kin=findKinship(people,db.profile.personId,id);
  return `<section class="family-section"><div class="section-heading"><div><h2>${esc(r.person.name)}님의 가족 연결</h2><p>인물을 누르면 그 인물을 중심으로 가계도를 이동합니다.</p></div>${button(`${icon('user')}인물 상세`,'person-open',id,'secondary small')}</div><div class="family-scroll" tabindex="0" aria-label="가계도. 화면이 좁을 때 좌우로 이동할 수 있습니다."><div class="family-tree">${r.parents.length?`<div class="tree-row">${r.parents.map(p=>treeNode(p,'부모')).join('')}</div><div class="tree-connect" aria-hidden="true"></div>`:'<p class="tree-empty-label">등록된 부모 연결이 없습니다.</p>'}<div class="tree-row">${treeNode(r.person,'선택 인물',true)}${r.spouses.map(p=>treeNode(p,'배우자')).join('')}</div>${r.children.length?`<div class="tree-connect" aria-hidden="true"></div><div class="tree-row">${r.children.map(p=>treeNode(p,'자녀')).join('')}</div>`:'<p class="tree-empty-label">등록된 자녀 연결이 없습니다.</p>'}</div></div><div class="relationship-result">${icon('tree')}<span><strong>${esc(db.profile.name)}님의 기준 인물과 ${esc(r.person.name)}님</strong> · ${esc(kin.label)}${kin.found&&kin.distance>0?`<small>${kin.path.map(p=>esc(p.name)).join(' → ')}</small>`:''}</span></div>${r.siblings.length?`<p class="siblings-list">형제자매 ${r.siblings.map(p=>`<button class="text-link" data-action="person-tree" data-id="${p.id}">${esc(p.name)}</button>`).join(' · ')}</p>`:''}<p class="field-help">출처: 가상 계보 · 실제 경주김씨 분파·항렬과 무관합니다. 촌수는 이 시연 자료의 부모·자녀 관계만으로 계산합니다.</p></section>`;
}
function renderGenealogy(params) {
  if(params.get('tab')==='tree') geneTab='tree';
  const query=params.get('q')||'', branch=params.get('branch')||'', generation=params.get('generation')||'';
  const filtered=searchPeople(people,{query,branch,generation});
  const selected=people.some(p=>p.id===params.get('person'))?params.get('person'):db.profile.personId;
  const treeActive=params.has('person')||geneTab==='tree';
  return `<div class="page-wrap">${head('족보 찾기','가족의 이름에서 시작해, 세대를 잇는 연결을 살펴보세요.','우리의 뿌리',button(`${icon('info')}찾기 도움말`,'gene-help','','ghost'))}<div class="tabs" role="group" aria-label="족보 보기 방식">${[['search','족보 검색'],['tree','나의 계보'],['directory','종친 둘러보기']].map(([id,t])=>`<button data-action="gene-tab" data-id="${id}" class="${geneTab===id?'active':''}" aria-pressed="${geneTab===id}">${t}</button>`).join('')}</div>${geneTab!=='tree'?`<form class="toolbar" id="gene-search"><div class="search-field"><label for="gene-query">이름·지역 검색</label>${icon('search')}<input id="gene-query" name="q" type="search" value="${esc(query)}" placeholder="예: 김가온, 서울" maxlength="80"></div><div class="filter-field"><label for="gene-branch">가문</label><select id="gene-branch" name="branch"><option value="">전체 가문</option>${[...new Set(people.map(p=>p.branch))].map(b=>`<option${b===branch?' selected':''}>${esc(b)}</option>`).join('')}</select></div><div class="filter-field"><label for="gene-generation">시연 세대</label><select id="gene-generation" name="generation"><option value="">전체 세대</option>${[1,2,3,4].map(g=>`<option value="${g}"${String(g)===generation?' selected':''}>시연 ${g}세대</option>`).join('')}</select></div><button type="submit" class="button primary">검색</button>${button('초기화','gene-reset','','ghost')}</form>`:''}${treeActive?familyTree(selected):''}${geneTab==='tree'?`<div class="info-callout">${icon('info')}<span>현재 기준 인물은 <strong>${esc(db.profile.name)}</strong>입니다. <a class="text-link" href="#/account">내 공간에서 기준 인물 변경</a></span></div>`:`<div class="results-bar"><span>검색 결과 <strong>${filtered.length}명</strong><span class="badge muted">모두 가상 인물</span></span><span class="field-help">가문·세대는 기능 체험을 위한 구분입니다.</span></div>${filtered.length?`<div class="${geneTab==='directory'?'directory-grid':'person-grid'}">${filtered.map(p=>geneTab==='directory'?`<article class="directory-card"><span class="person-avatar">${esc(p.name.slice(0,1))}</span><h3>${esc(p.name)}</h3><p>${esc(p.region)} · ${esc(p.branch)}</p><span class="badge muted">연락처 미제공 · 가상 인물</span>${button('가족 연결 보기','person-tree',p.id,'secondary small')}</article>`:personCard(p)).join('')}</div>`:empty('일치하는 인물이 없습니다.','이름 일부로 검색하거나 가문·세대 조건을 줄여보세요.',button('검색 조건 초기화','gene-reset','','primary'))}`}</div>`;
}
function openPerson(id) {
  const r=getPersonRelations(people,id); if(!r.person)return;
  const p=r.person, kin=findKinship(people,db.profile.personId,id);
  const rows=[['가문',p.branch],['세대',`시연 ${p.generation}세대`],['지역',p.region],['부모',r.parents.map(v=>v.name).join(' · ')||'연결 없음'],['배우자',r.spouses.map(v=>v.name).join(' · ')||'연결 없음'],['자녀',r.children.map(v=>v.name).join(' · ')||'연결 없음']];
  showModal(p.name,`<div class="detail-meta">${rows.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div><div class="detail-content">${paragraphs(p.bio)}</div><div class="info-callout">${icon('tree')}<span>나의 기준 인물과의 관계: <strong>${esc(kin.label)}</strong></span></div><p class="field-help">${esc(p.source)} · 검증되지 않은 시연 자료</p>`,`${button(`${icon('edit')}수정 요청 체험`,'revision-open',id,'ghost')}${button('가계도 보기','person-tree',id,'primary')}`,'가상 인물 · 개인정보가 포함되어 있지 않습니다.');
}
function openRevision(id) {
  const p=people.find(v=>v.id===id);if(!p)return;
  showModal('족보 수정 요청 체험',`<form id="revision-form"><input type="hidden" name="personId" value="${esc(id)}"><p><strong>${esc(p.name)}</strong>님의 가상 계보에 대한 검토 요청입니다.</p><div class="field"><label for="revision-content">수정 내용과 근거</label><textarea id="revision-content" name="content" required minlength="5" maxlength="1500" placeholder="어떤 연결을 검토해야 하는지 적어주세요. 실제 개인정보는 입력하지 마세요."></textarea></div><p class="field-help">요청은 이 브라우저에만 저장되며 운영 화면 체험에서 검토할 수 있습니다. 실제 관리자에게 전송되지 않습니다.</p><p class="form-error" role="alert"></p><button class="button primary" type="submit">이 브라우저에 요청 저장</button></form>`);
}

function eventCount(e) { const r=db.rsvps[e.id]; return Number(e.attending||0)+(r?.status==='attending'?Number(r.count||1):0); }
function eventStatus(e) { const now=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}); return now>e.date?'지난 행사':now>e.deadline?'신청 마감':'참석 신청 가능'; }
function eventCard(e) {
  const count=eventCount(e), r=db.rsvps[e.id];
  return `<article class="event-card"><div class="event-card-date"><span>${Number(e.date.slice(5,7))}월</span><strong>${Number(e.date.slice(8))}</strong><small>${new Intl.DateTimeFormat('ko-KR',{weekday:'short',timeZone:'Asia/Seoul'}).format(new Date(e.date+'T12:00:00+09:00'))}</small></div><div class="event-card-content"><div class="event-labels"><span class="badge soft">${esc(e.category)}</span><span class="badge muted">시연 행사</span>${r?`<span class="badge gold">${r.status==='attending'?`내 참석 ${r.count}명`:r.status==='maybe'?'내 응답: 미정':'내 응답: 불참'}</span>`:''}</div><h2>${esc(e.title)}</h2><p>${icon('location')}${esc(e.location)}</p><p>${icon('clock')}${esc(e.date)} · ${esc(e.startTime)}–${esc(e.endTime)}</p><div class="event-progress"><span>시연 참석 <strong>${count}명</strong> / ${e.capacity}명</span><div class="progress-track"><span style="width:${Math.min(100,count/e.capacity*100)}%"></span></div></div></div><div class="event-card-actions"><span class="field-help">${eventStatus(e)}</span>${button(r?'내 참석 확인':'행사 자세히','event-open',e.id,'primary')}${button(`${icon('download')}달력 저장`,'event-ics',e.id,'ghost small')}</div></article>`;
}
function calendar(eventsList) {
  const [year,month]=calendarMonth.split('-').map(Number);
  const startDay=new Date(Date.UTC(year,month-1,1)).getUTCDay();
  const days=new Date(Date.UTC(year,month,0)).getUTCDate();
  return `<section class="calendar" aria-label="행사 달력"><div class="calendar-header"><button class="icon-button" data-action="calendar-prev" aria-label="이전 달">${icon('left')}</button><h2>${year}년 ${month}월</h2><button class="icon-button" data-action="calendar-next" aria-label="다음 달">${icon('chevron')}</button></div><div class="calendar-grid">${['일','월','화','수','목','금','토'].map(d=>`<div class="calendar-day-label">${d}</div>`).join('')}${Array.from({length:startDay},()=>'<div class="calendar-cell muted" aria-hidden="true"></div>').join('')}${Array.from({length:days},(_,i)=>{const day=String(i+1).padStart(2,'0'), iso=`${calendarMonth}-${day}`,items=eventsList.filter(e=>e.date===iso);return `<div class="calendar-cell${items.length?' has-event':''}"><span class="calendar-day">${i+1}</span>${items.map(e=>`<button data-action="event-open" data-id="${esc(e.id)}" class="calendar-event">${esc(e.title)}</button>`).join('')}</div>`;}).join('')}</div><p class="field-help">행사명을 누르면 상세 내용을 확인할 수 있습니다.</p></section>`;
}
function renderEvents() {
  const list=allEvents().filter(e=>(eventCategory==='전체'||e.category===eventCategory)&&`${e.title} ${e.location}`.includes(eventQuery));
  return `<div class="page-wrap">${head('함께하는 행사','반가운 얼굴을 만나고, 함께할 시간을 약속하세요.','만남으로 가까워지는 우리','<div class="segmented" aria-label="행사 보기 방식">'+[['list','목록'],['calendar','달력']].map(([k,v])=>`<button data-action="event-view" data-id="${k}" class="${eventView===k?'active':''}" aria-pressed="${eventView===k}">${icon(k==='list'?'list':'calendar')}${v}</button>`).join('')+'</div>')}<div class="tabs">${['전체',...new Set(allEvents().map(e=>e.category))].map(c=>`<button data-action="event-category" data-id="${esc(c)}" class="${eventCategory===c?'active':''}" aria-pressed="${eventCategory===c}">${esc(c)}</button>`).join('')}</div><form class="toolbar" id="event-search"><div class="search-field"><label for="event-query">행사명·장소 검색</label>${icon('search')}<input type="search" id="event-query" name="q" value="${esc(eventQuery)}" placeholder="행사 이름 또는 지역" maxlength="80"></div><button type="submit" class="button secondary">검색</button><span class="field-help">${list.length}개의 시연 일정</span></form>${eventView==='calendar'?calendar(list):list.length?`<div class="events-list">${list.map(eventCard).join('')}</div>`:empty('조건에 맞는 행사가 없습니다.','분류나 검색어를 바꿔보세요.',button('전체 행사 보기','event-reset','','primary'))}<div class="info-callout">${icon('info')}<span>모든 일정은 기능 체험을 위한 가상 행사입니다. 참석 기록은 이 브라우저에 저장되고 실제 종친회로 전송되지 않습니다.</span></div></div>`;
}
function openEvent(id) {
  const e=allEvents().find(v=>v.id===id);if(!e){toast('행사를 찾지 못했습니다.');return;}
  const r=db.rsvps[id],status=eventStatus(e), unavailable=status!=='참석 신청 가능';
  showModal(e.title,`<div class="event-labels"><span class="badge soft">${esc(e.category)}</span><span class="badge muted">실제로 열리지 않는 시연 행사</span></div><div class="detail-meta"><div><span>일시</span><strong>${formatKoreanDate(e.date)}<br>${esc(e.startTime)}–${esc(e.endTime)}</strong></div><div><span>장소</span><strong>${esc(e.location)}</strong></div><div><span>신청 마감</span><strong>${formatKoreanDate(e.deadline,false)}</strong></div><div><span>운영</span><strong>${esc(e.host)}</strong></div></div><div class="detail-content">${paragraphs(e.description)}</div><div class="rsvp-summary">${icon('users')}시연 참석 ${eventCount(e)}명 / ${e.capacity}명 ${r?`· 내 응답 <strong>${r.status==='attending'?`${r.count}명 참석`:r.status==='maybe'?'미정':'불참'}</strong>`:''}</div><form id="rsvp-form"><input type="hidden" name="eventId" value="${esc(id)}"><fieldset class="rsvp-fieldset"><legend>참석 여부</legend><div class="rsvp-options">${[['attending','참석할게요'],['maybe','아직 미정'],['declined','참석이 어려워요']].map(([v,t])=>`<label class="checkbox-row"><input type="radio" name="status" value="${v}"${(r?.status||'attending')===v?' checked':''}${unavailable?' disabled':''}>${t}</label>`).join('')}</div></fieldset><div class="field attendee-count-field"><label for="rsvp-count">참석 인원 (본인 포함)</label><input type="number" id="rsvp-count" name="count" min="1" max="10" value="${r?.count||1}"${unavailable?' disabled':''}></div><p class="field-help">이 브라우저에만 기록하는 체험입니다. 다른 기기에 동기화되거나 실제 운영자에게 전달되지 않습니다.</p><p class="form-error" role="alert"></p><div class="form-actions"><button type="submit" class="button primary"${unavailable?' disabled':''}>${unavailable?status:r?'내 응답 변경':'내 참석 기록 저장'}</button>${r?button('내 응답 삭제','rsvp-remove',id,'ghost'):''}</div></form>`,`${button(`${icon('download')}달력 파일 저장`,'event-ics',id,'secondary')}${button(`${icon('share')}행사 링크 복사`,'event-share',id,'ghost')}`,'행사 안내 · 가상 자료');
}
function saveICS(id) {
  const e=allEvents().find(v=>v.id===id); if(!e)return;
  try { downloadBlob(createEventICS(e),`${e.date}-clan-demo.ics`,'text/calendar;charset=utf-8');toast('시연 일정 파일을 저장했습니다. 달력 앱에서 열어 추가할 수 있습니다.'); }
  catch {toast('일정의 날짜 또는 시간을 확인해 주세요.');}
}
function downloadBlob(content,name,type) {const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);}
async function copyLink(id) {
  const u=new URL(location.href);u.hash=`/events?event=${encodeURIComponent(id)}`;
  try {await navigator.clipboard.writeText(u.href);toast('행사 링크를 복사했습니다.');}
  catch {showModal('행사 링크',`<div class="field"><label for="copy-url">아래 주소를 복사해 주세요.</label><input id="copy-url" readonly value="${esc(u.href)}"></div>`);}
}
function renderNews() {
  const list=allNotices().filter(n=>(newsCategory==='전체'||n.category===newsCategory)&&`${n.title} ${n.excerpt||''} ${n.body||''}`.includes(newsQuery));
  return `<div class="page-wrap">${head('종친회 소식','놓치지 말아야 할 공지와 우리 종친회의 새로운 이야기.','가까이 전하는 안부')}<div class="tabs">${['전체',...new Set(allNotices().map(n=>n.category))].map(c=>`<button data-action="news-category" data-id="${esc(c)}" class="${newsCategory===c?'active':''}" aria-pressed="${newsCategory===c}">${esc(c)}</button>`).join('')}</div><form class="toolbar" id="news-search"><div class="search-field"><label for="news-query">소식 검색</label>${icon('search')}<input id="news-query" name="q" type="search" value="${esc(newsQuery)}" maxlength="80" placeholder="궁금한 소식을 찾아보세요"></div><button type="submit" class="button primary">검색</button></form><div class="panel news-panel">${list.length?list.map(noticeRow).join(''):empty('검색된 소식이 없습니다.','검색어나 분류를 바꿔보세요.')}</div></div>`;
}
function openNotice(id) {const n=allNotices().find(v=>v.id===id);if(!n)return;showModal(n.title,`<div class="notice-meta"><span class="badge soft">${esc(n.category)}</span><span>${esc(n.author)} · ${formatKoreanDate(n.date,false)}</span></div><div class="detail-content">${paragraphs(n.body||n.excerpt)}</div><p class="field-help">기능 체험을 위한 시연 공지입니다.</p>`,button('닫기','modal-close','','primary'));}
function showDemoInfo() {showModal('종친회 앱을 먼저 만나보세요',`<div class="detail-content"><p>족보를 찾아보고, 모임에 참석을 표시하고, 가족의 이야기를 남겨보세요. 이 화면은 실제 자료를 등록하기 전에 기능을 체험하는 공개 시연 버전입니다.</p><h3>지금 체험할 수 있어요</h3><p>가상 인물 검색과 가족 연결 · 촌수 찾기 · 행사 참석 기록 · 달력 파일 저장 · 글과 댓글 작성 · 자료 읽기 · 운영 화면</p><h3>기록이 저장되는 곳</h3><p>작성한 내용은 현재 브라우저의 저장 공간에만 남습니다. 다른 기기나 종친에게 전송되지 않으며, 브라우저 데이터를 지우면 사라집니다.</p><h3>실제 운영을 시작하려면</h3><p>종친회가 확인한 원본 족보, 자료 이용 권한, 회원 인증과 승인을 처리하는 서버 연결이 필요합니다. 현재 화면의 인물·행사는 모두 가상 자료입니다.</p></div>`,button('둘러보기','modal-close','','primary'));}
function showPrivacy() {showModal('저장과 공개 범위',`<div class="detail-content"><h3>공개된 시연 자료</h3><p>이 앱의 기본 데이터는 누구나 볼 수 있는 가상 인물과 가상 행사입니다. 실제 족보·회원 연락처·개인 문서를 공개 파일에 넣지 않습니다.</p><h3>내가 작성한 내용</h3><p>글, 댓글, 행사 응답, 프로필은 이 브라우저의 저장 공간에 보관됩니다. 로그인으로 보호되는 계정 저장소가 아니며 같은 브라우저를 사용하는 사람이 볼 수 있습니다. 실제 전화번호·주소·주민등록번호·개인 가족 문서를 입력하지 마세요.</p><h3>삭제와 백업</h3><p>내 공간에서 브라우저 데이터를 파일로 내보내거나 초기화할 수 있습니다. 백업 파일은 기기를 사용하는 사람이 열 수 있으므로 보관에 유의해 주세요.</p><h3>알림과 회원 승인</h3><p>실제 휴대전화 인증·승인·문자·푸시 알림은 연결되지 않았습니다. 운영 화면에서의 승인은 시연 상태만 바꿉니다.</p></div>`,button('확인','modal-close','','primary'));}

function applyFont() {document.body.classList.toggle('large-text',db.fontLarge);document.querySelectorAll('[data-action="font-toggle"]').forEach(b=>{b.setAttribute('aria-pressed',String(db.fontLarge));b.setAttribute('aria-label',`큰 글씨 모드 ${db.fontLarge?'끄기':'켜기'}`);});}
function renderApp(openFromUrl=true) {
  const {path,params}=getRoute();
  const changed=activeRoute!==path;
  const pages={home:()=>renderHome(),genealogy:()=>renderGenealogy(params),news:renderNews,events:renderEvents,community:community.renderCommunity,resources:community.renderResources,account:admin.renderAccount,admin:admin.renderAdmin};
  const renderer=pages[path];
  app.innerHTML=renderer?renderer():`<div class="page-wrap">${empty('찾을 수 없는 페이지입니다.','아래 버튼으로 홈으로 돌아갈 수 있습니다.','<a class="button primary" href="#/">홈으로</a>')}</div>`;
  document.querySelectorAll('[data-route]').forEach(a=>{const active=a.dataset.route===path;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  const names={home:'뿌리를 잇다',genealogy:'족보 찾기',news:'종친 소식',events:'함께하는 행사',community:'우리 이야기',resources:'자료실',account:'내 공간',admin:'운영 화면 체험'};
  document.title=`${names[path]||'페이지 안내'} · 경주김씨 종친회`;
  activeRoute=path;applyFont();
  if(changed){window.scrollTo({top:0,behavior:'instant'});if(openFromUrl)app.focus({preventScroll:true});}
  if(openFromUrl){if(path==='events'&&params.get('event'))openEvent(params.get('event'));if(path==='resources'&&params.get('article'))community.openResource(params.get('article'));if(path==='community'&&params.get('post'))community.openPost(params.get('post'));}
}

document.addEventListener('click',async event=>{
  if(event.target.closest('.skip-link')){event.preventDefault();app.focus();return;}
  const nav=event.target.closest('a[href^="#/"]');if(nav){closeModal();return;}
  const target=event.target.closest('[data-action]');if(!target)return;
  const action=target.dataset.action,id=target.dataset.id||'';
  try {
    if(action==='modal-close'){closeModal();return;}
    if(action==='demo-info'){showDemoInfo();return;}
    if(action==='privacy-info'){showPrivacy();return;}
    if(action==='font-toggle'){const old=db.fontLarge;db.fontLarge=!old;if(!persist()){db.fontLarge=old;return;}applyFont();toast(db.fontLarge?'큰 글씨 모드를 켰습니다.':'기본 글씨로 돌아왔습니다.');return;}
    if(action==='more-menu'){showModal('더 둘러보기',`<div class="mobile-menu-list">${[['bell','종친 소식','news'],['book','자료실','resources'],['user','내 공간','account'],['settings','운영 화면 체험','admin']].map(([i,t,p])=>`<a class="mobile-menu-link" href="#/${p}">${icon(i)}${t}${icon('chevron')}</a>`).join('')}</div>`);return;}
    if(action==='gene-tab'){geneTab=id;go('genealogy'+(id==='tree'?'?tab=tree':''));if(getRoute().path==='genealogy')refresh();return;}
    if(action==='gene-reset'){geneTab='search';go('genealogy');refresh();return;}
    if(action==='gene-help'){showModal('족보 찾기 도움말','<div class="detail-content"><p>① 이름의 일부나 지역을 입력해 검색하세요.</p><p>② 가문·시연 세대로 범위를 좁힐 수 있습니다.</p><p>③ 가계 보기를 누르면 부모·배우자·자녀 관계를 볼 수 있습니다.</p><p>④ 나의 계보는 내 공간에서 선택한 기준 인물을 중심으로 표시됩니다.</p><p>이 앱에 수록된 이름과 세대는 모두 가상 자료입니다. 실제 계보와 종친 자격을 확인하는 용도로 사용할 수 없습니다.</p></div>');return;}
    if(action==='person-open'){openPerson(id);return;}
    if(action==='person-tree'){geneTab='tree';closeModal();go(`genealogy?tab=tree&person=${encodeURIComponent(id)}`);return;}
    if(action==='revision-open'){openRevision(id);return;}
    if(action==='notice-open'){openNotice(id);return;}
    if(action==='news-category'){newsCategory=id;refresh();return;}
    if(action==='event-open'){openEvent(id);return;}
    if(action==='event-ics'){saveICS(id);return;}
    if(action==='event-share'){await copyLink(id);return;}
    if(action==='event-category'){eventCategory=id;refresh();return;}
    if(action==='event-view'){eventView=id;refresh();return;}
    if(action==='event-reset'){eventCategory='전체';eventQuery='';refresh();return;}
    if(action.startsWith('calendar-')){const [y,m]=calendarMonth.split('-').map(Number);const next=new Date(Date.UTC(y,m-1+(action==='calendar-next'?1:-1),1));calendarMonth=next.toISOString().slice(0,7);refresh();return;}
    if(action==='rsvp-remove'){const old=db.rsvps[id];delete db.rsvps[id];if(!persist()){db.rsvps[id]=old;return;}refresh();openEvent(id);toast('이 브라우저의 행사 응답을 삭제했습니다.');return;}
    if(await community.handleClick(action,target))return;
    await admin.handleClick(action,target);
  } catch(error) {console.error('UI action failed',error);toast('처리 중 문제가 발생했습니다. 입력 내용을 확인하고 다시 시도해 주세요.');}
});

document.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target;const fd=new FormData(form);
  try {
    if(form.id==='home-search'){geneTab='search';go(`genealogy?q=${encodeURIComponent(safeText(fd.get('query'),80).trim())}`);return;}
    if(form.id==='gene-search'){const p=new URLSearchParams();for(const key of ['q','branch','generation']){const v=safeText(fd.get(key),80).trim();if(v)p.set(key,v);}go('genealogy'+(p.size?'?'+p.toString():''));refresh();return;}
    if(form.id==='news-search'){newsQuery=safeText(fd.get('q'),80).trim();refresh();return;}
    if(form.id==='event-search'){eventQuery=safeText(fd.get('q'),80).trim();refresh();return;}
    if(form.id==='revision-form'){const p=people.find(v=>v.id===fd.get('personId')),content=safeText(fd.get('content'),1500).trim();if(!p||content.length<5){form.querySelector('.form-error').textContent='검토 내용을 5자 이상 입력해 주세요.';return;}const entry={id:newId(),personId:p.id,personName:p.name,content,status:'pending',date:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'})};db.requests.unshift(entry);if(!persist()){db.requests.shift();return;}closeModal();toast('검토 요청을 이 브라우저에 저장했습니다. 운영 화면 체험에서 확인하세요.');return;}
    if(form.id==='rsvp-form'){
      const id=fd.get('eventId'),e=allEvents().find(v=>v.id===id),status=fd.get('status'),count=Number(fd.get('count'));
      const error=form.querySelector('.form-error');
      if(!e||eventStatus(e)!=='참석 신청 가능'){error.textContent='참석 신청 기간이 아닙니다.';return;}
      if(!['attending','maybe','declined'].includes(status)||!Number.isInteger(count)||count<1||count>10){error.textContent='참석 여부와 1~10명 사이의 인원을 확인해 주세요.';return;}
      if(status==='attending'&&Number(e.attending)+count>Number(e.capacity)){error.textContent='시연 행사 정원을 초과합니다. 참석 인원을 줄여 주세요.';return;}
      const old=db.rsvps[id];db.rsvps[id]={status,count:status==='attending'?count:1};if(!persist()){if(old)db.rsvps[id]=old;else delete db.rsvps[id];return;}refresh();openEvent(id);toast('참석 여부를 이 브라우저에 저장했습니다.');return;
    }
    if(await community.handleSubmit(form))return;
    await admin.handleSubmit(form);
  }catch(error){console.error('Form submission failed',error);toast('저장 중 문제가 발생했습니다. 입력 내용을 확인해 주세요.');}
});
window.addEventListener('hashchange',()=>{closeModal();renderApp();});
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY)toast('다른 탭에서 기록이 변경되었습니다. 새로고침하면 최신 내용을 불러옵니다.');});
document.querySelectorAll('.mobile-nav [data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon)+`<span>${el.textContent}</span>`;});
renderApp();
if(storageWarning)toast(storageWarning);
