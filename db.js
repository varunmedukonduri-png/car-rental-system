/* Shared data layer (localStorage demo). Used by index.html (app.js) and admin.html (admin.js). */
const DB = {
  get(k, d) { try { const v = localStorage.getItem('cr_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { localStorage.setItem('cr_' + k, JSON.stringify(v)); },
  id: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
  inr: n => '₹' + Number(n).toLocaleString('en-IN'),
  esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  days: (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5),
  init() {
    if (!this.get('cars')) this.set('cars', [
      { id: 'c1', name: 'Luxury Sedan', type: 'Sedan', trans: 'Automatic', seats: 5, fuel: 'Petrol', price: 3500, img: 'image/sedan.webp', status: 'available' },
      { id: 'c2', name: 'Premium SUV', type: 'SUV', trans: 'Automatic', seats: 7, fuel: 'Diesel', price: 4800, img: 'image/SUV.jpg', status: 'available' },
      { id: 'c3', name: 'Compact Car', type: 'Compact', trans: 'Manual', seats: 5, fuel: 'Petrol', price: 1800, img: 'image/coupe.jpg', status: 'available' },
      { id: 'c4', name: 'Ford Endeavour', type: 'SUV', trans: 'Automatic', seats: 7, fuel: 'Diesel', price: 5500, img: 'image/57752_2020_Ford_Endeavour.jpg', status: 'available' }
    ]);
    ['users', 'bookings', 'maint'].forEach(k => { if (!this.get(k)) this.set(k, []); });
  },
  /* true if car is usable for [s,e): not in maintenance, no booking overlap, no scheduled service in range */
  free(carId, s, e) {
    const car = this.get('cars', []).find(c => c.id === carId);
    if (!car || car.status !== 'available') return false;
    return !this.get('bookings', []).some(b => b.carId === carId && ['pending', 'confirmed'].includes(b.status) && b.start < e && b.end > s)
      && !this.get('maint', []).some(m => m.carId === carId && !m.done && m.date >= s && m.date <= e);
  }
};
DB.init();
