// =============================================================
// Cubico School Prototypes — Image Loader (public pages)
// =============================================================
// Loads image overrides from Supabase and applies them to the
// current page. Reads <img data-slot="..."> elements and
// elements with data-slot-bg="..." attributes.
//
// Usage on every public page (Home, About, Programs, Admissions):
//   <script src="../supabase-config.js"></script>
//   <script src="../shared/image-loader.js"></script>
//   <script>CubicoImages.init("school-slug");</script>
//
// On first visit, placeholder images load instantly, then real
// images swap in after the Supabase fetch completes (~200ms).
// On repeat visits, real images load instantly from cache.
// =============================================================

(function () {
  const CACHE_PREFIX = "cubico-images-";
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async function init(schoolSlug) {
    if (!schoolSlug) {
      console.warn("[Cubico] CubicoImages.init() requires a school slug");
      return;
    }

    // 1. Apply cached values immediately (zero-flash for repeat visitors)
    const cached = readCache(schoolSlug);
    if (cached) applyImages(cached);

    // 2. Fetch fresh data from Supabase in the background
    try {
      const fresh = await fetchImages(schoolSlug);
      applyImages(fresh);
      writeCache(schoolSlug, fresh);
    } catch (err) {
      console.warn("[Cubico] Could not fetch image overrides:", err.message);
    }
  }

  function readCache(slug) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + slug);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts > CACHE_TTL) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function writeCache(slug, data) {
    try {
      localStorage.setItem(
        CACHE_PREFIX + slug,
        JSON.stringify({ data: data, ts: Date.now() })
      );
    } catch (e) {}
  }

  async function fetchImages(slug) {
    const cfg = window.CUBICO_CONFIG;
    if (!cfg || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.indexOf("PASTE_YOUR") === 0) {
      throw new Error("Supabase config missing — paste values into supabase-config.js");
    }
    const url =
      cfg.SUPABASE_URL +
      "/rest/v1/school_images?school_slug=eq." +
      encodeURIComponent(slug) +
      "&select=slot,url";
    const res = await fetch(url, {
      headers: {
        apikey: cfg.SUPABASE_ANON_KEY,
        Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY,
      },
    });
    if (!res.ok) {
      throw new Error("Supabase fetch failed: " + res.status);
    }
    const rows = await res.json();
    const map = {};
    for (let i = 0; i < rows.length; i++) {
      map[rows[i].slot] = rows[i].url;
    }
    return map;
  }

  function applyImages(map) {
    // <img data-slot="..."> elements — swap src
    document.querySelectorAll("img[data-slot]").forEach(function (img) {
      const slot = img.getAttribute("data-slot");
      if (map[slot]) {
        img.src = map[slot];
        img.classList.add("has-uploaded");
        // Hide siblings marked with .slot-fallback (e.g. monogram inside logo)
        const parent = img.parentElement;
        if (parent) {
          parent.querySelectorAll(".slot-fallback").forEach(function (el) {
            el.style.display = "none";
          });
        }
      }
    });

    // [data-slot-bg="..."] elements — set --slot-image CSS variable
    // Pages declare CSS like:
    //   .hero { background-image: linear-gradient(...), var(--slot-image); }
    document.querySelectorAll("[data-slot-bg]").forEach(function (el) {
      const slot = el.getAttribute("data-slot-bg");
      if (map[slot]) {
        el.style.setProperty("--slot-image", 'url("' + map[slot] + '")');
      }
    });
  }

  window.CubicoImages = { init: init };
})();
