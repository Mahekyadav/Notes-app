(() => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!token || !user) {
    window.location.href = 'auth.html';
    return;
  }

  // ── State ──────────────────────────────────────────────
  let allNotes = [];
  let allTags = [];
  let activeNoteId = null;
  let activeTag = '';
  let searchQuery = '';
  let searchTimer = null;

  // ── DOM refs ───────────────────────────────────────────
  const noteList = document.getElementById('noteList');
  const noteTitle = document.getElementById('noteTitle');
  const noteContent = document.getElementById('noteContent');
  const tagCheckboxes = document.getElementById('tagCheckboxes');
  const editorForm = document.getElementById('editorForm');
  const editorEmpty = document.getElementById('editorEmpty');
  const tagFilterList = document.getElementById('tagFilterList');
  const searchInput = document.getElementById('searchInput');
  const userInfo = document.getElementById('userInfo');
  const pinBtn = document.getElementById('pinBtn');

  userInfo.textContent = `${user.username} (${user.email})`;

  // ── API helpers ────────────────────────────────────────
  async function api(method, path, body) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    if (res.status === 401) {
      localStorage.clear();
      window.location.href = 'auth.html';
      return;
    }
    return res;
  }

  // ── Render helpers ─────────────────────────────────────
  function renderTagPill(tag) {
    return `<span class="tag-pill" style="background:${tag.color}">${escHtml(tag.name)}</span>`;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderNoteList(notes) {
    if (notes.length === 0) {
      noteList.innerHTML = '<div class="empty-state">No notes found.</div>';
      return;
    }
    noteList.innerHTML = notes.map(n => `
      <div class="note-item${n.id === activeNoteId ? ' active' : ''}" data-id="${n.id}">
        <div class="note-item-header">
          <span class="note-item-title">${escHtml(n.title)}</span>
          ${n.is_pinned ? '<span class="note-pin-icon">📌</span>' : ''}
        </div>
        <div class="note-item-preview">${escHtml((n.content || '').slice(0, 80))}</div>
        <div class="note-item-tags">${(n.tags || []).map(renderTagPill).join('')}</div>
      </div>
    `).join('');

    noteList.querySelectorAll('.note-item').forEach(el => {
      el.addEventListener('click', () => openNote(Number(el.dataset.id)));
    });
  }

  function renderTagFilter(tags) {
    const allItem = `<li class="tag-filter-item${activeTag === '' ? ' active' : ''}" data-tag="">All Notes</li>`;
    const tagItems = tags.map(t => `
      <li class="tag-filter-item${activeTag === t.name ? ' active' : ''}" data-tag="${escHtml(t.name)}">
        <span class="tag-dot" style="background:${t.color}"></span>${escHtml(t.name)}
      </li>
    `).join('');
    tagFilterList.innerHTML = allItem + tagItems;

    tagFilterList.querySelectorAll('.tag-filter-item').forEach(el => {
      el.addEventListener('click', () => {
        activeTag = el.dataset.tag;
        searchInput.value = '';
        searchQuery = '';
        tagFilterList.querySelectorAll('.tag-filter-item').forEach(x => x.classList.remove('active'));
        el.classList.add('active');
        fetchNotes();
      });
    });
  }

  function renderTagCheckboxes(selectedIds) {
    if (allTags.length === 0) {
      tagCheckboxes.innerHTML = '<span style="font-size:0.82rem;color:#999">No tags yet. Create tags via the sidebar.</span>';
      return;
    }
    tagCheckboxes.innerHTML = allTags.map(t => `
      <label class="tag-checkbox-item">
        <input type="checkbox" value="${t.id}" ${selectedIds.includes(t.id) ? 'checked' : ''} />
        <span class="tag-dot" style="background:${t.color}"></span>
        ${escHtml(t.name)}
      </label>
    `).join('');
  }

  function getSelectedTagIds() {
    return Array.from(tagCheckboxes.querySelectorAll('input:checked')).map(el => Number(el.value));
  }

  // ── Data loading ───────────────────────────────────────
  async function fetchNotes() {
    let url = '/api/notes';
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    else if (activeTag) params.set('tag', activeTag);
    if ([...params].length) url += '?' + params.toString();

    const res = await api('GET', url);
    if (!res) return;
    allNotes = await res.json();
    renderNoteList(allNotes);
  }

  async function fetchTags() {
    const res = await api('GET', '/api/tags');
    if (!res) return;
    allTags = await res.json();
    renderTagFilter(allTags);
  }

  async function init() {
    await fetchTags();
    await fetchNotes();
  }

  // ── Editor ─────────────────────────────────────────────
  function showEditor(note) {
    editorEmpty.style.display = 'none';
    editorForm.style.display = 'flex';

    noteTitle.value = note ? note.title : '';
    noteContent.value = note ? (note.content || '') : '';

    const selectedIds = note ? (note.tags || []).map(t => t.id) : [];
    renderTagCheckboxes(selectedIds);

    if (note) {
      pinBtn.classList.toggle('pinned', Boolean(note.is_pinned));
      pinBtn.title = note.is_pinned ? 'Unpin note' : 'Pin note';
    } else {
      pinBtn.classList.remove('pinned');
      pinBtn.title = 'Pin note';
    }

    activeNoteId = note ? note.id : null;
    renderNoteList(allNotes);
  }

  async function openNote(id) {
    const res = await api('GET', `/api/notes/${id}`);
    if (!res || !res.ok) return;
    const note = await res.json();
    showEditor(note);
  }

  // ── New Note ───────────────────────────────────────────
  document.getElementById('newNoteBtn').addEventListener('click', () => {
    activeNoteId = null;
    showEditor(null);
    noteTitle.focus();
  });

  // ── Save ───────────────────────────────────────────────
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const title = noteTitle.value.trim();
    if (!title) { noteTitle.focus(); return; }
    const content = noteContent.value;
    const tagIds = getSelectedTagIds();

    let res;
    if (activeNoteId) {
      res = await api('PUT', `/api/notes/${activeNoteId}`, { title, content, tagIds });
    } else {
      res = await api('POST', '/api/notes', { title, content, tagIds });
    }
    if (!res || !res.ok) return;
    const saved = await res.json();
    activeNoteId = saved.id;

    // Update or insert in local list
    const idx = allNotes.findIndex(n => n.id === saved.id);
    if (idx >= 0) allNotes[idx] = saved;
    else allNotes.unshift(saved);

    // Re-sort: pinned first, then by updated_at desc
    allNotes.sort((a, b) => {
      if (b.is_pinned !== a.is_pinned) return b.is_pinned - a.is_pinned;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

    renderNoteList(allNotes);
    pinBtn.classList.toggle('pinned', Boolean(saved.is_pinned));
    pinBtn.title = saved.is_pinned ? 'Unpin note' : 'Pin note';
  });

  // ── Delete ─────────────────────────────────────────────
  document.getElementById('deleteBtn').addEventListener('click', async () => {
    if (!activeNoteId) return;
    if (!confirm('Delete this note?')) return;

    const res = await api('DELETE', `/api/notes/${activeNoteId}`);
    if (!res || !res.ok) return;

    allNotes = allNotes.filter(n => n.id !== activeNoteId);
    activeNoteId = null;
    editorForm.style.display = 'none';
    editorEmpty.style.display = 'flex';
    renderNoteList(allNotes);
  });

  // ── Pin toggle ─────────────────────────────────────────
  pinBtn.addEventListener('click', async () => {
    if (!activeNoteId) return;
    const res = await api('PUT', `/api/notes/${activeNoteId}/pin`);
    if (!res || !res.ok) return;
    const updated = await res.json();

    const idx = allNotes.findIndex(n => n.id === updated.id);
    if (idx >= 0) allNotes[idx] = updated;

    allNotes.sort((a, b) => {
      if (b.is_pinned !== a.is_pinned) return b.is_pinned - a.is_pinned;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

    pinBtn.classList.toggle('pinned', Boolean(updated.is_pinned));
    pinBtn.title = updated.is_pinned ? 'Unpin note' : 'Pin note';
    renderNoteList(allNotes);
  });

  // ── Search (debounced 300ms) ───────────────────────────
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchInput.value.trim();
      activeTag = '';
      tagFilterList.querySelectorAll('.tag-filter-item').forEach(el => {
        el.classList.toggle('active', el.dataset.tag === '');
      });
      fetchNotes();
    }, 300);
  });

  // ── Logout ─────────────────────────────────────────────
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'auth.html';
  });

  // ── Boot ───────────────────────────────────────────────
  init();
})();
