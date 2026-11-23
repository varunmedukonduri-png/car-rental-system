/* Admin portal: dashboard, vehicle inventory, bookings, maintenance. Requires db.js */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const ADMIN = { email: 'admin@carrental.com', pw: 'admin123' };
const T = { dash: 'Dashboard', cars: 'Vehicles', bk: 'Bookings', mt: 'Maintenance' };
let tab = 'dash';
const authed = () => sessionStorage.getItem('cr_admin') === '1';

function login() {
  app.innerHTML = `<div class="panel login"><h2 style="margin-bottom:15px">Admin Login</h2>
    <form id="lf"><input id="e" type="email" placeholder="Email" required><input id="p" type="password" placeholder="Password" required><button>Sign In</button></form>
    <p class="mut" style="margin-top:12px"><small>Demo: admin@carrental.com / admin123</small></p><p class="sw"><a href="index.html">← Back to site</a></p></div>`;
  $('#lf').onsubmit = e => {
    e.preventDefault();
    if ($('#e').value === ADMIN.email && $('#p').value === ADMIN.pw) {
      sessionStorage.setItem('cr_admin', '1');
      draw();
    } else alert('Invalid credentials');
  };
}

function draw() {
  if (!authed()) return login();

  app.innerHTML = `<div class="adm"><div class="side"><h2>Admin</h2>
    ${Object.entries(T).map(([k, v]) => `<a data-t="${k}" class="${k === tab ? 'on' : ''}">${v}</a>`).join('')}
    <a href="index.html">View Site</a>
    <a href="user-portal.html">User Portal</a>
    <a id="lo">Logout</a></div>
    <div class="main"><h1 style="margin-bottom:20px">${T[tab]}</h1><div id="v"></div></div></div>`;

  $$('[data-t]').forEach(a => a.onclick = () => {
    tab = a.dataset.t;
    draw();
  });

  $('#lo').onclick = () => {
    sessionStorage.removeItem('cr_admin');
    draw();
  };

  ({ dash: vDash, cars: vCars, bk: vBk, mt: vMt })[tab]();
}

function vDash() {
  const c = DB.get('cars', []);
  const b = DB.get('bookings', []);
  const m = DB.get('maint', []);

  const rev = b
    .filter(x => x.status !== 'cancelled')
    .reduce((s, x) => s + x.total, 0);

  $('#v').innerHTML = `<div class="stats4">${[
    ['Vehicles', c.length],
    ['Available now', c.filter(x => x.status === 'available').length],
    ['Total bookings', b.length],
    ['Active bookings', b.filter(x => x.status === 'confirmed').length],
    ['Revenue', DB.inr(rev)],
    ['Pending maintenance', m.filter(x => !x.done).length]
  ].map(([k, v]) => `<div class="card"><b>${v}</b>${k}</div>`).join('')}</div>`;
}

function vCars() {
  const c = DB.get('cars', []);

  $('#v').innerHTML = `<div class="panel"><form id="cf" class="fgrid"><input type="hidden" id="id">
    <input id="n" placeholder="Name" required>
    <input id="ty" placeholder="Type (SUV, Sedan…)" required>
    <select id="tr"><option>Automatic</option><option>Manual</option></select>
    <input id="se" type="number" min="1" placeholder="Seats" required>
    <select id="fu"><option>Petrol</option><option>Diesel</option><option>Electric</option><option>Hybrid</option></select>
    <input id="pr" type="number" min="1" placeholder="₹ per day" required>
    <input id="im" placeholder="Image path e.g. image/SUV.jpg" required>
    <button>Save Vehicle</button></form></div>

    <div class="panel"><table>
    <tr><th>Name</th><th>Type</th><th>Specs</th><th>Price/day</th><th>Status</th><th>Actions</th></tr>
    ${c.map(x => `<tr>
      <td>${DB.esc(x.name)}</td>
      <td>${DB.esc(x.type)}</td>
      <td>${x.trans} · ${x.seats} · ${x.fuel}</td>
      <td>${DB.inr(x.price)}</td>
      <td><span class="badge ${x.status === 'available' ? 'ok' : 'maintenance'}">${x.status}</span></td>
      <td>
        <button class="sm" data-a="e" data-i="${x.id}">Edit</button>
        <button class="sm" data-a="s" data-i="${x.id}">${x.status === 'available' ? 'Set maintenance' : 'Set available'}</button>
        <button class="sm" data-a="d" data-i="${x.id}">Delete</button>
      </td>
    </tr>`).join('')}</table></div>`;

  $('#cf').onsubmit = e => {
    e.preventDefault();

    const a = DB.get('cars', []);
    const id = $('#id').value;

    const o = {
      id: id || DB.id(),
      name: $('#n').value,
      type: $('#ty').value,
      trans: $('#tr').value,
      seats: +$('#se').value,
      fuel: $('#fu').value,
      price: +$('#pr').value,
      img: $('#im').value,
      status: 'available'
    };

    const i = a.findIndex(x => x.id === id);

    if (i >= 0) {
      o.status = a[i].status;
      a[i] = o;
    } else {
      a.push(o);
    }

    DB.set('cars', a);
    vCars();
  };

  $$('[data-a]').forEach(b => b.onclick = () => {
    let a = DB.get('cars', []);
    const x = a.find(y => y.id === b.dataset.i);

    if (b.dataset.a === 'd') {
      if (!confirm('Delete ' + x.name + '?')) return;
      a = a.filter(y => y !== x);
    } else if (b.dataset.a === 's') {
      x.status = x.status === 'available' ? 'maintenance' : 'available';
    } else {
      $('#id').value = x.id;
      $('#n').value = x.name;
      $('#ty').value = x.type;
      $('#tr').value = x.trans;
      $('#se').value = x.seats;
      $('#fu').value = x.fuel;
      $('#pr').value = x.price;
      $('#im').value = x.img;
      scrollTo(0, 0);
      return;
    }

    DB.set('cars', a);
    vCars();
  });
}

function vBk() {
  const b = DB.get('bookings', []).slice().reverse();

  $('#v').innerHTML = `<div class="panel"><table>
    <tr><th>ID</th><th>Customer</th><th>Car</th><th>Dates</th><th>Total</th><th>Status</th><th>Update</th></tr>
    ${b.map(x => `<tr>
      <td>${x.id}</td>
      <td>${DB.esc(x.name)}<br><small>${DB.esc(x.email)}</small></td>
      <td>${DB.esc(x.car)}</td>
      <td>${x.start} → ${x.end}</td>
      <td>${DB.inr(x.total)}</td>
      <td><span class="badge ${x.status}">${x.status}</span></td>
      <td><select data-b="${x.id}">
        ${['pending', 'confirmed', 'completed', 'cancelled'].map(s =>
          `<option ${s === x.status ? 'selected' : ''}>${s}</option>`
        ).join('')}
      </select></td>
    </tr>`).join('') || '<tr><td>No bookings yet</td></tr>'}
  </table></div>`;

  $$('[data-b]').forEach(s => s.onchange = () => {
    const a = DB.get('bookings', []);
    a.find(y => y.id === s.dataset.b).status = s.value;
    DB.set('bookings', a);
    vBk();
  });
}

function vMt() {
  const c = DB.get('cars', []);
  const m = DB.get('maint', []).sort((a, b) => a.date.localeCompare(b.date));

  const nm = id => (c.find(x => x.id === id) || { name: '(deleted)' }).name;

  $('#v').innerHTML = `<div class="panel"><form id="mf" class="fgrid">
    <select id="mc">${c.map(x => `<option value="${x.id}">${DB.esc(x.name)}</option>`).join('')}</select>
    <input type="date" id="md" required>
    <input id="mn" placeholder="Service / note" required>
    <button>Schedule</button>
  </form></div>

  <div class="panel"><table>
    <tr><th>Vehicle</th><th>Date</th><th>Note</th><th>Status</th><th>Actions</th></tr>
    ${m.map(x => `<tr>
      <td>${DB.esc(nm(x.carId))}</td>
      <td>${x.date}</td>
      <td>${DB.esc(x.note)}</td>
      <td><span class="badge ${x.done ? 'ok' : 'pending'}">${x.done ? 'done' : 'scheduled'}</span></td>
      <td>
        <button class="sm" data-m="t" data-i="${x.id}">${x.done ? 'Reopen' : 'Mark done'}</button>
        <button class="sm" data-m="d" data-i="${x.id}">Delete</button>
      </td>
    </tr>`).join('') || '<tr><td>Nothing scheduled</td></tr>'}
  </table></div>`;

  $('#mf').onsubmit = e => {
    e.preventDefault();

    const id = $('#mc').value;
    const d = $('#md').value;

    const clash = DB.get('bookings', []).some(b =>
      b.carId === id &&
      ['pending', 'confirmed'].includes(b.status) &&
      b.start <= d &&
      b.end >= d
    );

    if (clash && !confirm('This car has a booking on that date. Schedule anyway?')) return;

    const a = DB.get('maint', []);
    a.push({
      id: DB.id(),
      carId: id,
      date: d,
      note: $('#mn').value,
      done: false
    });

    DB.set('maint', a);
    vMt();
  };

  $$('[data-m]').forEach(b => b.onclick = () => {
    let a = DB.get('maint', []);

    if (b.dataset.m === 'd') {
      a = a.filter(y => y.id !== b.dataset.i);
    } else {
      const x = a.find(y => y.id === b.dataset.i);
      x.done = !x.done;
    }

    DB.set('maint', a);
    vMt();
  });
}

draw();