// =============================================================
// Cubico CRM v2 — Lead Tracking for School Prototypes
// =============================================================
//
// SUPABASE SQL — Run this ONCE to add new columns (v2):
//
//   alter table public.leads add column if not exists country text default 'Pakistan';
//   alter table public.leads add column if not exists website_issue text;
//   alter table public.leads add column if not exists found_from text;
//
// (If starting fresh, use the full create table from v1 first,
//  then run the alter statements above.)
//
// =============================================================

(function () {
  "use strict";

  // ---- Constants ----
  var STATUSES = ["New", "Researching", "Emailed", "Replied", "Meeting", "Proposal", "Won", "Lost", "On Hold"];
  var PRIORITIES = ["Hot", "Warm", "Cold"];
  var SOURCES = ["Cold Email", "Referral", "Walk-in", "Social Media", "Website", "Other"];
  var COUNTRIES = ["Pakistan", "Saudi Arabia", "USA", "UAE", "UK", "Canada", "Other"];
  var FOUND_FROM = ["Google Maps", "Google Search", "School Directory", "Facebook", "Instagram", "LinkedIn", "Referral", "Walk-in / Drive-by", "Yellow Pages", "Website Listing", "Other"];
  var ACTIVITY_TYPES = [
    { value: "email_sent", label: "Email Sent" },
    { value: "email_received", label: "Email Received" },
    { value: "call", label: "Phone Call" },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "meeting", label: "Meeting" },
    { value: "note", label: "Note" },
  ];

  var FOLLOW_UP_DAYS = {
    New: 1, Researching: 2, Emailed: 3, Replied: 1, Meeting: 1, Proposal: 3,
  };

  var NEXT_ACTIONS = {
    New: "Research school — find principal name, email, WhatsApp",
    Researching: "Send initial outreach email with prototype link",
    Emailed: "Follow up if no reply in 3 days",
    Replied: "Schedule a meeting or call",
    Meeting: "Send proposal with prototype link",
    Proposal: "Follow up on proposal in 3 days",
    Won: "Start onboarding — collect real imagery",
    Lost: "Log reason and move on",
    "On Hold": "Set a future follow-up date",
  };

  var EMAIL_TEMPLATES = {
    initial: {
      subject: "Professional website for {{school}} — free demo ready",
      body: "Dear {{contact}},\n\nI hope this message finds you well. I'm reaching out from Cubico Technologies — we design modern, professional websites specifically for schools in Karachi.\n\nI've taken the initiative to prepare a free demo website for {{school}}. You can view it here:\n\n{{link}}\n\nThis is a fully functional preview showing how {{school}}'s online presence could look — with real pages for Programs, About, and Admissions. If you like what you see, we can customise it with your actual photos and content.\n\nWould you be open to a quick 10-minute walkthrough? I'm happy to visit your campus or do a phone call — whichever is easier.\n\nLooking forward to hearing from you.\n\nBest regards,\nCubico Technologies",
    },
    followup: {
      subject: "Following up — {{school}} website demo",
      body: "Hi {{contact}},\n\nI wanted to follow up on the website demo I shared for {{school}} last week:\n\n{{link}}\n\nI'd love to hear your thoughts. If you haven't had a chance to look at it yet, it only takes 2 minutes — the demo has your Programs, About, and Admissions pages ready.\n\nWould a quick call or campus visit this week work for you?\n\nBest,\nCubico Technologies",
    },
    after_meeting: {
      subject: "Great meeting — next steps for {{school}}",
      body: "Hi {{contact}},\n\nThank you for your time today — it was great learning more about {{school}} and your vision.\n\nAs discussed, here's the demo link for your reference:\n\n{{link}}\n\nNext steps:\n1. You share your school photos and logo\n2. We update the demo with real content\n3. You review and approve\n4. We go live\n\nI'll follow up in a few days. In the meantime, feel free to share the demo link with your team.\n\nBest regards,\nCubico Technologies",
    },
  };

  var WA_TEMPLATE =
    "Hi {{contact}}, I'm from Cubico Technologies. I've prepared a professional website demo for {{school}}. You can view it here: {{link}} — Would you like a quick walkthrough?";

  // ---- State ----
  var leads = [];
  var activities = {}; // { leadId: [...] }
  var allActivities = []; // all activities for dashboard stats
  var currentFilter = "All";
  var searchQuery = "";
  var expandedLeadId = null;

  // ---- Supabase helpers ----
  function cfg() {
    var c = window.CUBICO_CONFIG;
    if (!c || !c.SUPABASE_URL || c.SUPABASE_URL.indexOf("PASTE") === 0) return null;
    return c;
  }

  function apiHeaders() {
    var c = cfg();
    return {
      apikey: c.SUPABASE_ANON_KEY,
      Authorization: "Bearer " + c.SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
  }

  async function apiFetch(path, opts) {
    var c = cfg();
    if (!c) throw new Error("Supabase not configured");
    var res = await fetch(c.SUPABASE_URL + path, Object.assign({ headers: apiHeaders() }, opts));
    if (!res.ok) throw new Error("API " + res.status);
    var text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // ---- CRUD ----
  async function fetchLeads() {
    return apiFetch("/rest/v1/leads?order=created_at.desc");
  }

  async function saveLead(lead) {
    lead.updated_at = new Date().toISOString();
    if (lead.id) {
      var rows = await apiFetch("/rest/v1/leads?id=eq." + lead.id, {
        method: "PATCH", body: JSON.stringify(lead),
      });
      return rows[0];
    }
    var rows = await apiFetch("/rest/v1/leads", {
      method: "POST", body: JSON.stringify(lead),
    });
    return rows[0];
  }

  async function deleteLead(id) {
    await apiFetch("/rest/v1/leads?id=eq." + id, { method: "DELETE" });
  }

  async function fetchActivities(leadId) {
    return apiFetch("/rest/v1/lead_activity?lead_id=eq." + leadId + "&order=created_at.desc");
  }

  async function addActivity(act) {
    var rows = await apiFetch("/rest/v1/lead_activity", {
      method: "POST", body: JSON.stringify(act),
    });
    return rows[0];
  }

  // ---- Password gate ----
  function setupGate() {
    if (sessionStorage.getItem("cubico-admin-auth") === "yes") {
      document.getElementById("password-gate").classList.add("hidden");
      document.querySelector(".crm-container").classList.add("visible");
      return true;
    }
    document.getElementById("password-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var pw = document.getElementById("password-input").value;
      var c = cfg();
      if (c && pw === c.ADMIN_PASSWORD) {
        sessionStorage.setItem("cubico-admin-auth", "yes");
        document.getElementById("password-gate").classList.add("hidden");
        document.querySelector(".crm-container").classList.add("visible");
        loadDashboard();
      } else {
        document.getElementById("password-error").textContent = "Wrong password";
      }
    });
    return false;
  }

  // ---- Init ----
  async function init() {
    if (setupGate()) loadDashboard();
  }

  async function loadDashboard() {
    try {
      leads = await fetchLeads();
    } catch (e) {
      leads = [];
      console.warn("[CRM] Could not load leads:", e.message);
    }
    // Fetch all activities for dashboard stats
    try {
      allActivities = await apiFetch("/rest/v1/lead_activity?order=created_at.desc&limit=500");
    } catch (e) {
      allActivities = [];
    }
    setupUploadZone();
    renderAll();
  }

  function renderAll() {
    renderDashboard();
    renderPipeline();
    renderAlerts();
    renderLeadList();
  }

  // ---- Dashboard ----
  function renderDashboard() {
    var el = document.getElementById("dashboard");
    if (!el) return;

    var totalLeads = leads.length;
    var emailsSent = allActivities.filter(function (a) { return a.type === "email_sent"; }).length;
    var repliesReceived = allActivities.filter(function (a) { return a.type === "email_received"; }).length;
    var replyRate = emailsSent > 0 ? Math.round((repliesReceived / emailsSent) * 100) : 0;
    var won = leads.filter(function (l) { return l.status === "Won"; }).length;
    var conversionRate = totalLeads > 0 ? Math.round((won / totalLeads) * 100) : 0;

    // Leads by country
    var byCountry = {};
    leads.forEach(function (l) {
      var c = l.country || "Unknown";
      byCountry[c] = (byCountry[c] || 0) + 1;
    });

    // Leads by source
    var bySource = {};
    leads.forEach(function (l) {
      var s = l.source || l.found_from || "Unknown";
      bySource[s] = (bySource[s] || 0) + 1;
    });

    // Sort by count descending
    var countrySorted = Object.keys(byCountry).sort(function (a, b) { return byCountry[b] - byCountry[a]; });
    var sourceSorted = Object.keys(bySource).sort(function (a, b) { return bySource[b] - bySource[a]; });

    el.innerHTML =
      '<div class="dash-cards">' +
        dashCard(totalLeads, "Total Leads", "--accent") +
        dashCard(emailsSent, "Emails Sent", "--accent") +
        dashCard(repliesReceived, "Replies", "--success") +
        dashCard(replyRate + "%", "Reply Rate", replyRate >= 20 ? "--success" : "--warn") +
        dashCard(won, "Won", "--success") +
        dashCard(conversionRate + "%", "Conversion", conversionRate >= 10 ? "--success" : "--warn") +
      "</div>" +
      '<div class="dash-breakdown">' +
        '<div class="dash-list">' +
          '<h4>By Country</h4>' +
          countrySorted.map(function (c) {
            var pct = Math.round((byCountry[c] / totalLeads) * 100) || 0;
            return '<div class="dash-row"><span class="dash-row-label">' + esc(c) + '</span>' +
              '<div class="dash-bar-wrap"><div class="dash-bar" style="width:' + pct + '%"></div></div>' +
              '<span class="dash-row-val">' + byCountry[c] + '</span></div>';
          }).join("") +
        "</div>" +
        '<div class="dash-list">' +
          '<h4>By Source</h4>' +
          sourceSorted.map(function (s) {
            var pct = Math.round((bySource[s] / totalLeads) * 100) || 0;
            return '<div class="dash-row"><span class="dash-row-label">' + esc(s) + '</span>' +
              '<div class="dash-bar-wrap"><div class="dash-bar" style="width:' + pct + '%"></div></div>' +
              '<span class="dash-row-val">' + bySource[s] + '</span></div>';
          }).join("") +
        "</div>" +
      "</div>";
  }

  function dashCard(value, label, colorVar) {
    return '<div class="dash-card">' +
      '<div class="dash-card-val" style="color:var(' + colorVar + ')">' + value + '</div>' +
      '<div class="dash-card-label">' + label + '</div>' +
    '</div>';
  }

  // ---- Pipeline ----
  function renderPipeline() {
    var el = document.getElementById("pipeline");
    var counts = {};
    STATUSES.forEach(function (s) { counts[s] = 0; });
    leads.forEach(function (l) { if (counts[l.status] !== undefined) counts[l.status]++; });

    var html = '<div class="stat-item' + (currentFilter === "All" ? " active" : "") + '" data-filter="All">';
    html += '<div class="stat-count">' + leads.length + "</div>";
    html += '<div class="stat-label">All</div></div>';

    STATUSES.forEach(function (s) {
      html += '<div class="stat-item' + (currentFilter === s ? " active" : "") + '" data-filter="' + s + '">';
      html += '<div class="stat-count">' + counts[s] + "</div>";
      html += '<div class="stat-label">' + s + "</div></div>";
    });
    el.innerHTML = html;

    el.querySelectorAll(".stat-item").forEach(function (card) {
      card.addEventListener("click", function () {
        currentFilter = card.dataset.filter;
        renderAll();
      });
    });
  }

  // ---- Alerts ----
  function renderAlerts() {
    var el = document.getElementById("alerts");
    var today = todayStr();
    var overdue = [];
    var todayItems = [];

    leads.forEach(function (l) {
      if (!l.follow_up_date || l.status === "Won" || l.status === "Lost") return;
      if (l.follow_up_date < today) overdue.push(l);
      else if (l.follow_up_date === today) todayItems.push(l);
    });

    if (!overdue.length && !todayItems.length) { el.innerHTML = ""; return; }

    var html = "";
    overdue.forEach(function (l) {
      html += '<div class="alert alert-overdue" data-id="' + l.id + '">';
      html += '<span class="alert-icon">!</span>';
      html += '<span class="alert-text"><strong>' + esc(l.school_name) + "</strong> — overdue follow-up</span>";
      html += '<span class="alert-date">was due ' + formatDate(l.follow_up_date) + "</span></div>";
    });
    todayItems.forEach(function (l) {
      html += '<div class="alert alert-today" data-id="' + l.id + '">';
      html += '<span class="alert-icon">*</span>';
      html += '<span class="alert-text"><strong>' + esc(l.school_name) + "</strong> — follow up today</span>";
      html += '<span class="alert-date">today</span></div>';
    });
    el.innerHTML = html;

    el.querySelectorAll(".alert").forEach(function (a) {
      a.addEventListener("click", function () {
        expandedLeadId = a.dataset.id;
        renderLeadList();
        var card = document.querySelector('.lead-card[data-id="' + a.dataset.id + '"]');
        if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  // ---- Lead list ----
  function renderLeadList() {
    var el = document.getElementById("lead-list");
    var filtered = leads.filter(function (l) {
      if (currentFilter !== "All" && l.status !== currentFilter) return false;
      if (searchQuery) {
        var q = searchQuery.toLowerCase();
        return (l.school_name || "").toLowerCase().indexOf(q) >= 0 ||
          (l.contact_name || "").toLowerCase().indexOf(q) >= 0 ||
          (l.email || "").toLowerCase().indexOf(q) >= 0 ||
          (l.city || "").toLowerCase().indexOf(q) >= 0 ||
          (l.country || "").toLowerCase().indexOf(q) >= 0 ||
          (l.found_from || "").toLowerCase().indexOf(q) >= 0;
      }
      return true;
    });

    if (!filtered.length) {
      el.innerHTML = '<div class="empty-state">' +
        '<div class="empty-icon">--</div>' +
        "<h3>No leads" + (currentFilter !== "All" ? ' in "' + currentFilter + '"' : "") + "</h3>" +
        "<p>Add your first school lead or upload a CSV to get started.</p>" +
        '<button class="btn btn-accent" onclick="CubicoCRM.showAddLead()">+ Add Lead</button>' +
        "</div>";
      return;
    }

    var today = todayStr();
    el.innerHTML = filtered.map(function (l) {
      var fClass = "";
      if (l.follow_up_date && l.status !== "Won" && l.status !== "Lost") {
        if (l.follow_up_date < today) fClass = "overdue";
        else if (l.follow_up_date === today) fClass = "today";
      }
      var expanded = expandedLeadId === l.id;
      var meta = [];
      if (l.contact_name) meta.push(esc(l.contact_name) + (l.contact_role ? " · " + esc(l.contact_role) : ""));
      if (l.city) meta.push(esc(l.city));
      if (l.found_from) meta.push(esc(l.found_from));
      return '<div class="lead-card" data-id="' + l.id + '">' +
        '<div class="lead-row">' +
          '<div class="lead-info">' +
            "<h3>" + priorityDot(l.priority) + countryFlag(l.country) + '<span class="school-name">' + esc(l.school_name) + "</span></h3>" +
            '<div class="lead-meta">' + (meta.length ? meta.join('<span class="sep">/</span>') : '<span style="color:var(--text-faint)">No contact</span>') + "</div>" +
          "</div>" +
          '<span class="status-chip status-' + slugify(l.status) + '">' + l.status + "</span>" +
          '<span class="lead-followup ' + fClass + '">' +
            (l.follow_up_date ? formatDate(l.follow_up_date) : "—") +
          "</span>" +
          '<div class="lead-actions">' +
            '<button class="action-btn" data-action="email" title="Email">@</button>' +
            '<button class="action-btn" data-action="whatsapp" title="WhatsApp">W</button>' +
            '<button class="action-btn" data-action="copy" title="Copy link">L</button>' +
          "</div>" +
        "</div>" +
        '<div class="lead-detail' + (expanded ? " open" : "") + '" id="detail-' + l.id + '"></div>' +
      "</div>";
    }).join("");

    // Bind row clicks to expand
    el.querySelectorAll(".lead-row").forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (e.target.closest(".action-btn")) return;
        var card = row.closest(".lead-card");
        var id = card.dataset.id;
        if (expandedLeadId === id) {
          expandedLeadId = null;
          card.querySelector(".lead-detail").classList.remove("open");
        } else {
          // Close prev
          var prev = document.querySelector(".lead-detail.open");
          if (prev) prev.classList.remove("open");
          expandedLeadId = id;
          renderLeadDetail(id);
        }
      });
    });

    // Bind quick action buttons
    el.querySelectorAll(".action-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var lead = findLead(btn.closest(".lead-card").dataset.id);
        if (!lead) return;
        var action = btn.dataset.action;
        if (action === "email") composeEmail(lead, "initial");
        else if (action === "whatsapp") openWhatsApp(lead);
        else if (action === "copy") copyLink(lead);
      });
    });
  }

  // ---- Lead detail ----
  async function renderLeadDetail(id) {
    var lead = findLead(id);
    if (!lead) return;
    var el = document.getElementById("detail-" + id);
    el.classList.add("open");

    // Fetch activities
    try {
      activities[id] = await fetchActivities(id);
    } catch (e) {
      activities[id] = [];
    }

    var suggested = NEXT_ACTIONS[lead.status] || "";

    // Count emails sent/received for this lead
    var acts = activities[id] || [];
    var emailsSent = acts.filter(function (a) { return a.type === "email_sent"; }).length;
    var repliesReceived = acts.filter(function (a) { return a.type === "email_received"; }).length;

    el.innerHTML =
      '<div class="next-action-box"><span class="label">Next:</span> ' + esc(lead.next_action || suggested) + "</div>" +
      '<div class="quick-actions">' +
        '<button class="btn btn-sm btn-accent" data-action="compose-email">Compose Email</button>' +
        '<button class="btn btn-sm btn-success" data-action="whatsapp">WhatsApp</button>' +
        '<button class="btn btn-sm btn-ghost" data-action="copy">Copy Link</button>' +
        '<button class="btn btn-sm btn-warn" data-action="mark-reply">Mark Reply Received</button>' +
      "</div>" +
      '<div style="display:flex;gap:1rem;margin-bottom:1rem;font-size:0.78rem;color:var(--text-dim);">' +
        '<span>Emails sent: <strong style="color:var(--accent)">' + emailsSent + '</strong></span>' +
        '<span>Replies: <strong style="color:var(--success)">' + repliesReceived + '</strong></span>' +
      '</div>' +
      '<div id="email-compose-' + id + '"></div>' +
      '<div class="detail-grid">' +
        '<div>' +
          '<div class="detail-section"><h4>Contact</h4>' +
            detailField("Name", lead.contact_name) +
            detailField("Role", lead.contact_role) +
            detailField("Email", lead.email, "mailto:" + (lead.email || "")) +
            detailField("Phone", lead.phone, "tel:" + (lead.phone || "")) +
            detailField("WhatsApp", lead.whatsapp, lead.whatsapp ? "https://wa.me/" + cleanPhone(lead.whatsapp) : "") +
          "</div>" +
          '<div class="detail-section"><h4>School</h4>' +
            detailField("Country", lead.country) +
            detailField("City", lead.city) +
            detailField("Address", lead.address) +
            detailField("Website", lead.website, lead.website) +
            (lead.website_issue
              ? '<div class="detail-field"><label>Issue</label><div class="val"><span class="issue-tag">' + esc(lead.website_issue) + '</span></div></div>'
              : '<div class="detail-field"><label>Issue</label><div class="val"><span class="issue-tag none">No website / None noted</span></div></div>') +
            detailField("Found From", lead.found_from) +
            detailField("Source", lead.source) +
            detailField("Prototype", lead.prototype_url, lead.prototype_url) +
          "</div>" +
        "</div>" +
        '<div>' +
          '<div class="detail-section"><h4>Status</h4>' +
            '<div class="field"><label>Pipeline Stage</label><select id="edit-status">' +
              STATUSES.map(function (s) {
                return '<option' + (s === lead.status ? " selected" : "") + ">" + s + "</option>";
              }).join("") +
            "</select></div>" +
            '<div class="field"><label>Priority</label><select id="edit-priority">' +
              PRIORITIES.map(function (p) {
                return '<option' + (p === lead.priority ? " selected" : "") + ">" + p + "</option>";
              }).join("") +
            "</select></div>" +
            '<div class="field"><label>Follow-up Date</label>' +
              '<input type="date" id="edit-followup" value="' + (lead.follow_up_date || "") + '" /></div>' +
            '<div class="field"><label>Next Action</label>' +
              '<input type="text" id="edit-next-action" value="' + esc(lead.next_action || "") + '" placeholder="e.g. Call to schedule meeting" /></div>' +
            '<div class="field"><label>Notes</label>' +
              '<textarea id="edit-notes" rows="3">' + esc(lead.notes || "") + "</textarea></div>" +
            '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">' +
              '<button class="btn btn-sm btn-accent" id="save-lead-btn">Save Changes</button>' +
              '<button class="btn btn-sm btn-ghost" id="edit-lead-btn">Edit Full Details</button>' +
              '<button class="btn btn-sm btn-danger" id="delete-lead-btn">Delete</button>' +
            "</div>" +
          "</div>" +
          '<div class="detail-section">' +
            '<h4>Activity Log</h4>' +
            '<button class="btn btn-sm btn-ghost" id="add-activity-btn" style="margin-bottom:0.75rem;">+ Log Activity</button>' +
            '<div id="activity-form-' + id + '"></div>' +
            '<div class="timeline">' +
              (activities[id] || []).map(function (a) {
                return '<div class="timeline-item">' +
                  '<div class="timeline-dot ' + a.type + '"></div>' +
                  '<div class="timeline-head">' +
                    '<span class="timeline-type">' + formatType(a.type) + "</span>" +
                    '<span class="timeline-date">' + formatDateTime(a.created_at) + "</span>" +
                  "</div>" +
                  (a.subject ? '<div class="timeline-subject">' + esc(a.subject) + "</div>" : "") +
                  (a.body ? '<div class="timeline-body">' + esc(a.body) + "</div>" : "") +
                "</div>";
              }).join("") +
              (!(activities[id] || []).length ? '<div style="color:var(--text-dim);font-size:0.85rem;">No activity yet</div>' : "") +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>";

    // Bind events
    el.querySelector("#save-lead-btn").addEventListener("click", function () { saveInlineEdits(id); });
    el.querySelector("#edit-lead-btn").addEventListener("click", function () { showLeadModal(lead); });
    el.querySelector("#delete-lead-btn").addEventListener("click", function () { confirmDelete(id); });
    el.querySelector("#add-activity-btn").addEventListener("click", function () { showActivityForm(id); });

    // Status change auto-suggests follow-up
    el.querySelector("#edit-status").addEventListener("change", function () {
      var newStatus = this.value;
      var days = FOLLOW_UP_DAYS[newStatus];
      if (days) {
        var d = new Date();
        d.setDate(d.getDate() + days);
        el.querySelector("#edit-followup").value = dateStr(d);
      }
      el.querySelector("#edit-next-action").value = NEXT_ACTIONS[newStatus] || "";
    });

    // Quick action buttons in detail
    el.querySelectorAll("[data-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var a = btn.dataset.action;
        if (a === "compose-email") showEmailCompose(id);
        else if (a === "whatsapp") openWhatsApp(lead);
        else if (a === "copy") copyLink(lead);
        else if (a === "mark-reply") markReplyReceived(id);
      });
    });
  }

  async function saveInlineEdits(id) {
    var lead = findLead(id);
    if (!lead) return;
    var el = document.getElementById("detail-" + id);
    var oldStatus = lead.status;
    lead.status = el.querySelector("#edit-status").value;
    lead.priority = el.querySelector("#edit-priority").value;
    lead.follow_up_date = el.querySelector("#edit-followup").value || null;
    lead.next_action = el.querySelector("#edit-next-action").value;
    lead.notes = el.querySelector("#edit-notes").value;

    try {
      await saveLead({ id: id, status: lead.status, priority: lead.priority,
        follow_up_date: lead.follow_up_date, next_action: lead.next_action, notes: lead.notes });
      if (oldStatus !== lead.status) {
        await addActivity({ lead_id: id, type: "status_change",
          subject: "Status changed: " + oldStatus + " → " + lead.status });
        activities[id] = await fetchActivities(id);
      }
      toast("Saved");
      renderAll();
      if (expandedLeadId === id) renderLeadDetail(id);
    } catch (e) {
      toast("Error saving: " + e.message);
    }
  }

  // ---- Activity form ----
  function showActivityForm(leadId) {
    var el = document.getElementById("activity-form-" + leadId);
    el.innerHTML =
      '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:1rem;">' +
        '<div class="field-row"><div class="field"><label>Type</label><select id="act-type">' +
          ACTIVITY_TYPES.map(function (t) { return "<option value=\"" + t.value + "\">" + t.label + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label>Subject</label><input type="text" id="act-subject" placeholder="e.g. Sent initial email" /></div></div>' +
        '<div class="field"><label>Details</label><textarea id="act-body" rows="2" placeholder="Notes about this activity..."></textarea></div>' +
        '<div style="display:flex;gap:0.5rem;">' +
          '<button class="btn btn-sm btn-accent" id="save-act-btn">Save Activity</button>' +
          '<button class="btn btn-sm btn-ghost" id="cancel-act-btn">Cancel</button>' +
        "</div>" +
      "</div>";

    el.querySelector("#save-act-btn").addEventListener("click", async function () {
      var act = {
        lead_id: leadId,
        type: el.querySelector("#act-type").value,
        subject: el.querySelector("#act-subject").value,
        body: el.querySelector("#act-body").value,
      };
      try {
        await addActivity(act);
        activities[leadId] = await fetchActivities(leadId);
        renderLeadDetail(leadId);
        toast("Activity logged");
      } catch (e) { toast("Error: " + e.message); }
    });
    el.querySelector("#cancel-act-btn").addEventListener("click", function () { el.innerHTML = ""; });
  }

  // ---- Email compose panel (inside lead detail) ----
  function showEmailCompose(leadId) {
    var lead = findLead(leadId);
    if (!lead) return;
    var el = document.getElementById("email-compose-" + leadId);
    if (!el) return;

    // Default to initial if no emails sent, otherwise followup
    var acts = activities[leadId] || [];
    var hasSent = acts.some(function (a) { return a.type === "email_sent"; });
    var hasMeeting = acts.some(function (a) { return a.type === "meeting"; });
    var defaultTpl = hasMeeting ? "after_meeting" : (hasSent ? "followup" : "initial");
    var tpl = EMAIL_TEMPLATES[defaultTpl];
    var subject = fillTemplate(tpl.subject, lead);
    var body = fillTemplate(tpl.body, lead);

    el.innerHTML =
      '<div class="email-compose">' +
        '<div class="template-pills">' +
          '<span class="template-pill' + (defaultTpl === "initial" ? " active" : "") + '" data-tpl="initial">Initial Outreach</span>' +
          '<span class="template-pill' + (defaultTpl === "followup" ? " active" : "") + '" data-tpl="followup">Follow Up</span>' +
          '<span class="template-pill' + (defaultTpl === "after_meeting" ? " active" : "") + '" data-tpl="after_meeting">After Meeting</span>' +
        '</div>' +
        '<div class="field"><label>To</label><input type="email" id="compose-to" value="' + esc(lead.email || "") + '" placeholder="school@email.com" /></div>' +
        '<div class="field"><label>Subject</label><input type="text" id="compose-subject" value="' + esc(subject) + '" /></div>' +
        '<div class="field"><label>Body</label><textarea id="compose-body" rows="8">' + esc(body) + '</textarea></div>' +
        '<div class="compose-actions">' +
          '<button class="btn btn-sm btn-accent" id="compose-send">Open in Gmail</button>' +
          '<button class="btn btn-sm btn-success" id="compose-mark-sent">Mark as Sent</button>' +
          '<button class="btn btn-sm btn-ghost" id="compose-cancel">Close</button>' +
          '<span class="compose-hint">Opens your email client with this message pre-filled</span>' +
        '</div>' +
      '</div>';

    // Template pill switching
    el.querySelectorAll(".template-pill").forEach(function (pill) {
      pill.addEventListener("click", function () {
        el.querySelectorAll(".template-pill").forEach(function (p) { p.classList.remove("active"); });
        pill.classList.add("active");
        var t = EMAIL_TEMPLATES[pill.dataset.tpl];
        el.querySelector("#compose-subject").value = fillTemplate(t.subject, lead);
        el.querySelector("#compose-body").value = fillTemplate(t.body, lead);
      });
    });

    // Open in Gmail (mailto)
    el.querySelector("#compose-send").addEventListener("click", function () {
      var to = el.querySelector("#compose-to").value;
      var subj = el.querySelector("#compose-subject").value;
      var b = el.querySelector("#compose-body").value;
      window.open("mailto:" + encodeURIComponent(to) + "?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(b), "_blank");
    });

    // Mark as Sent — log the email as an activity
    el.querySelector("#compose-mark-sent").addEventListener("click", async function () {
      var subj = el.querySelector("#compose-subject").value;
      var b = el.querySelector("#compose-body").value;
      var to = el.querySelector("#compose-to").value;
      try {
        await addActivity({
          lead_id: leadId,
          type: "email_sent",
          subject: "Sent: " + subj,
          body: "To: " + to + "\n\n" + b,
        });
        // Auto-update status to Emailed if currently New or Researching
        if (lead.status === "New" || lead.status === "Researching") {
          lead.status = "Emailed";
          var d = new Date(); d.setDate(d.getDate() + 3);
          lead.follow_up_date = dateStr(d);
          lead.next_action = "Follow up if no reply in 3 days";
          await saveLead({ id: leadId, status: "Emailed", follow_up_date: lead.follow_up_date, next_action: lead.next_action });
        }
        activities[leadId] = await fetchActivities(leadId);
        leads = await fetchLeads();
        renderAll();
        renderLeadDetail(leadId);
        toast("Email logged as sent");
      } catch (e) { toast("Error: " + e.message); }
    });

    el.querySelector("#compose-cancel").addEventListener("click", function () { el.innerHTML = ""; });
  }

  async function markReplyReceived(leadId) {
    var lead = findLead(leadId);
    if (!lead) return;
    try {
      await addActivity({
        lead_id: leadId,
        type: "email_received",
        subject: "Reply received from " + (lead.contact_name || lead.school_name),
      });
      // Auto-update status to Replied
      if (lead.status === "Emailed") {
        lead.status = "Replied";
        lead.next_action = "Schedule a meeting or call";
        var d = new Date(); d.setDate(d.getDate() + 1);
        lead.follow_up_date = dateStr(d);
        await saveLead({ id: leadId, status: "Replied", follow_up_date: lead.follow_up_date, next_action: lead.next_action });
      }
      activities[leadId] = await fetchActivities(leadId);
      leads = await fetchLeads();
      renderAll();
      renderLeadDetail(leadId);
      toast("Reply logged — status updated");
    } catch (e) { toast("Error: " + e.message); }
  }

  // ---- Add / Edit lead modal ----
  function showLeadModal(lead) {
    var isEdit = !!lead;
    lead = lead || {};
    var overlay = document.getElementById("modal-overlay");
    overlay.classList.remove("hidden");

    document.getElementById("modal-content").innerHTML =
      "<h3>" + (isEdit ? "Edit Lead" : "Add New Lead") + "</h3>" +
      '<p class="modal-subtitle">' + (isEdit ? "Update school details below." : "Add a school you want to pitch.") + "</p>" +

      // -- School info --
      '<div class="form-divider">School Info</div>' +
      '<div class="field"><label>School Name *</label><input type="text" id="m-name" value="' + esc(lead.school_name || "") + '" required /></div>' +
      '<div class="field-row-3">' +
        '<div class="field"><label>Country</label><select id="m-country">' +
          COUNTRIES.map(function (c) { return '<option' + (c === (lead.country || "Pakistan") ? " selected" : "") + ">" + c + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label>City</label><input type="text" id="m-city" value="' + esc(lead.city || "") + '" /></div>' +
        '<div class="field"><label>School Slug</label><input type="text" id="m-slug" value="' + esc(lead.school_slug || "") + '" placeholder="e.g. msl-clifton" /></div>' +
      "</div>" +
      '<div class="field"><label>Address</label><input type="text" id="m-address" value="' + esc(lead.address || "") + '" /></div>' +
      '<div class="field-row">' +
        '<div class="field"><label>Website</label><input type="url" id="m-website" value="' + esc(lead.website || "") + '" placeholder="https://..." /></div>' +
        '<div class="field"><label>Website Issue</label><input type="text" id="m-website-issue" value="' + esc(lead.website_issue || "") + '" placeholder="e.g. Outdated, no mobile, slow..." /></div>' +
      "</div>" +

      // -- Contact --
      '<div class="form-divider">Contact Person</div>' +
      '<div class="field-row">' +
        '<div class="field"><label>Contact Name</label><input type="text" id="m-contact" value="' + esc(lead.contact_name || "") + '" /></div>' +
        '<div class="field"><label>Role</label><input type="text" id="m-role" value="' + esc(lead.contact_role || "") + '" placeholder="Principal, Owner..." /></div>' +
      "</div>" +
      '<div class="field-row-3">' +
        '<div class="field"><label>Email</label><input type="email" id="m-email" value="' + esc(lead.email || "") + '" /></div>' +
        '<div class="field"><label>Phone</label><input type="tel" id="m-phone" value="' + esc(lead.phone || "") + '" /></div>' +
        '<div class="field"><label>WhatsApp</label><input type="tel" id="m-whatsapp" value="' + esc(lead.whatsapp || "") + '" placeholder="+92 300 ..." /></div>' +
      "</div>" +

      // -- Pipeline --
      '<div class="form-divider">Pipeline</div>' +
      '<div class="field-row-3">' +
        '<div class="field"><label>Status</label><select id="m-status">' +
          STATUSES.map(function (s) { return '<option' + (s === (lead.status || "New") ? " selected" : "") + ">" + s + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label>Priority</label><select id="m-priority">' +
          PRIORITIES.map(function (p) { return '<option' + (p === (lead.priority || "Warm") ? " selected" : "") + ">" + p + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label>Source</label><select id="m-source">' +
          '<option value="">Select...</option>' +
          SOURCES.map(function (s) { return '<option' + (s === lead.source ? " selected" : "") + ">" + s + "</option>"; }).join("") +
        "</select></div>" +
      "</div>" +
      '<div class="field-row">' +
        '<div class="field"><label>Found From</label><select id="m-found-from">' +
          '<option value="">Where did you find this school?</option>' +
          FOUND_FROM.map(function (f) { return '<option' + (f === lead.found_from ? " selected" : "") + ">" + f + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label>Prototype URL</label><input type="url" id="m-proto" value="' + esc(lead.prototype_url || "") + '" placeholder="https://your-site.vercel.app/school/" /></div>' +
      "</div>" +
      '<div class="field"><label>Notes</label><textarea id="m-notes" rows="2">' + esc(lead.notes || "") + "</textarea></div>" +
      '<div class="modal-actions">' +
        '<button class="btn btn-accent" id="modal-save">' + (isEdit ? "Save Changes" : "Add Lead") + "</button>" +
        '<button class="btn btn-ghost" id="modal-cancel">Cancel</button>' +
      "</div>";

    document.getElementById("modal-cancel").addEventListener("click", closeModal);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });

    document.getElementById("modal-save").addEventListener("click", async function () {
      var data = {
        school_name: document.getElementById("m-name").value.trim(),
        school_slug: document.getElementById("m-slug").value.trim() || null,
        contact_name: document.getElementById("m-contact").value.trim() || null,
        contact_role: document.getElementById("m-role").value.trim() || null,
        email: document.getElementById("m-email").value.trim() || null,
        phone: document.getElementById("m-phone").value.trim() || null,
        whatsapp: document.getElementById("m-whatsapp").value.trim() || null,
        country: document.getElementById("m-country").value || "Pakistan",
        city: document.getElementById("m-city").value.trim() || null,
        address: document.getElementById("m-address").value.trim() || null,
        website: document.getElementById("m-website").value.trim() || null,
        website_issue: document.getElementById("m-website-issue").value.trim() || null,
        found_from: document.getElementById("m-found-from").value || null,
        source: document.getElementById("m-source").value || null,
        prototype_url: document.getElementById("m-proto").value.trim() || null,
        status: document.getElementById("m-status").value,
        priority: document.getElementById("m-priority").value,
        notes: document.getElementById("m-notes").value.trim() || null,
      };
      if (!data.school_name) return toast("School name is required");
      if (!isEdit) {
        var dup = findDuplicate(data.school_name, data.email);
        if (dup && !confirm('A lead named "' + dup.school_name + '" already exists. Add anyway?')) return;
      }
      if (isEdit) data.id = lead.id;
      try {
        await saveLead(data);
        leads = await fetchLeads();
        closeModal();
        renderAll();
        toast(isEdit ? "Lead updated" : "Lead added");
      } catch (e) { toast("Error: " + e.message); }
    });
  }

  function closeModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
  }

  async function confirmDelete(id) {
    var lead = findLead(id);
    if (!lead) return;
    if (!confirm('Delete "' + lead.school_name + '" and all its activity? This cannot be undone.')) return;
    try {
      await deleteLead(id);
      leads = leads.filter(function (l) { return l.id !== id; });
      expandedLeadId = null;
      renderAll();
      toast("Lead deleted");
    } catch (e) { toast("Error: " + e.message); }
  }

  // ---- Email / WhatsApp / Copy ----
  function composeEmail(lead, templateKey) {
    var tpl = EMAIL_TEMPLATES[templateKey];
    if (!tpl) return;
    var subject = fillTemplate(tpl.subject, lead);
    var body = fillTemplate(tpl.body, lead);
    var mailto = "mailto:" + (lead.email || "") +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
    window.open(mailto, "_blank");
  }

  function openWhatsApp(lead) {
    var phone = cleanPhone(lead.whatsapp || lead.phone || "");
    if (!phone) return toast("No WhatsApp number");
    var text = fillTemplate(WA_TEMPLATE, lead);
    window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(text), "_blank");
  }

  function copyLink(lead) {
    var url = lead.prototype_url;
    if (!url) return toast("No prototype URL set");
    navigator.clipboard.writeText(url).then(function () { toast("Link copied!"); });
  }

  function fillTemplate(tpl, lead) {
    return tpl
      .replace(/\{\{school\}\}/g, lead.school_name || "the school")
      .replace(/\{\{contact\}\}/g, lead.contact_name || "Sir/Madam")
      .replace(/\{\{link\}\}/g, lead.prototype_url || "[prototype link]");
  }

  // ---- Helpers ----
  function findLead(id) {
    for (var i = 0; i < leads.length; i++) { if (leads[i].id === id) return leads[i]; }
    return null;
  }

  function findDuplicate(name, email) {
    var n = (name || "").toLowerCase().trim();
    var e = (email || "").toLowerCase().trim();
    for (var i = 0; i < leads.length; i++) {
      var l = leads[i];
      if (n && (l.school_name || "").toLowerCase().trim() === n) return l;
      if (e && e !== "" && (l.email || "").toLowerCase().trim() === e) return l;
    }
    return null;
  }

  function todayStr() {
    return dateStr(new Date());
  }

  function dateStr(d) {
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function formatDate(s) {
    if (!s) return "";
    var d = new Date(s + "T00:00:00");
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months[d.getMonth()] + " " + d.getDate();
  }

  function formatDateTime(s) {
    if (!s) return "";
    var d = new Date(s);
    return formatDate(s.slice(0, 10)) + " · " +
      d.getHours().toString().padStart(2, "0") + ":" +
      d.getMinutes().toString().padStart(2, "0");
  }

  function formatType(t) {
    return (t || "").replace(/_/g, " ");
  }

  function slugify(s) {
    return (s || "").toLowerCase().replace(/\s+/g, "-");
  }

  function cleanPhone(p) {
    return (p || "").replace(/[\s\-\(\)]/g, "").replace(/^\+/, "");
  }

  function esc(s) {
    if (!s) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function priorityDot(p) {
    if (!p) return "";
    return '<span class="priority-dot priority-' + p.toLowerCase() + '"></span>';
  }

  var COUNTRY_FLAGS = {
    "Pakistan": "PK", "Saudi Arabia": "SA", "USA": "US", "UAE": "AE",
    "UK": "GB", "Canada": "CA",
  };
  function countryFlag(country) {
    if (!country) return "";
    var code = COUNTRY_FLAGS[country];
    if (!code) return "";
    // Convert country code to flag emoji via regional indicator symbols
    var flag = String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65, 0x1F1E6 + code.charCodeAt(1) - 65);
    return '<span class="country-flag">' + flag + "</span> ";
  }

  function detailField(label, val, href) {
    if (!val) return '<div class="detail-field"><label>' + label + '</label><div class="val empty">—</div></div>';
    var inner = href ? '<a href="' + esc(href) + '" target="_blank">' + esc(val) + "</a>" : esc(val);
    return '<div class="detail-field"><label>' + label + '</label><div class="val">' + inner + "</div></div>";
  }

  function toast(msg) {
    var existing = document.querySelector(".toast");
    if (existing) existing.remove();
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2500);
  }

  // ---- CSV Export ----
  function exportCSV() {
    if (!leads.length) return toast("No leads to export");
    var cols = ["school_name","country","city","address","contact_name","contact_role","email","phone","whatsapp","website","website_issue","found_from","source","status","priority","prototype_url","follow_up_date","next_action","notes","created_at"];
    var header = cols.join(",");
    var rows = leads.map(function (l) {
      return cols.map(function (c) {
        var val = (l[c] || "").toString().replace(/"/g, '""');
        return '"' + val + '"';
      }).join(",");
    });
    var csv = header + "\n" + rows.join("\n");
    var blob = new Blob([csv], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "cubico-leads-" + todayStr() + ".csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported " + leads.length + " leads");
  }

  // ---- CSV Bulk Upload ----
  var csvData = []; // parsed rows waiting to be imported

  function toggleUploadZone() {
    var zone = document.getElementById("upload-zone");
    zone.classList.toggle("visible");
    if (!zone.classList.contains("visible")) {
      csvData = [];
      zone.querySelector(".upload-preview").innerHTML = "";
      zone.querySelector(".upload-count").textContent = "";
      zone.querySelector(".upload-actions").innerHTML = "";
    }
  }

  function setupUploadZone() {
    var zone = document.getElementById("upload-zone");
    if (!zone) return;
    var fileInput = zone.querySelector('input[type="file"]');

    zone.addEventListener("click", function (e) {
      if (e.target === zone || e.target.closest(".upload-zone-icon") || e.target.closest("h3") || e.target.closest("p")) {
        fileInput.click();
      }
    });
    zone.addEventListener("dragover", function (e) { e.preventDefault(); zone.classList.add("dragover"); });
    zone.addEventListener("dragleave", function () { zone.classList.remove("dragover"); });
    zone.addEventListener("drop", function (e) {
      e.preventDefault(); zone.classList.remove("dragover");
      var file = e.dataTransfer.files[0];
      if (file) handleCSVFile(file);
    });
    fileInput.addEventListener("change", function () {
      if (fileInput.files[0]) handleCSVFile(fileInput.files[0]);
      fileInput.value = "";
    });
  }

  function handleCSVFile(file) {
    var ext = file.name.split(".").pop().toLowerCase();
    if (ext !== "csv") {
      toast("Please upload a .csv file. Save your Excel as CSV first.");
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      var text = e.target.result;
      csvData = parseCSV(text);
      if (!csvData.length) { toast("No data rows found in CSV"); return; }
      renderCSVPreview();
    };
    reader.readAsText(file);
  }

  function parseCSV(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) return [];
    var headers = parseCSVLine(lines[0]).map(function (h) { return h.trim().toLowerCase().replace(/\s+/g, "_"); });
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var vals = parseCSVLine(lines[i]);
      var obj = {};
      headers.forEach(function (h, idx) { obj[h] = (vals[idx] || "").trim(); });
      if (obj.school_name || obj.name || obj.school) rows.push(obj);
    }
    return rows;
  }

  function parseCSVLine(line) {
    var result = [];
    var current = "";
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else current += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ",") { result.push(current); current = ""; }
        else current += ch;
      }
    }
    result.push(current);
    return result;
  }

  // Map common CSV column names to our DB fields
  var CSV_FIELD_MAP = {
    school_name: "school_name", name: "school_name", school: "school_name",
    contact_name: "contact_name", contact: "contact_name", person: "contact_name",
    contact_role: "contact_role", role: "contact_role", position: "contact_role",
    email: "email", email_address: "email",
    phone: "phone", phone_number: "phone", tel: "phone",
    whatsapp: "whatsapp", wa: "whatsapp",
    country: "country",
    city: "city", town: "city",
    address: "address", location: "address",
    website: "website", url: "website", site: "website",
    website_issue: "website_issue", issue: "website_issue", problem: "website_issue",
    found_from: "found_from", found: "found_from", source_detail: "found_from",
    source: "source",
    notes: "notes", note: "notes", comments: "notes",
    priority: "priority",
    status: "status",
    prototype_url: "prototype_url", prototype: "prototype_url",
  };

  function mapCSVRow(row) {
    var lead = { status: "New", priority: "Warm", country: "Pakistan" };
    Object.keys(row).forEach(function (key) {
      var mapped = CSV_FIELD_MAP[key];
      if (mapped && row[key]) lead[mapped] = row[key];
    });
    return lead;
  }

  function renderCSVPreview() {
    var zone = document.getElementById("upload-zone");
    var countEl = zone.querySelector(".upload-count");
    var previewEl = zone.querySelector(".upload-preview");
    var actionsEl = zone.querySelector(".upload-actions");
    var mapped = csvData.map(mapCSVRow);

    countEl.textContent = mapped.length + " school" + (mapped.length !== 1 ? "s" : "") + " found in CSV";

    // Show preview table
    var cols = ["school_name", "country", "city", "contact_name", "email", "website", "website_issue", "found_from"];
    var colLabels = ["School", "Country", "City", "Contact", "Email", "Website", "Issue", "Found From"];
    var html = "<table><thead><tr>";
    colLabels.forEach(function (c) { html += "<th>" + c + "</th>"; });
    html += "</tr></thead><tbody>";
    mapped.slice(0, 50).forEach(function (r) {
      html += "<tr>";
      cols.forEach(function (c) { html += "<td>" + esc(r[c] || "—") + "</td>"; });
      html += "</tr>";
    });
    if (mapped.length > 50) html += '<tr><td colspan="' + cols.length + '" style="text-align:center;color:var(--text-dim);">... and ' + (mapped.length - 50) + " more</td></tr>";
    html += "</tbody></table>";
    previewEl.innerHTML = html;

    actionsEl.innerHTML =
      '<button class="btn btn-accent" id="csv-import-btn">Import ' + mapped.length + " Leads</button>" +
      '<button class="btn btn-ghost" id="csv-cancel-btn">Cancel</button>';

    actionsEl.querySelector("#csv-import-btn").addEventListener("click", importCSV);
    actionsEl.querySelector("#csv-cancel-btn").addEventListener("click", toggleUploadZone);
  }

  async function importCSV() {
    var mapped = csvData.map(mapCSVRow);
    var btn = document.getElementById("csv-import-btn");
    btn.textContent = "Importing...";
    btn.disabled = true;

    var success = 0;
    var errors = 0;
    var skipped = 0;
    for (var i = 0; i < mapped.length; i++) {
      var dup = findDuplicate(mapped[i].school_name, mapped[i].email);
      if (dup) { skipped++; }
      else {
        try {
          await saveLead(mapped[i]);
          success++;
          // Add to leads array so subsequent rows can check against it
          leads.push(mapped[i]);
        } catch (e) {
          errors++;
        }
      }
      btn.textContent = "Importing... " + (i + 1) + "/" + mapped.length;
    }

    leads = await fetchLeads();
    renderAll();
    toggleUploadZone();
    toast(success + " imported" + (skipped ? ", " + skipped + " duplicates skipped" : "") + (errors ? ", " + errors + " failed" : ""));
  }

  // ---- Expose ----
  // Listen for search events from the page
  document.addEventListener("crm-search", function (e) {
    searchQuery = e.detail || "";
    renderLeadList();
  });

  window.CubicoCRM = {
    init: init,
    showAddLead: function () { showLeadModal(null); },
    toggleUpload: toggleUploadZone,
    exportCSV: exportCSV,
  };
})();
