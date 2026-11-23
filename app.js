/* Customer site: auth, search, booking, payment (simulated), my bookings. Requires db.js */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const user = () => DB.get('session', null);
  const today = new Date().toISOString().slice(0, 10);
  const show = id => $('#' + id).classList.add('on'), hide = id => $('#' + id).classList.remove('on');
  const toast = m => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); };
  let mode = 'in', after = null, cur = null;

  document.body.insertAdjacentHTML('beforeend', `
  <div class="modal" id="authM"><div class="box"><span class="x" data-x>×</span><h2 id="authT"></h2>
    <form id="authF"><input id="aName" placeholder="Full name"><input id="aMail" type="email" placeholder="Email" required>
    <input id="aPass" type="password" placeholder="Password (min 6)" minlength="6" required><button class="btn">Continue</button></form>
    <p class="sw"><a href="#" id="authSw"></a></p></div></div>
  <div class="modal" id="bookM"><div class="box"><span class="x" data-x>×</span><h2 id="bT"></h2><p class="mut" id="bS"></p>
    <form id="bookF"><label>Pickup date<input type="date" id="bFrom" required></label><label>Return date<input type="date" id="bTo" required></label>
    <div class="tot" id="bTot"></div><input id="bCard" placeholder="Card number (16 digits)" maxlength="19" required>
    <div class="row"><input id="bExp" placeholder="MM/YY" maxlength="5" required><input id="bCvv" type="password" placeholder="CVV" maxlength="3" required></div>
    <button class="btn">Pay &amp; Confirm</button></form><p class="mut" style="margin-top:8px"><small>Demo payment – no real charge is made.</small></p></div></div>
  <div class="modal" id="myM"><div class="box"><span class="x" data-x>×</span><h2>My Bookings</h2><div id="myL"></div></div></div>`);

  $$('[data-x]').forEach(x => x.onclick = () => x.closest('.modal').classList.remove('on'));
  $$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('on'); }));

  /* ---------- auth ---------- */
  function openAuth(m, cb) {
    mode = m; after = cb || null;
    $('#authT').textContent = m === 'in' ? 'Sign In' : 'Create Account';
    $('#aName').style.display = m === 'in' ? 'none' : 'block'; $('#aName').required = m !== 'in';
    $('#authSw').textContent = m === 'in' ? 'New here? Register' : 'Have an account? Sign in';
    show('authM');
  }
  $('#authSw').onclick = e => { e.preventDefault(); openAuth(mode === 'in' ? 'up' : 'in', after); };
  $('#authF').onsubmit = e => {
    e.preventDefault();
    const em = $('#aMail').value.trim().toLowerCase(), pw = btoa($('#aPass').value), users = DB.get('users', []);
    let u = users.find(x => x.email === em);
    if (mode === 'up') {
      if (u) return toast('Email already registered');
      u = { email: em, name: $('#aName').value.trim(), pw }; users.push(u); DB.set('users', users);
    } else if (!u || u.pw !== pw) return toast('Invalid email or password');
    DB.set('session', { email: u.email, name: u.name });
    hide('authM'); e.target.reset(); nav(); toast('Welcome, ' + u.name);
    if (after) after();
  };

  function nav() {
    const box = $('.nav-buttons'), u = user();
    box.innerHTML = u
      ? `<button class="signin" id="nMy">My Bookings</button><button class="register" id="nOut">Logout (${DB.esc(u.name.split(' ')[0])})</button>`
      : `<button class="signin" id="nIn">Sign In</button><button class="register" id="nUp">Register</button>`;
    if (u) { $('#nMy').onclick = myBookings; $('#nOut').onclick = () => { DB.set('session', null); nav(); toast('Logged out'); }; }
    else { $('#nIn').onclick = () => openAuth('in'); $('#nUp').onclick = () => openAuth('up'); }
  }

  /* ---------- search + fleet ---------- */
  const types = [...new Set(DB.get('cars', []).map(c => c.type))];
  $('.vehicle-grid').insertAdjacentHTML('beforebegin', `<div class="search">
    <label>Pickup<input type="date" id="sFrom" min="${today}"></label><label>Return<input type="date" id="sTo" min="${today}"></label>
    <label>Type<select id="sType"><option value="">All</option>${types.map(t => `<option>${DB.esc(t)}</option>`).join('')}</select></label>
    <label>Sort by price<select id="sSort"><option value="">Featured</option><option value="a">Low to high</option><option value="d">High to low</option></select></label>
    <button class="btn" id="sGo">Search</button></div>`);

  function render() {
    const f = $('#sFrom').value, t = $('#sTo').value, ty = $('#sType').value, so = $('#sSort').value;
    const cars = DB.get('cars', []).filter(c => !ty || c.type === ty);
    if (so) cars.sort((a, b) => so === 'a' ? a.price - b.price : b.price - a.price);
    $('.vehicle-grid').innerHTML = cars.map(c => {
      const ok = f && t ? DB.free(c.id, f, t) : c.status === 'available';
      return `<div class="vehicle-card"><div class="vehicle-image"><img src="${DB.esc(c.img)}" alt="${DB.esc(c.name)}"></div>
      <div class="vehicle-info"><h3>${DB.esc(c.name)}</h3><p>${c.trans} · ${c.seats} Seats · ${c.fuel}</p>
      <div class="price"><b>${DB.inr(c.price)}</b>/day <span class="badge ${ok ? 'ok' : 'no'}">${ok ? 'Available' : 'Unavailable'}</span></div>
      <button class="btn rent-btn" data-id="${c.id}" ${ok ? '' : 'disabled'}>Rent Car</button></div></div>`;
    }).join('') || '<p>No cars match your search.</p>';
    $$('.rent-btn').forEach(b => b.onclick = () => book(b.dataset.id));
  }
  $('#sGo').onclick = () => {
    const f = $('#sFrom').value, t = $('#sTo').value;
    if ((f || t) && !(f && t && t > f)) return toast('Pick a pickup date and a later return date');
    render();
  };
  $('#sType').onchange = $('#sSort').onchange = render;

  /* ---------- booking ---------- */
  function calc() {
    const a = $('#bFrom').value, b = $('#bTo').value, d = a && b ? DB.days(a, b) : 0;
    $('#bTot').textContent = d > 0 ? `${d} day(s) × ${DB.inr(cur.price)} = ${DB.inr(d * cur.price)}` : 'Select valid dates';
    return d;
  }
  function book(id) {
    if (!user()) return openAuth('in', () => book(id));
    cur = DB.get('cars', []).find(x => x.id === id);
    $('#bT').textContent = cur.name; $('#bS').textContent = `${DB.inr(cur.price)}/day · ${cur.trans} · ${cur.seats} seats`;
    $('#bFrom').min = $('#bTo').min = today; $('#bFrom').value = $('#sFrom').value; $('#bTo').value = $('#sTo').value;
    calc(); show('bookM');
  }
  $('#bFrom').onchange = $('#bTo').onchange = calc;
  $('#bookF').onsubmit = e => {
    e.preventDefault();
    const s = $('#bFrom').value, en = $('#bTo').value, d = calc(), u = user();
    if (d < 1 || s < today) return toast('Choose valid dates');
    if (!DB.free(cur.id, s, en)) return toast('Car not available for those dates');
    if (!/^\d{16}$/.test($('#bCard').value.replace(/\s/g, '')) || !/^\d{2}\/\d{2}$/.test($('#bExp').value) || !/^\d{3}$/.test($('#bCvv').value)) return toast('Check payment details');
    const bk = { id: 'BK' + DB.id().toUpperCase(), carId: cur.id, car: cur.name, email: u.email, name: u.name, start: s, end: en, days: d, total: d * cur.price, status: 'confirmed', card: $('#bCard').value.slice(-4), created: new Date().toISOString() };
    const all = DB.get('bookings', []); all.push(bk); DB.set('bookings', all);
    hide('bookM'); e.target.reset(); render(); toast('Booking confirmed: ' + bk.id); myBookings();
  };

  function myBookings() {
    const l = DB.get('bookings', []).filter(b => b.email === user().email).reverse();
    $('#myL').innerHTML = l.map(b => `<div class="bk"><div><b>${DB.esc(b.car)}</b> <span class="badge ${b.status}">${b.status}</span><br>
      <small>${b.id} · ${b.start} → ${b.end} · ${DB.inr(b.total)}</small></div>${b.status === 'confirmed' ? `<button class="sm" data-c="${b.id}">Cancel</button>` : ''}</div>`).join('') || '<p>No bookings yet.</p>';
    $$('[data-c]', $('#myL')).forEach(x => x.onclick = () => {
      const a = DB.get('bookings', []); a.find(b => b.id === x.dataset.c).status = 'cancelled'; DB.set('bookings', a); myBookings(); render();
    });
    show('myM');
  }

  /* ---------- wire up existing buttons ---------- */
  $$('[onclick*="signin.html"],[onclick*="register.html"]').forEach(b => b.onclick = () => $('#vehicles').scrollIntoView({ behavior: 'smooth' }));
  $$('.app-btn').forEach(a => a.onclick = e => { e.preventDefault(); toast('Mobile app coming soon'); });
  $('.newsletter button').onclick = () => {
    const i = $('.newsletter input');
    if (!/^\S+@\S+\.\S+$/.test(i.value)) return toast('Enter a valid email');
    const s = DB.get('subs', []); s.push(i.value); DB.set('subs', s); i.value = ''; toast('Subscribed!');
  };
  $$('.footer-col')[1].insertAdjacentHTML('beforeend', '<a href="admin.html">Admin Portal</a>');

  nav(); render();
})();
