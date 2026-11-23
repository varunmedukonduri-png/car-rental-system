(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayText = today.toISOString().slice(0, 10);

  let authMode = "login";
  let activeCar = null;
  let showingShortlist = false;
  let toastTimer;

  const currentUser = () => DB.get("session", null);
  const safe = value => DB.esc(value == null ? "" : value);

  const notify = message => {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("show"), 2600);
  };

  const openModal = id => {
    const m = $("#" + id);
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
  };

  const closeModal = id => {
    const m = $("#" + id);
    m.classList.remove("open");
    m.setAttribute("aria-hidden", "true");
  };

  const shortlistKey = () => {
    const u = currentUser();
    return u ? "shortlist_" + u.email.toLowerCase() : null;
  };

  const getShortlist = () => {
    const key = shortlistKey();
    return key ? DB.get(key, []) : [];
  };

  const setShortlist = ids => {
    const key = shortlistKey();
    if (key) DB.set(key, ids);
  };

  function updateHeader() {
    const user = currentUser();

    $("#authButton").textContent = user ? "Sign Out" : "Sign In";
    $("#myBookingsBtn").classList.toggle("hidden", !user);
    $("#shortlistCount").textContent = getShortlist().length;
  }

  function openAuth(mode) {
    authMode = mode;

    $("#loginTab").classList.toggle("active", mode === "login");
    $("#registerTab").classList.toggle("active", mode === "register");
    $("#nameField").classList.toggle("hidden", mode !== "register");
    $("#fullName").required = mode === "register";
    $("#authTitle").textContent = mode === "login" ? "Welcome back" : "Create your account";
    $("#authSubmit").textContent = mode === "login" ? "Sign In" : "Create Account";
    $("#password").autocomplete = mode === "login" ? "current-password" : "new-password";
    $("#authError").textContent = "";

    openModal("authModal");
  }

  $("#loginTab").addEventListener("click", () => openAuth("login"));
  $("#registerTab").addEventListener("click", () => openAuth("register"));

  $("#authButton").addEventListener("click", () => {
    if (currentUser()) {
      DB.set("session", null);
      updateHeader();
      renderCars();
      notify("You have signed out");
    } else {
      openAuth("login");
    }
  });

  $("#authForm").addEventListener("submit", event => {
    event.preventDefault();

    const email = $("#email").value.trim().toLowerCase();
    const password = $("#password").value;
    const users = DB.get("users", []);

    let user = users.find(item => item.email.toLowerCase() === email);

    if (authMode === "register") {
      const name = $("#fullName").value.trim();

      if (name.length < 2) {
        return $("#authError").textContent = "Enter your full name.";
      }

      if (user) {
        return $("#authError").textContent = "This email is already registered.";
      }

      user = {
        email,
        name,
        pw: btoa(unescape(encodeURIComponent(password)))
      };

      users.push(user);
      DB.set("users", users);
    } else {
      const encoded = btoa(unescape(encodeURIComponent(password)));

      if (!user || user.pw !== encoded) {
        return $("#authError").textContent = "Incorrect email or password.";
      }
    }

    DB.set("session", {
      email: user.email,
      name: user.name
    });

    event.target.reset();
    closeModal("authModal");
    updateHeader();
    renderCars();
    notify("Welcome, " + user.name);
  });

  function refreshTypeOptions() {
    const select = $("#typeFilter");
    const previous = select.value;

    const types = [
      ...new Set(
        DB.get("cars", [])
          .map(car => (car.type || "Other").trim())
          .filter(Boolean)
      )
    ].sort();

    select.innerHTML = '<option value="">All types</option>' +
      types.map(type =>
        `<option value="${safe(type)}">${safe(type)}</option>`
      ).join("");

    if (types.includes(previous)) {
      select.value = previous;
    }
  }

  function carAvailable(car, start, end) {
    if (car.status !== "available") return false;

    if (start && end) {
      return DB.free(car.id, start, end);
    }

    return true;
  }

  function renderCars() {
    const allCars = DB.get("cars", []);

    refreshTypeOptions();

    $("#fleetCount").textContent = allCars.length;

    const search = $("#searchInput").value.trim().toLowerCase();
    const type = $("#typeFilter").value;
    const transmission = $("#transFilter").value;
    const sort = $("#sortFilter").value;
    const start = $("#pickupDate").value;
    const end = $("#returnDate").value;
    const shortlist = getShortlist();

    let cars = allCars.filter(car => {
      const text = [
        car.name,
        car.type,
        car.fuel,
        car.trans
      ].join(" ").toLowerCase();

      return (!search || text.includes(search)) &&
        (!type || car.type === type) &&
        (!transmission || car.trans === transmission) &&
        (!showingShortlist || shortlist.includes(car.id));
    });

    if (sort === "low") {
      cars.sort((a, b) => Number(a.price) - Number(b.price));
    }

    if (sort === "high") {
      cars.sort((a, b) => Number(b.price) - Number(a.price));
    }

    if (start && end && end <= start) {
      $("#resultsInfo").textContent = "Return date must be later than pickup date.";
    } else {
      $("#resultsInfo").textContent =
        `${cars.length} vehicle(s) ${showingShortlist ? "in your shortlist" : "match your filters"}.`;
    }

    $("#carGrid").innerHTML = cars.map(car => {
      const available = start && end && end > start
        ? carAvailable(car, start, end)
        : car.status === "available";

      const saved = shortlist.includes(car.id);
      const image = car.img || "image/car1.jpg";

      return `<article class="car-card">
        <div class="car-image">
          <img src="${safe(image)}" alt="${safe(car.name)}" onerror="this.onerror=null;this.src='image/car1.jpg'">
          <span class="type-pill">${safe(car.type || "Other")}</span>
          <button class="fav ${saved ? "saved" : ""}" data-fav="${safe(car.id)}" aria-label="${saved ? "Remove from" : "Add to"} shortlist">${saved ? "♥" : "♡"}</button>
        </div>

        <div class="car-info">
          <h3>${safe(car.name)}</h3>
          <p class="specs">${safe(car.trans)} · ${safe(car.seats)} Seats · ${safe(car.fuel)}</p>

          <div class="price-row">
            <div class="price">${DB.inr(car.price)}<small> / day</small></div>
            <span class="status ${available ? "" : "no"}">${available ? "Available" : "Unavailable"}</span>
          </div>

          <div class="card-actions">
            <button class="secondary" data-shortlist="${safe(car.id)}">${saved ? "Shortlisted" : "Shortlist"}</button>
            <button data-book="${safe(car.id)}" ${available ? "" : "disabled"}>Book now</button>
          </div>
        </div>
      </article>`;
    }).join("") || `<div class="empty">${showingShortlist ? "Your shortlist is empty. Save a car using the heart button." : "No vehicles match these filters."}</div>`;

    $("#carGrid").querySelectorAll("[data-fav], [data-shortlist]").forEach(button => {
      button.addEventListener("click", () => {
        toggleShortlist(button.dataset.fav || button.dataset.shortlist);
      });
    });

    $("#carGrid").querySelectorAll("[data-book]").forEach(button => {
      button.addEventListener("click", () => {
        openBooking(button.dataset.book);
      });
    });

    $("#shortlistToggle").innerHTML =
      `${showingShortlist ? "Show all cars" : "♡ My Shortlist"} <span id="shortlistCount">${getShortlist().length}</span>`;
  }

  function toggleShortlist(carId) {
    if (!currentUser()) {
      openAuth("login");
      notify("Sign in to save cars to your shortlist");
      return;
    }

    const ids = getShortlist();
    const exists = ids.includes(carId);

    setShortlist(
      exists
        ? ids.filter(id => id !== carId)
        : [...ids, carId]
    );

    updateHeader();
    renderCars();

    notify(exists ? "Removed from shortlist" : "Added to your shortlist");
  }

  $("#shortlistToggle").addEventListener("click", () => {
    showingShortlist = !showingShortlist;
    renderCars();
    $("#fleet").scrollIntoView({ behavior: "smooth" });
  });

  function openBooking(carId) {
    if (!currentUser()) {
      openAuth("login");
      notify("Sign in before booking a car");
      return;
    }

    activeCar = DB.get("cars", []).find(
      car => String(car.id) === String(carId)
    );

    if (!activeCar) {
      return notify("This car is no longer in the fleet");
    }

    $("#bookingCarName").textContent = activeCar.name;

    $("#bookingCarMeta").textContent =
      `${activeCar.type} · ${activeCar.trans} · ${activeCar.seats} seats · ${DB.inr(activeCar.price)} per day`;

    $("#bookingStart").min = $("#bookingEnd").min = todayText;
    $("#bookingStart").value = $("#pickupDate").value || "";
    $("#bookingEnd").value = $("#returnDate").value || "";
    $("#bookingError").textContent = "";

    calculateTotal();
    openModal("bookingModal");
  }

  function calculateTotal() {
    if (!activeCar) return 0;

    const start = $("#bookingStart").value;
    const end = $("#bookingEnd").value;
    const days = start && end ? DB.days(start, end) : 0;

    $("#bookingTotal").textContent = days > 0
      ? `${days} day(s) × ${DB.inr(activeCar.price)} = ${DB.inr(days * activeCar.price)}`
      : "Choose a valid pickup and return date";

    return days;
  }

  $("#bookingStart").addEventListener("change", calculateTotal);
  $("#bookingEnd").addEventListener("change", calculateTotal);

  $("#bookingForm").addEventListener("submit", event => {
    event.preventDefault();

    const user = currentUser();
    const start = $("#bookingStart").value;
    const end = $("#bookingEnd").value;
    const days = calculateTotal();

    if (!user) {
      return openAuth("login");
    }

    if (days < 1 || start < todayText) {
      return $("#bookingError").textContent = "Choose valid future rental dates.";
    }

    if (!DB.free(activeCar.id, start, end)) {
      return $("#bookingError").textContent =
        "This car is not available for those dates. Choose another date or car.";
    }

    const booking = {
      id: "BK" + DB.id().toUpperCase(),
      carId: activeCar.id,
      car: activeCar.name,
      email: user.email,
      name: user.name,
      start,
      end,
      days,
      total: days * Number(activeCar.price),
      status: "pending",
      created: new Date().toISOString()
    };

    const bookings = DB.get("bookings", []);
    bookings.push(booking);
    DB.set("bookings", bookings);

    event.target.reset();
    closeModal("bookingModal");
    renderCars();

    notify("Booking request sent. Check My Bookings for updates.");
    showMyBookings();
  });

  function showMyBookings() {
    const user = currentUser();

    if (!user) {
      return openAuth("login");
    }

    const bookings = DB.get("bookings", [])
      .filter(item => item.email === user.email)
      .slice()
      .reverse();

    $("#bookingList").innerHTML = bookings.map(booking => `
      <div class="booking-row">
        <div>
          <strong>${safe(booking.car)}</strong> · <span>${safe(booking.status)}</span>
          <small>${safe(booking.id)} · ${safe(booking.start)} → ${safe(booking.end)} · ${DB.inr(booking.total)}</small>
        </div>

        ${["pending", "confirmed"].includes(booking.status)
          ? `<button data-cancel="${safe(booking.id)}">Cancel</button>`
          : ""}
      </div>
    `).join("") || '<p class="muted">You have not made any bookings yet.</p>';

    $("#bookingList").querySelectorAll("[data-cancel]").forEach(button => {
      button.addEventListener("click", () => {
        const all = DB.get("bookings", []);

        const booking = all.find(item =>
          item.id === button.dataset.cancel &&
          item.email === user.email
        );

        if (booking) {
          booking.status = "cancelled";
          DB.set("bookings", all);
          showMyBookings();
          renderCars();
          notify("Booking cancelled");
        }
      });
    });

    openModal("bookingsModal");
  }

  $("#myBookingsBtn").addEventListener("click", showMyBookings);

  ["searchInput", "typeFilter", "transFilter", "sortFilter"].forEach(id => {
    $("#" + id).addEventListener(
      id === "searchInput" ? "input" : "change",
      renderCars
    );
  });

  ["pickupDate", "returnDate"].forEach(id => {
    $("#" + id).addEventListener("change", renderCars);
  });

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      closeModal(button.dataset.close);
    });
  });

  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", event => {
      if (event.target === modal) {
        closeModal(modal.id);
      }
    });
  });

  $("#pickupDate").min = $("#returnDate").min = todayText;

  updateHeader();
  renderCars();

  window.addEventListener("storage", event => {
    if (
      event.key === "cr_cars" ||
      event.key === "cr_bookings" ||
      event.key === "cr_maint"
    ) {
      renderCars();
    }
  });
})();