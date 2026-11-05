// 1) Create a project at https://supabase.com
// 2) Run supabase.sql in the Supabase SQL Editor
// 3) Paste your Project URL and anon/public key below.
// Never put a Supabase service_role key in browser code.
const SUPABASE_URL = "natmrlsgxyxzpmhytvlv";
const SUPABASE_ANON_KEY = "sb_publishable_x85Tva0EOP9YQmvwkhoLow_6iyzHEWR";

const configured = SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_") && !SUPABASE_ANON_KEY.includes("YOUR_");
const db = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let authMode = "signup";
let currentUser = null;
let currentProfile = null;
let activeMatchId = null;
let messageChannel = null;
let currentView = "discover";

const $ = id => document.getElementById(id);
$("year").textContent = new Date().getFullYear();

function notify(message, target = "app-message") {
  const el = $(target);
  if (el) el.textContent = message;
}
function safeImage(url) {
  return url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600";
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
}
function showApp(isLoggedIn) {
  $("setup-screen").classList.toggle("hidden", isLoggedIn);
  $("app-screen").classList.toggle("hidden", !isLoggedIn);
  $("main-nav").classList.toggle("hidden", !isLoggedIn);
}
function switchView(view) {
  currentView = view;
  document.querySelectorAll(".view").forEach(el => el.classList.add("hidden"));
  $(view + "-view").classList.remove("hidden");
  document.querySelectorAll(".nav-btn[data-view]").forEach(b =>
    b.classList.toggle("active", b.dataset.view === view));
  $("view-title").textContent = ({
    discover:"Discover people", matches:"Your matches",
    messages:"Your messages", profile:"Your profile"
  })[view];
  if (view === "discover") loadPeople();
  if (view === "matches") loadMatches();
  if (view === "messages") loadConversations();
  if (view === "profile") fillProfileForm();
}
document.querySelectorAll(".nav-btn[data-view]").forEach(b =>
  b.addEventListener("click", () => switchView(b.dataset.view)));

document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
  authMode = tab.dataset.auth;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === tab));
  $("signup-fields").classList.toggle("hidden", authMode === "login");
  $("auth-age").required = authMode === "signup";
  $("auth-submit").textContent = authMode === "signup" ? "Create account" : "Log in";
  $("auth-password").autocomplete = authMode === "signup" ? "new-password" : "current-password";
  notify("", "auth-message");
}));

$("auth-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!db) return notify("Add your Supabase URL and anon key in app.js first.", "auth-message");
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  try {
    if (authMode === "signup") {
      const age = Number($("auth-age").value);
      if (age < 18) return notify("You must be at least 18 to join.", "auth-message");
      const { data, error } = await db.auth.signUp({
        email, password,
        options: { data: { display_name: $("auth-name").value.trim(), age } }
      });
      if (error) throw error;
      if (!data.session) {
        notify("Account created. Check your email to confirm, then log in.", "auth-message");
      } else {
        notify("Account created. Complete your profile.", "auth-message");
      }
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) { notify(err.message, "auth-message"); }
});

async function boot() {
  if (!db) {
    showApp(false);
    notify("Setup needed: add your Supabase project URL and anon/public key in app.js.", "auth-message");
    return;
  }
  const { data } = await db.auth.getSession();
  currentUser = data.session?.user || null;
  if (currentUser) await enterApp();
  else showApp(false);
  db.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    if (currentUser) await enterApp();
    else { currentProfile = null; showApp(false); }
  });
}
async function enterApp() {
  showApp(true);
  await loadMyProfile();
  if (!currentProfile) switchView("profile");
  else switchView("discover");
}
async function loadMyProfile() {
  const { data, error } = await db.from("profiles").select("*").eq("id", currentUser.id).maybeSingle();
  if (error) return notify(error.message);
  currentProfile = data;
}
function fillProfileForm() {
  if (!currentProfile) return;
  $("profile-name").value = currentProfile.display_name || "";
  $("profile-age").value = currentProfile.age || "";
  $("profile-city").value = currentProfile.city || "";
  $("profile-area").value = currentProfile.area || "";
  $("profile-bio").value = currentProfile.bio || "";
  $("profile-photo").value = currentProfile.photo_url || "";
  $("area-filter").value = currentProfile.city || "";
}
$("profile-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!db || !currentUser) return;
  const age = Number($("profile-age").value);
  if (age < 18) return notify("You must be at least 18.", "profile-message");
  const profile = {
    id: currentUser.id,
    display_name: $("profile-name").value.trim(),
    age,
    city: $("profile-city").value.trim(),
    area: $("profile-area").value.trim(),
    bio: $("profile-bio").value.trim(),
    photo_url: $("profile-photo").value.trim() || null,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await db.from("profiles").upsert(profile).select().single();
  if (error) return notify(error.message, "profile-message");
  currentProfile = data;
  notify("Your profile has been saved.", "profile-message");
  switchView("discover");
});

$("search-btn").addEventListener("click", loadPeople);
$("area-filter").addEventListener("keydown", e => { if (e.key === "Enter") loadPeople(); });

async function loadPeople() {
  if (!db || !currentUser) return;
  const term = $("area-filter").value.trim();
  if (!term) return notify("Enter a city or area to search.");
  const { data, error } = await db.from("profiles")
    .select("id,display_name,age,city,area,bio,photo_url")
    .neq("id", currentUser.id)
    .ilike("city", term)
    .order("updated_at", { ascending: false })
    .limit(60);
  if (error) return notify(error.message);
  renderPeople(data || [], "people-grid", "No profiles found in that city yet. Try another city.");
}
function renderPeople(people, containerId, emptyText) {
  const container = $(containerId);
  if (!people.length) { container.innerHTML = `<div class="empty">${escapeHTML(emptyText)}</div>`; return; }
  container.innerHTML = people.map(p => `
    <article class="person-card">
      <img src="${escapeHTML(safeImage(p.photo_url))}" alt="Profile photo" loading="lazy">
      <div class="person-body">
        <h3>${escapeHTML(p.display_name)}, ${p.age}</h3>
        <p>📍 ${escapeHTML(p.area)}, ${escapeHTML(p.city)}</p>
        <p class="bio">${escapeHTML(p.bio || "Still writing my introduction.")}</p>
        <button class="primary" data-like="${p.id}">♡ Like</button>
      </div>
    </article>`).join("");
  container.querySelectorAll("[data-like]").forEach(btn =>
    btn.addEventListener("click", () => sendLike(btn.dataset.like, btn)));
}
async function sendLike(targetId, button) {
  button.disabled = true;
  const { error } = await db.from("likes").upsert(
    { liker_id: currentUser.id, liked_id: targetId },
    { onConflict: "liker_id,liked_id" }
  );
  button.disabled = false;
  if (error) return notify(error.message);
  const { data: mutual } = await db.from("matches").select("id")
    .or(`and(user_one.eq.${currentUser.id},user_two.eq.${targetId}),and(user_one.eq.${targetId},user_two.eq.${currentUser.id})`)
    .maybeSingle();
  if (mutual) {
    button.textContent = "It's a match! ♥";
    notify("It's a match! You can now message each other.");
  } else {
    button.textContent = "♥ Liked";
    notify("Like sent. If they like you back, you'll match.");
  }
}
async function loadMatches() {
  const { data, error } = await db.from("matches")
    .select("id,user_one,user_two,created_at")
    .or(`user_one.eq.${currentUser.id},user_two.eq.${currentUser.id}`)
    .order("created_at", { ascending: false });
  if (error) return notify(error.message);
  const ids = (data || []).map(m => m.user_one === currentUser.id ? m.user_two : m.user_one);
  if (!ids.length) return $("matches-grid").innerHTML = '<div class="empty">No matches yet. Like someone and see if they like you back.</div>';
  const { data: people, error: profileError } = await db.from("profiles")
    .select("id,display_name,age,city,area,bio,photo_url").in("id", ids);
  if (profileError) return notify(profileError.message);
  const map = new Map((data || []).map(m => [m.user_one === currentUser.id ? m.user_two : m.user_one, m.id]));
  renderPeople(people || [], "matches-grid", "No matches yet.");
  $("matches-grid").querySelectorAll(".person-card").forEach(card => {
    const id = (people || []).find(p => card.querySelector("h3")?.textContent.startsWith(p.display_name + ","))?.id;
    const btn = card.querySelector("button");
    if (id && btn) {
      btn.textContent = "Message";
      btn.onclick = () => { switchView("messages"); openChat(map.get(id), id); };
    }
  });
}
async function loadConversations() {
  const { data: matches, error } = await db.from("matches")
    .select("id,user_one,user_two")
    .or(`user_one.eq.${currentUser.id},user_two.eq.${currentUser.id}`);
  if (error) return notify(error.message);
  const list = $("conversation-list");
  if (!matches?.length) { list.innerHTML = '<p class="muted">Your matches will appear here.</p>'; return; }
  const otherIds = matches.map(m => m.user_one === currentUser.id ? m.user_two : m.user_one);
  const { data: profiles } = await db.from("profiles")
    .select("id,display_name,age").in("id", otherIds);
  list.innerHTML = matches.map(m => {
    const otherId = m.user_one === currentUser.id ? m.user_two : m.user_one;
    const p = profiles?.find(x => x.id === otherId);
    return `<button class="conversation" data-match="${m.id}" data-user="${otherId}">${escapeHTML(p?.display_name || "Member")}, ${p?.age || ""}</button>`;
  }).join("");
  list.querySelectorAll("[data-match]").forEach(b =>
    b.addEventListener("click", () => openChat(b.dataset.match, b.dataset.user, b.textContent)));
}
async function openChat(matchId, otherUserId, label = "Conversation") {
  activeMatchId = matchId;
  $("chat-title").textContent = label;
  $("message-input").disabled = false;
  $("send-btn").disabled = false;
  if (messageChannel) await db.removeChannel(messageChannel);
  await loadMessages();
  messageChannel = db.channel("chat-" + matchId)
    .on("postgres_changes", { event:"INSERT", schema:"public", table:"messages", filter:`match_id=eq.${matchId}` },
      payload => appendMessage(payload.new))
    .subscribe();
}
async function loadMessages() {
  const { data, error } = await db.from("messages").select("*")
    .eq("match_id", activeMatchId).order("created_at", { ascending:true }).limit(200);
  if (error) return notify(error.message);
  $("chat-messages").innerHTML = "";
  (data || []).forEach(appendMessage);
}
function appendMessage(m) {
  const el = document.createElement("div");
  el.className = "bubble" + (m.sender_id === currentUser.id ? " mine" : "");
  const body = document.createElement("span");
  body.textContent = m.body;
  const time = document.createElement("small");
  time.textContent = new Date(m.created_at).toLocaleString();
  el.append(body, time);
  $("chat-messages").appendChild(el);
  $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
}
$("message-form").addEventListener("submit", async e => {
  e.preventDefault();
  const body = $("message-input").value.trim();
  if (!body || !activeMatchId) return;
  $("send-btn").disabled = true;
  const { error } = await db.from("messages").insert({
    match_id: activeMatchId, sender_id: currentUser.id, body
  });
  $("send-btn").disabled = false;
  if (error) return notify(error.message);
  $("message-input").value = "";
});
$("logout-btn").addEventListener("click", async () => {
  if (messageChannel) await db.removeChannel(messageChannel);
  await db.auth.signOut();
});

boot();
