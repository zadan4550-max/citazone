
const TMDB_API_KEY = "1014c047929e9eceb961569f659f59cd";
const API_BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";
const BACKDROP = "https://image.tmdb.org/t/p/w1280";

const $ = (s) => document.querySelector(s);
const grids = {
  trending: $("#trendingGrid"),
  popular: $("#popularGrid"),
  upcoming: $("#upcomingGrid"),
  search: $("#searchGrid")
};

function apiUrl(path, params={}) {
  const url = new URL(API_BASE + path);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  return url.toString();
}

async function tmdb(path, params={}) {
  if (TMDB_API_KEY === "PASTE_YOUR_TMDB_API_KEY_HERE") {
    throw new Error("Add your TMDB API key in script.js first.");
  }
  const res = await fetch(apiUrl(path, params));
  if (!res.ok) throw new Error(`TMDB request failed (${res.status})`);
  return res.json();
}

function skeletons(grid, count=5) {
  grid.innerHTML = Array.from({length:count},()=>'<div class="skeleton" style="aspect-ratio:2/3"></div>').join("");
}

function year(date){ return date ? date.slice(0,4) : "—"; }
function escapeHtml(str=""){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

function renderMovies(grid, movies) {
  grid.innerHTML = "";
  const list = movies.filter(m => m.poster_path).slice(0, 20);
  if (!list.length) { grid.innerHTML = '<p style="color:#9da3b0">No movies found.</p>'; return; }
  list.forEach(movie => {
    const card = document.createElement("article");
    card.className = "movie-card";
    card.innerHTML = `
      <div class="poster-wrap">
        <img loading="lazy" src="${IMG}${movie.poster_path}" alt="${escapeHtml(movie.title || movie.name || "Movie")} poster">
        <span class="rating">★ ${movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}</span>
      </div>
      <h3>${escapeHtml(movie.title || movie.name || "Untitled")}</h3>
      <div class="movie-year">${year(movie.release_date || movie.first_air_date)}</div>`;
    card.addEventListener("click", () => openMovie(movie.id));
    grid.appendChild(card);
  });
}

async function loadHome() {
  Object.values(grids).forEach(g => skeletons(g));
  try {
    const [trending, popular, upcoming] = await Promise.all([
      tmdb("/trending/movie/week"),
      tmdb("/movie/popular", {page:1}),
      tmdb("/movie/upcoming", {page:1})
    ]);
    renderMovies(grids.trending, trending.results);
    renderMovies(grids.popular, popular.results);
    renderMovies(grids.upcoming, upcoming.results);
  } catch (err) {
    Object.values(grids).forEach(g => g.innerHTML = `<p style="color:#ffb4a0">${escapeHtml(err.message)}</p>`);
    $("#searchMessage").textContent = "Add your TMDB API key in script.js, then refresh the page.";
  }
}

async function searchMovies(query) {
  const q = query.trim();
  if (!q) return;
  $("#searchMessage").textContent = "Searching...";
  $("#searchSection").hidden = false;
  $("#searchTitle").textContent = `Results for “${q}”`;
  skeletons(grids.search, 10);
  $("#searchSection").scrollIntoView({behavior:"smooth", block:"start"});
  try {
    const data = await tmdb("/search/movie", {query:q, include_adult:"false", page:1});
    renderMovies(grids.search, data.results);
    $("#searchMessage").textContent = `${data.total_results || 0} result(s) found.`;
  } catch(err) {
    grids.search.innerHTML = `<p style="color:#ffb4a0">${escapeHtml(err.message)}</p>`;
    $("#searchMessage").textContent = "";
  }
}

async function openMovie(id) {
  const modal = $("#movieModal");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
  $("#modalTitle").textContent = "Loading...";
  $("#modalOverview").textContent = "";
  $("#modalPoster").removeAttribute("src");
  $("#modalBackdropImage").style.backgroundImage = "";
  $("#modalGenres").textContent = "";
  $("#modalMeta").innerHTML = "";
  $("#modalCast").innerHTML = "";
  $("#trailerBtn").href = "#";
  try {
    const movie = await tmdb(`/movie/${id}`, {append_to_response:"credits,videos"});
    $("#modalTitle").textContent = movie.title || "Untitled";
    $("#modalPoster").src = movie.poster_path ? IMG + movie.poster_path : "";
    $("#modalPoster").alt = `${movie.title || "Movie"} poster`;
    $("#modalBackdropImage").style.backgroundImage = movie.backdrop_path ? `url("${BACKDROP}${movie.backdrop_path}")` : "";
    $("#modalGenres").textContent = (movie.genres || []).map(g=>g.name).join(" • ");
    $("#modalMeta").innerHTML = `
      <span>📅 ${year(movie.release_date)}</span>
      <span>⭐ ${movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}</span>
      <span>⏱ ${movie.runtime ? movie.runtime + " min" : "—"}</span>`;
    $("#modalOverview").textContent = movie.overview || "No overview available.";
    const cast = (movie.credits?.cast || []).slice(0,5).map(c=>c.name).join(", ");
    $("#modalCast").innerHTML = cast ? `<b>Cast:</b> ${escapeHtml(cast)}` : "";
    const trailer = (movie.videos?.results || []).find(v => v.site === "YouTube" && v.type === "Trailer") ||
                    (movie.videos?.results || []).find(v => v.site === "YouTube");
    if (trailer) $("#trailerBtn").href = `https://www.youtube.com/watch?v=${trailer.key}`;
    else $("#trailerBtn").style.display = "none";
  } catch(err) {
    $("#modalTitle").textContent = "Could not load movie";
    $("#modalOverview").textContent = err.message;
  }
}

function closeModal(){
  $("#movieModal").classList.remove("show");
  $("#movieModal").setAttribute("aria-hidden","true");
  document.body.style.overflow = "";
  $("#trailerBtn").style.display = "";
}

$("#searchBtn").addEventListener("click", () => searchMovies($("#searchInput").value));
$("#searchInput").addEventListener("keydown", e => { if(e.key === "Enter") searchMovies(e.target.value); });
$("#closeModal").addEventListener("click", closeModal);
$("#modalBackdrop").addEventListener("click", closeModal);
document.addEventListener("keydown", e => { if(e.key === "Escape") closeModal(); });

$("#menuBtn").addEventListener("click", () => $("#mobileNav").classList.toggle("open"));
document.querySelectorAll(".mobile-nav a").forEach(a => a.addEventListener("click",()=>$("#mobileNav").classList.remove("open")));
document.querySelectorAll("[data-scroll]").forEach(b => b.addEventListener("click",()=>document.querySelector(b.dataset.scroll)?.scrollIntoView({behavior:"smooth"})));

loadHome();
