(() => {
  const ICONS = {
    vm: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/><path d="M8 7.5h.01M8 16.5h.01"/></svg>',
    db: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/></svg>',
    storage: '<svg viewBox="0 0 24 24"><path d="M4 14l2.5-8h11L20 14v5H4z"/><path d="M4 14h16M8 17h.01"/></svg>'
  };

  const TYPES = {
    vm: { label: 'Virtual Machine', short: 'Compute', sizes: [
      { id: '1', label: '1 vCPU · 2 GB RAM', price: 600 },
      { id: '2', label: '2 vCPU · 4 GB RAM', price: 1200 },
      { id: '3', label: '4 vCPU · 8 GB RAM', price: 2400 } ] },
    db: { label: 'Database', short: 'Database', sizes: [
      { id: '1', label: '2 vCPU · 4 GB RAM', price: 1800 },
      { id: '2', label: '4 vCPU · 8 GB RAM', price: 3400 },
      { id: '3', label: '8 vCPU · 16 GB RAM', price: 6200 } ] },
    storage: { label: 'Storage', short: 'Storage', sizes: [
      { id: '1', label: '100 GB', price: 300 },
      { id: '2', label: '500 GB', price: 1200 },
      { id: '3', label: '1 TB', price: 2200 } ] }
  };

  const KEY = 'cloudmanager.resources.v1';
  const $ = id => document.getElementById(id);
  const inr = n => '₹' + n.toLocaleString('en-IN');

  const seed = () => [
    { id: uid(), name: 'Web Server', type: 'vm', size: '2', status: 'running' },
    { id: uid(), name: 'Database Server', type: 'db', size: '1', status: 'running' },
    { id: uid(), name: 'Backup Storage', type: 'storage', size: '1', status: 'stopped' }
  ];
  function uid() { return Math.random().toString(36).slice(2, 9); }

  let resources;
  try { resources = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { resources = seed(); }
  let filter = 'all';
  const busy = new Set();

  const sizeOf = r => TYPES[r.type].sizes.find(s => s.id === r.size);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(resources)); } catch {} };

  /* ---------- pipeline animation ---------- */
  const stages = [...document.querySelectorAll('#pipeline li')];
  const log = $('flowLog');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function runFlow(message, apply) {
    log.classList.add('live');
    log.textContent = message;
    stages.forEach(s => s.classList.remove('active', 'done'));
    for (let i = 0; i < stages.length; i++) {
      stages[i].classList.add('active');
      if (i === 3) apply();           // dashboard updates at the final stage
      await wait(reduced ? 0 : 380);
      stages[i].classList.remove('active');
      stages[i].classList.add('done');
    }
    log.textContent = 'Done. Dashboard updated with the latest count, status and cost.';
  }

  /* ---------- rendering ---------- */
  function renderStats() {
    const running = resources.filter(r => r.status === 'running').length;
    $('statTotal').textContent = resources.length;
    $('statRun').textContent = running;
    $('statStop').textContent = resources.length - running;
    $('cost').textContent = inr(resources.reduce((t, r) => t + sizeOf(r).price, 0));
  }

  function cardHTML(r, entering) {
    const t = TYPES[r.type], s = sizeOf(r), isBusy = busy.has(r.id);
    const status = isBusy ? 'busy' : r.status;
    const pillText = isBusy ? 'Working…' : r.status === 'running' ? 'Running' : 'Stopped';
    return `<li class="card ${r.status}${entering ? ' enter' : ''}" data-id="${r.id}">
      <span class="ico" aria-hidden="true">${ICONS[r.type]}</span>
      <div class="info">
        <h3>${esc(r.name)} <span class="pill ${status}">${pillText}</span></h3>
        <p>${t.label} · ${s.label}</p>
        <p class="price-tag">${inr(s.price)}/month</p>
      </div>
      <div class="actions">
        <button class="btn" data-act="toggle" ${isBusy ? 'disabled' : ''}>${r.status === 'running' ? 'Stop' : 'Start'}</button>
        <button class="btn del" data-act="delete" ${isBusy ? 'disabled' : ''}>Delete</button>
      </div>
    </li>`;
  }
  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let enterId = null;
  function render() {
    renderStats();
    const shown = resources.filter(r => filter === 'all' || r.status === filter);
    $('cards').innerHTML = shown.map(r => cardHTML(r, r.id === enterId)).join('');
    enterId = null;
    $('empty').hidden = shown.length > 0;
    $('empty').textContent = resources.length === 0
      ? 'No resources yet. Provision one to get started.'
      : `No ${filter} resources right now.`;
    $('countLabel').textContent = `${shown.length} resource${shown.length === 1 ? '' : 's'}`;
  }

  function toast(msg, warn) {
    const el = document.createElement('div');
    el.className = 'toast' + (warn ? ' warn' : '');
    el.textContent = msg;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  /* ---------- form ---------- */
  const typeSeg = $('typeSeg'), sizeSeg = $('sizeSeg');
  typeSeg.innerHTML = Object.entries(TYPES).map(([k, t], i) =>
    `<label><span>${t.label} <span class="price">(${t.short})</span></span><input type="radio" name="type" value="${k}" ${i === 0 ? 'checked' : ''}></label>`).join('');

  function renderSizes() {
    const type = document.querySelector('input[name=type]:checked').value;
    sizeSeg.innerHTML = TYPES[type].sizes.map((s, i) =>
      `<label><span>${s.label}</span><span class="price">${inr(s.price)}/mo</span><input type="radio" name="size" value="${s.id}" ${i === 0 ? 'checked' : ''}></label>`).join('');
  }
  typeSeg.addEventListener('change', renderSizes);
  renderSizes();

  const nameInput = $('name');
  nameInput.addEventListener('input', () => { nameInput.classList.remove('invalid'); $('nameError').hidden = true; });

  $('form').addEventListener('submit', e => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.classList.add('invalid'); $('nameError').hidden = false; nameInput.focus(); return;
    }
    const r = {
      id: uid(), name,
      type: document.querySelector('input[name=type]:checked').value,
      size: document.querySelector('input[name=size]:checked').value,
      status: 'running'
    };
    $('form').reset(); renderSizes();
    busy.add(r.id);
    resources.unshift(r); enterId = r.id; filter = 'all'; syncTabs(); render();
    runFlow(`Provisioning “${name}”…`, () => {}).then(() => {
      busy.delete(r.id); save(); render(); toast(`Provisioned “${name}”`);
    });
  });

  /* ---------- card actions ---------- */
  $('cards').addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('.card').dataset.id;
    const r = resources.find(x => x.id === id);
    if (!r || busy.has(id)) return;
    busy.add(id); render();

    if (btn.dataset.act === 'toggle') {
      const next = r.status === 'running' ? 'stopped' : 'running';
      runFlow(`${next === 'running' ? 'Starting' : 'Stopping'} “${r.name}”…`, () => { r.status = next; }).then(() => {
        busy.delete(id); save(); render();
        toast(`${next === 'running' ? 'Started' : 'Stopped'} “${r.name}”`, next === 'stopped');
      });
    } else {
      runFlow(`Deleting “${r.name}”…`, () => {}).then(() => {
        resources = resources.filter(x => x.id !== id);
        busy.delete(id); save(); render(); toast(`Deleted “${r.name}”`, true);
      });
    }
  });

  /* ---------- tabs ---------- */
  function syncTabs() {
    document.querySelectorAll('.tab').forEach(t => {
      const on = t.dataset.filter === filter;
      t.classList.toggle('active', on); t.setAttribute('aria-selected', on);
    });
  }
  document.querySelector('.tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (!t) return;
    filter = t.dataset.filter; syncTabs(); render();
  });

  render();
})();
