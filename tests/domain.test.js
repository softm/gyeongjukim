import test from 'node:test';
import assert from 'node:assert/strict';
import { people, events, demoProfile } from '../assets/data.js';
import { searchPeople, getPersonRelations, findKinship, formatKoreanDate, createEventICS, escapeHtml, safeText, validatePost } from '../assets/domain.js';

test('search combines name tokens, fictional branch, and numeric generation without mutation', () => {
  const snapshot = JSON.stringify(people);
  assert.deepEqual(searchPeople(people, { query: '  김가온 서울 ', branch: '시연 가문 A', generation: '3' }).map((person) => person.id), ['p09']);
  assert.equal(searchPeople(people, { query: '김가온', branch: '시연 가문 B' }).length, 0);
  assert.equal(searchPeople(people, { branch: '전체', generation: 'all' }).length, people.length);
  assert.equal(searchPeople(people, { query: '존재하지않는이름' }).length, 0);
  assert.equal(JSON.stringify(people), snapshot);
});

test('family relations include both parents, spouse, children and siblings', () => {
  const relations = getPersonRelations(people, demoProfile.personId);
  assert.equal(relations.person.name, '김가온');
  assert.deepEqual(relations.parents.map((person) => person.id), ['p03', 'p04']);
  assert.deepEqual(relations.spouses.map((person) => person.id), ['p10']);
  assert.deepEqual(relations.children.map((person) => person.id), ['p15', 'p16']);
  assert.deepEqual(relations.siblings.map((person) => person.id), ['p11']);
  assert.equal(getPersonRelations(people, 'missing').person, null);
});

test('cousin path follows the common ancestor in the correct order', () => {
  const result = findKinship(people, 'p09', 'p12');
  assert.equal(result.found, true);
  assert.equal(result.distance, 4);
  assert.equal(result.label, '사촌 · 4촌');
  assert.deepEqual(result.path.map((person) => person.id), ['p09', 'p03', 'p01', 'p05', 'p12']);
  assert.equal(findKinship(people, 'p09', 'p01').label, '조부모 · 2촌');
  assert.equal(findKinship(people, 'p01', 'p09').label, '손자녀 · 2촌');
  assert.equal(findKinship(people, 'p09', 'p09').distance, 0);
});

test('spouses are not treated as blood relatives through their shared child', () => {
  const result = findKinship(people, 'p09', 'p10');
  assert.equal(result.found, false);
  assert.equal(result.distance, null);
  assert.deepEqual(result.path, []);
  const explicitMarriage = [
    { id: 'a', parentIds: [], spouseIds: ['b'] },
    { id: 'b', parentIds: [], spouseIds: ['a'] },
  ];
  assert.equal(findKinship(explicitMarriage, 'a', 'b').found, false);
});

test('maternal and half-sibling links are included without requiring surname matches', () => {
  assert.equal(findKinship(people, 'p15', 'p10').distance, 1);
  const records = [
    { id: 'parent', parentIds: [] },
    { id: 'a', parentIds: ['parent', 'missing'] },
    { id: 'b', parentIds: ['parent'] },
  ];
  assert.equal(findKinship(records, 'a', 'b').label, '형제자매 · 2촌');
});

test('cyclic and disconnected genealogy is handled without inventing a path', () => {
  const cyclic = [
    { id: 'a', parentIds: ['b'] },
    { id: 'b', parentIds: ['a'] },
    { id: 'c', parentIds: ['a'] },
  ];
  const result = findKinship(cyclic, 'a', 'c');
  assert.equal(result.found, false);
  assert.match(result.label, /순환/);
  const disconnected = [{ id: 'a', parentIds: ['missing'] }, { id: 'b', parentIds: [] }];
  assert.equal(findKinship(disconnected, 'a', 'b').found, false);
  assert.equal(findKinship(disconnected, 'a', 'unknown').found, false);
});

test('calendar generation converts Korea times to UTC and marks fictional events', () => {
  const result = createEventICS(events[0], new Date('2026-10-19T14:00:00Z'));
  const unfolded = result.replace(/\r\n[ \t]/g, '');
  assert.match(unfolded, /DTSTART:20261114T010000Z\r\n/);
  assert.match(unfolded, /DTEND:20261114T033000Z\r\n/);
  assert.match(unfolded, /DTSTAMP:20261019T140000Z\r\n/);
  assert.match(unfolded, /SUMMARY:\[시연\]/);
  assert.match(unfolded, /실제 행사가 아닙니다/);
  assert.ok(result.endsWith('END:VCALENDAR\r\n'));
});

test('calendar text escapes newlines, separators and backslashes; UTF-8 folding preserves text', () => {
  const event = {
    ...events[0],
    title: '가족, 기록; \\ 함께',
    location: '서울\r\nATTENDEE:unwanted@example.invalid',
    description: `${'한글 설명 '.repeat(25)}\n둘째 줄; 쉼표, 경로\\기록`,
  };
  const result = createEventICS(event);
  const unfolded = result.replace(/\r\n[ \t]/g, '');
  assert.ok(unfolded.includes('가족\\, 기록\\; \\\\ 함께'));
  assert.ok(unfolded.includes('LOCATION:서울\\nATTENDEE:unwanted@example.invalid'));
  assert.ok(!result.split('\r\n').some((line) => line.startsWith('ATTENDEE:')));
  assert.ok(unfolded.includes('둘째 줄\\; 쉼표\\, 경로\\\\기록'));
  assert.ok(!result.includes('\uFFFD'));
  for (const line of result.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
});

test('calendar validates real dates and times and uses exclusive all-day end dates', () => {
  assert.throws(() => createEventICS({ ...events[0], date: '2026-02-30' }), /날짜/);
  assert.throws(() => createEventICS({ ...events[0], startTime: '25:00' }), /시각/);
  assert.throws(() => createEventICS({ ...events[0], endTime: '09:00' }), /늦어야/);
  const allDay = createEventICS({ id: 'day', title: '종일 시연', date: '2026-12-31' });
  assert.match(allDay, /DTSTART;VALUE=DATE:20261231/);
  assert.match(allDay, /DTEND;VALUE=DATE:20270101/);
  assert.equal(formatKoreanDate('2026-11-14'), '2026년 11월 14일 (토)');
  assert.equal(formatKoreanDate('2026-11-14', false), '2026년 11월 14일');
  assert.equal(formatKoreanDate('2026-02-30'), '날짜 미정');
});

test('plain text normalization and HTML escaping prevent markup from becoming executable', () => {
  const attack = `<img src=x onerror="alert('x')">&`;
  assert.equal(escapeHtml(attack), '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;');
  assert.equal(escapeHtml(null), '');
  assert.equal(safeText('  가족\u0000 기록\r\n다음 줄  '), '가족 기록\n다음 줄');
  assert.equal(safeText('가족😀기록', 3), '가족😀');
});

test('post validation rejects blank and oversized content while preserving multiline plain text', () => {
  assert.equal(validatePost({ title: ' ', content: '' }).valid, false);
  assert.equal(validatePost({ title: '가'.repeat(81), content: '충분히 긴 내용입니다.' }).valid, false);
  assert.equal(validatePost({ title: '제목입니다', content: '가'.repeat(3001) }).valid, false);
  const result = validatePost({ title: '  새 글  ', content: '첫째 줄\r\n둘째 줄', category: '가족 기록' });
  assert.equal(result.valid, true);
  assert.deepEqual(result.values, { title: '새 글', content: '첫째 줄\n둘째 줄', category: '가족 기록' });
});

test('all genealogy people are fictional and person references are internally consistent', () => {
  const ids = new Set(people.map((person) => person.id));
  for (const person of people) {
    assert.equal(person.sourceStatus, '시연 자료');
    assert.equal(person.verified, false);
    assert.ok(!('phone' in person));
    assert.ok(!('dateOfBirth' in person));
    for (const related of [...person.parentIds, ...person.spouseIds]) assert.ok(ids.has(related));
  }
});
