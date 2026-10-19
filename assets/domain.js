/** Pure functions shared by the static app and the Node test suite. */

/** Normalizes plain text. Call escapeHtml before putting the result in HTML. */
export function safeText(value, maxLength = 5000) {
  if (value === null || value === undefined) return '';
  const limit = Number.isFinite(Number(maxLength)) ? Math.max(0, Math.floor(Number(maxLength))) : 5000;
  return Array.from(String(value).normalize('NFC').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()).slice(0, limit).join('');
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

const normalizeQuery = (value) => safeText(value, 500).normalize('NFKC').toLocaleLowerCase('ko-KR');
const isAllFilter = (value) => value === undefined || value === null || ['', 'all', '전체'].includes(String(value).trim());

export function searchPeople(people, { query = '', branch = '', generation = '' } = {}) {
  const tokens = normalizeQuery(query).split(/\s+/).filter(Boolean);
  return (Array.isArray(people) ? people : []).filter((person) => {
    if (!isAllFilter(branch) && person.branch !== branch) return false;
    if (!isAllFilter(generation) && Number(person.generation) !== Number(generation)) return false;
    const searchable = normalizeQuery([person.name, person.hanja, person.branch, person.region, `${person.generation}세대`].filter(Boolean).join(' '));
    return tokens.every((token) => searchable.includes(token));
  });
}

const uniqueIds = (ids) => [...new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && id) : [])];
const peopleMap = (people) => new Map((Array.isArray(people) ? people : []).filter((person) => person && typeof person.id === 'string').map((person) => [person.id, person]));

export function getPersonRelations(people, id) {
  const index = peopleMap(people);
  const person = index.get(id);
  if (!person) return { person: null, parents: [], spouses: [], children: [], siblings: [] };
  const parentIds = new Set(uniqueIds(person.parentIds).filter((parentId) => parentId !== id && index.has(parentId)));
  const spouseIds = new Set(uniqueIds(person.spouseIds).filter((spouseId) => spouseId !== id));
  // Show a declared marriage even when only the other person's record names it.
  for (const other of index.values()) {
    if (other.id !== id && uniqueIds(other.spouseIds).includes(id)) spouseIds.add(other.id);
  }
  return {
    person,
    parents: [...parentIds].map((parentId) => index.get(parentId)),
    spouses: [...spouseIds].map((spouseId) => index.get(spouseId)).filter(Boolean),
    children: [...index.values()].filter((other) => other.id !== id && uniqueIds(other.parentIds).includes(id)),
    siblings: [...index.values()].filter((other) => other.id !== id && uniqueIds(other.parentIds).some((parentId) => parentIds.has(parentId))),
  };
}

/**
 * Find each reachable ancestor once, then detect cycles with a topological pass.
 * Looking for a common ancestor (rather than any undirected path) prevents two
 * unrelated parents from being reported as blood relatives via their own child.
 */
function ancestorDistances(index, startId) {
  const distance = new Map([[startId, 0]]);
  const previous = new Map();
  const queue = [startId];
  const edges = new Map();
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    const parentIds = uniqueIds(index.get(id)?.parentIds).filter((parentId) => index.has(parentId));
    edges.set(id, parentIds);
    for (const parentId of parentIds) {
      if (!distance.has(parentId)) {
        distance.set(parentId, distance.get(id) + 1);
        previous.set(parentId, id);
        queue.push(parentId);
      }
    }
  }
  const inDegree = new Map(queue.map((id) => [id, 0]));
  for (const parents of edges.values()) {
    for (const parentId of parents) inDegree.set(parentId, inDegree.get(parentId) + 1);
  }
  const sortable = queue.filter((id) => inDegree.get(id) === 0);
  for (let cursor = 0; cursor < sortable.length; cursor += 1) {
    for (const parentId of edges.get(sortable[cursor]) || []) {
      inDegree.set(parentId, inDegree.get(parentId) - 1);
      if (inDegree.get(parentId) === 0) sortable.push(parentId);
    }
  }
  return { distance, previous, hasCycle: sortable.length !== queue.length };
}

function relationshipLabel(up, down) {
  const distance = up + down;
  if (distance === 0) return '본인';
  if (down === 0) return `${({ 1: '부모', 2: '조부모', 3: '증조부모' })[up] || `${up}대 선조`} · ${distance}촌`;
  if (up === 0) return `${({ 1: '자녀', 2: '손자녀', 3: '증손자녀' })[down] || `${down}대 후손`} · ${distance}촌`;
  if (up === 1 && down === 1) return '형제자매 · 2촌';
  if (up === 2 && down === 1) return '부모의 형제자매 · 3촌';
  if (up === 1 && down === 2) return '형제자매의 자녀 · 3촌';
  if (up === 2 && down === 2) return '사촌 · 4촌';
  if (up === 3 && down === 3) return '육촌 · 6촌';
  if (up === 4 && down === 4) return '팔촌 · 8촌';
  return `공통 조상으로 연결된 혈족 · ${distance}촌`;
}

export function findKinship(people, fromId, toId) {
  const index = peopleMap(people);
  const missing = (label) => ({ found: false, distance: null, path: [], label });
  if (!index.has(fromId) || !index.has(toId)) return missing('조회할 인물을 찾을 수 없습니다.');
  if (fromId === toId) return { found: true, distance: 0, path: [index.get(fromId)], label: '본인' };
  const left = ancestorDistances(index, fromId);
  const right = ancestorDistances(index, toId);
  if (left.hasCycle || right.hasCycle) return missing('계보 자료에 순환 연결이 있어 관계를 확인할 수 없습니다.');
  let commonId = null;
  let shortest = Infinity;
  for (const [id, distance] of left.distance) {
    if (!right.distance.has(id)) continue;
    const total = distance + right.distance.get(id);
    if (total < shortest) {
      commonId = id;
      shortest = total;
    }
  }
  if (commonId === null) return missing('등록된 계보에서 공통 조상을 찾지 못했습니다.');
  const pathTo = (ancestry) => {
    const result = [commonId];
    while (ancestry.previous.has(result[result.length - 1])) result.push(ancestry.previous.get(result[result.length - 1]));
    return result.reverse();
  };
  const fromPath = pathTo(left);
  const toPath = pathTo(right);
  const path = [...fromPath, ...toPath.reverse().slice(1)].map((id) => index.get(id));
  return {
    found: true,
    distance: shortest,
    path,
    label: relationshipLabel(left.distance.get(commonId), right.distance.get(commonId)),
  };
}

function parseCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match || Number(match[1]) < 1) return null;
  const date = new Date(`${match[0]}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== match[0]) return null;
  return { date, year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), iso: match[0] };
}

export function formatKoreanDate(iso, withDay = true) {
  const parsed = parseCalendarDate(iso);
  if (!parsed) return '날짜 미정';
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][parsed.date.getUTCDay()];
  return `${parsed.year}년 ${parsed.month}월 ${parsed.day}일${withDay ? ` (${weekday})` : ''}`;
}

const icsEscape = (value) => safeText(value, 20000).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const utcStamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

/** Fold iCalendar lines at 75 UTF-8 octets without splitting a Unicode character. */
function foldICSLine(line) {
  const encoder = new TextEncoder();
  const lines = [];
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      lines.push(current);
      current = ' ';
      bytes = 1;
    }
    current += character;
    bytes += size;
  }
  lines.push(current);
  return lines.join('\r\n');
}

/** Returns an RFC 5545 calendar string; event times are local Asia/Seoul times. */
export function createEventICS(event, now = new Date()) {
  const calendarDate = parseCalendarDate(event?.date);
  if (!calendarDate) throw new TypeError('올바른 행사 날짜가 필요합니다.');
  const dateLines = [];
  if (event.startTime) {
    const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (!timePattern.test(event.startTime) || !timePattern.test(event.endTime || '')) throw new TypeError('올바른 행사 시작·종료 시각이 필요합니다.');
    const start = new Date(`${calendarDate.iso}T${event.startTime}:00+09:00`);
    const end = new Date(`${calendarDate.iso}T${event.endTime}:00+09:00`);
    if (end <= start) throw new RangeError('행사 종료 시각은 시작 시각보다 늦어야 합니다.');
    dateLines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`);
  } else {
    const nextDay = new Date(calendarDate.date.getTime() + 86400000);
    dateLines.push(`DTSTART;VALUE=DATE:${calendarDate.iso.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${nextDay.toISOString().slice(0, 10).replace(/-/g, '')}`);
  }
  const demo = event.sourceStatus === '시연 자료';
  const description = [event.description, event.host ? `주최: ${event.host}` : '', demo ? '시연용 행사입니다. 실제 행사가 아닙니다.' : ''].filter(Boolean).join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gyeongju Kim Clan Demo//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-TIMEZONE:Asia/Seoul',
    'BEGIN:VEVENT',
    `UID:${encodeURIComponent(safeText(event.id || calendarDate.iso, 100))}@gyeongju-kim-clan.demo`,
    `DTSTAMP:${utcStamp(now)}`,
    ...dateLines,
    `SUMMARY:${icsEscape(`${demo ? '[시연] ' : ''}${event.title || '행사'}`)}`,
    `LOCATION:${icsEscape(event.location || '')}`,
    `DESCRIPTION:${icsEscape(description)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldICSLine).join('\r\n')}\r\n`;
}

export function validatePost(input = {}) {
  const values = {
    title: safeText(input.title, 81).replace(/\s+/g, ' '),
    content: safeText(input.content, 3001),
    category: safeText(input.category || '자유 이야기', 31),
  };
  const errors = {};
  const titleLength = Array.from(values.title).length;
  const contentLength = Array.from(values.content).length;
  if (titleLength < 2 || titleLength > 80) errors.title = '제목을 2~80자로 입력해 주세요.';
  if (contentLength < 5 || contentLength > 3000) errors.content = '내용을 5~3,000자로 입력해 주세요.';
  if (!values.category || Array.from(values.category).length > 30) errors.category = '게시판 분류를 1~30자로 입력해 주세요.';
  return { valid: Object.keys(errors).length === 0, errors, values };
}
