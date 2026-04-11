// =============================================================
// Cubico School Prototypes — Admin Uploader
// =============================================================
// Shared upload UI for every school's admin.html page.
// The slot list is identical across all schools (the rule).
//
// Each school's admin.html sets:
//   <script>window.CUBICO_SCHOOL = { slug: "msl-clifton", name: "MSL Clifton" };</script>
// then loads this file.
// =============================================================

(function () {
  // ---- Slot definitions (identical across every school) ----
  const SLOTS = [
    {
      section: "Brand",
      slots: [
        { id: "logo", label: "School Logo", hint: "Square or wide logo. Transparent PNG works best." },
      ],
    },
    {
      section: "Page Hero Backgrounds",
      slots: [
        { id: "hero-home",        label: "Home Page Hero",        hint: "Wide landscape — students or campus exterior." },
        { id: "hero-about",       label: "About Page Hero",       hint: "School building or group photo." },
        { id: "hero-programs",    label: "Programs Page Hero",    hint: "Children learning, classroom, books." },
        { id: "hero-admissions",  label: "Admissions Page Hero",  hint: "Welcoming campus shot." },
      ],
    },
    {
      section: "About Page",
      slots: [
        { id: "about-story",     label: "Our Story Image",            hint: "Main about image — classroom or students." },
        { id: "principal-photo", label: "Principal / Founder Photo",  hint: "Square headshot of principal or founder." },
        { id: "campus-1",        label: "Campus Photo 1",             hint: "Building, library, or facilities." },
        { id: "campus-2",        label: "Campus Photo 2",             hint: "Different angle or facility." },
        { id: "campus-3",        label: "Campus Photo 3",             hint: "Different angle or facility." },
      ],
    },
    {
      section: "Programs Page",
      slots: [
        { id: "program-1", label: "Program 1 Image", hint: "First program (e.g. Playgroup / Early Years)." },
        { id: "program-2", label: "Program 2 Image", hint: "Second program (e.g. Nursery / Primary)." },
        { id: "program-3", label: "Program 3 Image", hint: "Third program (e.g. KG / Secondary)." },
        { id: "program-4", label: "Program 4 Image (optional)", hint: "Only if school has 4 programs." },
      ],
    },
    {
      section: "Gallery (used across pages)",
      slots: [
        { id: "gallery-1", label: "Gallery 1", hint: "Campus life — sports, art, events." },
        { id: "gallery-2", label: "Gallery 2", hint: "Campus life." },
        { id: "gallery-3", label: "Gallery 3", hint: "Campus life." },
        { id: "gallery-4", label: "Gallery 4", hint: "Campus life." },
      ],
    },
    {
      section: "Admissions Page",
      slots: [
        { id: "admissions-photo", label: "Admissions Image", hint: "Happy student or welcoming entrance." },
      ],
    },
  ];

  let school = null;
  let currentImages = {};

  // ---- Boot ----
  document.addEventListener("DOMContentLoaded", function () {
    school = window.CUBICO_SCHOOL;
    if (!school || !school.slug) {
      alert("Missing window.CUBICO_SCHOOL config in admin.html");
      return;
    }
    const cfg = window.CUBICO_CONFIG;
    if (!cfg || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.indexOf("PASTE_YOUR") === 0) {
      alert("Supabase config missing — paste values into supabase-config.js");
      return;
    }
    setupPasswordGate();
  });

  // ---- Password gate ----
  function setupPasswordGate() {
    const cfg = window.CUBICO_CONFIG;
    const gate = document.getElementById("password-gate");
    const form = document.getElementById("password-form");
    const input = document.getElementById("password-input");
    const errMsg = document.getElementById("password-error");

    if (sessionStorage.getItem("cubico-admin-auth") === "yes") {
      gate.style.display = "none";
      bootAdmin();
      return;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (input.value === cfg.ADMIN_PASSWORD) {
        sessionStorage.setItem("cubico-admin-auth", "yes");
        gate.style.display = "none";
        bootAdmin();
      } else {
        errMsg.textContent = "Wrong password.";
        input.value = "";
        input.focus();
      }
    });
  }

  // ---- Boot admin UI ----
  async function bootAdmin() {
    const nameEl = document.getElementById("school-name");
    if (nameEl) nameEl.textContent = school.name;

    renderSlots();
    await loadCurrentImages();
  }

  function renderSlots() {
    const root = document.getElementById("slots-root");
    let html = "";
    for (let i = 0; i < SLOTS.length; i++) {
      const sec = SLOTS[i];
      html += '<section class="slot-section">';
      html += '<h2>' + escapeHtml(sec.section) + '</h2>';
      html += '<div class="slot-grid">';
      for (let j = 0; j < sec.slots.length; j++) {
        html += renderSlotCard(sec.slots[j]);
      }
      html += '</div></section>';
    }
    root.innerHTML = html;

    root.querySelectorAll(".slot-card").forEach(function (card) {
      const slotId = card.dataset.slot;
      const fileInput = card.querySelector('input[type="file"]');
      const deleteBtn = card.querySelector(".btn-delete");
      fileInput.addEventListener("change", function (e) {
        if (e.target.files[0]) handleUpload(slotId, e.target.files[0]);
      });
      deleteBtn.addEventListener("click", function () {
        handleDelete(slotId);
      });
    });
  }

  function renderSlotCard(slot) {
    return ''
      + '<div class="slot-card" data-slot="' + escapeHtml(slot.id) + '">'
      +   '<div class="slot-preview">'
      +     '<img class="slot-img" alt="" />'
      +     '<div class="slot-empty">No image yet · placeholder shown on site</div>'
      +     '<div class="slot-uploading">Uploading…</div>'
      +   '</div>'
      +   '<div class="slot-meta">'
      +     '<div class="slot-label">' + escapeHtml(slot.label) + '</div>'
      +     '<div class="slot-id">' + escapeHtml(slot.id) + '</div>'
      +     '<div class="slot-hint">' + escapeHtml(slot.hint) + '</div>'
      +   '</div>'
      +   '<div class="slot-actions">'
      +     '<label class="btn-upload">'
      +       '<input type="file" accept="image/*" hidden />'
      +       '<span>Upload</span>'
      +     '</label>'
      +     '<button type="button" class="btn-delete">Remove</button>'
      +   '</div>'
      +   '<div class="slot-status"></div>'
      + '</div>';
  }

  // ---- Data fetch ----
  async function loadCurrentImages() {
    try {
      const cfg = window.CUBICO_CONFIG;
      const url = cfg.SUPABASE_URL
        + "/rest/v1/school_images?school_slug=eq."
        + encodeURIComponent(school.slug)
        + "&select=slot,url";
      const res = await fetch(url, {
        headers: {
          apikey: cfg.SUPABASE_ANON_KEY,
          Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY,
        },
      });
      if (!res.ok) throw new Error("Fetch failed: " + res.status);
      const rows = await res.json();
      currentImages = {};
      for (let i = 0; i < rows.length; i++) {
        currentImages[rows[i].slot] = rows[i].url;
      }
      for (const slotId in currentImages) {
        showPreview(slotId, currentImages[slotId]);
      }
    } catch (e) {
      console.error("[Cubico] Failed to load current images:", e);
    }
  }

  // ---- UI helpers ----
  function showPreview(slotId, url) {
    const card = document.querySelector('.slot-card[data-slot="' + cssEsc(slotId) + '"]');
    if (!card) return;
    const img = card.querySelector(".slot-img");
    const empty = card.querySelector(".slot-empty");
    img.src = url;
    img.classList.add("has-image");
    empty.style.display = "none";
  }

  function clearPreview(slotId) {
    const card = document.querySelector('.slot-card[data-slot="' + cssEsc(slotId) + '"]');
    if (!card) return;
    const img = card.querySelector(".slot-img");
    const empty = card.querySelector(".slot-empty");
    img.removeAttribute("src");
    img.classList.remove("has-image");
    empty.style.display = "";
  }

  function setStatus(slotId, msg, type) {
    const card = document.querySelector('.slot-card[data-slot="' + cssEsc(slotId) + '"]');
    if (!card) return;
    const status = card.querySelector(".slot-status");
    status.textContent = msg;
    status.className = "slot-status " + (type || "");
    if (type === "success") {
      setTimeout(function () {
        status.textContent = "";
        status.className = "slot-status";
      }, 3000);
    }
  }

  function setUploading(slotId, on) {
    const card = document.querySelector('.slot-card[data-slot="' + cssEsc(slotId) + '"]');
    if (!card) return;
    card.classList.toggle("uploading", on);
  }

  // ---- Upload ----
  async function handleUpload(slotId, file) {
    setUploading(slotId, true);
    setStatus(slotId, "Uploading…");

    try {
      const cfg = window.CUBICO_CONFIG;
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = school.slug + "/" + slotId + "-" + Date.now() + "." + ext;
      const uploadUrl = cfg.SUPABASE_URL
        + "/storage/v1/object/" + cfg.STORAGE_BUCKET + "/" + path;

      // 1. Upload binary to Supabase Storage
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY,
          "Content-Type": file.type || "application/octet-stream",
          "x-upsert": "true",
        },
        body: file,
      });
      if (!uploadRes.ok) {
        const txt = await uploadRes.text();
        throw new Error("Upload " + uploadRes.status + ": " + txt);
      }

      // 2. Build the public URL
      const publicUrl = cfg.SUPABASE_URL
        + "/storage/v1/object/public/" + cfg.STORAGE_BUCKET + "/" + path;

      // 3. Upsert into school_images table
      const dbRes = await fetch(cfg.SUPABASE_URL + "/rest/v1/school_images", {
        method: "POST",
        headers: {
          apikey: cfg.SUPABASE_ANON_KEY,
          Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          school_slug: school.slug,
          slot: slotId,
          url: publicUrl,
        }),
      });
      if (!dbRes.ok) {
        const txt = await dbRes.text();
        throw new Error("DB " + dbRes.status + ": " + txt);
      }

      currentImages[slotId] = publicUrl;
      showPreview(slotId, publicUrl);
      setStatus(slotId, "✓ Uploaded — live on site", "success");

      // Bust the public-page cache so the new image shows up immediately
      try { localStorage.removeItem("cubico-images-" + school.slug); } catch (e) {}

    } catch (err) {
      setStatus(slotId, "Error: " + err.message, "error");
      console.error("[Cubico]", err);
    } finally {
      setUploading(slotId, false);
    }
  }

  // ---- Delete ----
  async function handleDelete(slotId) {
    if (!confirm('Remove image for "' + slotId + '"?\nThe site will revert to the placeholder.')) return;

    try {
      const cfg = window.CUBICO_CONFIG;
      const url = cfg.SUPABASE_URL
        + "/rest/v1/school_images?school_slug=eq."
        + encodeURIComponent(school.slug)
        + "&slot=eq." + encodeURIComponent(slotId);
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          apikey: cfg.SUPABASE_ANON_KEY,
          Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY,
        },
      });
      if (!res.ok) throw new Error("Delete " + res.status);

      delete currentImages[slotId];
      clearPreview(slotId);
      setStatus(slotId, "✓ Removed", "success");

      try { localStorage.removeItem("cubico-images-" + school.slug); } catch (e) {}
    } catch (err) {
      setStatus(slotId, "Error: " + err.message, "error");
    }
  }

  // ---- Utils ----
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function cssEsc(s) {
    return String(s).replace(/"/g, '\\"');
  }
})();
