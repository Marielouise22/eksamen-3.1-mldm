// DATA & KONSTANTER

const DATA_URL =
  "https://raw.githubusercontent.com/cederdorff/race/refs/heads/master/data/games.json";
const STORAGE_KEY = "favs"; // localStorage-nøgle til favoritter

// DOM-REFERENCER (samlet ét sted)

const els = {
  // Pill-værdier (kan mangle i HTML – så laver vi dem skjult)
  agePill: document.getElementById("age-pill"),
  playersPill: document.getElementById("players-pill"),
  durationPill: document.getElementById("duration-pill"),

  // Søg + liste
  search: document.getElementById("search-input"),
  list: document.getElementById("game-list"),

  // Skjult lager (selects/inputs – vises ikke i UI)
  genre: document.getElementById("genre-select"),
  language: document.getElementById("language-select"),
  difficulty: document.getElementById("difficulty-select"),
  ratingFrom: document.getElementById("rating-from"),
  ratingTo: document.getElementById("rating-to"),
  playFrom: document.getElementById("playtime-from"),
  playTo: document.getElementById("playtime-to"),
  availableOnly: document.getElementById("available-only"),
  sort: document.getElementById("sort-select"),
  clear: document.getElementById("clear-filters"),

  // Top/back
  backBtn: document.getElementById("go-back"),

  // Tabbar
  tabAll: document.getElementById("tab-all"),
  tabHome: document.getElementById("tab-home"),
  tabFav: document.getElementById("filter-favourites"),
  tabRes: document.getElementById("tab-reserve"),
};

// Modal (spildetaljer)
const modal = document.getElementById("game-modal");
const mImg = document.getElementById("modal-image");
const favoriteStatus = document.getElementById("favorite-status");
const mTitle = document.getElementById("modal-title");
const mMeta = document.getElementById("modal-meta");
const mDesc = document.getElementById("modal-desc");
const mDetails = document.getElementById("modal-details");
const mRulesWrap = document.getElementById("modal-rules-wrap");
const mRules = document.getElementById("modal-rules");
const rulesBtn = document.getElementById("rules-toggle");
const rulesContent = document.getElementById("rules-content");


const homeView = document.getElementById("home-view");
const gamesView = document.getElementById("games-view");
const gamesHeader = document.getElementById("games-header");
const selectedCafeName = document.getElementById("selected-cafe-name");
const logoHome = document.getElementById("logo-home");

// Booking view
const bookingView = document.getElementById("booking-view");
const bookingStage = document.getElementById("booking-stage");

// HJÆLPEFUNKTION: sørg for skjulte pill-inputs findes

function ensureHiddenPill(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("input");
    el.type = "hidden";
    el.id = id;
    el.value = "all";
    document.body.appendChild(el);
  }
  return el;
}
els.agePill = els.agePill || ensureHiddenPill("age-pill");
els.playersPill = els.playersPill || ensureHiddenPill("players-pill");
els.durationPill = els.durationPill || ensureHiddenPill("duration-pill");

// STATE

let GAMES = [];
let SHOW_FAVS = false;
let FAVS = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));

let lastFocusedElement = null;

const ACTIVE_FILTERS = {
  genre: new Set(),
  players: new Set(),
  age: new Set(),
  duration: new Set(),
};

// INIT

init();
async function init() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error("Kunne ikke hente data");
    GAMES = await res.json();

    // Bruger lokale, optimerede spilbilleder
    GAMES = GAMES.map((game) => {
      const filename = game.image.split("/").pop();

      return {
        ...game,
        image: `images/${filename}`,
       };
    });

    hydrateSelects(GAMES);
    bindEvents();
    render();
  } catch (err) {
    console.error(err);
    els.list.innerHTML = `<p>Kunne ikke indlæse spil.</p>`;
  }
}

// UI INITIALISERING (selects, events)

function hydrateSelects(games) {
  fillUniqueOptions(els.genre, unique(games.map((g) => g.genre)));
  fillUniqueOptions(els.language, unique(games.map((g) => g.language)));
  fillUniqueOptions(els.difficulty, unique(games.map((g) => g.difficulty)));

  // placeholders til rating-range
  const ratings = games.map((g) => g.rating).filter(Number.isFinite);
  if (ratings.length) {
    els.ratingFrom.placeholder = Math.min(...ratings).toFixed(1);
    els.ratingTo.placeholder = Math.max(...ratings).toFixed(1);
  }
  updateFavTabCounter();
}

function bindEvents() {
  // Inputs som trigger re-render
  [
    els.search,
    els.genre,
    els.language,
    els.difficulty,
    els.ratingFrom,
    els.ratingTo,
    els.playFrom,
    els.playTo,
    els.availableOnly,
    els.sort,
    els.agePill,
    els.playersPill,
    els.durationPill,
  ].forEach((el) => el?.addEventListener("input", render));

  // “Ryd filtre” – både synlig og skjult knap
  document
    .getElementById("clear-filters-pill")
    ?.addEventListener("click", clearAllFilters);
  els.clear?.addEventListener("click", clearAllFilters);

  // Klik i grid: ❤️ eller åbn modal
  els.list.addEventListener("click", (e) => {
    // Toggle fav
    const favBtn = e.target.closest("button.fav[data-fav-id]");
    if (favBtn) {
      e.stopPropagation();
      const id = String(favBtn.dataset.favId).trim();
      const game = GAMES.find((g) => String(g.id) === id);
      const title = game?.title || "spillet";

      if (FAVS.has(id)) {
          FAVS.delete(id);

          favBtn.classList.remove("active");
          favBtn.setAttribute("aria-pressed", "false");
          favBtn.setAttribute(
            "aria-label",
            `Tilføj ${title} til favoritter`
          );

        } else {
          FAVS.add(id);

          favBtn.classList.add("active");
          favBtn.setAttribute("aria-pressed", "true");
          favBtn.setAttribute(
            "aria-label",
            `Fjern ${title} fra favoritter`
          );
        }

      if (favoriteStatus) {
        favoriteStatus.textContent = FAVS.has(id)
          ? `${title} er tilføjet til favoritter`
          : `${title} er fjernet fra favoritter`;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...FAVS]));
      updateFavTabCounter();
      if (SHOW_FAVS) render();
      return;
    }
    // Åbn modal
    const cardButton = e.target.closest(".card-open[data-id]");
    if (cardButton) {
      lastFocusedElement = cardButton;
      openModalById(cardButton.dataset.id);
      }
  });

  // Vælg café på forsiden
    document.querySelectorAll(".cafe-card").forEach((button) => {
      button.addEventListener("click", () => {
        const selectedCafe = button.dataset.cafe;

        document.body.style.overflow = "";

        homeView.hidden = true;
        gamesView.hidden = false;
        gamesHeader.hidden = false;

        selectedCafeName.textContent = selectedCafe;

        console.log("Valgt café:", selectedCafe);

        updateBackIcon();
      });
    });

  // Tabbar
  els.tabAll?.addEventListener("click", () => {
    if (!bookingView?.hidden) closeBooking();
    SHOW_FAVS = false;
    setActiveTab(els.tabAll);
    render();
  });

  els.tabFav?.addEventListener("click", () => {
    SHOW_FAVS = true;
    setActiveTab(els.tabFav);
    render();
  });

  els.tabRes?.addEventListener("click", () => {
    setActiveTab(els.tabRes);
    openBooking();
  });

  els.tabHome?.addEventListener("click", () => {
    if (!bookingView?.hidden) closeBooking();
    SHOW_FAVS = false;
    setActiveTab(null);
    render();
  });

  // Tilbageknap – luk modal/booking hvis åbne
  els.backBtn?.addEventListener("click", () => {
    if (modal && modal.hidden === false) {
      closeModal();
      return;
    }
    if (bookingView && bookingView.hidden === false) {
      closeBooking();
      return;
    }
     showHome();
  });

  // Dropdown-pill logik (kategori, spillere, alder, varighed + sort)
  setupNewFilters();
  logoHome?.addEventListener("click", showHome);
}

function showHome() {
document.body.style.overflow = "";

  homeView.hidden = false;
  gamesView.hidden = true;
  gamesHeader.hidden = true;

  updateBackIcon();

}


// Marker aktiv tab
function setActiveTab(el) {
  document
    .querySelectorAll(".tabbar .tab")
    .forEach((t) => t.classList.remove("active"));
  if (el?.classList.contains("tab")) el.classList.add("active");
}

// RYD FILTRE

function clearAllFilters() {

  // Ryd søgning
  if (els.search) {
    els.search.value = "";
  }

  // Ryd aktive filtre
  Object.values(ACTIVE_FILTERS).forEach((filterSet) => {
    filterSet.clear();
  });

  // Fjern markering fra checkboxe
  document
    .querySelectorAll('#filter-menu input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.checked = false;
    });

  // Fjern favoritvisning
  SHOW_FAVS = false;
  els.tabFav?.classList.remove("active");

  // Nulstil sortering
  if (els.sort) {
    els.sort.value = "none";
  }

  render();
}

// FILTER / SORT

const valueOrAll = (el) => (el && el.value ? el.value : "all");

function getFilters() {
  return {
    query: (els.search?.value || "").trim().toLowerCase(),
    genre: ACTIVE_FILTERS.genre,
    players: ACTIVE_FILTERS.players,
    age: ACTIVE_FILTERS.age,
    duration: ACTIVE_FILTERS.duration,
    sort: valueOrAll(els.sort),
  };
}

function applyFilters(arr, f) {
  return arr.filter((g) => {

    // SØGNING
    const text = (
      g.title +
      " " +
      (g.description || "") +
      " " +
      (g.rules || "")
    ).toLowerCase();

    if (f.query && !text.includes(f.query)) {
      return false;
    }


    // KATEGORI
    if (
      f.genre.size > 0 &&
      !f.genre.has(g.genre)
    ) {
      return false;
    }


    // SPILLERE
    if (
      f.players.size > 0 &&
      !matchesPlayerFilter(g, f.players)
    ) {
      return false;
    }


    // ALDER
    if (f.age.size > 0 && !matchesAgeFilter(g, f.age)) {
      return false;
    }


    // VARIGHED
    if (
      f.duration.size > 0 &&
      !matchesDurationFilter(g, f.duration)
    ) {
      return false;
    }


    // FAVORITTER
    if (
      SHOW_FAVS &&
      !FAVS.has(String(g.id))
    ) {
      return false;
    }

    return true;
  });
}

function matchesAgeFilter(game, selectedAges) {
  const gameAge = Number(game.age);

  return [...selectedAges].some((age) => {
    return gameAge >= Number(age);
  });
}

function matchesPlayerFilter(game, selectedPlayers) {
  const gameMin = game.players?.min ?? 1;
  const gameMax = game.players?.max ?? 99;

  return [...selectedPlayers].some((range) => {

    if (range.endsWith("+")) {
      const minimum = parseInt(range);
      return gameMax >= minimum;
    }

    const [min, max] = range.split("-").map(Number);

    return gameMax >= min && gameMin <= max;
  });
}


function matchesDurationFilter(game, selectedDurations) {
  const playtime = Number(game.playtime);

  return [...selectedDurations].some((range) => {

    if (range.endsWith("+")) {
      const minimum = parseInt(range);
      return playtime >= minimum;
    }

    const [min, max] = range.split("-").map(Number);

    return playtime >= min && playtime <= max;
  });
}

function applySort(arr, key) {
  const out = [...arr];
  switch (key) {
    case "title":
      out.sort((a, b) => a.title.localeCompare(b.title, "da"));
      break;
    case "playtime":
      out.sort((a, b) => (a.playtime ?? 0) - (b.playtime ?? 0));
      break;
    case "rating":
      out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
  }
  return out;
}

// RENDER

function render() {
  const f = getFilters();
  const filtered = applyFilters(GAMES, f);
  const sorted = applySort(filtered, f.sort);

  renderSelectedFilters();

  if (!sorted.length) {
    els.list.innerHTML = `<p style="color:#7b5647">Ingen spil matcher dine filtre.</p>`;
    updateBackIcon();
    return;
  }
  els.list.innerHTML = sorted.map(gameCard).join("");
  renderSelectedFilters();
  updateFavTabCounter();
  updateBackIcon();
}

function gameCard(g) {
  const favActive = FAVS.has(String(g.id)) ? "active" : "";
  const isFavourite = FAVS.has(String(g.id));

  const players = g.players ? `${g.players.min}–${g.players.max}` : "—";
  const rating = Number.isFinite(g.rating) ? g.rating.toFixed(1) : "—";
  const badgeAvail = g.available ? `<span class="badge">Ledig</span>` : ``;

  return `
   <article class="card">
        <button
          class="card-open"
          type="button"
          data-id="${g.id}"
          aria-label="Åbn detaljer om ${escapeHtml(g.title)}"
        ></button>

     <div class="thumb">
        <img
          src="${g.image}"
          alt="${escapeHtml(g.title)}"
          width="500"
          height="500"
          loading="lazy"
          decoding="async"
        >
       <div class="badges">${badgeAvail}</div>
       <button
          class="fav ${favActive}"
          type="button"
          data-fav-id="${g.id}"
          aria-pressed="${isFavourite}"
          aria-label="${
            isFavourite
              ? `Fjern ${escapeHtml(g.title)} fra favoritter`
              : `Tilføj ${escapeHtml(g.title)} til favoritter`
          }"
          >
            ❤
        </button>
     </div>
     <h3>${escapeHtml(g.title)}</h3>
     <div class="meta">
       <span>👥 ${players}</span>
       <span>⭐ ${rating}</span>
     </div>
     <div class="extra">
       ${g.shelf ? `<span>Placering: ${escapeHtml(g.shelf)}</span>` : ""}
     </div>
   </article>
 `;
}

// HELPERS

function fillUniqueOptions(select, arr) {
  if (!select) return;
  unique(arr).forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  });
}
function unique(arr) {
  return [...new Set(arr.filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), "da")
  );
}
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function updateFavTabCounter() {
  const s = els.tabFav?.querySelector("small");
  if (s) s.textContent = `Favoritter (${FAVS.size})`;
}

// MODAL (spildetaljer)

function openModalById(id) {
  const g = GAMES.find((x) => String(x.id) === String(id));
  if (!g || !modal) return;

  // Billede
  mImg.src = g.image;
  mImg.alt = g.title;

  // Titel + meta
  mTitle.textContent = g.title;
  mMeta.innerHTML = [
    Number.isFinite(g.rating) ? `⭐ ${g.rating.toFixed(1)}` : null,
    g.players ? `👥 ${g.players.min}–${g.players.max}` : null,
    Number.isFinite(g.playtime) ? `⏱️ ${g.playtime} min` : null,
    g.age ? `👶 ${g.age}+` : null,
  ]
    .filter(Boolean)
    .map((x) => `<span>${x}</span>`)
    .join("");

  // Beskrivelse + detaljer
  mDesc.textContent = g.description || "";
  mDetails.innerHTML = [
    g.genre ? `<span>🎭 Kategori: ${escapeHtml(g.genre)}</span>` : "",
    g.language ? `<span>🗣️ Sprog: ${escapeHtml(g.language)}</span>` : "",
    g.difficulty ? `<span>🎯 Sværhed: ${escapeHtml(g.difficulty)}</span>` : "",
    g.shelf ? `<span>📍 Placering: ${escapeHtml(g.shelf)}</span>` : "",
    g.available != null
      ? `<span>${g.available ? "✅ Ledig" : "❌ Udlånt"}</span>`
      : "",
  ].join("");

  // Regler (fold-ud)
  mRules.textContent =
    g.rules || "Der er endnu ikke tilføjet regler for dette spil.";
  mRulesWrap.hidden = false;
  rulesContent.classList.remove("open");
  rulesBtn.setAttribute("aria-expanded", "false");

  modal.hidden = false;
  document.body.style.overflow = "hidden";

  modal.querySelector(".modal-close")?.focus();

  updateBackIcon();
}

function closeModal() {
  if (!modal) return;

  modal.hidden = true;
  document.body.style.overflow = "";
  updateBackIcon();

  lastFocusedElement?.focus();
  lastFocusedElement = null;
}

// Regler-toggle
rulesBtn?.addEventListener("click", () => {
  const isOpen = rulesContent.classList.toggle("open");
  rulesBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
});

// Luk modal ved klik på backdrop/× eller Escape
modal?.addEventListener("click", (e) => {
  if (
    e.target.matches("[data-close]") ||
    e.target.classList.contains("modal-backdrop")
  ) {
    closeModal();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal && modal.hidden === false) closeModal();
});



function setupNewFilters() {
  const filterToggle = document.getElementById("filter-toggle");
  const filterMenu = document.getElementById("filter-menu");
  const selectedFilters = document.getElementById("selected-filters");


  // ÅBN / LUK HELE FILTERMENUEN
  filterToggle?.addEventListener("click", () => {
    const isOpen = !filterMenu.hidden;

    filterMenu.hidden = isOpen;

    filterToggle.setAttribute(
      "aria-expanded",
      isOpen ? "false" : "true"
    );

    const arrow = filterToggle.querySelector("span");

    if (arrow) {
      arrow.textContent = isOpen ? "⌄" : "⌃";
    }
  });


  // ÅBN / LUK DE ENKELTE FILTERGRUPPER
  document
    .querySelectorAll(".filter-group-toggle")
    .forEach((button) => {

      button.addEventListener("click", () => {

        const optionsId = button.getAttribute("aria-controls");
        const options = document.getElementById(optionsId);

        if (!options) return;

        const isOpen = !options.hidden;

        options.hidden = isOpen;

        button.setAttribute(
          "aria-expanded",
          isOpen ? "false" : "true"
        );

        const arrow = button.querySelector("span");

        if (arrow) {
          arrow.textContent = isOpen ? "⌄" : "⌃";
        }
      });
    });


  // NÅR EN CHECKBOX VÆLGES
  filterMenu?.addEventListener("change", (event) => {

    const checkbox = event.target.closest(
      'input[type="checkbox"][data-filter]'
    );

    if (!checkbox) return;

    const filterType = checkbox.dataset.filter;
    const value = checkbox.value;

    if (!ACTIVE_FILTERS[filterType]) return;


    if (checkbox.checked) {
      ACTIVE_FILTERS[filterType].add(value);
    } else {
      ACTIVE_FILTERS[filterType].delete(value);
    }

    render();
  });


  // FJERN ET VALGT FILTER MED ×
  selectedFilters?.addEventListener("click", (event) => {

    const button = event.target.closest(
      ".selected-filter"
    );

    if (!button) return;

    const filterType = button.dataset.filter;
    const value = button.dataset.value;

    if (!ACTIVE_FILTERS[filterType]) return;

    ACTIVE_FILTERS[filterType].delete(value);


    // Fjern også checkboxens markering
    const checkbox = document.querySelector(
      `input[data-filter="${filterType}"][value="${value}"]`
    );

    if (checkbox) {
      checkbox.checked = false;
    }

    render();
  });
}

function renderSelectedFilters() {
  const container = document.getElementById("selected-filters");

  if (!container) return;

  const filters = [];

  Object.entries(ACTIVE_FILTERS).forEach(
    ([filterType, values]) => {

      values.forEach((value) => {

        filters.push({
          filterType,
          value,
          label: getFilterLabel(filterType, value),
        });

      });
    }
  );


  if (filters.length === 0) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }


  container.hidden = false;

  container.innerHTML = filters
    .map(
      (filter) => `
        <button
          type="button"
          class="selected-filter"
          data-filter="${filter.filterType}"
          data-value="${filter.value}"
          aria-label="Fjern filter ${escapeHtml(filter.label)}"
        >
          ${escapeHtml(filter.label)}
          <span aria-hidden="true">×</span>
        </button>
      `
    )
    .join("");
}


function getFilterLabel(type, value) {

  if (type === "genre") {
    return value;
  }

  if (type === "players") {
    return `${value.replace("-", "–")} spillere`;
  }

  if (type === "age") {
    return `${value}+ år`;
  }

  if (type === "duration") {

    const durationLabels = {
      "0-15": "≤ 15 min",
      "15-30": "15–30 min",
      "30-60": "30–60 min",
      "60-120": "60–120 min",
      "120+": "120+ min",
    };

    return durationLabels[value] || value;
  }

  return value;
}

// BOOKING FLOW (1 → 7) – uændret adfærd
const CAFES = [
  {
    id: "aarhus-v",
    name: "Aarhus V",
    address: "Vesterbrogade 36, 8000",
    img: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "aarhus-c",
    name: "Aarhus C",
    address: "Søndergade 98, 8000",
    img: "https://images.unsplash.com/photo-1481833761820-0509d3217039?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "aalborg",
    name: "Aalborg",
    address: "Nytorv 21, 9000",
    img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "odense",
    name: "Odense",
    address: "Kongensgade 11, 5000",
    img: "https://images.unsplash.com/photo-1498654200943-1088dd4438ae?q=80&w=800&auto=format&fit=crop",
  },
];

const booking = {
  step: 1,
  cafe: null,
  guests: null,
  month: null, // Date for 1. i måneden
  date: null, // YYYY-MM-DD
  time: null,
  type: null,
  name: "",
  phone: "",
  email: "",
  note: "",
};

function openBooking() {
  if (!bookingView) return;
  document.querySelector("main.page").style.display = "none";
  bookingView.hidden = false;
  booking.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  booking.step = 1;
  renderBooking();
  document
    .querySelectorAll(".tabbar .tab")
    .forEach((t) => t.classList.remove("active"));
  els.tabRes?.classList.add("active");
  updateBackIcon();
}

function closeBooking() {
  if (!bookingView) return;
  bookingView.hidden = true;
  document.querySelector("main.page").style.display = "";
  document
    .querySelectorAll(".tabbar .tab")
    .forEach((t) => t.classList.remove("active"));
  document.getElementById("tab-home")?.classList.add("active");
  updateBackIcon();
}

function renderBooking() {
  switch (booking.step) {
    case 1:
      return renderStepCafe();
    case 2:
      return renderStepGuests();
    case 3:
      return renderStepMonth();
    case 4:
      return renderStepDayAndTime();
    case 5:
      return renderStepType();
    case 6:
      return renderStepConfirm();
    case 7:
      return renderStepSuccess();
  }
}

function logo() {
  return `
    <img
      class="booking-logo"
      src="images/logo-spilcafe.webp"
      alt="Spilcaféen"
    >
  `;
}

/* STEP 1 – café */
function renderStepCafe() {
  bookingStage.innerHTML = `
   ${logo()}
   <h2 class="booking-title">Vælg café</h2>
   <div class="booking-grid booking-cafes">
     ${CAFES.map(
       (c) => `
       <article class="booking-card" data-cafe="${c.id}">
         <img src="${c.img}" alt="${c.name}">
         <h4>${c.name}</h4>
         <p>${c.address}</p>
       </article>
     `
     ).join("")}
   </div>
 `;
  bookingStage.querySelectorAll("[data-cafe]").forEach((card) => {
    card.addEventListener("click", () => {
      booking.cafe = CAFES.find((c) => c.id === card.dataset.cafe);
      booking.step = 2;
      renderBooking();
    });
  });
}

/* STEP 2 – gæster */
function renderStepGuests() {
  bookingStage.innerHTML = `
   ${logo()}
   <h2 class="booking-title">Hvor mange gæster er I?</h2>
   <div class="booking-bubbles">
     ${[2, 3, 4, 5, 6, 7, 8]
       .map((n) => `<button class="bubble" data-guests="${n}">${n}</button>`)
       .join("")}
   </div>
 `;
  bookingStage.querySelectorAll("[data-guests]").forEach((btn) => {
    btn.addEventListener("click", () => {
      booking.guests = Number(btn.dataset.guests);
      booking.step = 3;
      renderBooking();
    });
  });
}

/* STEP 3 – måned */
function renderStepMonth() {
  const d = booking.month || new Date();
  const ym = d.toLocaleDateString("da-DK", { month: "long", year: "numeric" });
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const startW = (first.getDay() + 6) % 7;
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

  const leading = Array.from(
    { length: startW },
    () => `<div class="cal-cell muted"></div>`
  ).join("");
  const body = Array.from(
    { length: days },
    (_, i) => `<button class="cal-cell" data-day="${i + 1}">${i + 1}</button>`
  ).join("");

  bookingStage.innerHTML = `
   ${logo()}
   <h2 class="booking-title">${ym}</h2>
   <div class="cal-header">
     <button class="cal-arrow" data-nav="-1">‹</button>
     <div style="min-width:140px"></div>
     <button class="cal-arrow" data-nav="1">›</button>
   </div>
   <div class="calendar">
     ${["ma", "ti", "on", "to", "fr", "lø", "sø"]
       .map((s) => `<div class="cal-day">${s}</div>`)
       .join("")}
     ${leading}${body}
   </div>
   <div class="legend"><span class="dot dot-green"></span> Ledige dage</div>
 `;

  bookingStage.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const diff = Number(btn.dataset.nav);
      booking.month = new Date(d.getFullYear(), d.getMonth() + diff, 1);
      renderStepMonth();
    });
  });
  bookingStage.querySelectorAll("[data-day]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const day = String(btn.dataset.day).padStart(2, "0");
      const mm = String((booking.month || d).getMonth() + 1).padStart(2, "0");
      const yy = (booking.month || d).getFullYear();
      booking.date = `${yy}-${mm}-${day}`;
      booking.step = 4;
      renderBooking();
    });
  });
}

/* STEP 4 – tid */
function renderStepDayAndTime() {
  const human = new Date(booking.date + "T00:00:00").toLocaleDateString(
    "da-DK",
    { day: "numeric", month: "long", year: "numeric" }
  );
  const slots = [];
  for (let h = 11; h <= 22; h++)
    ["00", "30"].forEach((m) =>
      slots.push(`${String(h).padStart(2, "0")}:${m}`)
    );
  const busy = new Set(["11:30", "14:00", "16:30", "18:00", "19:30", "20:30"]); // demo

  bookingStage.innerHTML = `
   ${logo()}
   <h2 class="booking-title">${human}</h2>
   <div class="booking-time">
     ${slots
       .map(
         (t) =>
           `<button class="slot ${
             busy.has(t) ? "busy" : ""
           }" data-time="${t}">${t}</button>`
       )
       .join("")}
   </div>
   <div class="legend">
     <span class="dot dot-green"></span> Ledige tider &nbsp;&nbsp;
     <span class="dot dot-red"></span> Reserveret
   </div>
 `;
  bookingStage.querySelectorAll("[data-time]").forEach((btn) => {
    if (btn.classList.contains("busy")) return;
    btn.addEventListener("click", () => {
      booking.time = btn.dataset.time;
      booking.step = 5;
      renderBooking();
    });
  });
}

/* STEP 5 – type */
function renderStepType() {
  bookingStage.innerHTML = `
   ${logo()}
   <h2 class="booking-title">Vælg type</h2>
   <div class="booking-type">
     ${[1, 2, 3]
       .map(
         (n) => `
       <button class="slot primary" data-type="Vi spiller i ${n} time${
           n > 1 ? "r" : ""
         }">
         Vi spiller i ${n} time${n > 1 ? "r" : ""}
       </button>
     `
       )
       .join("")}
   </div>
 `;
  bookingStage.querySelectorAll("[data-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      booking.type = btn.dataset.type;
      booking.step = 6;
      renderBooking();
    });
  });
}

/* STEP 6 – bekræft + kontakt */
function renderStepConfirm() {
  const place = booking.cafe
    ? `${booking.cafe.name} – ${booking.cafe.address}`
    : "";
  const humanDate = new Date(booking.date + "T00:00:00").toLocaleDateString(
    "da-DK",
    { day: "numeric", month: "long", year: "numeric" }
  );
  bookingStage.innerHTML = `
   ${logo()}
   <h2 class="booking-title">Bekræft</h2>
   <div class="booking-summary">
     <div><strong>Sted</strong><br>${place}</div>
     <div><strong>Dato</strong><br>${humanDate}</div>
     <div><strong>Tid</strong><br>${booking.time}</div>
     <div><strong>Antal gæster</strong><br>${booking.guests}</div>
     <div><strong>Type</strong><br>${booking.type}</div>
   </div>

   <form class="booking-form" id="confirm-form">
     <input type="text"  name="name"  placeholder="Navn"   required>
     <input type="tel"   name="phone" placeholder="Mobil"  required>
     <input type="email" name="email" placeholder="E-mail" required>
     <textarea name="note" rows="3" placeholder="Kommentar"></textarea>
     <button class="booking-btn" type="submit">Bekræft booking</button>
   </form>
 `;
  document.getElementById("confirm-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    booking.name = String(fd.get("name") || "");
    booking.phone = String(fd.get("phone") || "");
    booking.email = String(fd.get("email") || "");
    booking.note = String(fd.get("note") || "");
    booking.step = 7;
    renderBooking();
  });
}

/* STEP 7 – succes */
function renderStepSuccess() {
  const humanDate = new Date(booking.date + "T00:00:00").toLocaleDateString(
    "da-DK",
    { day: "numeric", month: "long", year: "numeric" }
  );
  bookingStage.innerHTML = `
   ${logo()}
   <div class="booking-success">
     <div class="success-big">Tak for din booking 😊</div>
     <div class="booking-summary" style="text-align:left">
       <div><strong>Sted</strong><br>${booking.cafe.name} – ${
    booking.cafe.address
  }</div>
       <div><strong>Dato</strong><br>${humanDate}</div>
       <div><strong>Tid</strong><br>${booking.time}</div>
       <div><strong>Antal gæster</strong><br>${booking.guests}</div>
       <div><strong>Type</strong><br>${booking.type}</div>
       <div><strong>Navn</strong><br>${booking.name}</div>
       <div><strong>Email</strong><br>${booking.email}</div>
       ${
         booking.note
           ? `<div><strong>Kommentar</strong><br>${escapeHtml(
               booking.note
             )}</div>`
           : ""
       }
     </div>
     <button class="booking-btn" id="done-btn">Afslut</button>
   </div>
 `;
  document.getElementById("done-btn").addEventListener("click", () => {
    closeBooking();
    // reset
    booking.step = 1;
    booking.cafe =
      booking.guests =
      booking.date =
      booking.time =
      booking.type =
        null;
    booking.name = booking.phone = booking.email = booking.note = "";
  });
}

// Tilbageknap – kun synlig når modal eller booking er åben

function isHomeView() {
  const modalOpen = modal && modal.hidden === false;
  const bookingOpen = bookingView && bookingView.hidden === false;
  return !(modalOpen || bookingOpen);
}
function updateBackIcon() {
  if (!els.backBtn) return;

  els.backBtn.style.visibility =
    homeView && !homeView.hidden ? "hidden" : "visible";
}

