import { safeText, validatePost, formatKoreanDate } from './domain.js';

/** Community and resource screens. Every mutation is local and rolls back on failed persistence. */
export function createCommunity(ctx) {
  const { db, seedPosts, resources, icon, esc, button, showModal, closeModal, toast, refresh, persist } = ctx;
  let category = '전체';
  let query = '';
  let savedPostsOnly = false;
  let resourceCategory = '전체';
  let resourceQuery = '';
  let savedResourcesOnly = false;
  let deletedPost = null;
  const list = (value) => Array.isArray(value) ? value : [];
  const allPosts = () => [...list(db.posts), ...list(seedPosts)];
  const postById = (id) => allPosts().find((post) => post.id === id);
  const isOwn = (id) => list(db.posts).some((post) => post.id === id) && !list(seedPosts).some((post) => post.id === id);
  const saved = (key) => list(db.bookmarks).includes(key);
  const liked = (id) => list(db.likes).includes(id);
  const commentsFor = (post) => [...list(post.comments), ...list(db.comments?.[post.id])];
  const categories = () => [...new Set(allPosts().map((post) => safeText(post.category, 30)).filter(Boolean))];
  const resourceCategories = () => [...new Set(list(resources).map((resource) => resource.category))];
  const isPublicResource = (resource) => resource.sourceStatus === '공개 기관 자료 요약';
  const localNote = '이 브라우저에 저장됩니다. 다른 종친에게 전송되지 않습니다.';
  const newId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
  const koreanToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const paragraphs = (text) => safeText(text, 20000).split(/\n{2,}/).map((part) => `<p>${esc(part).replace(/\n/g, '<br>')}</p>`).join('');
  const initials = (name) => esc(Array.from(safeText(name || '종친', 80))[0] || '종');
  const numericCount = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
  const matches = (text, term) => safeText(term, 100).normalize('NFKC').toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean).every((token) => String(text).normalize('NFKC').toLocaleLowerCase('ko-KR').includes(token));
  const tab = (label, action, active) => `<button type="button" class="${active ? 'active' : ''}" data-action="${action}" data-id="${esc(label)}" aria-pressed="${active}">${esc(label)}</button>`;

  function saveMutation(mutate, failureMessage = '브라우저에 저장하지 못했습니다. 저장 공간과 브라우저 설정을 확인해 주세요.') {
    const previous = { posts: db.posts, comments: db.comments, likes: db.likes, bookmarks: db.bookmarks };
    try {
      mutate();
      if (persist() === true) return true;
    } catch (_) {
      // A failed local write must never look like a successful submission.
    }
    Object.assign(db, previous);
    if (failureMessage) toast(failureMessage);
    return false;
  }

  // Raster data only: never interpolate a remote URL, SVG, or arbitrary data URL.
  function validImageURL(value) {
    return typeof value === 'string' && value.length <= 1066800 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
  }

  function postImage(post) {
    return validImageURL(post.image) ? `<img class="post-image" src="${esc(post.image)}" alt="${esc(post.imageName ? `첨부 사진: ${post.imageName}` : '이 브라우저에 저장한 첨부 사진')}" loading="lazy">` : '';
  }

  function postControls(post, allowDelete = false) {
    const id = esc(post.id);
    return `<div class="post-footer">
      <button type="button" data-action="community-like" data-id="${id}" aria-pressed="${liked(post.id)}" aria-label="${liked(post.id) ? '공감 취소' : '공감하기'}">${icon('heart')} 공감 ${numericCount(post.likes) + (liked(post.id) ? 1 : 0)}</button>
      <button type="button" data-action="community-open" data-id="${id}">${icon('chat')} 댓글 ${commentsFor(post).length}</button>
      <button type="button" data-action="community-bookmark" data-id="${id}" aria-pressed="${saved(`post:${post.id}`)}">${icon('bookmark')} ${saved(`post:${post.id}`) ? '저장됨' : '글 저장'}</button>
      ${allowDelete && isOwn(post.id) ? `<button type="button" class="text-link" data-action="community-delete" data-id="${id}">내 글 삭제</button>` : `<button type="button" class="text-link" data-action="community-open" data-id="${id}">이야기 읽기 ${icon('arrow')}</button>`}
    </div>`;
  }

  function renderPost(post) {
    const excerpt = safeText(post.content, 155).replace(/\s+/g, ' ');
    return `<article class="post-card">
      <div class="post-header"><div class="post-avatar" aria-hidden="true">${initials(post.author)}</div><div><div class="post-author">${esc(post.author || '시연 회원')}</div><div class="post-meta"><span>${esc(formatKoreanDate(post.date, false))}</span><span>·</span><span>${isOwn(post.id) ? '이 브라우저의 글' : '시연 게시글'}</span></div></div><span class="badge ${isOwn(post.id) ? 'gold' : 'soft'}">${esc(post.category)}</span></div>
      <h2><button type="button" class="post-title" style="border:0;padding:0;background:transparent;text-align:left" data-action="community-open" data-id="${esc(post.id)}">${esc(post.title)}</button></h2>
      <p class="post-excerpt">${esc(excerpt)}${Array.from(String(post.content || '')).length > 155 ? '…' : ''}</p>
      ${postImage(post)}${postControls(post)}
    </article>`;
  }

  function renderCommunity() {
    const filtered = allPosts().filter((post) => (category === '전체' || post.category === category) && (!savedPostsOnly || saved(`post:${post.id}`)) && matches(`${post.title} ${post.content} ${post.author}`, query));
    const localComments = Object.values(db.comments || {}).reduce((sum, comments) => sum + list(comments).length, 0);
    return `<div class="page-wrap">
      <div class="page-heading"><div><p class="eyebrow">${icon('users')} 마음을 나누는 자리</p><h1>종친 이야기</h1><p class="page-intro">서로의 안부를 묻고, 가족의 소중한 이야기를 기록해 보세요.</p></div>${button('글쓰기', 'community-compose', '', 'primary')}</div>
      <div class="tabs" role="group" aria-label="게시판 분류">${['전체', ...categories()].map((item) => tab(item, 'community-filter', category === item)).join('')}</div>
      <form id="community-search-form" class="toolbar" role="search"><div class="search-field"><label for="community-query">이야기 검색</label>${icon('search')}<input id="community-query" name="query" type="search" maxlength="100" value="${esc(query)}" placeholder="제목, 내용, 작성자로 찾아보세요"></div><button type="submit" class="button primary">검색</button><button type="button" class="button secondary" data-action="community-saved" aria-pressed="${savedPostsOnly}">${icon('bookmark')} 저장한 글</button></form>
      <div class="community-layout"><section aria-label="게시글 목록"><div class="results-bar"><p id="community-results" tabindex="-1" aria-live="polite">${savedPostsOnly ? '저장한 글' : '이야기'} <strong>${filtered.length}</strong>개${query ? ` · “${esc(query)}” 검색` : ''}</p>${category !== '전체' || query || savedPostsOnly ? button('필터 초기화', 'community-reset', '', 'ghost small') : '<span>최신 작성순</span>'}</div><div class="community-list">${filtered.length ? filtered.map(renderPost).join('') : `<div class="empty-state">${icon('chat')}<h2>조건에 맞는 이야기가 없어요</h2><p>검색어를 바꾸거나 다른 게시판을 살펴보세요. 관심 있는 글은 저장해 두고 다시 읽을 수 있습니다.</p>${button('전체 이야기 보기', 'community-reset')}</div>`}</div></section>
      <aside class="community-aside"><section class="panel"><h2>함께 읽는 공간</h2><p>안부 한마디, 오래된 사진에 얽힌 이야기, 궁금한 점을 편하게 남겨 보세요.</p><div class="info-callout">${icon('info')}<div><strong>브라우저에서 체험 중</strong>${localNote}</div></div></section><section class="panel"><h2>나의 체험 기록</h2><div class="stat-list"><div><span>내가 쓴 글</span><strong>${list(db.posts).length}</strong></div><div><span>내가 쓴 댓글</span><strong>${localComments}</strong></div><div><span>저장한 이야기</span><strong>${allPosts().filter((post) => saved(`post:${post.id}`)).length}</strong></div></div></section><section class="panel"><h2>기록의 첫걸음</h2><p>가족 기록에 설명과 출처를 남기는 방법부터 천천히 알아보세요.</p>${button('기록 안내 읽기', 'resource-open', 'r03', 'secondary small')}</section></aside></div>
    </div>`;
  }

  function renderResources() {
    const filtered = list(resources).filter((resource) => (resourceCategory === '전체' || resource.category === resourceCategory) && (!savedResourcesOnly || saved(`resource:${resource.id}`)) && matches(`${resource.title} ${resource.description} ${resource.content}`, resourceQuery));
    return `<div class="page-wrap"><div class="page-heading"><div><p class="eyebrow">${icon('book')} 세대를 잇는 배움</p><h1>자료실</h1><p class="page-intro">경주의 역사와 문화를 살펴보고, 가족의 기록을 남기는 방법을 배워 보세요.</p></div></div>
      <div class="info-callout">${icon('info')}<div><strong>역사·문화와 가족 기록</strong>역사·문화 자료는 UNESCO와 경주시의 공개 자료를 확인한 요약이며 출처 원문을 함께 제공합니다. 계보 이용 안내는 시연 콘텐츠입니다. 실제 회원 족보·항렬표는 등록되지 않았습니다.</div></div>
      <div class="tabs" role="group" aria-label="자료 분류">${['전체', ...resourceCategories()].map((item) => tab(item, 'resource-filter', resourceCategory === item)).join('')}</div>
      <form id="resource-search-form" class="toolbar" role="search"><div class="search-field"><label for="resource-query">자료 검색</label>${icon('search')}<input id="resource-query" name="query" type="search" maxlength="100" value="${esc(resourceQuery)}" placeholder="계보, 가족사진, 큰 글씨 등을 검색하세요"></div><button type="submit" class="button primary">검색</button><button type="button" class="button secondary" data-action="resource-saved" aria-pressed="${savedResourcesOnly}">${icon('bookmark')} 저장한 자료</button></form>
      <div class="results-bar"><p id="resource-results" tabindex="-1" aria-live="polite">${savedResourcesOnly ? '저장한 자료' : '읽을거리'} <strong>${filtered.length}</strong>개</p>${resourceCategory !== '전체' || resourceQuery || savedResourcesOnly ? button('필터 초기화', 'resource-reset', '', 'ghost small') : '<span>원문 전체를 바로 읽을 수 있어요</span>'}</div>
      ${filtered.length ? `<div class="resource-grid">${filtered.map((resource) => `<article class="resource-card"><div class="resource-icon" aria-hidden="true">${icon(({ archive: 'history', image: 'photo', accessibility: 'user' })[resource.icon] || resource.icon || 'book')}</div><div class="resource-body"><span class="badge soft">${esc(resource.category)}</span><h2>${esc(resource.title)}</h2><p>${esc(resource.description)}</p><p class="field-help">약 ${numericCount(resource.readingMinutes)}분 · ${isPublicResource(resource) ? '공개 기관 자료 요약' : '시연 사용 안내'}</p><button type="button" class="text-link" data-action="resource-open" data-id="${esc(resource.id)}">${saved(`resource:${resource.id}`) ? `${icon('bookmark')} ` : ''}자료 읽기 ${icon('arrow')}</button></div></article>`).join('')}</div>` : `<div class="empty-state">${icon('book')}<h2>조건에 맞는 자료가 없어요</h2><p>검색어를 바꾸거나 전체 자료를 살펴보세요. 읽고 싶은 자료는 북마크로 저장할 수 있습니다.</p>${button('전체 자료 보기', 'resource-reset')}</div>`}
    </div>`;
  }

  function openPost(id) {
    const post = postById(id);
    if (!post) { toast('게시글을 찾을 수 없습니다.'); return; }
    const comments = commentsFor(post);
    const body = `<div class="detail-meta"><span>${icon('user')} ${esc(post.author || '시연 회원')}</span><span>${icon('calendar')} ${esc(formatKoreanDate(post.date, false))}</span><span class="badge soft">${esc(post.category)}</span><span>${isOwn(id) ? '이 브라우저에서 작성' : '시연 자료'}</span></div><article class="detail-content">${paragraphs(post.content)}${postImage(post)}</article>${postControls(post, true)}
      <section aria-labelledby="community-comments-title"><h3 id="community-comments-title" style="margin-top:24px">댓글 ${comments.length}</h3><div class="comment-list">${comments.length ? comments.map((comment) => `<article class="comment"><div class="post-header"><div class="post-avatar" aria-hidden="true">${initials(comment.author)}</div><div><div class="post-author">${esc(comment.author || '시연 회원')}</div><div class="post-meta">${esc(formatKoreanDate(comment.date, false))}</div></div></div>${paragraphs(comment.content)}</article>`).join('') : '<p class="field-help" style="padding:16px 0">아직 댓글이 없습니다. 첫 이야기를 남겨 보세요.</p>'}</div>
      <form id="community-comment-form" class="comment-form" data-id="${esc(id)}" novalidate><label class="sr-only" for="community-comment-content">댓글 내용</label><textarea id="community-comment-content" name="content" required maxlength="1000" placeholder="따뜻한 댓글을 남겨 주세요" aria-describedby="community-comment-help community-comment-error"></textarea><button class="button primary" type="submit">댓글 저장</button></form><p id="community-comment-help" class="field-help">${localNote}</p><p id="community-comment-error" class="form-error" role="alert"></p></section>`;
    showModal(post.title, body, button('닫기', 'community-close'), isOwn(id) ? '이 브라우저의 이야기' : '시연 커뮤니티');
  }

  function openComposer() {
    const choices = categories();
    if (!choices.length) choices.push('자유 이야기');
    showModal('새 이야기 쓰기', `<div class="info-callout">${icon('info')}<div><strong>브라우저에 기록하는 체험 글</strong>${localNote}</div></div><form id="community-post-form" class="form-grid" novalidate><div class="field full-width"><label for="community-post-category">게시판</label><select id="community-post-category" name="category">${choices.map((item) => `<option value="${esc(item)}" ${item === category ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></div><div class="field full-width"><label for="community-post-title">제목</label><input id="community-post-title" name="title" required minlength="2" maxlength="80" placeholder="이야기의 제목을 적어 주세요" aria-describedby="community-post-error"></div><div class="field full-width"><label for="community-post-content">이야기</label><textarea id="community-post-content" name="content" required minlength="5" maxlength="3000" rows="7" placeholder="안부, 질문, 가족 이야기를 편하게 적어 주세요" aria-describedby="community-post-error"></textarea><p class="field-help">5~3,000자 · 실제 개인정보를 입력하지 않아도 체험할 수 있습니다.</p></div><div class="field full-width"><label for="community-post-image">사진 한 장 · 선택</label><input id="community-post-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="community-image-help"><p id="community-image-help" class="field-help">JPEG·PNG·WebP, 최대 800KB. 선택한 사진도 이 브라우저에만 저장되며 업로드되지 않습니다.</p><button type="button" class="text-link" data-action="community-clear-image">사진 선택 해제</button></div><p id="community-post-error" class="form-error full-width" role="alert"></p></form>`, `${button('취소', 'community-close')}<button class="button primary" type="submit" form="community-post-form">이 브라우저에 저장</button>`, '내가 쓴 글은 이 기기의 체험 기록에서 확인할 수 있습니다.');
  }

  function openResource(id) {
    const resource = list(resources).find((item) => item.id === id);
    if (!resource) { toast('자료를 찾을 수 없습니다.'); return; }
    const sourceLinks = list(resource.sourceLinks).map((source) => {
      try {
        const url = new URL(String(source.url));
        if (url.protocol !== 'https:' || url.username || url.password) return '';
        return `<li><a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(source.label || url.hostname)} <span class="sr-only">새 창에서 열기</span></a></li>`;
      } catch (_) { return ''; }
    }).filter(Boolean).join('');
    const sourceNotice = isPublicResource(resource)
      ? `<h3>확인한 공개 역사·문화 자료</h3><p>아래 공개 기관의 설명을 확인해 요약했습니다. 상세 내용은 출처 원문에서 확인할 수 있습니다. 설화는 설화로 구분하며 회원의 실제 계보와 연결하지 않습니다.</p>${sourceLinks ? `<ul class="detail-content">${sourceLinks}</ul>` : ''}`
      : '<h3>시연 사용 안내</h3><p>이 글은 시연 앱의 이용과 가족 기록을 돕기 위한 안내입니다. 실제 족보나 특정 분파의 공인 자료가 아닙니다.</p>';
    showModal(resource.title, `<article data-resource-id="${esc(id)}"><div class="detail-meta"><span class="badge soft">${esc(resource.category)}</span><span>약 ${numericCount(resource.readingMinutes)}분</span><span>${isPublicResource(resource) ? '공개 기관 자료 요약' : '시연 사용 안내'}</span></div><div class="detail-content">${paragraphs(resource.content)}</div><div class="content-block">${sourceNotice}</div></article>`, `<button type="button" class="button secondary" data-action="resource-bookmark" data-id="${esc(id)}" aria-pressed="${saved(`resource:${id}`)}">${icon('bookmark')} ${saved(`resource:${id}`) ? '저장 해제' : '자료 저장'}</button>${button('닫기', 'community-close')}`, resource.description);
  }

  function updatePostView(id, element) {
    const insideDialog = Boolean(element?.closest?.('dialog[open]'));
    const commentInput = document.getElementById('community-comment-content');
    const draft = insideDialog ? commentInput?.value || '' : '';
    refresh();
    if (insideDialog) {
      openPost(id);
      const replacement = document.getElementById('community-comment-content');
      if (replacement) replacement.value = draft;
    }
  }

  function confirmDelete(id) {
    const post = postById(id);
    if (!post || !isOwn(id)) { toast('이 브라우저에서 작성한 글만 삭제할 수 있습니다.'); return; }
    showModal('이 글을 삭제할까요?', `<div class="content-block"><h3>${esc(post.title)}</h3><p>${esc(post.author || '내 글')} · ${esc(formatKoreanDate(post.date, false))}</p></div><p>이 브라우저의 글과 첨부 사진, 이 글에 남긴 체험 댓글·공감·북마크를 삭제합니다. 삭제 완료 화면에서 바로 되돌릴 수 있습니다.</p>`, `${button('글로 돌아가기', 'community-open', id)}${button('글 삭제', 'community-confirm-delete', id, 'danger')}`, '선택한 글 한 개에만 적용됩니다.');
  }

  function removePost(id) {
    if (!isOwn(id)) { toast('시연 게시글은 삭제할 수 없습니다.'); return; }
    const index = list(db.posts).findIndex((post) => post.id === id);
    const restore = { post: db.posts[index], index, comments: db.comments?.[id], liked: liked(id), bookmarked: saved(`post:${id}`) };
    if (!saveMutation(() => {
      db.posts = list(db.posts).filter((post) => post.id !== id);
      db.comments = { ...(db.comments || {}) };
      delete db.comments[id];
      db.likes = list(db.likes).filter((postId) => postId !== id);
      db.bookmarks = list(db.bookmarks).filter((key) => key !== `post:${id}`);
    })) return;
    deletedPost = restore;
    refresh();
    showModal('글을 삭제했습니다', `<p>“${esc(restore.post.title)}” 글을 이 브라우저에서 삭제했습니다.</p><p class="field-help">이 창에서 되돌리면 글과 사진, 댓글·공감·북마크를 함께 복원합니다.</p>`, `${button('되돌리기', 'community-undo-delete', id)}${button('목록으로', 'community-close', '', 'primary')}`);
  }

  function restorePost(id) {
    const restore = deletedPost;
    if (!restore || restore.post.id !== id) { toast('되돌릴 글을 찾을 수 없습니다.'); return; }
    if (postById(id)) { toast('이미 존재하는 글입니다.'); return; }
    if (!saveMutation(() => {
      db.posts = [...list(db.posts)];
      db.posts.splice(Math.min(restore.index, db.posts.length), 0, restore.post);
      if (restore.comments) db.comments = { ...(db.comments || {}), [id]: restore.comments };
      if (restore.liked) db.likes = [...new Set([...list(db.likes), id])];
      if (restore.bookmarked) db.bookmarks = [...new Set([...list(db.bookmarks), `post:${id}`])];
    })) return;
    deletedPost = null;
    refresh();
    openPost(id);
    toast('이 브라우저의 글을 복원했습니다.');
  }

  function handleClick(action, element) {
    const id = element?.dataset?.id || '';
    if (action === 'community-open') { openPost(id); return true; }
    if (action === 'community-compose') { openComposer(); return true; }
    if (action === 'community-close') { closeModal(); return true; }
    if (action === 'community-clear-image') {
      const input = document.getElementById('community-post-image');
      if (input) input.value = '';
      return true;
    }
    if (action === 'community-filter') { category = ['전체', ...categories()].includes(id) ? id : '전체'; refresh(); return true; }
    if (action === 'community-reset') { category = '전체'; query = ''; savedPostsOnly = false; refresh(); return true; }
    if (action === 'community-saved') { savedPostsOnly = !savedPostsOnly; refresh(); return true; }
    if (action === 'community-delete') { confirmDelete(id); return true; }
    if (action === 'community-confirm-delete') { removePost(id); return true; }
    if (action === 'community-undo-delete') { restorePost(id); return true; }
    if (action === 'community-like') {
      if (!postById(id)) { toast('게시글을 찾을 수 없습니다.'); return true; }
      const previous = liked(id);
      if (saveMutation(() => { db.likes = previous ? list(db.likes).filter((key) => key !== id) : [...list(db.likes), id]; })) {
        updatePostView(id, element);
        toast(previous ? '이 브라우저의 공감을 취소했습니다.' : '이 브라우저에 공감을 기록했습니다.');
      }
      return true;
    }
    if (action === 'community-bookmark' || action === 'resource-bookmark') {
      const resourceMode = action === 'resource-bookmark';
      if (!(resourceMode ? list(resources).some((resource) => resource.id === id) : postById(id))) { toast('저장할 내용을 찾을 수 없습니다.'); return true; }
      const key = `${resourceMode ? 'resource' : 'post'}:${id}`;
      const previous = saved(key);
      const insideDialog = Boolean(element?.closest?.('dialog[open]'));
      if (saveMutation(() => { db.bookmarks = previous ? list(db.bookmarks).filter((entry) => entry !== key) : [...list(db.bookmarks), key]; })) {
        if (resourceMode) { refresh(); if (insideDialog) openResource(id); }
        else updatePostView(id, element);
        toast(previous ? '북마크를 해제했습니다.' : '이 브라우저에 북마크를 저장했습니다.');
      }
      return true;
    }
    if (action === 'resource-open') { openResource(id); return true; }
    if (action === 'resource-filter') { resourceCategory = ['전체', ...resourceCategories()].includes(id) ? id : '전체'; refresh(); return true; }
    if (action === 'resource-reset') { resourceCategory = '전체'; resourceQuery = ''; savedResourcesOnly = false; refresh(); return true; }
    if (action === 'resource-saved') { savedResourcesOnly = !savedResourcesOnly; refresh(); return true; }
    return false;
  }

  function setFormError(form, message, fieldName = '') {
    const target = document.getElementById(form.id === 'community-comment-form' ? 'community-comment-error' : 'community-post-error');
    if (target) target.textContent = message;
    for (const field of form.querySelectorAll('[aria-invalid]')) field.removeAttribute('aria-invalid');
    const field = fieldName ? form.elements.namedItem(fieldName) : null;
    if (field?.focus) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }

  function readLocalImage(file) {
    if (!file || !file.size) return Promise.resolve('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return Promise.reject(new Error('사진은 JPEG·PNG·WebP 형식으로 선택해 주세요.'));
    if (file.size > 800000) return Promise.reject(new Error('사진은 800KB 이하로 선택해 주세요.'));
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('사진을 읽지 못했습니다. 파일을 다시 선택해 주세요.'));
      reader.onabort = () => reject(new Error('사진 읽기가 취소되었습니다.'));
      reader.onload = () => validImageURL(reader.result) ? resolve(reader.result) : reject(new Error('선택한 사진을 표시할 수 없습니다. 다른 파일을 선택해 주세요.'));
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit(eventOrForm) {
    const form = eventOrForm?.tagName === 'FORM' ? eventOrForm : eventOrForm?.target?.closest?.('form');
    if (!form || !['community-search-form', 'resource-search-form', 'community-post-form', 'community-comment-form'].includes(form.id)) return false;
    eventOrForm?.preventDefault?.();
    if (form.id === 'community-search-form' || form.id === 'resource-search-form') {
      const value = safeText(form.elements.namedItem('query')?.value, 100);
      if (form.id === 'community-search-form') query = value; else resourceQuery = value;
      const resultId = form.id === 'community-search-form' ? 'community-results' : 'resource-results';
      refresh();
      document.getElementById(resultId)?.focus({ preventScroll: true });
      return true;
    }
    if (form.dataset.saving === 'true') return true;
    setFormError(form, '');
    if (form.id === 'community-comment-form') {
      const id = form.dataset.id;
      const content = safeText(form.elements.namedItem('content')?.value, 1001);
      if (!content || Array.from(content).length > 1000) { setFormError(form, '댓글을 1~1,000자로 입력해 주세요.', 'content'); return true; }
      if (!postById(id)) { setFormError(form, '게시글을 찾을 수 없습니다.'); return true; }
      const comment = { id: newId('local-comment'), author: `${safeText(db.profile?.name || '체험 회원', 40)} · 이 브라우저`, content, date: koreanToday(), sourceStatus: '브라우저 체험 기록' };
      if (!saveMutation(() => { db.comments = { ...(db.comments || {}), [id]: [...list(db.comments?.[id]), comment] }; }, '')) { setFormError(form, '댓글을 저장하지 못했습니다. 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.'); return true; }
      refresh();
      openPost(id);
      toast('댓글을 이 브라우저에 저장했습니다.');
      return true;
    }
    const validation = validatePost({ title: form.elements.namedItem('title')?.value, category: form.elements.namedItem('category')?.value, content: form.elements.namedItem('content')?.value });
    if (!validation.valid) { const [field, message] = Object.entries(validation.errors)[0]; setFormError(form, message, field); return true; }
    form.dataset.saving = 'true';
    const submit = document.querySelector('button[form="community-post-form"][type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const file = form.elements.namedItem('image')?.files?.[0];
      const image = await readLocalImage(file);
      const dialog = form.closest('dialog');
      if (!form.isConnected || (dialog && !dialog.open)) return true;
      const post = { ...validation.values, id: newId('local-post'), author: `${safeText(db.profile?.name || '체험 회원', 40)} · 이 브라우저`, date: koreanToday(), likes: 0, comments: [], tags: [], sourceStatus: '브라우저 체험 기록', image, imageName: image ? safeText(file.name, 120) : '' };
      if (!saveMutation(() => { db.posts = [post, ...list(db.posts)]; }, '')) { setFormError(form, '글을 저장하지 못했습니다. 사진을 빼거나 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.'); return true; }
      category = '전체'; query = ''; savedPostsOnly = false;
      refresh();
      openPost(post.id);
      toast('새 글을 이 브라우저에 저장했습니다.');
    } catch (error) {
      if (form.isConnected) setFormError(form, error instanceof Error ? error.message : '사진을 읽거나 글을 저장하지 못했습니다.');
    } finally {
      form.dataset.saving = 'false';
      if (submit) submit.disabled = false;
    }
    return true;
  }

  return { renderCommunity, renderResources, openPost, openComposer, openResource, handleClick, handleSubmit };
}
