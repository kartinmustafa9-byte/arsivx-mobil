// Global Error Handler for Diagnostics
window.onerror = function (msg, url, line) {
  console.error("[Sistem Hatası] " + msg + "\nSatır: " + line);
  return false;
};

console.log(
  "[Sistem Teşhisi] ArşivX Motoru (app.js) başarıyla yüklendi ve çalışıyor!",
);

// Obliterate old Service Worker caches
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let registration of registrations) {
      registration.unregister();
    }
  });
}

// Platform Engine
const PlatformEngine = {
  detect: () => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return "ios";
    if (/android/.test(ua)) return "android";
    if (/electron/.test(ua) || window.innerWidth > 1024) return "desktop";
    return "web";
  },
  init: () => {
    const p = PlatformEngine.detect();
    console.log("ArsivX Engine: Platform Detected ->", p);
    document.body.className = `platform-${p}`;
    if (p !== "web") {
      const platformLink = document.createElement("link");
      platformLink.rel = "stylesheet";
      platformLink.href = `platforms/${p}/${p}-styles.css`;
      document.head.appendChild(platformLink);
    }
  },
};
PlatformEngine.init();

function isElectronApp() {
  return (
    window.location.protocol === "file:" ||
    window.location.search.includes("platform=electron") ||
    window.location.hash.includes("platform=electron") ||
    navigator.userAgent.toLowerCase().includes("electron")
  );
}

// Supabase Configuration
const SUPABASE_URL = "https://csipcdygthbijixvxfdj.supabase.co";
const SUPABASE_KEY = "sb_publishable_bsAhDVFme1XeC6GKpHE_Wg_uhTAlayj";

function getApiBaseUrl() {
  if (
    window.location.origin.includes("localhost") ||
    window.location.origin.includes("127.0.0.1")
  ) {
    return "http://localhost:8001";
  }
  return window.location.origin;
}

window.getSupabase = function getSupabase() {
  if (window.supabaseClientInstance) return window.supabaseClientInstance;
  if (window.supabase && typeof window.supabase.createClient === "function") {
    console.log("[Supabase Motoru] Oturum Akışı: Implicit");
    window.supabaseClientInstance = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY,
      {
        auth: {
          flowType: "implicit",
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      },
    );
    // window.supabase = window.supabaseClientInstance; // Removed to preserve createClient
    return window.supabaseClientInstance;
  }
  if (window.supabase && typeof window.supabase.from === "function") {
    window.supabaseClientInstance = window.supabase;
    return window.supabase;
  }
  return null;
};

window.appSettings = {};

async function loadGlobalSystemSettings() {
  const sb = window.getSupabase();
  if (sb) {
    try {
      const { data } = await sb.from("system_settings").select("*");
      if (data) {
        data.forEach((s) => (window.appSettings[s.key] = s.value));
      }
    } catch (e) {}
  }
}

// Auth Logic
async function checkUser() {
  console.log("[Oturum Kontrolü] Başlatılıyor...");

  await loadGlobalSystemSettings();

  if (window.appSettings["maintenance_mode"] === "true") {
    document.body.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#060714;color:#fff;text-align:center;padding:20px;font-family:'Outfit',sans-serif;">
                <div style="width:80px;height:80px;background:rgba(239, 68, 68, 0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </div>
                <h1 style="font-size:32px;font-weight:800;margin-bottom:10px;">Sistem Bakımda</h1>
                <p style="font-size:16px;color:#8b949e;max-width:400px;line-height:1.6;">ArşivX şu anda planlı bir bakım ve güncelleme çalışması nedeniyle geçici olarak kullanılamamaktadır. Lütfen daha sonra tekrar deneyin.</p>
            </div>
        `;
    return;
  }

  // Global Announcement Check
  if (window.appSettings["global_announcement"]) {
    let ann = document.getElementById("global-announcement");
    if (!ann) {
      ann = document.createElement("div");
      ann.id = "global-announcement";
      ann.style.cssText =
        "background: rgba(16, 185, 129, 0.15); border-bottom: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; text-align: center; padding: 10px; font-size: 13px; font-weight: 600; z-index: 9999; position: relative;";
      document.body.insertBefore(ann, document.body.firstChild);
    }
    ann.innerHTML = window.appSettings["global_announcement"];
  }

  // Intercept Google Redirect Server Exchange Error (Unable to exchange external code: 4/0A)
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const errorDesc =
    urlParams.get("error_description") ||
    hashParams.get("error_description") ||
    urlParams.get("error") ||
    hashParams.get("error");

  if (errorDesc || window.location.href.includes("error=")) {
    console.warn("[Oturum Kontrolü] Yönlendirme hatası tespit edildi.");
    showLoginScreen();
    return;
  }

  // 1. localStorage'da kayıtlı email varsa doğrudan giriş yap
  const savedEmail = localStorage.getItem("arsivx_user_email");
  if (savedEmail) {
    console.log("[Oturum Kontrolü] Kayıtlı oturum bulundu:", savedEmail);
    const savedName = localStorage.getItem("arsivx_name_" + savedEmail);
    showMainApp({
      email: savedEmail,
      user_metadata: {
        full_name: savedName || "",
      },
    });
    return;
  }

  // 2. Supabase oturumunu kontrol et
  const sb = getSupabase();
  let user = null;
  if (sb) {
    try {
      const res = await sb.auth.getSession();
      if (res.data.session) {
        user = res.data.session.user;
      } else {
        const userRes = await sb.auth.getUser();
        user = userRes.data.user;
      }
    } catch (e) {
      console.error("Supabase oturum kontrolü hatası:", e);
    }
  }

  if (user) {
    console.log("[Oturum Kontrolü] Supabase oturumu aktif:", user.email);
    localStorage.setItem("arsivx_user_email", user.email);

    const savedName =
      localStorage.getItem("arsivx_name_" + user.email) ||
      (user.user_metadata && user.user_metadata.full_name);
    user.user_metadata = user.user_metadata || {};
    user.user_metadata.full_name = savedName || "";
    showMainApp(user);
  } else {
    console.log("[Oturum Kontrolü] Oturum yok, giriş ekranı gösteriliyor.");
    showLoginScreen();
  }
}

window.showMainApp = function (user) {
  console.log("[Oturum] Kullanıcı bilgileri yüklendi:", user);

  // Clear the pending automatic bypass timeout
  if (window.googleBypassTimeout) {
    clearTimeout(window.googleBypassTimeout);
    window.googleBypassTimeout = null;
  }

  // Close any hanging login/bypass SweetAlerts!
  if (typeof Swal !== "undefined") {
    Swal.close();
  }

  // UUID yoksa deterministik oluştur
  if (!user.id) {
    const str = user.email || "arsivx@arsivx.com";
    let hex = "";
    for (let j = 0; j < 4; j++) {
      let subHash = 0;
      let subStr = str + j;
      for (let i = 0; i < subStr.length; i++) {
        subHash = (subHash << 5) - subHash + subStr.charCodeAt(i);
        subHash |= 0;
      }
      hex += (subHash >>> 0).toString(16).padStart(8, "0");
    }
    hex = hex.substring(0, 32);
    user.id = `${hex.substring(0, 8)}-${hex.substring(8, 12)}-4${hex.substring(13, 16)}-a${hex.substring(17, 20)}-${hex.substring(20, 32)}`;
  }

  const screenLogin = document.getElementById("screen-login");
  const mainInterface = document.getElementById("main-interface");

  if (screenLogin) screenLogin.classList.add("hidden");
  if (mainInterface) mainInterface.classList.remove("hidden");

  window.currentUser = user;

  const email = user.email || "mustafakartn58@gmail.com";
  localStorage.setItem("arsivx_last_logged_in_email", email);
  const avatar = "logo.png";

  // Check if name has been explicitly entered and saved
  const hasEnteredName =
    localStorage.getItem("arsivx_name_entered_" + email) === "true";
  const savedName = localStorage.getItem("arsivx_name_" + email);

  if (hasEnteredName && savedName) {
    // Store in localStorage for quick retrieval
    localStorage.setItem("arsivx_user_email", email);
    localStorage.setItem("arsivx_user_name", savedName);
    renderUserProfile(savedName, email, avatar);
    completeAppLoading();
  } else {
    // Prompt for Name and Surname on first login
    const initialVal =
      savedName ||
      (user.user_metadata && user.user_metadata.full_name) ||
      email.split("@")[0] ||
      "";

    if (typeof Swal !== "undefined") {
      Swal.fire({
        title: "Adınız ve Soyadınız",
        text: "ArşivX AI sistemine kaydolmak için lütfen Adınızı ve Soyadınızı girin:",
        input: "text",
        inputPlaceholder: "Örn: Mustafa Kartın",
        inputValue: initialVal,
        icon: "info",
        background: "#0c0d1e",
        color: "#ffffff",
        confirmButtonText: "Kaydet & Başla 🚀",
        confirmButtonColor: "#e0b354",
        allowOutsideClick: false,
        allowEscapeKey: false,
        customClass: {
          popup: "swal2-premium-popup",
          title: "swal2-premium-title",
          htmlContainer: "swal2-premium-html",
          confirmButton: "swal2-premium-confirm",
        },
        preConfirm: (name) => {
          if (!name || name.trim().length < 3) {
            Swal.showValidationMessage(
              "Lütfen geçerli bir ad soyad girin (en az 3 karakter)!",
            );
            return false;
          }
          return name.trim();
        },
      }).then((result) => {
        if (result.isConfirmed && result.value) {
          const finalName = result.value;
          localStorage.setItem("arsivx_user_email", email);
          localStorage.setItem("arsivx_user_name", finalName);
          localStorage.setItem("arsivx_name_" + email, finalName);
          localStorage.setItem("arsivx_name_entered_" + email, "true");

          renderUserProfile(finalName, email, avatar);
          completeAppLoading();

          Swal.fire({
            title: "Hoş Geldiniz! 🎉",
            text: `Merhaba ${finalName}, profiliniz başarıyla oluşturuldu.`,
            icon: "success",
            timer: 2000,
            showConfirmButton: false,
            background: "#0c0d1e",
            color: "#ffffff",
            customClass: {
              popup: "swal2-premium-popup",
              title: "swal2-premium-title",
              htmlContainer: "swal2-premium-html",
            },
          });
        }
      });
    } else {
      // Safe fallback
      const val = prompt("Lütfen Adınızı ve Soyadınızı girin:", initialVal);
      const finalName =
        (val && val.trim()) || initialVal || "ArşivX Kullanıcısı";
      localStorage.setItem("arsivx_user_email", email);
      localStorage.setItem("arsivx_user_name", finalName);
      localStorage.setItem("arsivx_name_" + email, finalName);
      localStorage.setItem("arsivx_name_entered_" + email, "true");
      renderUserProfile(finalName, email, avatar);

      // Push name to DB
      if (window.getSupabase() && user.id) {
        window
          .getSupabase()
          .from("profiles")
          .update({ full_name: finalName })
          .eq("id", user.id)
          .then(() => {});
      }
      completeAppLoading();
    }
  }

  // Name was already entered, but make sure DB has it just in case
  if (hasEnteredName && savedName && window.getSupabase() && user.id) {
    window
      .getSupabase()
      .from("profiles")
      .update({ full_name: savedName })
      .eq("id", user.id)
      .then(() => {});
  }

  // Save this email to the registered emails list
  try {
    let registeredEmails = JSON.parse(
      localStorage.getItem("arsivx_registered_emails") || "[]",
    );
    if (!registeredEmails.includes(email)) {
      registeredEmails.push(email);
      localStorage.setItem(
        "arsivx_registered_emails",
        JSON.stringify(registeredEmails),
      );
    }
  } catch (e) {
    console.error("Kayıtlı e-postalar veritabanı güncellenemedi:", e);
  }
};

function renderUserProfile(fullName, email, avatar) {
  // Profil ekranı
  if (document.getElementById("profile-name-large")) {
    document.getElementById("profile-name-large").innerText = fullName;
    document.getElementById("profile-img-large").src = avatar;
    document.getElementById("profile-email").innerText = email;
  }

  // Sidebar kullanıcı kutusu
  if (document.getElementById("sidebar-user-name")) {
    document.getElementById("sidebar-user-name").innerText = fullName;
    document.getElementById("sidebar-user-email").innerText = email;
    document.getElementById("sidebar-user-img").src = avatar;
  }

  // Mobil başlık email
  if (document.getElementById("mobile-header-email")) {
    document.getElementById("mobile-header-email").innerText = email;
  }

  // Ana ekran selamlama
  if (document.getElementById("home-user-name")) {
    document.getElementById("home-user-name").innerText = fullName;
  }
}

async function completeAppLoading() {
  if (!window.sessionLogged) {
    window.sessionLogged = true;
    setTimeout(() => {
      window.addSystemLog("sisteme giriş yaptı.");
    }, 1500);
    logUserActivity("login", { os: PlatformEngine.detect() });
    startSessionTracker();
  }

  // Check Profile for Premium / Trial Status
  const sb = window.getSupabase();
  if (sb && window.currentUser && window.currentUser.id) {
    try {
      const { data: profile } = await sb
        .from("profiles")
        .select("*")
        .eq("id", window.currentUser.id)
        .single();
      if (profile) {
        window.userProfile = profile;

        // Check if user is banned
        if (profile.is_banned) {
          if (typeof Swal !== "undefined") {
            Swal.fire(
              "Erişim Engellendi",
              "Hesabınız kuralları ihlal ettiği gerekçesiyle yönetici tarafından askıya alınmıştır.",
              "error",
            );
          } else {
            alert("Hesabınız askıya alınmıştır.");
          }
          setTimeout(() => window.logout(), 3000);
          return;
        }

        checkTrialStatus(profile);
      }
    } catch (e) {
      console.error("Profil doğrulama hatası:", e);
    }
  }

  loadRecords();
  if (!window.isTrialExpired) {
    window.switchTab("scanner");
  }
}

// Activity Logging Engine
window.logUserActivity = async function (actionType, detailsObj = {}) {
  const sb = window.getSupabase();
  if (!sb || !window.currentUser) return;
  try {
    let finalPhotoUrl = detailsObj.photo_url;

    // If it's a base64 string, upload to storage
    if (finalPhotoUrl && finalPhotoUrl.startsWith("data:image")) {
      try {
        // Convert base64 to blob
        const res = await fetch(finalPhotoUrl);
        const blob = await res.blob();

        // Upload to Supabase Storage (scans bucket)
        const fileName = `scan_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
        const { data, error } = await sb.storage
          .from("scans")
          .upload(window.currentUser.id + "/" + fileName, blob, {
            contentType: "image/jpeg",
          });

        if (!error) {
          // Get public URL
          const { data: publicUrlData } = sb.storage
            .from("scans")
            .getPublicUrl(window.currentUser.id + "/" + fileName);
          finalPhotoUrl = publicUrlData.publicUrl;
        } else {
          console.error("Storage upload failed, fallback to base64", error);
        }
      } catch (storageErr) {
        console.error("Blob conversion/upload err:", storageErr);
      }
    }

    const finalDetails = { ...detailsObj };
    if (finalPhotoUrl) finalDetails.photo_url = finalPhotoUrl;

    await sb.from("user_activities").insert([
      {
        user_id: window.currentUser.id,
        action_type: actionType,
        details: finalDetails,
      },
    ]);
  } catch (e) {
    console.error("Activity log error:", e);
  }
};

// Session Tracker (Pings every 1 min)
let sessionInterval = null;
function startSessionTracker() {
  if (sessionInterval) clearInterval(sessionInterval);
  sessionInterval = setInterval(async () => {
    const sb = window.getSupabase();
    if (sb && window.currentUser) {
      try {
        // Call RPC to safely increment or just read/write if RPC is missing
        const { data: profile } = await sb
          .from("profiles")
          .select("total_time_spent")
          .eq("id", window.currentUser.id)
          .single();
        if (profile) {
          await sb
            .from("profiles")
            .update({
              total_time_spent: (profile.total_time_spent || 0) + 1,
              last_seen: new Date().toISOString(),
            })
            .eq("id", window.currentUser.id);
        }
      } catch (e) {
        /* ignore */
      }
    }
  }, 60000); // 1 Minute
}

function checkTrialStatus(profile) {
  const trialStatusEl = document.getElementById("sidebar-trial-status");
  const oldBanner = document.getElementById("arsivx-trial-banner");
  if (oldBanner) oldBanner.remove(); // Clean up old just in case

  const now = new Date();

  if (profile.is_premium) {
    if (profile.premium_expires_at) {
      const expireDate = new Date(profile.premium_expires_at);
      if (now > expireDate) {
        window.isTrialExpired = true;
        if (trialStatusEl) {
          trialStatusEl.style.display = "block";
          trialStatusEl.style.color = "#ef4444";
          trialStatusEl.style.background = "rgba(239, 68, 68, 0.15)";
          trialStatusEl.style.borderColor = "rgba(239, 68, 68, 0.3)";
          trialStatusEl.innerHTML = "Premium Süresi Doldu";
        }
        lockScannerUI();
        return;
      }
    }
    if (trialStatusEl) trialStatusEl.style.display = "none";
    return;
  }

  const trialStart = new Date(profile.trial_start);
  const diffTime = Math.abs(now - trialStart);
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  if (diffDays >= 3) {
    window.isTrialExpired = true;
    if (trialStatusEl) {
      trialStatusEl.style.display = "block";
      trialStatusEl.style.color = "#ef4444";
      trialStatusEl.style.background = "rgba(239, 68, 68, 0.15)";
      trialStatusEl.style.borderColor = "rgba(239, 68, 68, 0.3)";
      trialStatusEl.innerHTML = `Süre Doldu`;
    }
    lockScannerUI();
  } else {
    const hoursLeft = Math.ceil((3 - diffDays) * 24);
    if (trialStatusEl) {
      trialStatusEl.style.display = "block";
      trialStatusEl.innerHTML = `💎 Deneme: ${hoursLeft} Saat`;
    }
  }
}

function lockScannerUI() {
  if (window.location.pathname.includes("/admin")) return;
  window.isTrialExpired = true;

  // Tüm ekranları gizle
  const allScreens = document.querySelectorAll('.screen, [id^="screen-"]');
  allScreens.forEach((s) => s.classList.add("hidden"));

  // Sidebar'daki sekme butonlarını gizle (tarayıcı, arşiv, vb.)
  const tabsToHide = ["scanner", "archive", "add"];
  tabsToHide.forEach((tabName) => {
    // nav butonları
    const navBtn = document.querySelector(
      `[onclick*="switchTab('${tabName}')"], [onclick*='switchTab("${tabName}")']`,
    );
    if (navBtn) navBtn.style.display = "none";
    // menü butonları (bottom nav vs.)
    const allNavBtns = document.querySelectorAll(`[data-tab="${tabName}"]`);
    allNavBtns.forEach((b) => (b.style.display = "none"));
  });

  // Bottom nav butonları
  const bottomNav = document.querySelector(".bottom-nav, .tab-bar, nav");
  if (bottomNav) {
    const scannerBtns = bottomNav.querySelectorAll(
      '[onclick*="scanner"], [onclick*="archive"], [onclick*="add"]',
    );
    scannerBtns.forEach((b) => (b.style.display = "none"));
  }

  // === ÖDEME PAYWALL SAYFASINI GÖSTER ===
  let paywall = document.getElementById("paywall-screen");
  if (!paywall) {
    paywall = document.createElement("div");
    paywall.id = "paywall-screen";
    // NOT: 'screen' class vermiyoruz - gizleme döngüsüne girmesin
    document.body.appendChild(paywall);
  }
  // Tam ekran fixed overlay olarak göster
  paywall.style.cssText =
    "display:flex !important; position:fixed; inset:0; z-index:999; align-items:center; justify-content:center; padding:20px; overflow-y:auto; background:radial-gradient(ellipse at top, rgba(139,92,246,0.1) 0%, transparent 60%), #060714;";
  paywall.innerHTML = `
        <style>
        @keyframes pw-float{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-14px) rotate(4deg)}}
        @keyframes pw-ring-pulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.7);opacity:0}}
        @keyframes pw-slide-up{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pw-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes pw-bounce{0%{transform:scale(.5);opacity:0}65%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
        @keyframes pw-particle{0%{transform:translateY(0) scale(1);opacity:.8}100%{transform:translateY(-90px) scale(0);opacity:0}}
        @keyframes pw-glow-pulse{0%,100%{box-shadow:0 0 25px rgba(16,185,129,.4),0 8px 30px rgba(16,185,129,.2)}50%{box-shadow:0 0 50px rgba(16,185,129,.7),0 8px 40px rgba(16,185,129,.4)}}
        .pw-icon{animation:pw-bounce .7s .1s cubic-bezier(.34,1.56,.64,1) both,pw-float 3.5s 1s ease-in-out infinite}
        .pw-ring1{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(139,92,246,.5);animation:pw-ring-pulse 2.2s ease-out infinite}
        .pw-ring2{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(16,185,129,.4);animation:pw-ring-pulse 2.2s .7s ease-out infinite}
        .pw-card{animation:pw-slide-up .6s cubic-bezier(.34,1.56,.64,1) forwards}
        .pw-feature{animation:pw-slide-up .5s ease-out both}
        .pw-feature:nth-child(1){animation-delay:.25s}.pw-feature:nth-child(2){animation-delay:.35s}.pw-feature:nth-child(3){animation-delay:.45s}.pw-feature:nth-child(4){animation-delay:.55s}
        .pw-btn-year{background:linear-gradient(135deg,#10b981,#059669)!important;animation:pw-glow-pulse 2s ease-in-out infinite,pw-slide-up .5s .65s ease-out both;transition:transform .2s,box-shadow .2s!important}
        .pw-btn-year:hover{transform:translateY(-3px) scale(1.02)!important;box-shadow:0 12px 40px rgba(16,185,129,.55)!important}
        .pw-btn-month{animation:pw-slide-up .5s .75s ease-out both;transition:transform .2s,background .2s!important}
        .pw-btn-month:hover{transform:translateY(-2px)!important;background:rgba(255,255,255,.1)!important}
        .pw-hot{background:linear-gradient(90deg,#f59e0b,#fbbf24,#f59e0b);background-size:200% auto;animation:pw-shimmer 2s linear infinite;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
        .pw-par{position:absolute;width:7px;height:7px;border-radius:50%;animation:pw-particle 2.5s ease-out infinite;pointer-events:none}
        </style>

        <div class="pw-par" style="background:#8b5cf6;left:15%;top:80%;animation-delay:.0s"></div>
        <div class="pw-par" style="background:#10b981;left:85%;top:75%;animation-delay:.6s"></div>
        <div class="pw-par" style="background:#06b6d4;left:50%;top:88%;animation-delay:1.2s"></div>
        <div class="pw-par" style="background:#f59e0b;left:28%;top:82%;animation-delay:1.8s"></div>
        <div class="pw-par" style="background:#8b5cf6;left:72%;top:84%;animation-delay:.9s"></div>
        <div class="pw-par" style="background:#10b981;left:40%;top:90%;animation-delay:.3s"></div>

        <div class="pw-card" style="background:linear-gradient(145deg,rgba(10,10,30,.97),rgba(15,15,42,.97));backdrop-filter:blur(24px);border:1px solid rgba(139,92,246,.2);padding:45px 32px;border-radius:28px;text-align:center;max-width:440px;width:100%;box-shadow:0 40px 100px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.06);">

            <div style="position:relative;width:88px;height:88px;margin:0 auto 28px;">
                <div class="pw-ring1"></div>
                <div class="pw-ring2"></div>
                <div class="pw-icon" style="width:88px;height:88px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;z-index:1;box-shadow:0 8px 30px rgba(124,58,237,.5)">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                </div>
            </div>

            <h2 style="color:#fff;font-family:'Outfit',sans-serif;font-weight:800;font-size:27px;margin:0 0 10px;letter-spacing:-.5px">Deneme Süreniz Doldu</h2>
            <p style="color:#8b949e;font-size:14px;margin:0 0 26px;line-height:1.7">Ücretsiz 3 gününüz tamamlandı.<br>Kayıt defterinizi okuyabilirsiniz, yeni tarama için <span style="color:#c4b5fd;font-weight:600">Premium</span> gerekli.</p>

            <div style="text-align:left;margin-bottom:24px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:6px 16px">
                <div class="pw-feature" style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.05)">
                    <div style="width:30px;height:30px;background:rgba(16,185,129,.15);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <span style="color:#e2e8f0;font-size:13.5px">Sınırsız belge tarama & arşivleme</span>
                </div>
                <div class="pw-feature" style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.05)">
                    <div style="width:30px;height:30px;background:rgba(139,92,246,.15);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"></path></svg>
                    </div>
                    <span style="color:#e2e8f0;font-size:13.5px">Güvenli bulut depolama (yedekli)</span>
                </div>
                <div class="pw-feature" style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.05)">
                    <div style="width:30px;height:30px;background:rgba(6,182,212,.15);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"></path></svg>
                    </div>
                    <span style="color:#e2e8f0;font-size:13.5px">Yapay zeka destekli OCR okuma</span>
                </div>
                <div class="pw-feature" style="display:flex;align-items:center;gap:12px;padding:11px 0">
                    <div style="width:30px;height:30px;background:rgba(245,158,11,.15);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    </div>
                    <span style="color:#e2e8f0;font-size:13.5px">Öncelikli müşteri desteği</span>
                </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:11px">
                <button onclick="showMockPayment('Yıllık')" class="pw-btn-year" style="color:#fff;border:none;padding:17px 20px;font-size:16px;font-weight:800;border-radius:14px;cursor:pointer;font-family:'Outfit',sans-serif;position:relative">
                    <span style="position:absolute;top:-10px;right:16px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.5px">🔥 EN POPÜLER</span>
                    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:4px">
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                        Yıllık - 1.990 ₺
                    </div>
                    <span style="display:block;font-size:12px;font-weight:400;opacity:.88;margin-top:4px">2 ay ücretsiz · Aylık sadece 166 ₺</span>
                </button>

                <button onclick="showMockPayment('Aylık')" class="pw-btn-month" style="background:rgba(255,255,255,.05);color:#e2e8f0;border:1px solid rgba(255,255,255,.1);padding:15px 20px;font-size:15px;font-weight:600;border-radius:14px;cursor:pointer;font-family:'Outfit',sans-serif;display:flex;align-items:center;justify-content:center;gap:8px">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8b949e" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    Aylık - 199 ₺
                </button>
            </div>

            <button onclick="window.switchTab('registry')" style="margin-top:20px;background:transparent;color:#4b5563;border:none;padding:8px 14px;cursor:pointer;font-size:13px;font-family:'Outfit',sans-serif;display:inline-flex;align-items:center;gap:5px;transition:color .2s" onmouseover="this.style.color='#8b5cf6'" onmouseout="this.style.color='#4b5563'">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                Kayıt Defterimi Gör (Salt Okunur)
            </button>
        </div>
    `;
  if (window.lucide) window.lucide.createIcons();
}

window.showMockPayment = function (type) {
  if (typeof Swal !== "undefined") {
    const ibanInfo =
      window.appSettings["payment_iban"] ||
      "Lütfen yönetici ile iletişime geçin.";
    const shopierAylik = window.appSettings["shopier_link_aylik"] || "";
    const shopierYillik = window.appSettings["shopier_link_yillik"] || "";
    const wpNum = window.appSettings["whatsapp_number"] || "";

    let shopierLink = type.toLowerCase().includes("yıl")
      ? shopierYillik
      : shopierAylik;
    if (
      shopierLink &&
      shopierLink.trim() !== "" &&
      !shopierLink.startsWith("http")
    ) {
      shopierLink = "https://" + shopierLink.trim();
    }

    let htmlContent = `
            <div style="text-align:left; color:#e6edf3; font-size:14px; line-height:1.6;">
                <p style="margin-bottom:15px;">Şu an <strong>${type}</strong> paket satın almak üzeresiniz.</p>
        `;

    if (shopierLink && shopierLink.trim() !== "") {
      htmlContent += `
                <div style="background:rgba(16,185,129,0.1); padding:15px; border-radius:12px; border:1px solid rgba(16,185,129,0.3); margin-bottom:15px;">
                    <span style="display:block; font-size:12px; color:#10b981; font-weight:700; margin-bottom:10px;">💳 KREDİ KARTI İLE GÜVENLİ ÖDEME</span>
                    <p style="font-size:13px; color:#8b949e; margin-bottom:8px;">Shopier altyapısı ile güvenli şekilde kredi/banka kartınızla ödeme yapabilirsiniz.</p>
                    <p style="font-size:12px; color:#f59e0b; font-weight:bold; margin-bottom:12px; padding:8px; background:rgba(245,158,11,0.1); border-radius:6px; border:1px solid rgba(245,158,11,0.2);">⚠️ ÖNEMLİ: Hesabınızın ANINDA otomatik açılması için Shopier'de ödeme yaparken e-posta adresi kısmına kesinlikle <u style="color:#fff">${window.currentUser ? window.currentUser.email : ""}</u> adresinizi girmelisiniz.</p>
                    <a href="${shopierLink}" target="_blank" style="display:block; text-align:center; background:#10b981; color:#fff; padding:12px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:15px;">Kredi Kartı ile Öde (Shopier)</a>
                </div>
                
                <p style="font-size:13px; color:#8b949e; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:15px;">Veya aşağıdaki havale/EFT yöntemini kullanabilirsiniz.</p>
            `;
    }

    htmlContent += `
                <div style="background:rgba(0,0,0,0.3); padding:15px; border-radius:12px; border:1px solid rgba(139,92,246,0.3); margin-bottom:15px;">
                    <span style="display:block; font-size:11px; color:#c4b5fd; font-weight:700; margin-bottom:5px;">HAVALE / EFT BİLGİLERİ</span>
                    <div style="font-family:monospace; font-size:15px; font-weight:bold; color:#fff; word-break:break-all;">${ibanInfo}</div>
                </div>
        `;

    if (wpNum && wpNum.trim() !== "") {
      const cleanWp = wpNum.replace(/[^0-9+]/g, "");
      const wpText = encodeURIComponent(
        `Merhaba, ArşivX ${type} paketi için ödememi tamamladım. Hesabımın e-posta adresi: ${window.currentUser ? window.currentUser.email : ""}`,
      );
      htmlContent += `
                <p style="font-size:13px; color:#10b981; margin-bottom:0; font-weight:bold;">ÖNEMLİ: Ödemenizi yaptıktan sonra hesabınızın anında açılması için lütfen bize WhatsApp'tan bildirin!</p>
                <a href="https://wa.me/${cleanWp}?text=${wpText}" target="_blank" style="display:flex; align-items:center; justify-content:center; gap:8px; background:#25D366; color:#fff; padding:12px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:15px; margin-top:15px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                    Ödemeyi Yaptım (WhatsApp Bildir)
                </a>
            `;
    } else {
      htmlContent += `
                <p style="font-size:13px; color:#8b949e; margin-bottom:0;">Yöneticimiz ödemeyi teyit ettiği an üyeliğiniz açılacaktır.</p>
             `;
    }

    htmlContent += `</div>`;

    Swal.fire({
      title: "💎 Premium Paket Al",
      html: htmlContent,
      icon: "info",
      background: "#0c0d1e",
      color: "#ffffff",
      showCancelButton: true,
      cancelButtonText: "Kapat",
      showConfirmButton: false,
      confirmButtonColor: "#10b981",
    });
  } else {
    alert("Şu an test aşamasındayız.");
  }
};

function showLoginScreen() {
  const sl = document.getElementById("screen-login");
  const mi = document.getElementById("main-interface");
  if (sl) sl.classList.remove("hidden");
  if (mi) mi.classList.add("hidden");

  // Clear in-memory databases to prevent data leaks between sessions
  records = [];
  activeRecords = [];
  trashRecords = [];
  window.currentUser = null;
  window.sessionLogged = false;

  // Instantly wipe UI lists
  const list = document.getElementById("registryList");
  if (list) {
    list.innerHTML = '<p class="empty-msg">Henüz kayıt bulunmuyor.</p>';
  }
  const trashList = document.getElementById("trashList");
  if (trashList) {
    trashList.innerHTML = '<p class="empty-msg">Çöp kutusu boş.</p>';
  }

  // Reset counts in UI
  const regCount = document.getElementById("registryCount");
  if (regCount) regCount.innerText = "0";
  const statTotal = document.getElementById("stat-total");
  if (statTotal) statTotal.innerText = "0";
  const homeCount = document.getElementById("home-registry-count");
  if (homeCount) homeCount.innerText = "0";
}

const googleLoginBtn = document.getElementById("googleLoginBtn");
if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async () => {
    console.log(
      "[Adım 1] Google butonuna tıklandı. Supabase bağlantısı kontrol ediliyor...",
    );
    try {
      const sb = getSupabase();
      if (!sb) {
        if (typeof Swal !== "undefined")
          Swal.fire("Hata", "Supabase kütüphanesi yüklenmedi!", "error");
        return;
      }

      const isApp = isElectronApp();
      let redirectUrl = window.location.origin;
      if (isApp) {
        redirectUrl = "http://localhost:8002";
      }
      console.log("[Adım 2] Yönlendirme adresi ayarlandı: " + redirectUrl);

      const { data, error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: isApp,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        console.error("[Hata] Supabase yetkilendirmeyi reddetti: ", error);
        if (typeof Swal !== "undefined")
          Swal.fire("Giriş Hatası", "Hata detayı: " + error.message, "error");
        return;
      }

      if (isApp && data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e) {
      console.error("Google Auth Error:", e);
      if (typeof Swal !== "undefined")
        Swal.fire("Hata", "Beklenmeyen bir hata oluştu.", "error");
    }
  });
}

// Profil Ad Soyad Düzenleme Fonksiyonu
window.editProfileName = () => {
  const email = window.currentUser
    ? window.currentUser.email
    : localStorage.getItem("arsivx_user_email") || "mustafakartn58@gmail.com";
  const currentName =
    localStorage.getItem("arsivx_name_" + email) || "ArşivX Kullanıcısı";

  if (typeof Swal !== "undefined") {
    Swal.fire({
      title: "Ad Soyad Düzenle",
      text: "Lütfen yeni adınızı ve soyadınızı girin:",
      input: "text",
      inputPlaceholder: "Örn: Mustafa Kartın",
      inputValue: currentName,
      icon: "question",
      background: "#0c0d1e",
      color: "#ffffff",
      confirmButtonText: "Güncelle 💾",
      confirmButtonColor: "#e0b354",
      showCancelButton: true,
      cancelButtonText: "İptal",
      customClass: {
        popup: "swal2-premium-popup",
        title: "swal2-premium-title",
        htmlContainer: "swal2-premium-html",
        confirmButton: "swal2-premium-confirm",
      },
      preConfirm: (name) => {
        if (!name || name.trim().length < 3) {
          Swal.showValidationMessage(
            "Lütfen geçerli bir ad soyad girin (en az 3 karakter)!",
          );
          return false;
        }
        return name.trim();
      },
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const newName = result.value;
        localStorage.setItem("arsivx_user_name", newName);
        localStorage.setItem("arsivx_name_" + email, newName);
        localStorage.setItem("arsivx_name_entered_" + email, "true");

        // Update active user state if exists
        if (window.currentUser) {
          window.currentUser.user_metadata =
            window.currentUser.user_metadata || {};
          window.currentUser.user_metadata.full_name = newName;
        }

        // Re-render UI elements immediately
        renderUserProfile(newName, email, "logo.png");

        Swal.fire({
          title: "Güncellendi! 👍",
          text: "İsminiz başarıyla güncellendi.",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
          background: "#0c0d1e",
          color: "#ffffff",
          customClass: {
            popup: "swal2-premium-popup",
            title: "swal2-premium-title",
            htmlContainer: "swal2-premium-html",
          },
        });
      }
    });
  } else {
    const val = prompt("Lütfen yeni adınızı ve soyadınızı girin:", currentName);
    if (val && val.trim() && val.trim().length >= 3) {
      const newName = val.trim();
      localStorage.setItem("arsivx_user_name", newName);
      localStorage.setItem("arsivx_name_" + email, newName);
      localStorage.setItem("arsivx_name_entered_" + email, "true");
      if (window.currentUser) {
        window.currentUser.user_metadata =
          window.currentUser.user_metadata || {};
        window.currentUser.user_metadata.full_name = newName;
      }
      renderUserProfile(newName, email, "logo.png");
    }
  }
};

// Legacy referans fonksiyonlar
function promptCustomAccount() {
  /* devre dışı */
}
function loginDynamically(email, name) {
  localStorage.setItem("arsivx_user_email", email);
  showMainApp({
    email: email,
    user_metadata: {
      full_name: name || "ArşivX Kullanıcısı",
      avatar_url: "logo.png",
    },
  });
}

window.logout = async () => {
  if (typeof Swal !== "undefined") {
    const result = await Swal.fire({
      title: "Çıkış Yap",
      text: "Oturumu kapatmak istediğinize emin misiniz?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Evet, Kapat",
      cancelButtonText: "Vazgeç",
    });
    if (!result.isConfirmed) return;
  }

  await logUserActivity("logout", {});

  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
  window.history.replaceState({}, document.title, window.location.pathname);

  // Clear only session storage and specific login user keys to keep names database
  localStorage.removeItem("arsivx_user_email");
  localStorage.removeItem("arsivx_user_name");
  sessionStorage.clear();
  window.location.reload();
};

// Check session on start and handle redirect

// Attach onAuthStateChange immediately without setTimeout so we never miss SIGNED_IN broadcast!
const sbInit = getSupabase();
if (sbInit) {
  sbInit.auth.onAuthStateChange((event, session) => {
    console.log("Auth State Change:", event, session);
    if (event === "SIGNED_IN" && session) {
      console.log("[Canlı Oturum] Giriş algılandı! Açına ekranı açılıyor...");
      showMainApp(session.user);
    } else if (event === "SIGNED_OUT") {
      if (window.currentUser) {
        console.log(
          "[Oturum Kontrolü] SIGNED_OUT engellendi, çünkü zaten aktif bir kullanıcı oturumu var.",
        );
        return;
      }
      showLoginScreen();
    }
  });
}

const video = document.getElementById("scanner");
const canvas = document.getElementById("arOverlay");
const ctx = canvas ? canvas.getContext("2d") : null;
const actionBtn = document.getElementById("mainActionBtn");
const targetInput = document.getElementById("targetName") || { value: "evrak" };
const aiMessage = document.getElementById("scannerStatusMsg") ||
  document.getElementById("aiMessage") || {
    set innerText(val) {
      console.log("[aiMessage Mock]:", val);
    },
    get innerText() {
      return "";
    },
  };
const confVal = document.getElementById("confVal") || {
  set innerText(val) {},
  get innerText() {
    return "";
  },
};
const registryCount = document.getElementById("registryCount") || {
  set innerText(val) {},
  get innerText() {
    return "";
  },
};

// Storage Logic (Cloud First)
let records = [];
let activeRecords = [];
let trashRecords = [];

async function loadRecords() {
  const sb = getSupabase();
  if (!sb) return;

  // Dynamically retrieve active user Email
  let userEmail = null;
  if (window.currentUser && window.currentUser.email) {
    userEmail = window.currentUser.email;
  } else {
    try {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (user) {
        window.currentUser = user;
        userEmail = user.email;
      }
    } catch (e) {
      console.error("Kullanıcı bilgisi yüklenemedi:", e);
    }
  }

  if (!userEmail) {
    // Ultimate fallback to ensure data isolation even during session delays
    userEmail = "mustafakartn58@gmail.com";
  }

  try {
    // Query all records. We omit .eq('user_id', ...) because the column 'user_id' does not exist in the database!
    const { data, error } = await sb
      .from("records")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // --- ACCOUNT LINKING (SHARED WORKSPACE) LOGIC ---
    const linksRecord = (data || []).find(
      (r) => r.name === "__account_links__",
    );
    let accountLinks = {};
    if (linksRecord && linksRecord.content) {
      try {
        accountLinks = JSON.parse(linksRecord.content);
      } catch (e) {}
    }

    let myBoss = null;
    window.myEmployees = accountLinks[userEmail] || []; // For Ekip Yönetimi UI

    // Am I an employee of someone?
    for (let boss in accountLinks) {
      if (
        Array.isArray(accountLinks[boss]) &&
        accountLinks[boss].includes(userEmail)
      ) {
        myBoss = boss;
        break;
      }
    }

    // The effective email dictates whose records we see and create
    const effectiveEmail = myBoss ? myBoss : userEmail;
    window.effectiveEmail = effectiveEmail; // Expose globally for saving new records
    // ------------------------------------------------

    // Parse owner and type tags from content and clean them for the UI
    records = (data || []).map((r) => {
      let content = r.content || "";
      let owner = null;
      let type = "folder";

      const typeMatch = content.match(/\[type:(.*?)\]/);
      if (typeMatch) {
        type = typeMatch[1];
        content = content.replace(/\[type:(.*?)\]/g, "");
      }

      let isFavorite = false;
      const favMatch = content.match(/\[favorite:(.*?)\]/);
      if (favMatch) {
        isFavorite = favMatch[1] === "true";
        content = content.replace(/\[favorite:(.*?)\]/g, "");
      }

      let sender = null;
      let isRead = true; // varsayılan okundu

      const senderMatch = content.match(/\[sender:(.*?)\]/);
      if (senderMatch) {
        sender = senderMatch[1];
        content = content.replace(/\[sender:(.*?)\]/g, "");
      } else {
        // Eski format geriye dönük uyumluluk
        const oldSenderMatch = content.match(
          /\(Bu belge (.*?) hesabından gönderildi\.\)/,
        );
        if (oldSenderMatch) {
          sender = oldSenderMatch[1];
          content = content.replace(
            /\n*\s*\(Bu belge .*? hesabından gönderildi\.\)/g,
            "",
          );
        }
      }

      const readMatch = content.match(/\[read:(.*?)\]/);
      if (readMatch) {
        isRead = readMatch[1] === "true";
        content = content.replace(/\[read:(.*?)\]/g, "");
      }

      const ownerMatch = content.match(/\[owner:(.*?)\]/);
      if (ownerMatch) {
        owner = ownerMatch[1];
        content = content.replace(/\n*\s*\[owner:(.*?)\]/g, "");
      } else {
        // Infer type for old records
        if (
          r.location &&
          (r.location.includes("Tarayıcı") ||
            r.location.includes("Dijital Arşiv") ||
            r.name === "Evrak Tarama ve Arşiv")
        ) {
          type = "scan";
        }
      }

      return {
        ...r,
        content: content,
        _owner: owner,
        _type: type,
        _sender: sender,
        _isRead: isRead,
        _isFavorite: isFavorite,
        _originalContent: r.content,
      };
    });

    // Strict isolation by Gmail owner tag. Only explicitly owned records are visible.
    // If part of a team, effectiveEmail belongs to the Boss, so the employee sees all of Boss's records!
    activeRecords = records.filter(
      (r) =>
        r.is_deleted !== true &&
        r.name !== "__system_logs__" &&
        r.name !== "__account_links__" &&
        (r._owner === effectiveEmail || r._sender === effectiveEmail),
    );
    trashRecords = records.filter(
      (r) =>
        r.is_deleted === true &&
        r.name !== "__system_logs__" &&
        r.name !== "__account_links__" &&
        r._owner === effectiveEmail,
    );

    if (typeof window.checkNotifications === "function")
      window.checkNotifications();

    updateRegistryCount();

    const regScreen = document.getElementById("screen-registry");
    if (regScreen && !regScreen.classList.contains("hidden")) {
      renderRegistry();
    }

    const trashScreen = document.getElementById("screen-trash");
    if (trashScreen && !trashScreen.classList.contains("hidden")) {
      window.renderTrash();
    }
  } catch (e) {
    console.error("Data load failed", e);
  }
}

function updateRegistryCount() {
  // Show active records (folders) count on home and profile page for accurate stats
  const regCount = document.getElementById("registryCount");
  if (regCount) {
    regCount.innerText = activeRecords.length;
  }
  const statTotal = document.getElementById("stat-total");
  if (statTotal) {
    statTotal.innerText = activeRecords.length;
  }
  const homeCount = document.getElementById("home-registry-count");
  if (homeCount) {
    homeCount.innerText = activeRecords.length;
  }
}

// Photo Upload Helper
async function uploadPhoto(base64Data, fileName) {
  if (!supabase) return null;
  try {
    const userId = window.currentUser ? window.currentUser.id : "public";
    const blob = await fetch(base64Data).then((res) => res.blob());
    const uploadPath = `uploads/${userId}/${fileName}.jpg`;

    const { data, error } = await window
      .getSupabase()
      .storage.from("arsiv-photos")
      .upload(uploadPath, blob, { contentType: "image/jpeg", upsert: true });

    if (error) throw error;
    const {
      data: { publicUrl },
    } = window
      .getSupabase()
      .storage.from("arsiv-photos")
      .getPublicUrl(uploadPath);
    return publicUrl;
  } catch (e) {
    console.error("Upload failed, falling back to base64:", e);
    return base64Data; // Fallback to base64 so photos are not lost
  }
}

// Tab Management & Independent Ekle Camera Stream
let addStream = null;

async function startAddCamera() {
  const addVideo = document.getElementById("add-video");
  if (!addVideo) return;

  // Ensure the video element is visible and placeholder text is hidden
  addVideo.style.display = "block";
  const previewArea = document.getElementById("photoPreview");
  if (previewArea) {
    const placeholderImg = previewArea.querySelector(".placeholder-icon");
    const placeholderTxt = previewArea.querySelector("p");
    if (placeholderImg) placeholderImg.classList.add("hidden");
    if (placeholderTxt) placeholderTxt.classList.add("hidden");
  }

  try {
    if (addStream) {
      stopAddCamera();
    }
    addStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 4096 },
        height: { ideal: 2160 },
      },
    });
    addVideo.srcObject = addStream;

    addVideo.onloadedmetadata = () => {
      const overlayCanvas = document.getElementById("add-overlay");
      if (
        overlayCanvas &&
        typeof window.startLiveDocumentHighlight === "function"
      ) {
        window.startLiveDocumentHighlight(addVideo, overlayCanvas);
      }
    };
    console.log("[Ekle] Kamera canlı yayını başlatıldı.");
  } catch (e) {
    console.error("[Ekle] Kamera başlatılamadı:", e);
  }
}

function stopAddCamera() {
  if (addStream) {
    addStream.getTracks().forEach((t) => t.stop());
    addStream = null;
    console.log("[Ekle] Kamera canlı yayını durduruldu.");
  }
  const addVideo = document.getElementById("add-video");
  if (addVideo) {
    addVideo.srcObject = null;
  }
}

window.switchTab = function (tab) {
  console.log("Switching to tab:", tab);

  // === NATIVE ML KIT SCANNER INTERCEPTION ===
  if (tab === "scanner" && window.Capacitor && window.Capacitor.isNativePlatform()) {
      window.launchNativeMLKitScanner();
      return; // Do not switch to the web-based scanner HTML tab
  }

  // === TRIAL LOCK: Engellenen sekmelere geçişi kes ===
  const lockedTabs = ["scanner", "archive", "add", "trash"];
  if (window.isTrialExpired && lockedTabs.includes(tab)) {
    // Paywall'ı göster
    const pw = document.getElementById("paywall-screen");
    if (pw) {
      pw.style.cssText =
        "display:flex !important; position:fixed; inset:0; z-index:999; align-items:center; justify-content:center; padding:20px; overflow-y:auto; background:radial-gradient(ellipse at top, rgba(139,92,246,0.1) 0%, transparent 60%), #060714;";
    } else {
      lockScannerUI();
    }
    return; // Sekme geçişini engelle
  }

  // Auto-close side drawer on mobile
  window.toggleMenu(false);

  // Stop all active streams when moving to another screen to avoid resource locks
  stopAddCamera();
  if (tab !== "scanner") {
    if (typeof window.stopScanner === "function") window.stopScanner();
  }

  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.add("hidden"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));

  // Paywall ekranını da gizle (kilitli değilse)
  const pw = document.getElementById("paywall-screen");
  if (pw) pw.style.display = "none";

  if (tab === "home") {
    document.getElementById("screen-home").classList.remove("hidden");
  } else {
    const targetScreen = document.getElementById(`screen-${tab}`);
    if (targetScreen) targetScreen.classList.remove("hidden");
  }

  // Activate matching button directly by ID
  const targetBtn = document.getElementById(`tab-${tab}`);
  if (targetBtn) targetBtn.classList.add("active");

  if (tab === "registry") renderRegistry();
  if (tab === "trash" && typeof window.renderTrash === "function")
    window.renderTrash();
  if (tab === "add") {
    startAddCamera();
  }
  if (tab === "scanner") {
    if (typeof window.startScanner === "function") window.startScanner();
  }
  if (tab === "share") {
    if (typeof window.populateShareSelect === "function")
      window.populateShareSelect();
  }

  if (window.lucide) window.lucide.createIcons();
};

window.showQR = function (id, name) {
  const container = document.getElementById("qrCodeContainer");
  const modal = document.getElementById("qrModal");
  const title = document.getElementById("qrFolderTitle");
  const headerTitle = document.getElementById("qrModalHeaderTitle");
  const helpText = document.getElementById("qrHelpText");

  if (headerTitle) headerTitle.innerText = "Klasör QR Kodu";
  if (helpText) helpText.style.display = "none";

  container.innerHTML = "";
  title.innerText = name;

  QRCode.toCanvas(
    container,
    `arsivx_id:${id}`,
    { width: 250, margin: 1 },
    function (error) {
      if (error) console.error(error);
      modal.classList.remove("hidden");
    },
  );
};

window.closeQRModal = function () {
  document.getElementById("qrModal").classList.add("hidden");
};

window.downloadQR = function () {
  const canvas = document.querySelector("#qrCodeContainer canvas");
  const link = document.createElement("a");
  link.download = `ArsivX_QR_${document.getElementById("qrFolderTitle").innerText}.png`;
  link.href = canvas.toDataURL();
  link.click();
};
window.showConnectQR = function () {
  const url = "https://lazy-worms-switch.loca.lt";
  // Set title
  const titleElem = document.getElementById("qrFolderTitle");
  const headerTitle = document.getElementById("qrModalHeaderTitle");
  const helpText = document.getElementById("qrHelpText");

  if (headerTitle) headerTitle.innerText = "Mobil Bağlantı QR Kodu";
  if (helpText) helpText.style.display = "block";

  if (titleElem) titleElem.innerText = url;
  // Generate QR code
  const container = document.getElementById("qrCodeContainer");
  if (container) {
    container.innerHTML = "";
    new QRCode(container, {
      text: url,
      width: 256,
      height: 256,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H,
    });
  }
  // Show modal
  const modal = document.getElementById("qrModal");
  if (modal) modal.classList.remove("hidden");
};
window.cancelAdd = function () {
  document.getElementById("newFolderName").value = "";
  document.getElementById("newFolderLocation").value = "";
  document.getElementById("newFolderContent").value = "";

  stopAddCamera();
  const previewArea = document.getElementById("photoPreview");
  if (previewArea) {
    previewArea.innerHTML = `
            <video id="add-video" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover; border-radius:16px; background:#000;"></video>
            <div class="placeholder-icon hidden"><i data-lucide="camera"></i></div>
            <p class="hidden">Klasör fotoğrafı çekin</p>
        `;
    previewArea.classList.remove("captured");
  }

  lastCapturedPhoto = null;
  const snapBtn = document.getElementById("snapPhotoBtn");
  const retakeBtn = document.getElementById("retakePhotoBtn");
  const saveFolderBtn = document.getElementById("saveFolderBtn");
  if (snapBtn) snapBtn.classList.remove("hidden");
  if (retakeBtn) retakeBtn.classList.add("hidden");
  if (saveFolderBtn) {
    saveFolderBtn.classList.remove("hidden");
    saveFolderBtn.style.display = "block";
  }

  window.switchTab("home");
};

// Document Scanner & Editor State
let originalImg = new Image();
let currentFilter = "original"; // default to Original
let currentRotation = 0; // 0, 90, 180, 270
let exportFormat = "jpg";
let lastCapturedPhoto = null;
let editorStep = 1;

// Crop State
let cropPoints = [];
let draggingPoint = null;
let isDraggingCrop = false;

// Sliders
let sliderBrightnessVal = 23;
let sliderContrastVal = 10;
let dragPointIndex = -1;
let dragStartPos = { x: 0, y: 0 };
let hiddenCroppedCanvas = document.createElement("canvas");

const snapBtn = document.getElementById("snapPhotoBtn");
const retakeBtn = document.getElementById("retakePhotoBtn");
const saveFolderBtn = document.getElementById("saveFolderBtn");
const previewArea = document.getElementById("photoPreview");

// Initialize event listeners for cropping canvas
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("docCanvas");
  if (!canvas) return; // FIX: Prevent crash on admin page

  // Mouse Events
  canvas.addEventListener("mousedown", (e) => {
    if (editorStep !== 1) return;
    handleCropStart(e);
  });
  // Use window for mousemove and mouseup so dragging outside canvas doesn't drop the point
  window.addEventListener("mousemove", (e) => {
    if (editorStep !== 1 || dragPointIndex === -1) return;
    handleCropMove(e);
  });
  window.addEventListener("mouseup", () => {
    if (editorStep !== 1 || dragPointIndex === -1) return;
    handleCropEnd();
  });

  // Touch Events for mobile
  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (editorStep !== 1) return;
      e.preventDefault();
      handleCropStart(e);
    },
    { passive: false },
  );
  window.addEventListener(
    "touchmove",
    (e) => {
      if (editorStep !== 1 || dragPointIndex === -1) return;
      // e.preventDefault() is handled if we touch on canvas, but on window we shouldn't prevent all touches
      handleCropMove(e);
    },
    { passive: false },
  );
  window.addEventListener("touchend", () => {
    if (editorStep !== 1 || dragPointIndex === -1) return;
    handleCropEnd();
  });
});

function getCanvasCoords(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const clientX =
    e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
  const clientY =
    e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;

  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top) / rect.height) * canvas.height;
  return { x, y };
}

function getMidpoint(idx) {
  const pStart = cropPoints[idx];
  const pEnd = cropPoints[(idx + 1) % 4];
  return {
    x: (pStart.x + pEnd.x) / 2,
    y: (pStart.y + pEnd.y) / 2,
  };
}

function handleCropStart(e) {
  const canvas = document.getElementById("docCanvas");
  if (!canvas || cropPoints.length === 0) return;

  const pos = getCanvasCoords(e, canvas);
  dragPointIndex = -1;

  const rect = canvas.getBoundingClientRect();
  const eventScreenX =
    e.touches && e.touches.length > 0
      ? e.touches[0].clientX - rect.left
      : e.clientX - rect.left;
  const eventScreenY =
    e.touches && e.touches.length > 0
      ? e.touches[0].clientY - rect.top
      : e.clientY - rect.top;

  let minDist = Infinity;
  let closestIndex = -1;

  // Corners check
  for (let i = 0; i < 4; i++) {
    const p = cropPoints[i];
    const screenPxX = (p.x / canvas.width) * rect.width;
    const screenPxY = (p.y / canvas.height) * rect.height;
    const dist = Math.hypot(screenPxX - eventScreenX, screenPxY - eventScreenY);

    if (dist < minDist) {
      minDist = dist;
      closestIndex = i;
    }
  }

  // Midpoints check
  for (let i = 0; i < 4; i++) {
    const mid = getMidpoint(i);
    const screenPxX = (mid.x / canvas.width) * rect.width;
    const screenPxY = (mid.y / canvas.height) * rect.height;
    const dist = Math.hypot(screenPxX - eventScreenX, screenPxY - eventScreenY);

    if (dist < minDist) {
      minDist = dist;
      closestIndex = 4 + i;
    }
  }

  // Dev gibi hit alanı (120 piksel) - mobilde tıklamayı kesinleştirmek için
  if (minDist < 120) {
    dragPointIndex = closestIndex;
    dragStartPos = pos;
  }

  if (dragPointIndex !== -1) {
    updateMagnifier(pos);
  }
}

function handleCropMove(e) {
  if (dragPointIndex === -1) return;
  const canvas = document.getElementById("docCanvas");
  if (!canvas) return;

  const pos = getCanvasCoords(e, canvas);
  const dx = pos.x - dragStartPos.x;
  const dy = pos.y - dragStartPos.y;

  if (dragPointIndex < 4) {
    cropPoints[dragPointIndex].x = Math.max(0, Math.min(canvas.width, pos.x));
    cropPoints[dragPointIndex].y = Math.max(0, Math.min(canvas.height, pos.y));
  } else {
    const idx = dragPointIndex - 4;
    const i1 = idx;
    const i2 = (idx + 1) % 4;

    const newP1x = cropPoints[i1].x + dx;
    const newP1y = cropPoints[i1].y + dy;
    const newP2x = cropPoints[i2].x + dx;
    const newP2y = cropPoints[i2].y + dy;

    if (
      newP1x >= 0 &&
      newP1x <= canvas.width &&
      newP1y >= 0 &&
      newP1y <= canvas.height &&
      newP2x >= 0 &&
      newP2x <= canvas.width &&
      newP2y >= 0 &&
      newP2y <= canvas.height
    ) {
      cropPoints[i1].x = newP1x;
      cropPoints[i1].y = newP1y;
      cropPoints[i2].x = newP2x;
      cropPoints[i2].y = newP2y;
    }
  }

  dragStartPos = pos;
  drawCropScreen();
  updateMagnifier(pos);
}

function handleCropEnd() {
  dragPointIndex = -1;
  const bubble = document.getElementById("magnifier-bubble");
  if (bubble) bubble.classList.add("hidden");
}

function updateMagnifier(pos) {
  const bubble = document.getElementById("magnifier-bubble");
  const canvas = document.getElementById("docCanvas");
  if (!bubble || !canvas) return;

  let magCanvas = document.getElementById("magnifierCanvas");
  if (!magCanvas) {
    magCanvas = document.createElement("canvas");
    magCanvas.id = "magnifierCanvas";
    magCanvas.width = 90;
    magCanvas.height = 90;
    bubble.appendChild(magCanvas);
  }

  const magCtx = magCanvas.getContext("2d");
  magCtx.fillStyle = "#000000";
  magCtx.fillRect(0, 0, 90, 90);

  let target = pos;
  if (dragPointIndex !== -1) {
    target =
      dragPointIndex < 4
        ? cropPoints[dragPointIndex]
        : getMidpoint(dragPointIndex - 4);
  }

  const zoomSize = 36;
  const halfZoom = zoomSize / 2;

  magCtx.drawImage(
    canvas,
    target.x - halfZoom,
    target.y - halfZoom,
    zoomSize,
    zoomSize,
    0,
    0,
    90,
    90,
  );

  magCtx.strokeStyle = getThemeColor();
  magCtx.lineWidth = 1.5;
  magCtx.beginPath();
  magCtx.moveTo(45, 0);
  magCtx.lineTo(45, 90);
  magCtx.moveTo(0, 45);
  magCtx.lineTo(90, 45);
  magCtx.stroke();

  const rect = canvas.getBoundingClientRect();
  const cursorRelativeX = (target.x / canvas.width) * rect.width;

  bubble.classList.remove("hidden");
  if (cursorRelativeX < rect.width / 2) {
    bubble.style.left = "auto";
    bubble.style.right = "15px";
  } else {
    bubble.style.left = "15px";
    bubble.style.right = "auto";
  }
  bubble.style.top = "15px";
  bubble.style.display = "block";
}

// Global Loader Spinner for AI Scanning
function showGlobalSpinner(msg) {
  let spinner = document.getElementById("ai-scanner-spinner");
  if (!spinner) {
    spinner = document.createElement("div");
    spinner.id = "ai-scanner-spinner";
    spinner.style.position = "fixed";
    spinner.style.top = "0";
    spinner.style.left = "0";
    spinner.style.width = "100vw";
    spinner.style.height = "100vh";
    spinner.style.backgroundColor = "rgba(2, 2, 4, 0.75)";
    spinner.style.backdropFilter = "blur(12px)";
    spinner.style.zIndex = "99999";
    spinner.style.display = "flex";
    spinner.style.flexDirection = "column";
    spinner.style.alignItems = "center";
    spinner.style.justifyContent = "center";
    spinner.style.color = "#ffffff";
    spinner.style.fontFamily = "'Outfit', sans-serif";

    spinner.innerHTML = `
            <div class="spinner-icon" style="
                width: 64px;
                height: 64px;
                border: 5px solid rgba(224, 86, 253, 0.15);
                border-top: 5px solid #e056fd;
                border-radius: 50%;
                animation: spin-anim 1s linear infinite;
                margin-bottom: 20px;
                box-shadow: 0 0 20px rgba(224, 86, 253, 0.4);
            "></div>
            <div class="spinner-text" id="ai-spinner-text" style="
                font-size: 1.1rem;
                font-weight: 600;
                letter-spacing: 0.5px;
                text-shadow: 0 2px 10px rgba(0,0,0,0.5);
            "></div>
            <style>
                @keyframes spin-anim {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
    document.body.appendChild(spinner);
  }
  document.getElementById("ai-spinner-text").innerText = msg;
  spinner.style.display = "flex";
}

function hideGlobalSpinner() {
  const spinner = document.getElementById("ai-scanner-spinner");
  if (spinner) spinner.style.display = "none";
}

function getOriginalImageBase64() {
  const canvas = document.createElement("canvas");
  canvas.width = originalImg.width;
  canvas.height = originalImg.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(originalImg, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}

async function initCropPoints() {
  const w = originalImg.width;
  const h = originalImg.height;
  const a4Ratio = 1.4142;

  let cropW, cropH;
  if (h > w) {
    if (h > w * a4Ratio) {
      cropW = w * 0.94;
      cropH = cropW * a4Ratio;
    } else {
      cropH = h * 0.94;
      cropW = cropH / a4Ratio;
    }
  } else {
    if (w > h * a4Ratio) {
      cropH = h * 0.94;
      cropW = cropH * a4Ratio;
    } else {
      cropW = w * 0.94;
      cropH = cropW / a4Ratio;
    }
  }
  const offsetX = (w - cropW) / 2;
  const offsetY = (h - cropH) / 2;
  cropPoints = [
    { x: offsetX, y: offsetY },
    { x: offsetX + cropW, y: offsetY },
    { x: offsetX + cropW, y: offsetY + cropH },
    { x: offsetX, y: offsetY + cropH },
  ];
  console.log(
    "[Yerel Tarayıcı] Belge sınırları başarıyla A4 formatında hazırlandı.",
  );
}

function drawCropScreen() {
  const canvas = document.getElementById("docCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const width = originalImg.width;
  const height = originalImg.height;

  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(originalImg, 0, 0);

  if (cropPoints.length === 0) return;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.moveTo(cropPoints[0].x, cropPoints[0].y);
  for (let i = 3; i >= 0; i--) {
    ctx.lineTo(cropPoints[i].x, cropPoints[i].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = getThemeColor();
  ctx.lineWidth = Math.max(3, Math.round(width / 250));
  ctx.beginPath();
  ctx.moveTo(cropPoints[0].x, cropPoints[0].y);
  for (let i = 1; i < 4; i++) {
    ctx.lineTo(cropPoints[i].x, cropPoints[i].y);
  }
  ctx.closePath();
  ctx.stroke();

  const handleRadius = Math.max(8, Math.round(width / 100));
  const midRadius = Math.max(6, Math.round(width / 130));

  cropPoints.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, handleRadius, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = getThemeColor();
    ctx.lineWidth = Math.max(2, Math.round(width / 300));
    ctx.stroke();
  });

  for (let i = 0; i < 4; i++) {
    const mid = getMidpoint(i);
    ctx.beginPath();
    ctx.arc(mid.x, mid.y, midRadius, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = getThemeColor();
    ctx.lineWidth = Math.max(1.5, Math.round(width / 400));
    ctx.stroke();
  }
}

window.openDocEditor = function (dataUrl, autoDetectedPoints = null) {
  const modal = document.getElementById("docEditorModal");
  const filenameInput = document.getElementById("docFileName");
  const locationInput = document.getElementById("docLocation");
  const contentInput = document.getElementById("docContent");

  if (filenameInput) {
    filenameInput.value = "Evrak_" + Date.now().toString().slice(-6);
  }
  if (locationInput) {
    locationInput.value = "";
  }
  if (contentInput) {
    const liveText = document.getElementById("scannerLiveText");
    contentInput.value =
      liveText && liveText.value ? liveText.value.trim() : "";

    // Full Image AI OCR: Trigger full resolution OCR for better details
    if (typeof worker !== "undefined" && worker) {
      const originalValue = contentInput.value;
      contentInput.value =
        "Yapay zeka tam detaylı tarama yapıyor, lütfen bekleyin...\n\n" +
        originalValue;

      // Generate full OCR async and update textarea
      worker
        .recognize(dataUrl)
        .then(({ data }) => {
          if (data && data.text && data.text.trim().length > 10) {
            contentInput.value = data.text.trim();
          } else {
            contentInput.value = originalValue;
          }
        })
        .catch((e) => {
          console.error("Full AI OCR Error:", e);
          contentInput.value = originalValue;
        });
    }
  }

  currentFilter = "original";
  currentRotation = 0;
  exportFormat = "jpg";
  sliderBrightnessVal = 23;
  sliderContrastVal = 10;

  const slideB = document.getElementById("slider-brightness");
  const slideC = document.getElementById("slider-contrast");
  if (slideB) slideB.value = 23;
  if (slideC) slideC.value = 10;

  const valB = document.getElementById("val-brightness");
  const valC = document.getElementById("val-contrast");
  if (valB) valB.innerText = "+23";
  if (valC) valC.innerText = "+10";

  updateFormatButtons();

  originalImg.onload = async function () {
    showGlobalSpinner("Evrak Hazırlanıyor...");
    try {
      let aiDetected = false;
      if (
        autoDetectedPoints &&
        Array.isArray(autoDetectedPoints) &&
        autoDetectedPoints.length === 4
      ) {
        cropPoints = autoDetectedPoints;
        aiDetected = true;
        console.log(
          "[ArşivX AI] Kamera destekli akıllı kırpma noktaları yüklendi!",
        );
      } else {
        await initCropPoints();
      }

      if (aiDetected) {
        window.nextEditorStep(2); // DİREKT KIRPILMIŞ HALİNE GİT
      } else {
        window.nextEditorStep(1); // Bulamazsa manuel kırpmaya (Adım 1) git
      }

      if (modal) modal.classList.remove("hidden");
    } catch (e) {
      console.error("Editor açılış hatası:", e);
      window.nextEditorStep(1); // Fallback to Step 1 manual crop
      if (modal) modal.classList.remove("hidden");
    } finally {
      hideGlobalSpinner();
    }
  };
  originalImg.src = dataUrl;
};

window.closeDocEditor = function () {
  const modal = document.getElementById("docEditorModal");
  if (modal) modal.classList.add("hidden");

  const scannerScreen = document.getElementById("screen-scanner");
  if (scannerScreen && !scannerScreen.classList.contains("hidden")) {
    if (typeof window.startScanner === "function") {
      window.startScanner();
    }
  }
};

function updateFormatButtons() {
  const jpgBtn = document.getElementById("format-jpg");
  const pdfBtn = document.getElementById("format-pdf");
  const xlsBtn = document.getElementById("format-excel");

  if (jpgBtn) {
    jpgBtn.classList.toggle("btn-primary", exportFormat === "jpg");
    jpgBtn.classList.toggle("active", exportFormat === "jpg");
    jpgBtn.classList.toggle("btn-secondary", exportFormat !== "jpg");
  }
  if (pdfBtn) {
    pdfBtn.classList.toggle("btn-primary", exportFormat === "pdf");
    pdfBtn.classList.toggle("active", exportFormat === "pdf");
    pdfBtn.classList.toggle("btn-secondary", exportFormat !== "pdf");
  }
  if (xlsBtn) {
    xlsBtn.classList.toggle("btn-primary", exportFormat === "excel");
    xlsBtn.classList.toggle("active", exportFormat === "excel");
    xlsBtn.classList.toggle("btn-secondary", exportFormat !== "excel");
  }
}

window.nextEditorStep = function (step) {
  editorStep = step;

  document.getElementById("editor-step-1").classList.add("hidden");
  document.getElementById("editor-step-2").classList.add("hidden");
  document.getElementById("editor-step-3").classList.add("hidden");

  const title = document.getElementById("editor-title-text");

  if (step === 1) {
    document.getElementById("editor-step-1").classList.remove("hidden");
    if (title)
      title.innerHTML = '<i data-lucide="crop"></i> Evrak Kırpma (Adım 1/3)';
    drawCropScreen();
  } else if (step === 2) {
    document.getElementById("editor-step-2").classList.remove("hidden");
    if (title)
      title.innerHTML =
        '<i data-lucide="sliders"></i> Filtre ve Renk Ayarları (Adım 2/3)';

    showGlobalSpinner("Döküman İşleniyor...");
    (async () => {
      try {
        await warpImage();
        generateFilterThumbnails();
        await applyFiltersAçındAdjustments();
      } catch (e) {
        console.error("Filtre ekranıı yükleme hatası:", e);
      } finally {
        hideGlobalSpinner();
      }
    })();
  } else if (step === 3) {
    document.getElementById("editor-step-3").classList.remove("hidden");
    if (title)
      title.innerHTML =
        '<i data-lucide="folder-check"></i> Evrak Kaydetme (Adım 3/3)';

    const finalCanvas = document.getElementById("filterCanvas");
    const previewCanvas = document.getElementById("finalPreviewCanvas");
    if (finalCanvas && previewCanvas) {
      previewCanvas.width = 100;
      previewCanvas.height = 100;
      const pCtx = previewCanvas.getContext("2d");
      pCtx.clearRect(0, 0, 100, 100);
      pCtx.drawImage(finalCanvas, 0, 0, 100, 100);
    }

    if (finalCanvas) {
      runOcrOnCroppedImage(finalCanvas);
    }
  }

  if (window.lucide) window.lucide.createIcons();
};

window.prevEditorStep = function (step) {
  window.nextEditorStep(step);
};

window.applyBackendOp = async function (op, type) {
  const canvas = document.getElementById("filterCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let params = {};
  if (op === "binary") {
    const esikVal = parseInt(document.getElementById("tech-binary-esik").value);
    params.esik = esikVal;
  } else if (op === "dondur") {
    const aciVal = parseFloat(document.getElementById("tech-dondur-aci").value);
    params.aci = aciVal;
  } else if (op === "olcekle") {
    const sVal = parseFloat(document.getElementById("tech-olcek-s").value);
    params.s = sVal;
  } else if (op === "kontrast") {
    const faktorVal = parseFloat(
      document.getElementById("tech-kontrast-faktor").value,
    );
    params.faktor = faktorVal;
  } else if (op === "mean" || op === "median") {
    const boyutVal = parseInt(
      document.getElementById("tech-filtre-boyut").value,
    );
    params.boyut = boyutVal;
  } else if (op === "motion") {
    const uzunlukVal = parseInt(
      document.getElementById("tech-motion-uzunluk").value,
    );
    const aciVal = parseFloat(document.getElementById("tech-motion-aci").value);
    params.uzunluk = uzunlukVal;
    params.aci = aciVal;
  } else if (op === "gurultu_ekle") {
    const yogunlukVal = parseFloat(
      document.getElementById("tech-gurultu-yogunluk").value,
    );
    params.yogunluk = yogunlukVal;
  } else if (op === "canny") {
    const loVal = parseInt(document.getElementById("tech-canny-lo").value);
    const hiVal = parseInt(document.getElementById("tech-canny-hi").value);
    params.lo = loVal;
    params.hi = hiVal;
  } else if (op === "morfo") {
    params.type = type || "genisle";
    const boyutVal = parseInt(
      document.getElementById("tech-morfo-boyut").value,
    );
    params.boyut = boyutVal;
  }

  showGlobalSpinner("Görüntü İşleniyor...");
  try {
    const warpedBase64 = hiddenCroppedCanvas.toDataURL("image/jpeg", 0.92);

    let endpoint = `${getApiBaseUrl()}/api/apply_op`;
    let payload = { image: warpedBase64, op: op, ...params };

    if (op === "magic_full") {
      endpoint = `${getApiBaseUrl()}/api/apply_enhancement`;
      payload = { image: warpedBase64 };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await response.json();
    if (res.success && res.image) {
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          resolve();
        };
        img.src = res.image;
      });
      console.log(`[Python API] İşlem başarıyla uygulandı: ${op}`);
      if (typeof speak === "function") speak("İşlem uygulandı.");
    } else {
      throw new Error(res.error || "Sunucu işlemi tamamlayamadı.");
    }
  } catch (e) {
    console.error("[Python API] Görüntü işleme hatası:", e);
    if (typeof Swal !== "undefined") {
      Swal.fire({
        icon: "error",
        title: "Hata",
        text: "İşlem uygulanamadı: " + e.message,
        background: "#060713",
        color: "#fff",
        confirmButtonColor: "#8b5cf6",
      });
    }
  } finally {
    hideGlobalSpinner();
  }
};

window.rotateDoc = function () {
  if (editorStep === 1) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = originalImg.height;
    tempCanvas.height = originalImg.width;

    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate((90 * Math.PI) / 180);
    tempCtx.drawImage(
      originalImg,
      -originalImg.width / 2,
      -originalImg.height / 2,
    );

    originalImg.onload = async function () {
      await initCropPoints();
      drawCropScreen();
    };
    originalImg.src = tempCanvas.toDataURL("image/jpeg", 0.95);
    speak("Resim döndürüldü.");
  }
};

window.resetCrop = async function () {
  await initCropPoints();
  drawCropScreen();
  speak("Kırpma alanı sıfırlandı.");
};

window.selectFullPage = function () {
  const w = originalImg.width;
  const h = originalImg.height;
  cropPoints = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  drawCropScreen();
  speak("Tüm sayfa seçildi.");
};

window.setExportFormat = function (format) {
  exportFormat = format;
  updateFormatButtons();
  speak(`${format.toUpperCase()} dışa aktarma formatı seçildi.`);
};

async function warpImage() {
  showGlobalSpinner("Perspektif Düzeltiliyor...");
  try {
    executeLocalWarpFallback();
    console.log(
      "[Yerel Tarayıcı] Perspektif düzeltme yerel olarak tamamlandı.",
    );
  } catch (e) {
    console.error("[Yerel Tarayıcı] Perspektif bükme hatası:", e);
  } finally {
    hideGlobalSpinner();
  }
}

function executeLocalWarpFallback() {
  const w1 = Math.hypot(
    cropPoints[1].x - cropPoints[0].x,
    cropPoints[1].y - cropPoints[0].y,
  );
  const w2 = Math.hypot(
    cropPoints[2].x - cropPoints[3].x,
    cropPoints[2].y - cropPoints[3].y,
  );
  const h1 = Math.hypot(
    cropPoints[3].x - cropPoints[0].x,
    cropPoints[3].y - cropPoints[0].y,
  );
  const h2 = Math.hypot(
    cropPoints[2].x - cropPoints[1].x,
    cropPoints[2].y - cropPoints[1].y,
  );

  let W = Math.round(Math.max(w1, w2));
  let H = Math.round(Math.max(h1, h2));

  // En-boy oranını evrakın doğal yapısında korumak için zorunlu A4 oranını (1.4142) kaldırdık.
  // Bu sayede uzun fişler, faturalar veya A4 evraklar ezilmeden/sıkışmadan kendi doğal oranında taranır.

  // Evrak kalitesini en üst düzeyde korumak için max çözünürlüğü 3000px seviyesine çıkardık.
  // Bu sayede uzun evraklar ve küçük yazılar dijital defterde kristal netliğinde saklanır.
  const maxDim = 3000;
  if (W > maxDim || H > maxDim) {
    const scale = maxDim / Math.max(W, H);
    W = Math.round(W * scale);
    H = Math.round(H * scale);
  }

  hiddenCroppedCanvas.width = W;
  hiddenCroppedCanvas.height = H;

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = originalImg.width;
  srcCanvas.height = originalImg.height;
  const srcCtx = srcCanvas.getContext("2d");
  srcCtx.drawImage(originalImg, 0, 0);

  const srcCtxData = srcCtx.getImageData(
    0,
    0,
    srcCanvas.width,
    srcCanvas.height,
  );
  const srcD = srcCtxData.data;
  const srcW = srcCanvas.width;
  const srcH = srcCanvas.height;

  const destCtx = hiddenCroppedCanvas.getContext("2d");
  const destData = destCtx.createImageData(W, H);
  const destD = destData.data;

  for (let y = 0; y < H; y++) {
    const fy = y / H;
    const o_fy = 1 - fy;
    for (let x = 0; x < W; x++) {
      const fx = x / W;
      const o_fx = 1 - fx;

      const u =
        o_fx * o_fy * cropPoints[0].x +
        fx * o_fy * cropPoints[1].x +
        fx * fy * cropPoints[2].x +
        o_fx * fy * cropPoints[3].x;
      const v =
        o_fx * o_fy * cropPoints[0].y +
        fx * o_fy * cropPoints[1].y +
        fx * fy * cropPoints[2].y +
        o_fx * fy * cropPoints[3].y;

      const su = Math.min(srcW - 1, Math.max(0, Math.round(u)));
      const sv = Math.min(srcH - 1, Math.max(0, Math.round(v)));

      const srcIdx = (sv * srcW + su) * 4;
      const destIdx = (y * W + x) * 4;

      destD[destIdx] = srcD[srcIdx];
      destD[destIdx + 1] = srcD[srcIdx + 1];
      destD[destIdx + 2] = srcD[srcIdx + 2];
      destD[destIdx + 3] = 255;
    }
  }
  destCtx.putImageData(destData, 0, 0);
}

async function applyFiltersAçındAdjustments() {
  const canvas = document.getElementById("filterCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const W = hiddenCroppedCanvas.width;
  const H = hiddenCroppedCanvas.height;

  canvas.width = W;
  canvas.height = H;

  const hiddenCtx = hiddenCroppedCanvas.getContext("2d");
  const imgData = hiddenCtx.getImageData(0, 0, W, H);

  // Doğrudan yerel görüntü işleme algoritmasını çalıştır (Sıfır Sunucu Bağımlılığı!)
  applyFilterAlgorithm(imgData, currentFilter);
  ctx.putImageData(imgData, 0, 0);

  const outputImgData = ctx.getImageData(0, 0, W, H);
  const d = outputImgData.data;
  if (sliderBrightnessVal !== 0 || sliderContrastVal !== 0) {
    const factor =
      (259 * (sliderContrastVal + 255)) / (255 * (259 - sliderContrastVal));
    for (let i = 0; i < d.length; i += 4) {
      for (let k = 0; k < 3; k++) {
        let val = d[i + k];
        if (sliderBrightnessVal !== 0) {
          val += sliderBrightnessVal;
        }
        if (sliderContrastVal !== 0) {
          val = factor * (val - 128) + 128;
        }
        d[i + k] = Math.min(255, Math.max(0, val));
      }
    }
    ctx.putImageData(outputImgData, 0, 0);
  }
}

function sharpenPixels(d, w, h, strength = 1.0) {
  const copy = new Uint8ClampedArray(d);
  const str = strength;
  const center = 1 + 4 * str;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;

      for (let c = 0; c < 3; c++) {
        let val =
          copy[idx + c] * center -
          copy[idx - 4 + c] * str - // left
          copy[idx + 4 + c] * str - // right
          copy[idx - w * 4 + c] * str - // top
          copy[idx + w * 4 + c] * str; // bottom
        d[idx + c] = Math.min(255, Math.max(0, val));
      }
    }
  }
}

function applyFilterAlgorithm(imgData, filterId) {
  const w = imgData.width;
  const h = imgData.height;
  const d = imgData.data;

  if (filterId === "grayscale") {
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = gray;
      d[i + 1] = gray;
      d[i + 2] = gray;
    }
  } else if (filterId === "lighten") {
    for (let i = 0; i < d.length; i += 4) {
      for (let k = 0; k < 3; k++) {
        d[i + k] = Math.min(255, Math.max(0, (d[i + k] - 90) * 1.35 + 115));
      }
    }
  } else if (filterId === "magic") {
    // Step 1: Apply professional 5-point sharpening first to make text outlines extremely sharp
    sharpenPixels(d, w, h, 0.85);

    // Step 2: Hardware-accelerated GPU smooth background estimation
    // This eliminates all blocky artifacts, splotches, grid lines, and splotch halos.
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext("2d");

    const rawCanvas = document.createElement("canvas");
    rawCanvas.width = w;
    rawCanvas.height = h;
    rawCanvas.getContext("2d").putImageData(imgData, 0, 0);

    tempCtx.filter = "blur(28px) brightness(1.04)";
    tempCtx.drawImage(rawCanvas, 0, 0);
    tempCtx.filter = "none"; // reset

    const bgData = tempCtx.getImageData(0, 0, w, h);
    const bgD = bgData.data;

    // Step 3: Local homomorphic ratio division and piecewise binarization
    // With vibrant color preservation for stamps and signatures
    for (let i = 0; i < d.length; i += 4) {
      const bgR = Math.max(25, bgD[i]);
      const bgG = Math.max(25, bgD[i + 1]);
      const bgB = Math.max(25, bgD[i + 2]);

      const nr = d[i] / bgR;
      const ng = d[i + 1] / bgG;
      const nb = d[i + 2] / bgB;

      const minRatio = Math.min(nr, ng, nb);

      if (minRatio > 0.82) {
        // If all channels are close to background, it is pure white A4 paper background
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
      } else {
        // It is text or colored stamp/signature. We stretch each channel relative to threshold
        const stretch = (ratio, val) => {
          const blackPoint = 0.35;
          const whitePoint = 0.82;
          if (ratio >= whitePoint) {
            return 255;
          } else if (ratio <= blackPoint) {
            return val * 0.25; // Bold and deepen ink stroke
          } else {
            // High-contrast smooth transition stretch
            return ((ratio - blackPoint) / (whitePoint - blackPoint)) * 255;
          }
        };

        d[i] = Math.min(255, Math.max(0, stretch(nr, d[i])));
        d[i + 1] = Math.min(255, Math.max(0, stretch(ng, d[i + 1])));
        d[i + 2] = Math.min(255, Math.max(0, stretch(nb, d[i + 2])));
      }
      d[i + 3] = 255; // Ensure alpha is fully opaque
    }
  } else if (filterId === "bw") {
    // Step 1: Apply crisp 5-point sharpening first
    sharpenPixels(d, w, h, 0.7);

    // Step 2: Adaptive Binarization
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0; i < d.length; i += 4) {
      gray[i / 4] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }

    const integral = new Int32Array(w * h);
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        sum += gray[idx];
        if (y === 0) {
          integral[idx] = sum;
        } else {
          integral[idx] = integral[idx - w] + sum;
        }
      }
    }

    const S = Math.max(16, Math.floor(w / 16));
    const halfS = Math.floor(S / 2);
    const t = 10;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;

        const x1 = Math.max(0, x - halfS);
        const x2 = Math.min(w - 1, x + halfS);
        const y1 = Math.max(0, y - halfS);
        const y2 = Math.min(h - 1, y + halfS);

        const count = (x2 - x1 + 1) * (y2 - y1 + 1);

        let sum = integral[y2 * w + x2];
        if (x1 > 0) sum -= integral[y2 * w + (x1 - 1)];
        if (y1 > 0) sum -= integral[(y1 - 1) * w + x2];
        if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * w + (x1 - 1)];

        const mean = sum / count;
        const dIdx = idx * 4;

        const v = gray[idx];
        const lower = mean - t - 20; // Aggressive binarization to completely wipe background shadows
        const upper = mean - t + 2;

        let val;
        if (v < lower) {
          val = 0;
        } else if (v > upper) {
          val = 255;
        } else {
          val = Math.round(((v - lower) / (upper - lower)) * 255);
        }

        d[dIdx] = val;
        d[dIdx + 1] = val;
        d[dIdx + 2] = val;
        d[dIdx + 3] = 255;
      }
    }
  }
}

window.updateAdjustments = function () {
  const slideB = document.getElementById("slider-brightness");
  const slideC = document.getElementById("slider-contrast");

  if (slideB) {
    sliderBrightnessVal = parseInt(slideB.value, 10);
    const valB = document.getElementById("val-brightness");
    if (valB)
      valB.innerText =
        (sliderBrightnessVal > 0 ? "+" : "") + sliderBrightnessVal;
  }

  if (slideC) {
    sliderContrastVal = parseInt(slideC.value, 10);
    const valC = document.getElementById("val-contrast");
    if (valC)
      valC.innerText = (sliderContrastVal > 0 ? "+" : "") + sliderContrastVal;
  }

  applyFiltersAçındAdjustments();
};

window.applyFilter = function (filterId) {
  currentFilter = filterId;

  document.querySelectorAll(".filter-thumb").forEach((thumb) => {
    thumb.classList.remove("active");
  });
  const activeThumb = document.getElementById(`thumb-${filterId}`);
  if (activeThumb) activeThumb.classList.add("active");

  applyFiltersAçındAdjustments();
  speak(
    `${filterId === "magic" ? "Sihirli Renk" : filterId === "bw" ? "Net Siyah Beyaz" : filterId === "grayscale" ? "Gri Ton" : filterId === "lighten" ? "Aydınlık" : "Orijinal"} filtresi uygulandı.`,
  );
};

function generateFilterThumbnails() {
  const carousel = document.getElementById("filterCarousel");
  if (!carousel) return;
  carousel.innerHTML = "";

  const filtersList = [
    { id: "original", label: "Orijinal" },
    { id: "magic", label: "Sihirli" },
    { id: "bw", label: "Net S-B" },
    { id: "grayscale", label: "Gri Ton" },
    { id: "lighten", label: "Aydınlık" },
  ];

  filtersList.forEach((filter) => {
    const thumb = document.createElement("div");
    thumb.className = `filter-thumb ${filter.id === currentFilter ? "active" : ""}`;
    thumb.id = `thumb-${filter.id}`;
    thumb.onclick = () => window.applyFilter(filter.id);

    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = 54;
    thumbCanvas.height = 54;

    const thumbCtx = thumbCanvas.getContext("2d");
    thumbCtx.drawImage(hiddenCroppedCanvas, 0, 0, 54, 54);

    const thumbData = thumbCtx.getImageData(0, 0, 54, 54);
    applyFilterAlgorithm(thumbData, filter.id);
    thumbCtx.putImageData(thumbData, 0, 0);

    thumb.appendChild(thumbCanvas);

    const label = document.createElement("span");
    label.innerText = filter.label;
    thumb.appendChild(label);

    carousel.appendChild(thumb);
  });
}

async function runOcrOnCroppedImage(canvas) {
  if (!worker) return;
  const docContentTextarea = document.getElementById("docContent");
  if (docContentTextarea) {
    docContentTextarea.value = "AI Okuyor...";
  }
  try {
    const { data } = await worker.recognize(canvas);
    if (data && data.text && docContentTextarea) {
      docContentTextarea.value = data.text;
      speak("Döküman metni okundu.");
    } else if (docContentTextarea) {
      docContentTextarea.value = "";
    }
  } catch (err) {
    console.error("OCR on crop failed:", err);
    if (docContentTextarea) docContentTextarea.value = "";
  }
}

window.saveProcessedDoc = async function () {
  const canvas = document.getElementById("filterCanvas");
  if (!canvas) return;

  const docName =
    document.getElementById("docFileName").value.trim() || "Evrak";
  const docLocation =
    document.getElementById("docLocation").value.trim() || "Evrak Tarayıcı";
  const docContent = document.getElementById("docContent").value.trim() || "";

  if (typeof Swal !== "undefined") {
    Swal.fire({
      title: "Kaydediliyor...",
      text: "Evrak veritabanına ve buluta yükleniyor, lütfen bekleyin.",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
      background: "#060713",
      color: "#fff",
    });
  }

  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.9);
  let capturedPhoto = jpegDataUrl;

  try {
    const uploadedUrl = await uploadPhoto(jpegDataUrl, `scan_${Date.now()}`);
    if (uploadedUrl) {
      capturedPhoto = uploadedUrl;
    }
  } catch (e) {
    console.error("Storage upload failed, falling back to base64:", e);
  }

  try {
    const userEmail = window.currentUser
      ? window.currentUser.email || "mustafakartn58@gmail.com"
      : "mustafakartn58@gmail.com";

    const recordData = {
      name: docName,
      location: docLocation,
      content: docContent + "\n\n[owner:" + userEmail + "][type:scan]",
      photo_url: capturedPhoto,
    };

    const { error } = await window
      .getSupabase()
      .from("records")
      .insert([recordData]);
    if (error) throw error;

    window.addSystemLog(
      `'${docName}' isimli yeni taranan evrak eklendi (Konum: ${docLocation}).`,
    );

    if (typeof window.logUserActivity === "function") {
      window.logUserActivity("scan", {
        file_name: docName,
        location: docLocation,
        photo_url: capturedPhoto,
      });
    }

    await loadRecords();

    window.closeDocEditor();
    window.stopScanner();

    window.switchTab("registry");

    if (typeof Swal !== "undefined") {
      Swal.fire({
        title: "Kaydedildi!",
        text: "Evrak başarıyla Kayıt Defteri'ne eklendi.",
        icon: "success",
        background: "#060713",
        color: "#fff",
        confirmButtonColor: "#8b5cf6",
        timer: 2000,
        showConfirmButton: false,
      });
    }
  } catch (err) {
    console.error("Evrak kaydetme hatası:", err);
    if (typeof Swal !== "undefined") {
      Swal.fire({
        title: "Hata!",
        text: "Evrak veritabanına kaydedilemedi: " + err.message,
        icon: "error",
        background: "#060713",
        color: "#fff",
        confirmButtonColor: "#8b5cf6",
      });
    } else {
      alert("Evrak kaydedilemedi: " + err.message);
    }
  }
};

// Photo Capture Trigger
if (snapBtn) {
  snapBtn.addEventListener("click", () => {
    const addVideo = document.getElementById("add-video");
    if (!addVideo || !addStream) {
      Swal.fire({
        title: "Hata",
        text: "Kamera canlı yayını hazır değil!",
        icon: "error",
        background: "#060713",
        color: "#fff",
        confirmButtonColor: "#8b5cf6",
      });
      return;
    }

    window.autoCropImage(addVideo, (rawPhotoUrl) => {
      // Stop streaming and hide video tag
      stopAddCamera();

      // Save the raw captured photo in state
      lastCapturedPhoto = rawPhotoUrl;

      // Display preview image directly in Ekle screen
      if (previewArea) {
        previewArea.innerHTML = `
                    <img id="add-preview-img" src="${rawPhotoUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:16px; border:1px solid var(--glass-border);" />
                `;
        previewArea.classList.add("captured");
      }

      snapBtn.classList.add("hidden");
      if (retakeBtn) retakeBtn.classList.remove("hidden");
      if (saveFolderBtn) {
        saveFolderBtn.classList.remove("hidden");
        saveFolderBtn.style.display = "block"; // Make sure it's fully displayed
      }
      speak("Fotoğraf çekildi. Klasör bilgilerini girip kaydedebilirsiniz.");
    });
  });
}

if (retakeBtn) {
  retakeBtn.addEventListener("click", () => {
    lastCapturedPhoto = null;
    if (previewArea) {
      previewArea.classList.remove("captured");
      previewArea.innerHTML = `
                <video id="add-video" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover; border-radius:16px; background:#000;"></video>
                <div class="placeholder-icon hidden"><i data-lucide="camera"></i></div>
                <p class="hidden">Klasör fotoğrafı çekin</p>
            `;
    }

    if (snapBtn) snapBtn.classList.remove("hidden");
    retakeBtn.classList.add("hidden");
    if (saveFolderBtn) saveFolderBtn.classList.add("hidden");

    // Restart the Ekle camera feed
    startAddCamera();
  });
}

// Save Folder
if (saveFolderBtn) {
  saveFolderBtn.addEventListener("click", async () => {
    const name = document.getElementById("newFolderName").value.trim();
    const location = document.getElementById("newFolderLocation").value.trim();
    const content = document.getElementById("newFolderContent").value.trim();
    if (!name) {
      Swal.fire({
        title: "Eksik Bilgi",
        text: "Klasör ismi girmelisiniz.",
        icon: "warning",
        background: "#060713",
        color: "#fff",
        confirmButtonColor: "#8b5cf6",
      });
      return;
    }
    if (!supabase) {
      Swal.fire({
        title: "Hata",
        text: "Supabase bağlantısı henüz hazır değil.",
        icon: "error",
        background: "#060713",
        color: "#fff",
        confirmButtonColor: "#8b5cf6",
      });
      return;
    }
    saveFolderBtn.disabled = true;
    saveFolderBtn.innerText = "YÜKLENİYOR...";

    let photoUrl = null;
    if (lastCapturedPhoto) {
      photoUrl = await uploadPhoto(lastCapturedPhoto, `folder_${Date.now()}`);
    }

    try {
      const userEmail = window.currentUser
        ? window.currentUser.email || "mustafakartn58@gmail.com"
        : "mustafakartn58@gmail.com";

      const recordData = {
        name: name,
        location: location,
        content: content + "\n\n[owner:" + userEmail + "][type:folder]",
        photo_url: photoUrl || lastCapturedPhoto,
      };

      const { error } = await window
        .getSupabase()
        .from("records")
        .insert([recordData]);

      if (error) throw error;

      // Log this folder creation
      window.addSystemLog(
        `'${name}' isimli yeni bir klasör ekledi (Konum: ${location || "Belirtilmedi"}).`,
      );

      if (typeof window.logUserActivity === "function") {
        window.logUserActivity("archive", {
          file_name: name,
          location: location,
          photo_url: photoUrl || lastCapturedPhoto,
        });
      }

      await loadRecords(); // Refresh data

      // Reset fields
      document.getElementById("newFolderName").value = "";
      document.getElementById("newFolderLocation").value = "";
      document.getElementById("newFolderContent").value = "";

      if (previewArea) {
        previewArea.innerHTML = `
                    <video id="add-video" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover; border-radius:16px; background:#000;"></video>
                    <div class="placeholder-icon hidden"><i data-lucide="camera"></i></div>
                    <p class="hidden">Klasör fotoğrafı çekin</p>
                `;
        previewArea.classList.remove("captured");
      }

      lastCapturedPhoto = null;
      if (snapBtn) snapBtn.classList.remove("hidden");
      retakeBtn.classList.add("hidden");
      if (saveFolderBtn) {
        saveFolderBtn.classList.remove("hidden");
        saveFolderBtn.style.display = "block";
      }

      speak(`${name} klasörü buluta kaydedildi.`);
      window.switchTab("registry");
    } catch (e) {
      Swal.fire({
        title: "Hata",
        text: "Kayıt sırasında bir hata oluştu: " + e.message,
        icon: "error",
        background: "#060713",
        color: "#fff",
        confirmButtonColor: "#8b5cf6",
      });
    } finally {
      saveFolderBtn.disabled = false;
      saveFolderBtn.innerText = "KAYDET";
    }
  });
}

window.currentRegistryFilter = "all";
window.setRegistryFilter = function (filter) {
  window.currentRegistryFilter = filter;
  document.querySelectorAll(".registry-filters .filter-btn").forEach((btn) => {
    if (btn.dataset.filter === filter) btn.classList.add("active");
    else btn.classList.remove("active");
  });
  renderRegistry();
};

// Render Registry
function renderRegistry() {
  const list = document.getElementById("registryList");
  if (!list) return;

  let displayRecords = activeRecords;
  const userEmail = window.currentUser ? window.currentUser.email : null;

  if (window.currentRegistryFilter !== "sent") {
    displayRecords = activeRecords.filter(
      (r) => !r._owner || r._owner === userEmail,
    );
  }

  if (window.currentRegistryFilter === "scan") {
    displayRecords = displayRecords.filter((r) => r._type === "scan");
  } else if (window.currentRegistryFilter === "folder") {
    displayRecords = displayRecords.filter((r) => r._type === "folder");
  } else if (window.currentRegistryFilter === "favorites") {
    displayRecords = displayRecords.filter((r) => r._isFavorite === true);
  } else if (window.currentRegistryFilter === "received") {
    displayRecords = displayRecords.filter(
      (r) => r._sender && r._sender !== userEmail,
    );
  } else if (window.currentRegistryFilter === "sent") {
    // HATA DÜZELTİLDİ: Kullanıcı kendisine gönderirse de Gidenler'de görsün diye owner kısıtlamasını kaldırdık
    displayRecords = activeRecords.filter(
      (r) => r._sender === userEmail && r._isRead !== undefined,
    );
  }

  if (displayRecords.length === 0) {
    list.innerHTML = '<p class="empty-msg">Henüz kayıt bulunmuyor.</p>';
    return;
  }

  list.innerHTML = displayRecords
    .map((r) => {
      const isScan = r._type === "scan";
      const isExcel = r.photo_url && r.photo_url.includes("excel");
      const isPdf = r.photo_url && r.photo_url.includes("pdf");
      const hasImg = r.photo_url && !isExcel && !isPdf;
      const iconName = isExcel
        ? "file-spreadsheet"
        : isPdf
          ? "file-text"
          : isScan
            ? "scan"
            : "folder";

      let senderBadge = "";
      if (window.currentRegistryFilter === "sent") {
        const timeStr = new Date(r.created_at || Date.now()).toLocaleString(
          "tr-TR",
          {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "short",
          },
        );
        senderBadge = `<div style="display:inline-flex; align-items:center; gap:4px; margin-top:4px; background:rgba(14,165,233,0.15); border:1px solid rgba(14,165,233,0.3); color:#7dd3fc; font-size:10px; padding:2px 6px; border-radius:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;">
                <i data-lucide="send" style="width:10px; height:10px; flex-shrink:0;"></i>
                <span style="overflow:hidden; text-overflow:ellipsis;">Kime: ${r._owner}</span>
                <span style="opacity:0.6; margin-left:2px; flex-shrink:0;">(${timeStr})</span>
            </div>`;
      } else if (r._sender && r._owner === userEmail) {
        const timeStr = new Date(r.created_at || Date.now()).toLocaleString(
          "tr-TR",
          {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "short",
          },
        );
        senderBadge = `<div style="display:inline-flex; align-items:center; gap:4px; margin-top:4px; background:rgba(139,92,246,0.15); border:1px solid rgba(139,92,246,0.3); color:#c4b5fd; font-size:10px; padding:2px 6px; border-radius:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;">
                <i data-lucide="mail" style="width:10px; height:10px; flex-shrink:0;"></i>
                <span style="overflow:hidden; text-overflow:ellipsis;">Kimden: ${r._sender}</span>
                <span style="opacity:0.6; margin-left:2px; flex-shrink:0;">(${timeStr})</span>
            </div>`;
      }

      return `
        <div class="registry-item animate-in" data-record-id="${r.id}" style="cursor:pointer; ${r._sender && r._owner === userEmail && r._isRead === false ? "border: 1px solid rgba(239, 68, 68, 0.4);" : ""}">
            <div class="item-image-wrapper" style="position:relative; width:60px; height:60px; flex-shrink:0;">
                <img class="item-img" src="${hasImg ? r.photo_url : ""}" style="width:100%; height:100%; object-fit:cover; border-radius:12px; display:${hasImg ? "block" : "none"};" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="item-fallback-img" style="display:${hasImg ? "none" : "flex"}; width:100%; height:100%; justify-content:center; align-items:center; background:rgba(255,255,255,0.05); border-radius:12px;">
                    <i data-lucide="${iconName}"></i>
                </div>
            </div>
            <div class="item-info" style="flex:1; overflow:hidden;">
                <h4 style="font-size:15px; font-weight:800; color:#fff; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center;">
                    ${r._sender && r._owner === userEmail && r._isRead === false ? '<span style="display:inline-block; width:8px; height:8px; background:#ef4444; border-radius:50%; margin-right:6px; vertical-align:middle; box-shadow: 0 0 5px rgba(239,68,68,0.5);"></span>' : ""}
                    ${r._isFavorite ? '<i data-lucide="star" style="color:#eab308; fill:#eab308; width:16px; height:16px; margin-right:6px; flex-shrink:0;"></i>' : ""}
                    ${r.name}
                </h4>
                <p style="font-size:12px; color:var(--text-dim); margin-bottom:2px; display:flex; align-items:center; gap:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><i data-lucide="map-pin" style="width:12px; height:12px;"></i> ${r.location || "Konum Belirtilmedi"}</p>
                <p style="font-size:11px; opacity:0.7; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px;">${r.content ? r.content.substring(0, 30) : "Detay belirtilmedi"}</p>
                ${senderBadge}
            </div>
            <div style="position:relative;">
                <button class="options-btn" data-menu-id="${r.id}" title="Seçenekler">
                    <i data-lucide="more-vertical"></i>
                </button>
                <div id="item-menu-${r.id}" class="item-menu-dropdown hidden">
                    <ul>
                        <li data-action="edit" data-record-id="${r.id}"><i data-lucide="edit"></i> Düzenle (Detay & Konum)</li>
                        <li data-action="excel" data-record-id="${r.id}"><i data-lucide="file-spreadsheet"></i> Excel İndir</li>
                        <li data-action="pdf" data-record-id="${r.id}"><i data-lucide="file-text"></i> PDF İndir</li>
                        <li data-action="jpeg" data-record-id="${r.id}"><i data-lucide="image"></i> JPEG İndir</li>
                        <li data-action="favorite" data-record-id="${r.id}"><i data-lucide="star" style="color: ${r._isFavorite ? "#eab308" : "inherit"}; fill: ${r._isFavorite ? "#eab308" : "none"};"></i> ${r._isFavorite ? "Favorilerden Çıkar" : "Favorilere Ekle"}</li>
                        <li data-action="move" data-record-id="${r.id}"><i data-lucide="folder-output"></i> Başka Kategoriye Taşı</li>
                        <li data-action="sendemail" data-record-id="${r.id}"><i data-lucide="mail"></i> E-postaya Gönder</li>
                        <li class="danger" data-action="delete" data-record-id="${r.id}"><i data-lucide="trash-2"></i> Çöpe Taşı</li>
                    </ul>
                </div>
            </div>
        </div>
        `;
    })
    .join("");

  if (window.lucide) window.lucide.createIcons();

  // Her render sonrası event delegation kur
  addRegistryListeners(list);

  if (typeof window.populateShareSelect === "function") {
    window.populateShareSelect();
  }
}

// =====================================================
// KAYIT DEFTERİ DİREKT LISTENER (Ghost click %100 önleme)
// =====================================================
function addRegistryListeners(list) {
  // Önceki listener'ları temizle (clone trick)
  const newList = list.cloneNode(true);
  list.parentNode.replaceChild(newList, list);
  if (window.lucide) window.lucide.createIcons();

  // --- MENÜ LI'LARI ---
  newList.querySelectorAll("li[data-action]").forEach(function (li) {
    function execAction() {
      // Tıklamaları geçici olarak kilitle (800ms kalkan)
      window.blockRegistryClicks = true;
      setTimeout(function () {
        window.blockRegistryClicks = false;
      }, 800);

      const action = li.dataset.action;
      const recordId = parseInt(li.dataset.recordId);

      // Menü kapatmayı 200ms geciktiriyoruz. Bu sayede mobil cihazların
      // göndereceği gecikmeli sanal "click" menü elemanına çarpar ve
      // yandaki e.stopPropagation() sayesinde yok edilir, arkadaki karta geçemez!
      setTimeout(function () {
        window.closeAllItemMenus();
      }, 200);

      if (action === "edit") window.editRecordPrompt(recordId);
      if (action === "delete") window.deleteRecord(recordId);
      if (action === "excel") window.downloadRecordExcel(recordId);
      if (action === "pdf") window.downloadRecordPdf(recordId);
      if (action === "jpeg") window.downloadRecordJpeg(recordId);
      if (action === "sendemail") window.sendRecordByEmailPrompt(recordId);
      if (action === "favorite") window.toggleFavoriteRecord(recordId);
      if (action === "move") window.moveRecordPrompt(recordId);
    }

    // touchstart: ghost click'i tamamen öldür
    li.addEventListener(
      "touchstart",
      function (e) {
        e.stopPropagation();
        e.preventDefault();
      },
      { passive: false },
    );

    // touchend: aksiyonu tetikle (click yerine)
    li.addEventListener(
      "touchend",
      function (e) {
        e.stopPropagation();
        e.preventDefault();
        execAction();
      },
      { passive: false },
    );

    // click: masaüstü için
    li.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      execAction();
    });
  });

  // --- MENÜ DROPDOWN KENDİSİ ---
  newList.querySelectorAll(".item-menu-dropdown").forEach(function (menu) {
    menu.addEventListener(
      "touchstart",
      function (e) {
        e.stopPropagation();
        e.preventDefault();
      },
      { passive: false },
    );
    menu.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
    });
  });

  // --- 3 NOKTA BUTONU ---
  newList.querySelectorAll(".options-btn").forEach(function (btn) {
    function triggerToggle() {
      window.blockRegistryClicks = true;
      setTimeout(function () {
        window.blockRegistryClicks = false;
      }, 800);
      window.toggleItemMenu(btn.dataset.menuId);
    }

    btn.addEventListener(
      "touchstart",
      function (e) {
        e.stopPropagation();
        e.preventDefault();
        triggerToggle();
      },
      { passive: false },
    );

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      triggerToggle();
    });
  });

  // --- KAYIT KARTLARI (kart tıklama → detay) ---
  newList.querySelectorAll(".registry-item").forEach(function (card) {
    function handleCardClick(e) {
      if (window.blockRegistryClicks) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      // Çift güvenlik kontrolü: Eğer tıklanan hedef menü butonuna veya dropdown'a aitse durdur
      if (
        e.target.closest(".options-btn") ||
        e.target.closest(".item-menu-dropdown") ||
        e.target.closest("li[data-action]")
      ) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      const recordId = parseInt(card.dataset.recordId);
      if (!isNaN(recordId)) window.showRecordDetails(recordId);
    }

    card.addEventListener("click", handleCardClick);

    card.addEventListener(
      "touchend",
      function (e) {
        if (window.blockRegistryClicks) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      { passive: false },
    );
  });
}

// =====================================================
// KAYIT DEFTERİ MENÜ KONTROL FONKSİYONLARI
// =====================================================
window.closeAllItemMenus = function () {
  document.querySelectorAll(".item-menu-dropdown").forEach(function (menu) {
    menu.classList.add("hidden");
  });
  document.querySelectorAll(".registry-item").forEach(function (item) {
    item.style.pointerEvents = "";
  });
};

window.toggleItemMenu = function (id) {
  const menu = document.getElementById("item-menu-" + id);
  if (!menu) return;

  const isHidden = menu.classList.contains("hidden");
  window.closeAllItemMenus();

  if (isHidden) {
    menu.classList.remove("hidden");
    // Diğer kartlara pointer-events:none - ghost click engeli
    document.querySelectorAll(".registry-item").forEach(function (item) {
      item.style.pointerEvents = "none";
    });
    const parentItem = menu.closest(".registry-item");
    if (parentItem) parentItem.style.pointerEvents = "auto";

    // Dışına tıklanınca kapat
    const closeOnOutside = function (e) {
      if (!menu.contains(e.target) && !e.target.closest(".options-btn")) {
        window.closeAllItemMenus();
        document.removeEventListener("click", closeOnOutside);
        document.removeEventListener("touchend", closeOnOutside);
      }
    };
    setTimeout(function () {
      document.addEventListener("click", closeOnOutside);
      document.addEventListener("touchend", closeOnOutside);
    }, 50);
  }
};

// Detay Modalını Göster
window.showRecordDetails = function (id) {
  const record = records.find((r) => r.id === id);
  if (!record) return;

  document.getElementById("detail-img").src = record.photo_url || "logo.png";
  document.getElementById("detail-name").innerText =
    record.name || "İsimsiz Klasör";
  document.getElementById("detail-location").innerText =
    "📌 " + (record.location || "Konum Belirtilmedi");
  document.getElementById("detail-content").innerText =
    record.content || "Detay bulunmuyor.";
  document.getElementById("detail-date").innerText = new Date(
    record.created_at || Date.now(),
  ).toLocaleString("tr-TR");

  document.getElementById("recordDetailsModal").classList.remove("hidden");
};

// Global PDF İndirme Fonksiyonu
window.downloadRecordPdf = async function (id) {
  const record = records.find((r) => r.id === id);
  if (!record) return;

  if (record.photo_url && record.photo_url.includes("pdf")) {
    const link = document.createElement("a");
    link.href = record.photo_url;
    link.download = `${record.name || "kayit"}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  if (!window.jspdf) {
    if (typeof Swal !== "undefined")
      Swal.fire("Hata!", "PDF kütüphanesi yüklenemedi.", "error");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let startY = 20;

  if (record.photo_url && !record.photo_url.includes("excel")) {
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = record.photo_url;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const maxWidth = 170;
      const maxHeight = 120;
      let imgWidth = img.width;
      let imgHeight = img.height;
      const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);

      imgWidth = imgWidth * ratio;
      imgHeight = imgHeight * ratio;

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

      doc.addImage(dataUrl, "JPEG", 20, 20, imgWidth, imgHeight);
      startY = 20 + imgHeight + 10;
    } catch (e) {
      console.error("PDF'e resim eklenemedi:", e);
    }
  }
  doc.save(`${record.name || "kayit"}.pdf`);
};

// Global Excel İndirme Fonksiyonu
window.downloadRecordExcel = function (id) {
  const record = records.find((r) => r.id === id);
  if (!record) return;

  if (record.photo_url && record.photo_url.includes("excel")) {
    const link = document.createElement("a");
    link.href = record.photo_url;
    link.download = `${record.name || "kayit"}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }
  const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Evrak Detaylari">
  <Table>
   <Row>
    <Cell><Data ss:Type="String">Dosya Adi</Data></Cell>
    <Cell><Data ss:Type="String">Konum</Data></Cell>
    <Cell><Data ss:Type="String">Icerik (AI OCR)</Data></Cell>
    <Cell><Data ss:Type="String">Tarih</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">${record.name || ""}</Data></Cell>
    <Cell><Data ss:Type="String">${record.location || ""}</Data></Cell>
    <Cell><Data ss:Type="String">${record.content || ""}</Data></Cell>
    <Cell><Data ss:Type="String">${new Date(record.created_at || Date.now()).toLocaleString("tr-TR")}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;
  const base64Xml = btoa(unescape(encodeURIComponent(xmlContent)));
  const link = document.createElement("a");
  link.setAttribute(
    "href",
    "data:application/vnd.ms-excel;base64," + base64Xml,
  );
  link.setAttribute("download", `${record.name || "kayit"}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Global JPEG İndirme Fonksiyonu
window.downloadRecordJpeg = function (id) {
  const record = records.find((r) => r.id === id);
  if (!record) return;
  if (!record.photo_url) {
    Swal.fire("Hata!", "Bu kayda ait fotoğraf bulunamadı.", "error");
    return;
  }
  const link = document.createElement("a");
  link.href = record.photo_url;
  link.download = `${record.name || "kayit"}.jpg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Global Telefona Kaydet (Paylaş / Kaydet) Fonksiyonu
window.saveRecordToPhone = function (id) {
  const record = records.find((r) => r.id === id);
  if (!record) return;

  if (navigator.share) {
    navigator
      .share({
        title: record.name || "ArşivX Evrak",
        text: `Klasör: ${record.name}\nKonum: ${record.location}\nİçerik: ${record.content}`,
        url: record.photo_url || window.location.href,
      })
      .then(() => {
        Swal.fire("Başarılı!", "Cihaz paylaşım menüsü açıldı.", "success");
      })
      .catch((err) => {
        console.log("Paylaşım hatası:", err);
        fallbackSave(record);
      });
  } else {
    fallbackSave(record);
  }

  function fallbackSave(rec) {
    if (rec.photo_url) {
      const link = document.createElement("a");
      link.href = rec.photo_url;
      link.download = `${rec.name || "kayit"}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      Swal.fire("Başarılı!", "Fotoğraf indirildi.", "success");
    } else {
      Swal.fire("Başarılı!", "Klasör detayları panoya kopyalandı.", "success");
      navigator.clipboard.writeText(
        `Klasör: ${rec.name}\nKonum: ${rec.location}\nİçerik: ${rec.content}`,
      );
    }
  }
};

// Soft Delete (Move to Trash)
window.deleteRecord = async function (id) {
  const confirmed =
    typeof Swal !== "undefined"
      ? (
          await Swal.fire({
            title: "Çöpe Taşı?",
            text: "Bu kayıt çöp kutusuna taşınacaktır.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Evet, Taşı",
            cancelButtonText: "İİptal",
          })
        ).isConfirmed
      : confirm("Bu kaydı çöp kutusuna taşımak istediğinize emin misiniz?");

  if (confirmed) {
    try {
      const record = records.find((r) => r.id === id);
      const { error } = await window
        .getSupabase()
        .from("records")
        .update({ is_deleted: true })
        .eq("id", id);
      if (error) {
        if (
          error.message.includes(
            'column "is_deleted" of relation "records" does not exist',
          )
        ) {
          if (typeof Swal !== "undefined")
            Swal.fire(
              "Hata!",
              'Çöp Kutusu özelliği için Supabase veritabanında "is_deleted" sütunu eksik! SQL komutunu çalıştırın.',
              "error",
            );
          else
            alert(
              "Çöp Kutusu özelliği için Supabase veritabanında 'is_deleted' sütunu eksik! Lütfen SQL kodunu çalıştırın.",
            );
        } else {
          throw error;
        }
      } else {
        if (record) {
          window.addSystemLog(
            `'${record.name}' klasörünü çöp kutusuna taşıdı.`,
          );
        }
        if (typeof Swal !== "undefined")
          Swal.fire({
            title: "Taşındı!",
            text: "Kayıt çöp kutusuna taşındı.",
            icon: "success",
            timer: 1500,
            showConfirmButton: false,
          });
        await loadRecords();
      }
    } catch (e) {
      if (typeof Swal !== "undefined")
        Swal.fire("Hata!", "Silme hatası: " + e.message, "error");
      else alert("Silme hatası: " + e.message);
    }
  }
};

// Çöp Kutusu Render
window.renderTrash = function () {
  const list = document.getElementById("trashList");
  if (!list) return;

  if (trashRecords.length === 0) {
    list.innerHTML = '<p class="empty-msg">Çöp kutusu boş.</p>';
    return;
  }

  list.innerHTML = trashRecords
    .map(
      (r) => `
        <div class="registry-item animate-in">
            <img class="item-img" src="${r.photo_url || "https://via.placeholder.com/60"}" style="filter: grayscale(100%); opacity: 0.7;">
            <div class="item-info" style="opacity: 0.8;">
                <h4 style="text-decoration: line-through;">${r.name}</h4>
                <p>📌 ${r.location || "Konum Belirtilmedi"}</p>
                <small>${new Date(r.created_at || Date.now()).toLocaleDateString("tr-TR")}</small>
            </div>
            <div class="item-actions" style="display:flex; flex-direction:column; gap:6px;">
                <button onclick="window.restoreRecord(${r.id})" class="btn-primary" style="font-size:10px; padding:4px 8px; border-radius:4px;"><i data-lucide="refresh-cw" style="width:12px; height:12px;"></i> GERİ AL</button>
                <button onclick="window.permanentlyDeleteRecord(${r.id})" class="danger-btn" style="font-size:10px; padding:4px 8px; border-radius:4px;"><i data-lucide="trash" style="width:12px; height:12px;"></i> TAMAMEN SİL</button>
            </div>
        </div>
    `,
    )
    .join("");
  if (window.lucide) window.lucide.createIcons();
};

window.restoreRecord = async function (id) {
  try {
    const record = records.find((r) => r.id === id);
    const { error } = await window
      .getSupabase()
      .from("records")
      .update({ is_deleted: false })
      .eq("id", id);
    if (error) throw error;
    if (record) {
      window.addSystemLog(
        `'${record.name}' klasörünü çöp kutusundan geri yükledi.`,
      );
    }
    if (typeof Swal !== "undefined")
      Swal.fire({
        title: "Geri Yüklendi!",
        text: "Kayıt deftere geri alındı.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    await loadRecords();
  } catch (e) {
    if (typeof Swal !== "undefined")
      Swal.fire("Hata!", "Geri yükleme hatası: " + e.message, "error");
    else alert("Geri yükleme hatası: " + e.message);
  }
};

window.permanentlyDeleteRecord = async function (id) {
  const confirmed =
    typeof Swal !== "undefined"
      ? (
          await Swal.fire({
            title: "Kalıcı Olarak Silinsin Mi?",
            text: "Bu işlemin geri dönüşü YOKTUR!",
            icon: "error",
            showCancelButton: true,
            confirmButtonText: "Evet, SİL",
            cancelButtonText: "İİptal",
            confirmButtonColor: "#d33",
          })
        ).isConfirmed
      : confirm(
          "Bu kayıt kalıcı olarak SİLİNECEK! Geri dönüşü yoktur. Emin misiniz?",
        );

  if (confirmed) {
    try {
      const record = records.find((r) => r.id === id);
      const { error } = await window
        .getSupabase()
        .from("records")
        .delete()
        .eq("id", id);
      if (error) throw error;
      if (record) {
        window.addSystemLog(`'${record.name}' klasörünü kalıcı olarak sildi.`);
      }
      if (typeof Swal !== "undefined")
        Swal.fire({
          title: "Silindi!",
          text: "Kayıt kalıcı olarak silindi.",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      await loadRecords();
    } catch (e) {
      if (typeof Swal !== "undefined")
        Swal.fire("Hata!", "Kalıcı silme hatası: " + e.message, "error");
      else alert("Kalıcı silme hatası: " + e.message);
    }
  }
};

window.emptyTrash = async function () {
  if (trashRecords.length === 0) return;

  const confirmed =
    typeof Swal !== "undefined"
      ? (
          await Swal.fire({
            title: "Çöp Kutusunu Temizle?",
            text: "Tüm kayıtlar kalıcı olarak silinecek. Onaylıyor musunuz?",
            icon: "error",
            showCancelButton: true,
            confirmButtonText: "Evet, Temizle",
            cancelButtonText: "İİptal",
            confirmButtonColor: "#d33",
          })
        ).isConfirmed
      : confirm(
          "Çöp kutusundaki TÜM kayıtlar kalıcı olarak silinecek! Onaylıyor musunuz?",
        );

  if (confirmed) {
    try {
      const idsToDelete = trashRecords.map((r) => r.id);
      if (idsToDelete.length === 0) return;
      const { error } = await window
        .getSupabase()
        .from("records")
        .delete()
        .in("id", idsToDelete);
      if (error) throw error;
      if (typeof Swal !== "undefined")
        Swal.fire({
          title: "Temizlendi!",
          text: "Çöp kutusu tamamen boşaltıldı.",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      await loadRecords();
    } catch (e) {
      if (typeof Swal !== "undefined")
        Swal.fire("Hata!", "Toplu silme hatası: " + e.message, "error");
      else alert("Toplu silme hatası: " + e.message);
    }
  }
};

let worker = null;
let isScanning = false;
let stream = null;
let lastFrameTime = 0;
let frameCount = 0;

// AI Voice Utility
const speak = (text) => {
  // Sesli asistan tamamen devre dışıışı bırakıldı
  console.log("[AI Ses Rehberliği Pasif]:", text);
};

// Initialize AI Engine
async function initAI() {
  try {
    aiMessage.innerText = "Yapay zeka modülleri hazırlanıyor (Tesseract)...";
    worker = await Tesseract.createWorker("tur+eng", 1, {
      logger: (m) => {
        if (m.status === "loading tesseract core")
          aiMessage.innerText = "Sistem Çekirdeği Yükleniyor...";
        if (m.status === "loading language traineddata")
          aiMessage.innerText = "Dil Paketleri İndiriliyor...";
        if (m.status === "initializing api")
          aiMessage.innerText = "AI API Başlatılıyor...";
      },
    });
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: "6",
      tessjs_create_pdf: "0",
    });
    aiMessage.innerText = "Sistem çevrimiçi. ArşivX taramaya hazır.";
    document.getElementById("connectionStatus").classList.add("online");
    speak("Sistem çevrimiçi. Aramak istediğiniz klasör ismini girişniz.");
  } catch (err) {
    aiMessage.innerText = "HATA: AI Motoru Başlatılamadı. Sayfayı yenileyin.";
    console.error(err);
  }
}

initAI();

// Yüksek hızlı canlı belge kenarı tespiti (CamScanner tarzı)
window.detectDocumentEdges = function (videoEl) {
  if (!videoEl || !videoEl.videoWidth || videoEl.paused || videoEl.ended)
    return null;

  const tw = 160;
  const th = 160;

  if (!window.edgeDetectCanvas) {
    window.edgeDetectCanvas = document.createElement("canvas");
    window.edgeDetectCanvas.width = tw;
    window.edgeDetectCanvas.height = th;
  }
  const tempCanvas = window.edgeDetectCanvas;
  const tempCtx = tempCanvas.getContext("2d");

  // Kameradan kareyi 160x160 piksele ölçeklendirerek çiz
  tempCtx.drawImage(videoEl, 0, 0, tw, th);

  let imgData;
  try {
    imgData = tempCtx.getImageData(0, 0, tw, th);
  } catch (e) {
    return null; // Güvenlik kısıtlaması durumunda
  }

  const d = imgData.data;
  const gray = new Uint8Array(tw * th);
  let maxL = 0;
  let minL = 255;

  // Gri tonlama ve min/max parlaklık hesabı
  for (let i = 0; i < d.length; i += 4) {
    const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    gray[i / 4] = L;
    if (L > maxL) maxL = L;
    if (L < minL) minL = L;
  }

  // Düşük kontrast durumunda belge yok sayılır
  if (maxL - minL < 45) {
    return null;
  }

  // Adaptif eşik katsayısı
  const threshold = minL + (maxL - minL) * 0.38;

  let tl = { x: tw, y: th, val: tw + th };
  let tr = { x: 0, y: th, val: -th };
  let br = { x: 0, y: 0, val: 0 };
  let bl = { x: tw, y: 0, val: tw };

  let found = false;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const idx = y * tw + x;
      if (gray[idx] >= threshold) {
        found = true;
        const sum = x + y;
        const diff = x - y;

        if (sum < tl.val) {
          tl.x = x;
          tl.y = y;
          tl.val = sum;
        }
        if (diff > tr.val) {
          tr.x = x;
          tr.y = y;
          tr.val = diff;
        }
        if (sum > br.val) {
          br.x = x;
          br.y = y;
          br.val = sum;
        }
        if (diff < bl.val) {
          bl.x = x;
          bl.y = y;
          bl.val = diff;
        }
      }
    }
  }

  if (!found) return null;

  // Çok küçük veya hatalı alanları temizle (Boyut kontrolü)
  const minX = Math.min(tl.x, bl.x);
  const maxX = Math.max(tr.x, br.x);
  const minY = Math.min(tl.y, tr.y);
  const maxY = Math.max(bl.y, br.y);
  const wSpan = maxX - minX;
  const hSpan = maxY - minY;

  if (wSpan < tw * 0.25 || hSpan < th * 0.25) {
    return null;
  }

  // 0-1 aralığında normalize edilmiş 4 köşe döndür
  return [
    { x: tl.x / tw, y: tl.y / th },
    { x: tr.x / tw, y: tr.y / th },
    { x: br.x / tw, y: br.y / th },
    { x: bl.x / tw, y: bl.y / th },
  ];
};

// Main Search / Scanner Startup
window.startScanner = async function () {
  const video = document.getElementById("scanner");
  const canvas = document.getElementById("arOverlay");
  if (!video) return;

  try {
    if (stream) {
      window.stopScanner();
    }
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 4096 },
        height: { ideal: 2160 },
      },
    });
    window.localMediaStream = stream; // Keep reference for torch controls
    video.srcObject = stream;

    video.onloadedmetadata = () => {
      if (typeof window.startLiveDocumentHighlight === "function") {
        window.startLiveDocumentHighlight(video, canvas);
      }
      if (canvas) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      isScanning = true;
      document.getElementById("app").classList.add("scanning");

      if (actionBtn) actionBtn.innerText = "TARAMAYI DURDUR";

      const archiveBtn = document.getElementById("archiveDocBtn");
      if (archiveBtn) archiveBtn.classList.remove("hidden");

      const modeLabel = document.getElementById("scan-mode-label");
      if (modeLabel && modeLabel.innerText.trim() === "Otomatik") {
        window.runAutoCaptureCountdown();
      } else {
        if (aiMessage)
          aiMessage.innerText =
            "Manuel çekim modu aktif. Hazır olduğunuzda deklanşöre basın.";
      }
      processLoop();
    };
  } catch (err) {
    if (aiMessage) aiMessage.innerText = "Kamera erişim hatası!";
    console.error(err);
  }
};

window.stopScanner = function () {
  isScanning = false;
  document.getElementById("app").classList.remove("scanning");

  if (actionBtn) actionBtn.innerText = "TARAMAYI BAŞLAT";

  const archiveBtn = document.getElementById("archiveDocBtn");
  if (archiveBtn) archiveBtn.classList.add("hidden");

  if (window.autoCaptureTimer) clearTimeout(window.autoCaptureTimer);
  if (window.autoCaptureInterval) clearInterval(window.autoCaptureInterval);

  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  const video = document.getElementById("scanner");
  if (video) video.srcObject = null;

  const canvas = document.getElementById("arOverlay");
  if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (aiMessage) aiMessage.innerText = "Tarama durduruldu.";
};

if (actionBtn) {
  actionBtn.addEventListener("click", () => {
    if (isScanning) {
      window.stopScanner();
    } else {
      window.startScanner();
    }
  });
}

window.drawDocPolygon = function (corners) {
  if (!ctx || !canvas || !corners) return;
  ctx.save();
  ctx.strokeStyle = getThemeColor(); // Tema rengi (CamScanner yeşil / OpenScan turuncu)
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.shadowColor = getThemeGlow();
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.moveTo(corners[0].x * canvas.width, corners[0].y * canvas.height);
  for (let i = 1; i < 4; i++) {
    ctx.lineTo(corners[i].x * canvas.width, corners[i].y * canvas.height);
  }
  ctx.closePath();
  ctx.stroke();

  // Köşelere beyaz yuvarlaklar çiz
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = getThemeColor();
  ctx.lineWidth = 2.5;
  ctx.shadowBlur = 4;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(
      corners[i].x * canvas.width,
      corners[i].y * canvas.height,
      7,
      0,
      2 * Math.PI,
    );
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
};

async function processLoop() {
  if (!isScanning) return;

  const startTime = performance.now();
  const target = targetInput.value.trim().toLowerCase();

  const cw = video.videoWidth;
  const ch = video.videoHeight;
  if (!cw || !ch) {
    if (isScanning) setTimeout(processLoop, 200);
    return;
  }

  // 1. Canlı Belge Kenarı Tespiti ve Stabilite Kontrolü
  const corners = window.detectDocumentEdges(video);

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    window.drawDocPolygon(corners);
  }

  const modeLabel = document.getElementById("scan-mode-label");
  const isAutoMode = modeLabel && modeLabel.innerText.trim() === "Otomatik";

  if (corners) {
    if (isAutoMode) {
      if (!window.lastDetectedCorners) {
        window.lastDetectedCorners = corners;
        window.stableFramesCount = 0;
      } else {
        let isStable = true;
        for (let i = 0; i < 4; i++) {
          const dx = Math.abs(corners[i].x - window.lastDetectedCorners[i].x);
          const dy = Math.abs(corners[i].y - window.lastDetectedCorners[i].y);
          if (dx > 0.035 || dy > 0.035) {
            // Oynama toleransı
            isStable = false;
            break;
          }
        }

        if (isStable) {
          window.stableFramesCount++;
          const remaining = Math.max(
            1,
            3 - Math.floor(window.stableFramesCount / 2),
          );
          if (aiMessage)
            aiMessage.innerText = `Belge algılandı! Sabit tutun... (${remaining})`;

          if (window.stableFramesCount >= 6) {
            // ~1.2 saniye stabil kalındı
            window.stableFramesCount = 0;
            window.lastDetectedCorners = null;
            if (aiMessage) aiMessage.innerText = "Fotoğraf Çekiliyor...";
            speak("Çekiliyor");
            window.takeDocPhoto();
            return; // Kamerayı durdur ve döngüden çık
          }
        } else {
          window.stableFramesCount = 0;
          window.lastDetectedCorners = corners;
          if (aiMessage) aiMessage.innerText = "Belge algılandı. Sabit tutun.";
        }
      }
    } else {
      if (aiMessage) aiMessage.innerText = "Belge algılandı. Deklanşöre basın.";
    }
  } else {
    window.stableFramesCount = 0;
    window.lastDetectedCorners = null;
    if (isAutoMode) {
      if (aiMessage) aiMessage.innerText = "Otomatik Mod: Bir belge hizalayın.";
    } else {
      if (aiMessage)
        aiMessage.innerText = "Manuel Mod: Hazır olduğunuzda çekin.";
    }
  }

  // 2. QR TARAMA MANTIĞI (FULL FRAME)
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = cw;
  tempCanvas.height = ch;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(video, 0, 0, cw, ch);

  const imageData = tempCtx.getImageData(0, 0, cw, ch);
  const code = jsQR(imageData.data, imageData.width, imageData.height);

  if (code && code.data.startsWith("arsivx_id:")) {
    const foundId = code.data.split(":")[1];
    handleFoundRecord(foundId);
  }

  // 3. OCR TARAMA MANTIĞI (ROI)
  const roiWidth = cw * 0.8;
  const roiHeight = ch * 0.4;
  const roiX = (cw - roiWidth) / 2;
  const roiY = (ch - roiHeight) / 2;

  const ocrCanvas = document.createElement("canvas");
  ocrCanvas.width = roiWidth;
  ocrCanvas.height = roiHeight;
  const ocrCtx = ocrCanvas.getContext("2d");
  ocrCtx.drawImage(
    video,
    roiX,
    roiY,
    roiWidth,
    roiHeight,
    0,
    0,
    roiWidth,
    roiHeight,
  );

  try {
    if (!worker) {
      // Tesseract worker is still initializing in the background, skip OCR for this frame
      if (isScanning) {
        setTimeout(processLoop, 200);
      }
      return;
    }
    const { data } = await worker.recognize(ocrCanvas);

    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      window.drawDocPolygon(corners); // Belge yeşil çerçevesini çizmeye devam et
    }

    // Okunan canlı OCR metnini ata
    if (data && data.text) {
      const liveTextarea = document.getElementById("scannerLiveText");
      if (liveTextarea) liveTextarea.value = data.text.trim();
    }

    let found = false;
    let bestMatch = "";

    if (data.words) {
      data.words.forEach((word) => {
        const text = word.text.toLowerCase();
        const confidence = word.confidence;

        // Hedef arama kelimesiyle eşleşme kontrolü
        if (text.includes(target)) {
          found = true;
          bestMatch = word.text;
          confVal.innerText = Math.round(confidence) + "%";

          const bbox = word.bbox;
          const rx = bbox.x0 + roiX;
          const ry = bbox.y0 + roiY;
          const rw = bbox.x1 - bbox.x0;
          const rh = bbox.y1 - bbox.y0;

          if (ctx) {
            ctx.save();
            ctx.strokeStyle = "#00f2ff";
            ctx.lineWidth = 4;
            ctx.strokeRect(rx - 5, ry - 5, rw + 10, rh + 10);

            ctx.fillStyle = "#00f2ff";
            ctx.font = "bold 24px Outfit";
            ctx.fillText(word.text, rx, ry - 15);

            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(cw / 2, ch / 2);
            ctx.strokeStyle = "rgba(0, 242, 255, 0.2)";
            ctx.stroke();
            ctx.restore();
          }
        }
      });
    }

    if (found) {
      if (aiMessage) aiMessage.innerText = `HEDEF TESPİT EDİLDİ: ${bestMatch}`;
      speak(`Hedef bulundu. ${bestMatch} klasörü burada.`);
      setTimeout(() => {
        if (isScanning) processLoop();
      }, 1500);
      return;
    }
  } catch (e) {
    console.error(e);
  }

  if (isScanning) {
    setTimeout(processLoop, 200);
  }
}

async function handleFoundRecord(id) {
  if (document.querySelector(".ar-result-card")) return;

  const record = records.find((r) => r.id == id);
  if (!record) return;

  const card = document.createElement("div");
  card.className = "ar-result-card animate__animated animate__backInUp";
  card.innerHTML = `
        <img src="${record.photo_url || "https://via.placeholder.com/60"}">
        <div class="ar-result-info">
            <h3>${record.name}</h3>
            <p>📌 ${record.location || "Konum Belirtilmedi"}</p>
            <p>${record.content ? record.content.substring(0, 40) + "..." : ""}</p>
        </div>
    `;
  document.getElementById("app").appendChild(card);
  speak(
    `${record.name} klasörü bulundu. Konumu: ${record.location || "belirtilmemiş"}`,
  );

  setTimeout(() => {
    card.classList.replace("animate__backInUp", "animate__backOutDown");
    setTimeout(() => card.remove(), 1000);
  }, 5000);
}

// Theme Toggle Logic (Karanlık / Aydınlık Mod)
document.addEventListener("change", (e) => {
  if (e.target && e.target.id === "setting-theme") {
    const isDark = e.target.checked;
    if (isDark) {
      document.body.classList.remove("light-theme");
      console.log("[Tema] Karanlık Mod aktif.");
      speak("Karanlık tema aktif edildi.");
    } else {
      document.body.classList.add("light-theme");
      console.log("[Tema] Aydınlık Mod aktif.");
      speak("Aydınlık tema aktif edildi.");
    }
  }
});

// Initialize settings on load
setTimeout(() => {
  const themeCheckbox = document.getElementById("setting-theme");
  if (themeCheckbox && !themeCheckbox.checked) {
    document.body.classList.add("light-theme");
  }
}, 500);

// SOL ANIMASYONLU MENÜ TOGGLE
window.toggleMenu = function (open) {
  const sidebar = document.getElementById("sidebarMenu");
  const backdrop = document.getElementById("menu-backdrop");
  if (sidebar) {
    if (open) {
      sidebar.classList.add("open");
      if (backdrop) backdrop.classList.remove("hidden");
    } else {
      sidebar.classList.remove("open");
      if (backdrop) backdrop.classList.add("hidden");
    }
  }
};

// --- TURKISH NUMBER TO WORDS CONVERTER ---
function numberToTurkishWords(numStr) {
  const num = parseInt(numStr, 10);
  if (isNaN(num)) return numStr;
  if (num === 0) return "sıfır";

  const birler = [
    "",
    "bir",
    "iki",
    "üç",
    "dört",
    "beş",
    "altı",
    "yedi",
    "sekiz",
    "dokuz",
  ];
  const onlar = [
    "",
    "on",
    "yirmi",
    "otuz",
    "kırk",
    "elli",
    "altmış",
    "yetmiş",
    "seksen",
    "doksan",
  ];
  const yuzler = [
    "",
    "yüz",
    "iki yüz",
    "üç yüz",
    "dört yüz",
    "beş yüz",
    "altı yüz",
    "yedi yüz",
    "sekiz yüz",
    "dokuz yüz",
  ];

  let words = [];
  let temp = Math.abs(num);

  const groups = [];
  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const groupNames = ["", "bin", "milyon", "milyar"];

  for (let i = groups.length - 1; i >= 0; i--) {
    let g = groups[i];
    if (g === 0) continue;

    let gWords = [];
    let h = Math.floor(g / 100);
    let t = Math.floor((g % 100) / 10);
    let o = g % 10;

    if (h > 0) {
      gWords.push(yuzler[h]);
    }
    if (t > 0) {
      gWords.push(onlar[t]);
    }
    if (o > 0) {
      if (i === 1 && g === 1) {
        // skip "bir" for standalone thousand (just "bin")
      } else {
        gWords.push(birler[o]);
      }
    }

    if (gWords.length > 0) {
      words.push(...gWords);
      if (groupNames[i]) {
        words.push(groupNames[i]);
      }
    }
  }

  if (num < 0) {
    words.unshift("eksi");
  }

  return words.join(" ");
}

function convertDigitsInText(text) {
  return text.replace(/\d+/g, (match) => {
    return numberToTurkishWords(match);
  });
}

// SESLİ YAZMA VE SPEECH-TO-TEXT ENTEGRASYONU
window.startVoiceInput = function (inputId) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert(
      "Tarayıcınız ses tanıma teknolojisini (Web Speech API) desteklemiyor.",
    );
    return;
  }

  const micBtn =
    document.getElementById("mic-" + inputId) ||
    document.getElementById(inputId + "MicBtn");
  if (!micBtn) return;

  // Stop any active recognition to prevent device lock/conflicts
  if (window.activeRecognition) {
    try {
      window.activeRecognition.abort();
    } catch (e) {
      console.error("Önceki ses tanıma abort hatası:", e);
    }
    window.activeRecognition = null;
  }

  if (micBtn.classList.contains("listening")) {
    micBtn.classList.remove("listening");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "tr-TR";
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let initialValue = "";

  recognition.onstart = function () {
    micBtn.classList.add("listening");
    window.activeRecognition = recognition;
    const targetInput = document.getElementById(inputId);
    if (targetInput) initialValue = targetInput.value.trim();
    console.log("[Ses Tanıma Başladı] Dinleniyor...");
  };

  recognition.onresult = function (event) {
    let finalTranscript = "";
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    const targetInput = document.getElementById(inputId);
    if (
      targetInput &&
      (targetInput.tagName === "TEXTAREA" || targetInput.type === "text")
    ) {
      const separator = initialValue ? " " : "";
      let currentTranscript = finalTranscript || interimTranscript;

      // Convert any numeric characters to Turkish word equivalents
      currentTranscript = convertDigitsInText(currentTranscript);

      targetInput.value = initialValue + separator + currentTranscript.trim();

      if (inputId === "homeSearchInput") {
        window.filterHomeSearch();
      }
    }
  };

  recognition.onerror = function (event) {
    console.error("[Ses Tanıma Hatası]", event.error);
    micBtn.classList.remove("listening");
  };

  recognition.onend = function () {
    micBtn.classList.remove("listening");
    window.activeRecognition = null;
    console.log("[Ses Tanıma Bitti]");
  };

  recognition.start();
};

// ANASAYFA FILTRELI ARAMA MOTORU (Real-time Speech + Content Search)
window.filterHomeSearch = function () {
  const query = document
    .getElementById("homeSearchInput")
    .value.trim()
    .toLowerCase();
  const resultsBox = document.getElementById("homeSearchResults");
  if (!resultsBox) return;

  if (!query) {
    resultsBox.classList.add("hidden");
    resultsBox.innerHTML = "";
    return;
  }

  // Filter by name OR details/details list
  const filtered = activeRecords.filter((r) => {
    const nameMatch = r.name && r.name.toLowerCase().includes(query);
    const contentMatch = r.content && r.content.toLowerCase().includes(query);
    return nameMatch || contentMatch;
  });

  if (filtered.length === 0) {
    resultsBox.innerHTML = `<div class="search-empty-msg">Aranan klasör veya içerik bulunamadı.</div>`;
  } else {
    resultsBox.innerHTML = filtered
      .map(
        (r) => `
            <div class="search-result-item" onclick="window.showSearchResultDetails(${r.id})">
                <img class="search-result-img" src="${r.photo_url || "logo.png"}">
                <div class="search-result-info">
                    <div class="search-result-title">${r.name}</div>
                    <div class="search-result-desc">📌 ${r.location || "Konum Belirtilmedi"} | ${r.content ? r.content.substring(0, 45) + "..." : "Detay belirtilmemiş"}</div>
                </div>
            </div>
        `,
      )
      .join("");
  }
  resultsBox.classList.remove("hidden");
};

window.showSearchResultDetails = function (recordId) {
  const record = records.find((r) => r.id === recordId);
  if (record) {
    window.switchTab("registry");
    document.getElementById("homeSearchResults").classList.add("hidden");
    document.getElementById("homeSearchInput").value = "";

    setTimeout(() => {
      const items = document.querySelectorAll(".registry-item");
      items.forEach((item) => {
        if (item.innerHTML.includes(`showQR(${record.id}`)) {
          item.scrollIntoView({ behavior: "smooth", block: "center" });
          item.style.border = "2px solid var(--accent)";
          item.style.boxShadow = "0 0 20px rgba(139, 92, 246, 0.4)";
          setTimeout(() => {
            item.style.border = "1px solid var(--glass-border)";
            item.style.boxShadow = "none";
          }, 4000);
        }
      });
    }, 300);
  }
};

// EVRAK TARA VE ARŞİFLE KAYDET BUTONU ENTEGRASYONU
document.addEventListener("DOMContentLoaded", () => {
  const archiveBtn = document.getElementById("archiveDocBtn");
  if (archiveBtn) {
    archiveBtn.addEventListener("click", async () => {
      const ocrText = document.getElementById("scannerLiveText").value.trim();
      if (!ocrText) {
        alert(
          "Canlı taranan veya okunan bir metin bulunamadı. Lütfen kamerayı evrakın üstünde netleştirin!",
        );
        return;
      }

      archiveBtn.disabled = true;
      archiveBtn.innerHTML =
        '<i data-lucide="loader" class="animate-spin"></i> KAYDEDİLİYOR...';
      if (window.lucide) window.lucide.createIcons();
      let photoUrl = null;
      if (video && stream) {
        try {
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = video.videoWidth || 640;
          tempCanvas.height = video.videoHeight || 480;
          tempCanvas.getContext("2d").drawImage(video, 0, 0);
          const jpegDataUrl = tempCanvas.toDataURL("image/jpeg", 0.95);

          archiveBtn.innerHTML = '<i data-lucide="archive"></i> EVRAKI ARŞİVLE';
          archiveBtn.disabled = false;
          if (window.lucide) window.lucide.createIcons();

          window.stopScanner();

          if (typeof window.detectDocumentCornersFromImage === "function") {
            if (
              window.lastDetectedLivePoints &&
              Date.now() - window.lastDetectedLivePoints.timestamp < 3000
            ) {
              console.log(
                "[ArşivX AI] Canlı yayından alınan noktalar kullanılıyor.",
              );
              window.openDocEditor(
                jpegDataUrl,
                window.lastDetectedLivePoints.points,
              );
            } else {
              window.detectDocumentCornersFromImage(tempCanvas, (points) => {
                window.openDocEditor(jpegDataUrl, points);
              });
            }
          } else {
            window.openDocEditor(jpegDataUrl);
          }
        } catch (e) {
          console.error("[Scanner Capture Error]", e);
          archiveBtn.innerHTML = '<i data-lucide="archive"></i> EVRAKI ARŞİVLE';
          archiveBtn.disabled = false;
          if (window.lucide) window.lucide.createIcons();
        }
      } else {
        alert("Kamera açılmadı veya erişilemiyor.");
        archiveBtn.innerHTML = '<i data-lucide="archive"></i> EVRAKI ARŞİVLE';
        archiveBtn.disabled = false;
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }
});

// Advanced Document Scanner Logic
window.takeDocPhoto = function () {
  const video = document.getElementById("scanner");
  if (!video || !video.videoWidth) {
    if (typeof Swal !== "undefined") {
      Swal.fire({
        title: "Uyarı",
        text: "Kamera henüz hazır değil.",
        icon: "warning",
        background: "#060713",
        color: "#fff",
        confirmButtonColor: "#8b5cf6",
      });
    }
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const rawPhotoUrl = canvas.toDataURL("image/jpeg", 0.95);

  // Stop scanner video
  if (typeof window.stopScanner === "function") {
    window.stopScanner();
  }

  // Open professional document editor modal directly!
  if (typeof window.openDocEditor === "function") {
    window.openDocEditor(rawPhotoUrl);
  }
};

window.cancelDocScan = function () {
  window.scannedDocDataUrl = null;
  const viewport = document.querySelector(".viewport");
  if (viewport) {
    viewport.innerHTML = `
            <video id="scanner" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover;"></video>
            <canvas id="arOverlay" style="position:absolute; inset:0; pointer-events:none;"></canvas>
            <div class="scanner-grid"></div>
            <div class="scan-laser"></div>
        `;
  }
  const normalBtns = document.getElementById("taraNormalButtons");
  const editorMenu = document.getElementById("docEditorMenu");
  if (editorMenu) editorMenu.classList.add("hidden");
  if (normalBtns) normalBtns.classList.remove("hidden");

  // Sadece tarama sekmesindeysek kamerayı başlat
  if (!document.getElementById("screen-scanner").classList.contains("hidden")) {
    startScanner();
  }
};

window.downloadDoc = function (type) {
  if (!window.scannedDocDataUrl) return;

  const nameInput = document.getElementById("docFileName");
  const fileName =
    nameInput && nameInput.value ? nameInput.value : "Taranan_Evrak";

  if (type === "jpeg") {
    const link = document.createElement("a");
    link.href = window.scannedDocDataUrl;
    link.download = `${fileName}.jpg`;
    link.click();
    if (typeof Swal !== "undefined")
      Swal.fire("İndirildi", "JPEG dosyası indirildi.", "success");
  } else if (type === "pdf") {
    if (!window.jspdf) {
      if (typeof Swal !== "undefined")
        Swal.fire("Hata!", "PDF kütüphanesi yüklenemedi.", "error");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    // A4 boyutları: 210 x 297 mm
    doc.addImage(window.scannedDocDataUrl, "JPEG", 10, 10, 190, 277);
    doc.save(`${fileName}.pdf`);
    if (typeof Swal !== "undefined")
      Swal.fire("İndirildi", "PDF belgesi oluşturuldu.", "success");
  }
};

window.saveDocToRegistry = async function () {
  if (!window.scannedDocDataUrl) return;
  const nameInput = document.getElementById("docFileName");
  const fileName =
    nameInput && nameInput.value ? nameInput.value : "Taranan_Evrak";

  // Switch to add tab
  window.switchTab("add");

  const folderInput = document.getElementById("newFolderName");
  if (folderInput) folderInput.value = fileName;

  setTimeout(() => {
    let previewImg = document.getElementById("preview-captured-img");
    if (!previewImg) {
      previewImg = document.createElement("img");
      previewImg.id = "preview-captured-img";
      previewImg.style.cssText =
        "width:100%; height:100%; object-fit:cover; border-radius:16px;";
      const previewArea = document.getElementById("photoPreview");
      if (previewArea) previewArea.appendChild(previewImg);
    }
    previewImg.src = window.scannedDocDataUrl;
    previewImg.style.display = "block";
    lastCapturedPhoto = window.scannedDocDataUrl;

    stopAddCamera();
    const addVideo = document.getElementById("add-video");
    if (addVideo) addVideo.style.display = "none";

    const snapBtn = document.getElementById("snapPhotoBtn");
    const retakeBtn = document.getElementById("retakePhotoBtn");
    const saveFolderBtn = document.getElementById("saveFolderBtn");

    if (snapBtn) snapBtn.classList.add("hidden");
    if (retakeBtn) retakeBtn.classList.remove("hidden");
    if (saveFolderBtn) {
      saveFolderBtn.classList.remove("hidden");
      saveFolderBtn.style.display = "block";
    }

    if (typeof Swal !== "undefined")
      Swal.fire({
        title: "Ekleme Ekranına Aktarıldı!",
        text: "Lütfen diğer detayları girişp kaydedin.",
        icon: "info",
        timer: 2500,
      });

    window.cancelDocScan(); // reset scanner for next use
  }, 500);
};

window.handleGalleryUpload = function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    // Reset input value so same file can be selected again
    event.target.value = "";

    // Profesyonel editörü aç
    if (typeof window.detectDocumentCornersFromImage === "function") {
      const img = new Image();
      img.onload = () => {
        window.detectDocumentCornersFromImage(img, (points) => {
          window.openDocEditor(e.target.result, points);
        });
      };
      img.src = e.target.result;
    } else {
      window.openDocEditor(e.target.result);
    }
  };
  reader.readAsDataURL(file);
};

// --- Dropdown Options Menu and Registry Edit Actions ---
window.toggleItemMenu = function (id) {
  const targetMenu = document.getElementById(`item-menu-${id}`);
  const wasHidden = targetMenu ? targetMenu.classList.contains("hidden") : true;

  window.closeAllItemMenus();

  if (targetMenu && wasHidden) {
    targetMenu.classList.remove("hidden");
    // Z-Index Stacking Context Kalkanı:
    // Aktif menünün açıldığı kartı z-index: 150 seviyesine yükseltiyoruz.
    // Bu sayede alttaki kartların 3 nokta butonları bu menünün üstüne çıkamaz!
    const card = targetMenu.closest(".registry-item");
    if (card) {
      card.style.zIndex = "150";
    }
  }
};

window.closeAllItemMenus = function () {
  document
    .querySelectorAll(".item-menu-dropdown")
    .forEach((m) => m.classList.add("hidden"));
  // Tüm kartların z-index değerlerini sıfırla
  document.querySelectorAll(".registry-item").forEach((card) => {
    card.style.zIndex = "";
  });
};

window.renameRecordPrompt = async function (id) {
  const record = records.find((r) => r.id === id);
  if (!record) return;

  const { value: newName } = await Swal.fire({
    title: "Klasörü Yeniden Adlandır",
    input: "text",
    inputValue: record.name,
    showCancelButton: true,
    confirmButtonText: "Kaydet",
    cancelButtonText: "İİptal",
    background: "#060713",
    color: "#fff",
    confirmButtonColor: "#8b5cf6",
    inputValidator: (value) => {
      if (!value.trim()) {
        return "Boş bırakamazsınız!";
      }
    },
  });

  if (newName && newName.trim() !== record.name) {
    try {
      const { error } = await window
        .getSupabase()
        .from("records")
        .update({ name: newName.trim() })
        .eq("id", id);
      if (error) throw error;

      window.addSystemLog(
        `'${record.name}' klasörünün adını '${newName.trim()}' olarak değiştirdi.`,
      );

      Swal.fire({
        title: "Başarılı!",
        text: "Klasör yeniden adlandırıldı.",
        icon: "success",
        background: "#060713",
        color: "#fff",
        confirmButtonColor: "#8b5cf6",
        timer: 1500,
        showConfirmButton: false,
      });
      await loadRecords();
    } catch (err) {
      Swal.fire("Hata!", "Klasör adlandırılamadı: " + err.message, "error");
    }
  }
};

window.editLocationPrompt = async function (id) {
  const record = records.find((r) => r.id === id);
  if (!record) return;

  const { value: newLocation } = await Swal.fire({
    title: "Konumu Düzenle",
    input: "text",
    inputValue: record.location || "",
    showCancelButton: true,
    confirmButtonText: "Kaydet",
    cancelButtonText: "İİptal",
    background: "#060713",
    color: "#fff",
    confirmButtonColor: "#8b5cf6",
    inputPlaceholder: "Konum adı belirtin...",
  });

  if (
    newLocation !== undefined &&
    newLocation.trim() !== (record.location || "")
  ) {
    try {
      const { error } = await window
        .getSupabase()
        .from("records")
        .update({ location: newLocation.trim() })
        .eq("id", id);
      if (error) throw error;

      window.addSystemLog(
        `'${record.name}' klasörünün konumunu '${newLocation.trim()}' olarak güncelledi.`,
      );

      Swal.fire({
        title: "Başarılı!",
        text: "Konum güncellendi.",
        icon: "success",
        background: "#060713",
        color: "#fff",
        confirmButtonColor: "#8b5cf6",
        timer: 1500,
        showConfirmButton: false,
      });
      await loadRecords();
    } catch (err) {
      Swal.fire("Hata!", "Konum güncellenemedi: " + err.message, "error");
    }
  }
};

// --- SYSTEM AUDIT LOG SYSTEM (Stored in Supabase Only) ---
window.addSystemLog = async function (actionText) {
  if (!supabase) return;

  let userEmail = "mustafakartn58@gmail.com";
  if (window.currentUser && window.currentUser.email) {
    userEmail = window.currentUser.email;
  } else {
    try {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (user) {
        userEmail = user.email || "mustafakartn58@gmail.com";
        window.currentUser = user;
      }
    } catch (e) {
      console.error("Kullanıcı bilgisi alınamadı:", e);
    }
  }

  // 1. Try to write to a dedicated 'logs' table in Supabase
  try {
    await window
      .getSupabase()
      .from("logs")
      .insert([
        {
          email: userEmail,
          action: actionText,
        },
      ]);
  } catch (e) {
    console.warn(
      "[Log] 'logs' tablosuna yazma denemesi başarısız oldu (Tablo henüz oluşturulmamış olabilir).",
    );
  }

  // 2. Fallback: Save to '__system_logs__' record in 'records' table so it's visible in DB dashboard
  const timestamp = new Date().toLocaleString("tr-TR");
  const logEntry = `[${timestamp}] ${userEmail}: ${actionText}`;

  try {
    const { data, error } = await window
      .getSupabase()
      .from("records")
      .select("*")
      .eq("name", "__system_logs__");

    if (error) throw error;

    // Parse owner and find our specific log record
    let logRecord = null;
    if (data) {
      logRecord = data.find((r) => {
        const content = r.content || "";
        const ownerMatch = content.match(/\n\n\[owner:(.*?)\]$/);
        const owner = ownerMatch ? ownerMatch[1] : null;
        return owner === userEmail;
      });
    }

    if (logRecord) {
      let currentContent = logRecord.content || "";
      // Strip the owner tag first to append and clean
      currentContent = currentContent.replace(/\n\n\[owner:(.*?)\]$/, "");
      let logLines = currentContent
        .split("\n")
        .filter((line) => line.trim() !== "");
      logLines.push(logEntry);
      if (logLines.length > 100) {
        logLines = logLines.slice(logLines.length - 100);
      }
      const newContent = logLines.join("\n") + "\n\n[owner:" + userEmail + "]";
      await window
        .getSupabase()
        .from("records")
        .update({ content: newContent })
        .eq("id", logRecord.id);
    } else {
      await window
        .getSupabase()
        .from("records")
        .insert([
          {
            name: "__system_logs__",
            location: "Sistem",
            content: logEntry + "\n\n[owner:" + userEmail + "]",
            is_deleted: false,
          },
        ]);
    }
  } catch (err) {
    console.error("Sistem günlüğü kaydedilemedi:", err);
  }
};

window.addEventListener("click", () => {
  window.closeAllItemMenus();
});

// ==========================================================================
// CAMSCCANNER TARAYICI KONTROLLERİ (Izgara, Flaş, Oran, Manuel/Oto Tarama)
// ==========================================================================

window.toggleScanGrid = function () {
  const grid = document.getElementById("scannerGridLines");
  const btn = document.getElementById("scan-grid-btn");
  if (grid && btn) {
    const isHidden = grid.classList.toggle("hidden");
    btn.classList.toggle("active", !isHidden);
    speak(isHidden ? "Izgara kapatıldı." : "Izgara açıldı.");
  }
};

window.toggleScanFlash = function () {
  const btn = document.getElementById("scan-flash-btn");
  if (!btn) return;
  const isActive = btn.classList.toggle("active");

  // Update icon and label
  btn.querySelector("span").innerText = isActive ? "Flaş Açık" : "Flaş";
  const icon = btn.querySelector("i") || btn.querySelector("svg");
  if (icon) {
    icon.setAttribute("data-lucide", isActive ? "zap" : "zap-off");
    if (window.lucide) window.lucide.createIcons();
  }

  // Toggle flashlight track constraint if camera stream is active
  if (window.localMediaStream) {
    const track = window.localMediaStream.getVideoTracks()[0];
    if (track && typeof track.getCapabilities === "function") {
      try {
        const cap = track.getCapabilities();
        if (cap.torch) {
          track
            .applyConstraints({ advanced: [{ torch: isActive }] })
            .catch((err) => {
              console.warn("Flaş kontrol hatası:", err);
            });
        } else {
          console.log("Cihaz flaşı desteklemiyor.");
        }
      } catch (err) {
        console.warn("Flaş kontrol yeteneği alınamadı:", err);
      }
    }
  }
  speak(isActive ? "Flaş açıldı." : "Flaş kapatıldı.");
};

window.toggleScanRatio = function () {
  const label = document.getElementById("scan-ratio-label");
  const videoWrapper = document.getElementById("scanner-viewport-wrapper");
  if (!label || !videoWrapper) return;

  const ratios = ["4:3", "16:9", "1:1"];
  let currentIdx = ratios.indexOf(label.innerText.trim());
  let nextIdx = (currentIdx + 1) % ratios.length;
  const nextRatio = ratios[nextIdx];
  label.innerText = nextRatio;

  // Adjust video wrapper styling for target ratio
  if (nextRatio === "4:3") {
    videoWrapper.style.aspectRatio = "4 / 3";
    videoWrapper.style.maxHeight = "70vh";
  } else if (nextRatio === "16:9") {
    videoWrapper.style.aspectRatio = "16 / 9";
    videoWrapper.style.maxHeight = "80vh";
  } else {
    videoWrapper.style.aspectRatio = "1 / 1";
    videoWrapper.style.maxHeight = "50vh";
  }
  speak(`Boyut oranı ${nextRatio} olarak ayarlandı.`);
};

window.toggleScanMode = function () {
  const label = document.getElementById("scan-mode-label");
  if (!label) return;

  const activeMode =
    label.innerText.trim() === "Manuel" ? "Otomatik" : "Manuel";
  label.innerText = activeMode;
  const btn = document.getElementById("scan-mode-btn");
  if (btn) btn.classList.toggle("active", activeMode === "Otomatik");

  speak(`Çekim yöntemi ${activeMode} olarak değiştirildi.`);

  if (activeMode === "Otomatik") {
    window.runAutoCaptureCountdown();
  } else {
    if (window.autoCaptureTimer) clearTimeout(window.autoCaptureTimer);
    if (window.autoCaptureInterval) clearInterval(window.autoCaptureInterval);
    const aiMsg = document.getElementById("aiMessage");
    if (aiMsg)
      aiMsg.innerText =
        "Manuel çekim modu aktif. Hazır olduğunuzda deklanşöre basın.";
  }
};

window.runAutoCaptureCountdown = function () {
  if (window.autoCaptureTimer) clearTimeout(window.autoCaptureTimer);
  if (window.autoCaptureInterval) clearInterval(window.autoCaptureInterval);

  let count = 3;
  const aiMsg = document.getElementById("aiMessage");
  speak("Otomatik tarama aktif. Lütfen belgeyi sabit tutun.");
  if (aiMsg)
    aiMsg.innerText = "Otomatik tarama başlatıldı. Sabit tutunuz: " + count;

  window.autoCaptureInterval = setInterval(() => {
    const scannerScreen = document.getElementById("screen-scanner");
    if (
      !isScanning ||
      !scannerScreen ||
      scannerScreen.classList.contains("hidden")
    ) {
      clearInterval(window.autoCaptureInterval);
      return;
    }

    count--;
    if (count > 0) {
      speak(count.toString());
      if (aiMsg)
        aiMsg.innerText = "Otomatik tarama başlatıldı. Sabit tutunuz: " + count;
    } else {
      clearInterval(window.autoCaptureInterval);
      speak("Çekiliyor.");
      if (aiMsg) aiMsg.innerText = "Çekiliyor...";
      window.takeDocPhoto();
    }
  }, 1000);
};

/* --- OSS DOCUMENT SCANNER & CARD WALLET MOBİL ENTEGRASYONLARI --- */
window.launchOSSScanner = function () {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
    window.location.href =
      "https://apps.apple.com/app/oss-document-scanner/id6443657788";
  } else {
    const intentUrl =
      "intent:#Intent;package=com.akylas.documentscanner;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.akylas.documentscanner;end";
    window.location.href = intentUrl;
  }
};

window.launchCardWallet = function () {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
    window.location.href =
      "https://apps.apple.com/app/oss-cardwallet/id1534065600";
  } else {
    const intentUrl =
      "intent:#Intent;package=com.akylas.cardwallet;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.akylas.cardwallet;end";
    window.location.href = intentUrl;
  }
};

/* ============================================================
   OPENSCAN TEMA YÖNETİM SİSTEMİ (OpenScan Varsayılan)
   ============================================================ */

/**
 * Her zaman OpenScan turuncu rengi döndürür.
 * OpenScan artık varsayılan ve tek tema.
 */
function getThemeColor() {
  return "#f37121"; // OpenScan turuncu
}

function getThemeGlow() {
  return "rgba(243, 113, 33, 0.35)"; // OpenScan glow
}

/**
 * Sayfa yüklendiğinde OpenScan temasını aktif et
 */
(function initScannerTheme() {
  // OpenScan'ı kalıcı olarak varsayılan yap
  localStorage.setItem("scannerTheme", "openscan");
  document.body.classList.add("openscan-theme");
  console.log("[OpenScan] Tema aktif edildi.");
})();

/* ============================================================
   OPENSCAN FİLTRE ALGORİTMALARI (JavaScript Fallback)
   scan.cpp → Python CV2 → JavaScript karşılıkları
   ============================================================ */

/**
 * OpenScan Magic Color Filtresi (scan.cpp getMagicColorBitmap)
 * Adım 1: threshold(150, THRESH_TRUNC) → normalize (x1.7)
 * Adım 2: subtract(66) → normalize (x1.35)
 * Sonuç: koyu arka plan bastırılır, kontrast artırılır
 */
function applyOpenScanMagicColor(d) {
  const scale1 = 255.0 / 150.0; // ~1.7
  const scale2 = 255.0 / (255.0 - 66.0); // ~1.349

  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      // Adım 1: Truncate at 150, then scale
      let v = Math.min(d[i + c], 150);
      v = v * scale1;

      // Adım 2: Subtract 66, clip to 0, then scale
      v = Math.max(0, v - 66);
      v = v * scale2;

      d[i + c] = Math.min(255, Math.max(0, Math.round(v)));
    }
    d[i + 3] = 255; // alpha tam opak
  }
}

/**
 * OpenScan Grayscale Filtresi (scan.cpp getGrayBitmap)
 * Standart luma dönüşümü: Y = 0.299R + 0.587G + 0.114B
 */
function applyOpenScanGray(d) {
  for (let i = 0; i < d.length; i += 4) {
    const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = gray;
    d[i + 1] = gray;
    d[i + 2] = gray;
    d[i + 3] = 255;
  }
}

/**
 * OpenScan B&W Filtresi (scan.cpp getBWBitmap)
 * Adım 1: Grayscale
 * Adım 2: 2x2 Box Blur
 * Adım 3: Gaussian Adaptive Threshold (blok=7, C=2)
 * Adım 4: Bitwise NOT (metin siyah → beyaz arka plan)
 */
function applyOpenScanBW(imgData) {
  const w = imgData.width;
  const h = imgData.height;
  const d = imgData.data;

  // Adım 1: Grayscale
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < d.length; i += 4) {
    gray[i / 4] = Math.round(
      0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2],
    );
  }

  // Adım 2: 2x2 Box Blur (scan.cpp: cv::blur(dst, dst, Size(2,2)))
  const blurred = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      let sum = gray[idx];
      let count = 1;
      if (x + 1 < w) {
        sum += gray[idx + 1];
        count++;
      }
      if (y + 1 < h) {
        sum += gray[idx + w];
        count++;
      }
      if (x + 1 < w && y + 1 < h) {
        sum += gray[idx + w + 1];
        count++;
      }
      blurred[idx] = Math.round(sum / count);
    }
  }

  // Adım 3: Gaussian Adaptive Threshold (blok boyutu: 7, C: 2)
  // Integral image tabanlı hızlı uygulama
  const blockRadius = 3; // (7-1)/2
  const C = 2;
  const integral = new Int32Array(w * h);
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += blurred[y * w + x];
      integral[y * w + x] = rowSum + (y > 0 ? integral[(y - 1) * w + x] : 0);
    }
  }

  const thresholded = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - blockRadius);
      const x2 = Math.min(w - 1, x + blockRadius);
      const y1 = Math.max(0, y - blockRadius);
      const y2 = Math.min(h - 1, y + blockRadius);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      let s = integral[y2 * w + x2];
      if (x1 > 0) s -= integral[y2 * w + (x1 - 1)];
      if (y1 > 0) s -= integral[(y1 - 1) * w + x2];
      if (x1 > 0 && y1 > 0) s += integral[(y1 - 1) * w + (x1 - 1)];
      const mean = s / count;
      const idx = y * w + x;
      // adaptiveThreshold: piksel > mean - C → 255, değilse → 0
      thresholded[idx] = blurred[idx] > mean - C ? 255 : 0;
    }
  }

  // Adım 4: Bitwise NOT (scan.cpp: bitwise_not(dst, dst))
  for (let i = 0; i < w * h; i++) {
    const v = 255 - thresholded[i];
    d[i * 4] = v;
    d[i * 4 + 1] = v;
    d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
}

/**
 * OpenScan tema aktifken kullanılacak gelişmiş filtre karışımı.
 * applyFilterAlgorithm() fonksiyonuna gönderilir.
 */
window.applyOpenScanFilter = function (filterId, imgData) {
  const d = imgData.data;
  if (filterId === "os_magic") {
    applyOpenScanMagicColor(d);
  } else if (filterId === "os_gray") {
    applyOpenScanGray(d);
  } else if (filterId === "os_bw") {
    applyOpenScanBW(imgData);
  }
};

window.sendRecordByEmailPrompt = async function (recordId) {
  const record = activeRecords.find((r) => r.id == recordId);
  if (!record) return alert("Kayıt bulunamadı");

  const { value: format } = await Swal.fire({
    title: "Paylaşım Formatı",
    text: "Evrakı hangi formatta paylaşmak istiyorsunuz?",
    icon: "question",
    input: "radio",
    inputOptions: {
      jpeg: "Resim (JPEG)",
      pdf: "Belge (PDF)",
      excel: "Tablo (Excel)",
    },
    showCancelButton: true,
    confirmButtonText: "Paylaş",
    cancelButtonText: "İptal",
    inputValidator: (value) => {
      if (!value) return "Lütfen bir format seçin!";
    },
  });

  if (!format) return;

  Swal.fire({
    title: "Hazırlanıyor...",
    text: "Lütfen bekleyin",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    let file;
    let fileName = (record.name || "kayit")
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();

    if (format === "jpeg") {
      if (!record.photo_url) throw new Error("Fotoğraf bulunamadı");
      const res = await fetch(record.photo_url);
      const blob = await res.blob();
      file = new File([blob], fileName + ".jpg", { type: blob.type });
    } else if (format === "pdf") {
      if (!window.jspdf) throw new Error("PDF motoru yüklenemedi");
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(record.name || "Isimsiz Evrak", 10, 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);

      let y = 30;
      if (record.location) {
        doc.text(`Konum: ${record.location}`, 10, y);
        y += 10;
      }
      if (record.content) {
        const splitText = doc.splitTextToSize(record.content, 180);
        doc.text(splitText, 10, y);
      }
      if (record.photo_url && record.photo_url.startsWith("data:image")) {
        doc.addPage();
        doc.addImage(record.photo_url, "JPEG", 10, 10, 190, 0);
      }

      const pdfBlob = doc.output("blob");
      file = new File([pdfBlob], fileName + ".pdf", {
        type: "application/pdf",
      });
    } else if (format === "excel") {
      const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Evrak">
  <Table>
   <Row><Cell><Data ss:Type="String">Ad</Data></Cell><Cell><Data ss:Type="String">${(record.name || "").replace(/</g, "&lt;")}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Konum</Data></Cell><Cell><Data ss:Type="String">${(record.location || "").replace(/</g, "&lt;")}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Icerik</Data></Cell><Cell><Data ss:Type="String">${(record.content || "").replace(/</g, "&lt;")}</Data></Cell></Row>
  </Table>
 </Worksheet>
</Workbook>`;
      file = new File([xmlContent], fileName + ".xls", {
        type: "application/vnd.ms-excel",
      });
    }

    Swal.close();

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (
      isMobile &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        files: [file],
        title: record.name || "ArşivX Evrak",
        text: "ArşivX Kayıt Paylaşımı",
      });
    } else {
      Swal.fire({
        title: "Evrak Hazırlanıyor...",
        text: "Buluta yükleniyor, lütfen bekleyin...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      try {
        const sb = window.getSupabase();
        const userId = window.currentUser ? window.currentUser.id : "public";
        const uploadName =
          userId +
          "/share_" +
          Date.now() +
          "_" +
          file.name.replace(/[^a-zA-Z0-9.\-_]/g, "");

        const { data, error } = await sb.storage
          .from("scans")
          .upload(uploadName, file, {
            contentType: file.type,
          });

        if (error) throw error;

        const { data: urlData } = sb.storage
          .from("scans")
          .getPublicUrl(uploadName);
        const publicUrl = urlData.publicUrl;

        Swal.close();

        let htmlContent = "";
        if (format === "jpeg") {
          htmlContent = `<div><p>Merhaba,</p><p>ArşivX üzerinden paylaşılan evrak aşağıdadır:</p><br><img src="${publicUrl}" style="max-width:800px; border-radius:8px;"><br><p>İyi çalışmalar.</p></div>`;
        } else {
          htmlContent = `<div><p>Merhaba,</p><p>ArşivX üzerinden paylaşılan evrak aşağıdadır:</p><br><a href="${publicUrl}" style="display:inline-block; padding:10px 20px; background:#8b5cf6; color:#fff; text-decoration:none; border-radius:6px; font-weight:bold;">📄 ${format.toUpperCase()} Evrakını İndir / Görüntüle</a><br><p>İyi çalışmalar.</p></div>`;
        }

        const subject = encodeURIComponent(
          "ArşivX Evrak Paylaşımı: " + (record.name || "İsimsiz"),
        );

        try {
          const blobHtml = new Blob([htmlContent], { type: "text/html" });
          const blobText = new Blob([publicUrl], { type: "text/plain" });
          const item = new ClipboardItem({
            "text/html": blobHtml,
            "text/plain": blobText,
          });
          await navigator.clipboard.write([item]);

          Swal.fire({
            title: "Kopyalandı!",
            html:
              "Evrak içeriği başarıyla kopyalandı.<br><br>Açılan Gmail ekranında metin alanına <b>(Ctrl + V)</b> veya sağ tıklayıp <b>'Yapıştır'</b> dediğinizde " +
              (format === "jpeg"
                ? "fotoğraf doğrudan maile eklenecektir!"
                : "şık evrak butonu maile eklenecektir!"),
            icon: "success",
            confirmButtonText: "Gmail'i Aç",
          }).then(() => {
            window.open(
              `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}`,
              "_blank",
            );
          });
        } catch (clipboardErr) {
          const body = encodeURIComponent(
            `Merhaba,\n\nSize ArşivX üzerinden bir evrak gönderildi.\nAşağıdaki bağlantıya tıklayarak ${format.toUpperCase()} formatındaki evrakı görüntüleyebilirsiniz:\n\n${publicUrl}\n\nİyi çalışmalar.`,
          );
          window.open(
            `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`,
            "_blank",
          );
        }
      } catch (uploadErr) {
        console.error("Yükleme hatası:", uploadErr);
        Swal.fire(
          "Hata",
          "Dosya buluta yüklenirken bir sorun oluştu.",
          "error",
        );
      }
    }
  } catch (err) {
    Swal.fire(
      "Hata!",
      "Paylaşım hazırlanırken bir hata oluştu: " + err.message,
      "error",
    );
  }
};

window.populateShareSelect = function () {
  const select = document.getElementById("share-item-select");
  if (!select) return;

  if (typeof activeRecords === "undefined" || activeRecords.length === 0) {
    select.innerHTML = '<option value="">Gönderilecek evrak yok</option>';
    return;
  }

  let html = '<option value="">Lütfen seçin...</option>';
  activeRecords.forEach((r) => {
    let title = r.title || r.name || "İsimsiz Evrak";
    if (r._type === "folder") {
      title = "(Defter) " + r.folder_name;
    }
    html += `<option value="${r.id}">${title}</option>`;
  });

  select.innerHTML = html;
};

window.sendItemToUser = async function () {
  const select = document.getElementById("share-item-select");
  const emailInput = document.getElementById("share-email");

  if (!select || !emailInput) return;

  const recordId = select.value;
  const targetEmail = emailInput.value.trim().toLowerCase();

  if (!recordId) {
    alert("Lütfen gönderilecek evrakı seçin.");
    return;
  }
  if (!targetEmail) {
    alert("Lütfen alıcının e-posta adresini girin.");
    return;
  }

  const record = activeRecords.find((r) => r.id == recordId);
  if (!record) return;

  try {
    const sb = window.getSupabase();
    if (!sb) throw new Error("Veritabanı bağlantısı kurulamadı");

    // We removed the profiles check to allow sending to ANY email,
    // acting as an invitation to the app! If they login, they see it.
    const senderEmail = window.currentUser
      ? window.currentUser.email
      : "Bilinmeyen Kullanıcı";

    // We recreate the exact content block with the sender's note and new owner
    let newContent = record.content || "";
    newContent += `\n\n[sender:${senderEmail}][read:false]`;
    newContent += `\n\n(Bu belge ${senderEmail} hesabından gönderildi.)`;
    newContent += `\n\n[owner:${targetEmail}][type:${record._type || "scan"}]`;

    const clonedRecord = {
      name: record.name,
      location: record.location || "Gelen Kutusu",
      content: newContent,
      photo_url: record.photo_url || null,
      is_deleted: false,
    };

    const { error } = await sb.from("records").insert([clonedRecord]);
    if (error) throw error;

    if (typeof Swal !== "undefined") {
      Swal.fire({
        title: "Başarılı!",
        text: "Belge, karşı kullanıcının arşivine başarıyla iletildi!",
        icon: "success",
        confirmButtonText: "Tamam",
      });
    } else {
      alert("Belge başarıyla kullanıcının arşivine gönderildi!");
    }

    await loadRecords();
    window.switchTab("registry");
    window.setRegistryFilter("sent");

    emailInput.value = "";
    select.value = "";
  } catch (e) {
    console.error("Paylaşım hatası:", e);
    alert("Gönderim sırasında hata oluştu: " + e.message);
  }
};

// Bildirim ve Gelen Evrak Sistemi

window.toggleNotifications = function () {
  const cb = document.getElementById("setting-notifications");
  if (cb) {
    localStorage.setItem("notify_received", cb.checked ? "true" : "false");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const notifySetting = localStorage.getItem("notify_received");
  const cb = document.getElementById("setting-notifications");
  if (cb) {
    if (notifySetting === "false") cb.checked = false;
    else cb.checked = true; // default true
  }
});

window.checkNotifications = function () {
  const notifySetting = localStorage.getItem("notify_received") !== "false";
  const userEmail = window.currentUser ? window.currentUser.email : null;
  const unreadCount = activeRecords.filter(
    (r) => r._sender && r._sender !== userEmail && r._isRead === false,
  ).length;

  const badge = document.getElementById("notification-badge");
  if (badge) {
    if (unreadCount > 0) {
      badge.style.display = "block";
      if (notifySetting && !window.notificationShown) {
        window.notificationShown = true;
        window.showBeautifulNotification(
          "Yeni Evrak!",
          `Size ${unreadCount} adet yeni evrak gönderildi. Görüntülemek için tıklayın.`,
          "mail-plus",
        );
      }
    } else {
      badge.style.display = "none";
    }
  }
};

window.showReceivedDocuments = async function () {
  const userEmail = window.currentUser ? window.currentUser.email : null;
  const unreads = activeRecords.filter(
    (r) => r._sender && r._sender !== userEmail && r._isRead === false,
  );
  if (unreads.length > 0) {
    const sb = window.getSupabase();
    for (let r of unreads) {
      const { data: dbRec } = await sb
        .from("records")
        .select("content")
        .eq("id", r.id)
        .single();
      if (dbRec && dbRec.content) {
        let newDbContent = dbRec.content.replace(
          /\[read:false\]/g,
          "[read:true]",
        );
        await sb
          .from("records")
          .update({ content: newDbContent })
          .eq("id", r.id);
      }
      r._isRead = true;
    }
    window.checkNotifications(); // Işığı söndür
  }

  window.switchTab("registry");
  window.setRegistryFilter("received");
};

// BACKGROUND POLLER FOR NOTIFICATIONS (Since Realtime might not be configured on DB)
let lastNotificationPoll = new Date().toISOString();
setInterval(async () => {
  if (
    !document.getElementById("setting-notifications") ||
    !document.getElementById("setting-notifications").checked
  )
    return;
  if (!window.currentUser) return;

  const sb = window.getSupabase();
  if (!sb) return;

  try {
    // Find new records created after last check
    const { data, error } = await sb
      .from("records")
      .select("*")
      .gt("created_at", lastNotificationPoll)
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      lastNotificationPoll = new Date().toISOString();

      // Check if any of these new records are sent TO the current user
      let hasNewItem = false;
      let senderName = "Biri";
      let itemName = "";

      for (let r of data) {
        if (
          r.content &&
          r.content.includes(`[owner:${window.currentUser.email}]`) &&
          r.content.includes("[read:false]")
        ) {
          hasNewItem = true;

          const senderMatch = r.content.match(/\[sender:(.*?)\]/);
          if (senderMatch) senderName = senderMatch[1].split("@")[0];
          itemName = r.name;
          break;
        }
      }

      if (hasNewItem) {
        if (typeof window.showBeautifulNotification === "function") {
          window.showBeautifulNotification(
            `${senderName} sana "${itemName}" gönderdi.`,
            "received",
          );
        }
        // Silently refresh UI to show it in Gelenler
        await loadRecords();
      }
    }
  } catch (e) {
    // fail silently
  }
}, 10000);

window.testNotification = function () {
  window.showBeautifulNotification(
    "Test Bildirimi",
    "ArşivX akıllı bildirim sistemi mükemmel çalışıyor!",
    "bell-ring",
  );
};

window.showBeautifulNotification = function (title, message, iconStr = "mail") {
  let container = document.getElementById("arsivx-notification-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "arsivx-notification-container";
    container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
        `;
    document.body.appendChild(container);
  }

  const notif = document.createElement("div");
  notif.style.cssText = `
        background: rgba(15, 15, 20, 0.85);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(139, 92, 246, 0.4);
        box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(139, 92, 246, 0.2);
        border-radius: 14px;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        color: white;
        min-width: 300px;
        max-width: 400px;
        transform: translateX(120%);
        opacity: 0;
        transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease;
        pointer-events: auto;
        cursor: pointer;
    `;

  notif.innerHTML = `
        <div style="background: rgba(139, 92, 246, 0.2); padding: 12px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #a78bfa; box-shadow: 0 0 15px rgba(139, 92, 246, 0.4);">
            <i data-lucide="${iconStr}"></i>
        </div>
        <div style="flex: 1;">
            <h4 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: #fff; font-family: 'Outfit', sans-serif;">${title}</h4>
            <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.4; font-family: 'Outfit', sans-serif;">${message}</p>
        </div>
    `;

  container.appendChild(notif);
  if (window.lucide) window.lucide.createIcons({ root: notif });

  notif.addEventListener("click", () => {
    closeNotif();
    if (title !== "Test Bildirimi") {
      window.showReceivedDocuments();
    }
  });

  requestAnimationFrame(() => {
    notif.style.transform = "translateX(0)";
    notif.style.opacity = "1";
  });

  let isClosing = false;
  function closeNotif() {
    if (isClosing) return;
    isClosing = true;
    notif.style.transform = "translateX(120%)";
    notif.style.opacity = "0";
    setTimeout(() => notif.remove(), 600);
  }

  setTimeout(closeNotif, 5000);
};

// Start the application after all functions are fully parsed
checkUser();

window.toggleFavoriteRecord = async function (id) {
  const record = records.find((r) => r.id === id);
  if (!record) return;

  // Toggle the favorite tag in _originalContent
  let newContent = record._originalContent || "";
  let currentlyFavorite = false;

  if (newContent.includes("[favorite:true]")) {
    currentlyFavorite = true;
    newContent = newContent.replace(/\[favorite:true\]/g, "");
  } else {
    newContent += "[favorite:true]";
  }

  const sb = window.getSupabase();
  const { error } = await sb
    .from("records")
    .update({ content: newContent })
    .eq("id", id);

  if (error) {
    if (typeof Swal !== "undefined") Swal.fire("Hata", error.message, "error");
    else alert(error.message);
    return;
  }

  const msg = currentlyFavorite
    ? "Favorilerden çıkarıldı."
    : "Favorilere eklendi!";
  if (typeof Swal !== "undefined") {
    Swal.fire({
      title: "Başarılı",
      text: msg,
      icon: "success",
      timer: 1500,
      showConfirmButton: false,
    });
  } else {
    alert(msg);
  }

  await loadRecords();
};

window.moveRecordPrompt = async function (id) {
  const record = records.find((r) => r.id === id);
  if (!record) return;

  const currentType = record._type || "folder";

  if (typeof Swal !== "undefined") {
    const { value: category } = await Swal.fire({
      title: "Kategoriyi Değiştir (Taşı)",
      input: "radio",
      inputOptions: {
        scan: "Tarayıcı (Taranmış Belgeler)",
        folder: "Arşiv (Diğer Dosyalar)",
      },
      inputValue: currentType,
      showCancelButton: true,
      confirmButtonText: "Taşı",
      cancelButtonText: "İptal",
      customClass: {
        input: "swal2-radio-prominent",
      },
    });

    if (category && category !== currentType) {
      let newContent = record._originalContent || "";
      if (newContent.includes(`[type:${currentType}]`)) {
        newContent = newContent.replace(
          `[type:${currentType}]`,
          `[type:${category}]`,
        );
      } else {
        newContent += `[type:${category}]`;
      }

      const sb = window.getSupabase();
      const { error } = await sb
        .from("records")
        .update({ content: newContent })
        .eq("id", id);

      if (error) {
        Swal.fire("Hata", error.message, "error");
      } else {
        Swal.fire({
          title: "Başarılı",
          text: "Başka kategoriye taşındı!",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
        await loadRecords();
      }
    }
  }
};

window.editRecordPrompt = async function (id) {
  const record = records.find((r) => r.id === id);
  if (!record) return;

  const htmlContent = `
        <div style="text-align: left; font-size: 14px; margin-bottom:15px;">
            <div style="text-align:center; margin-bottom:10px;">
                <img src="${record.photo_url || "logo.png"}" style="max-height: 150px; border-radius:8px; object-fit:contain; cursor:pointer;" onclick="window.open(this.src, '_blank')">
            </div>
            <label style="font-weight:bold; color:var(--text-color);">Evrak Adı:</label>
            <input id="edit-name" class="swal2-input" value="${record.name || ""}" style="margin-top:5px; margin-bottom:15px; width:90%;">
            
            <label style="font-weight:bold; color:var(--text-color);">Konum:</label>
            <input id="edit-loc" class="swal2-input" value="${record.location || ""}" style="margin-top:5px; margin-bottom:15px; width:90%;">
            
            <label style="font-weight:bold; color:var(--text-color);">Oluşturulma:</label>
            <div style="margin-top:5px; margin-bottom:15px; color:var(--text-dim);">${new Date(record.created_at || Date.now()).toLocaleString("tr-TR")}</div>
            
            <label style="font-weight:bold; color:var(--text-color);">Detay/İçerik:</label>
            <textarea id="edit-content" class="swal2-textarea" style="margin-top:5px; margin-bottom:15px; width:90%; font-size:13px; border-radius:8px; padding:10px; background:rgba(255,255,255,0.05); color:var(--text-color);" rows="4">${record.content || ""}</textarea>
        </div>
    `;

  const { value: formValues } = await Swal.fire({
    title: "Evrakı Düzenle",
    html: htmlContent,
    showCancelButton: true,
    confirmButtonText: "Kaydet",
    cancelButtonText: "İptal",
    focusConfirm: false,
    preConfirm: () => {
      return {
        name: document.getElementById("edit-name").value.trim(),
        location: document.getElementById("edit-loc").value.trim(),
        content: document.getElementById("edit-content").value.trim(),
      };
    },
  });

  if (formValues) {
    const sb = window.getSupabase();
    let updates = {};
    let changed = false;

    if (formValues.name && formValues.name !== record.name) {
      updates.name = formValues.name;
      changed = true;
      if (typeof window.addSystemLog === "function") {
        window.addSystemLog(
          `'${record.name}' evrak adını '${formValues.name}' olarak güncelledi.`,
        );
      }
    }
    if (formValues.location !== (record.location || "")) {
      updates.location = formValues.location;
      changed = true;
      if (typeof window.addSystemLog === "function") {
        window.addSystemLog(
          `'${record.name}' konumunu '${formValues.location}' olarak güncelledi.`,
        );
      }
    }

    if (formValues.content !== (record.content || "")) {
      // Retrieve original tags to append back to the new content
      let tags = "";
      const tagRegex = /\[(type|owner|sender|isRead|favorite):(.*?)\]/g;
      let match;
      while ((match = tagRegex.exec(record._originalContent || "")) !== null) {
        tags += match[0];
      }
      updates.content = formValues.content + tags;
      changed = true;
      if (typeof window.addSystemLog === "function") {
        window.addSystemLog(`'${record.name}' içeriğini güncelledi.`);
      }
    }

    if (changed) {
      const { error } = await sb.from("records").update(updates).eq("id", id);
      if (error) {
        Swal.fire("Hata", error.message, "error");
      } else {
        Swal.fire({
          title: "Başarılı",
          text: "Evrak güncellendi!",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
        await loadRecords();
      }
    }
  }
};

// EKİP YÖNETİMİ (Shared Workspace)
window.manageTeamPrompt = async function () {
  const sb = window.getSupabase();
  if (!sb || !window.currentUser) {
    Swal.fire("Hata", "Oturum açmanız gerekiyor.", "error");
    return;
  }

  // List existing employees
  const employees = window.myEmployees || [];
  let empListHtml =
    employees.length > 0
      ? employees
          .map(
            (e) =>
              `<div style="display:flex; justify-content:space-between; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; margin-bottom:8px;"><span>${e}</span> <button onclick="window.removeTeamMember('${e}')" style="background:#ef4444; color:white; border:none; border-radius:4px; padding:2px 8px; cursor:pointer;">Sil</button></div>`,
          )
          .join("")
      : '<p style="color:var(--text-dim); font-size:13px; text-align:center;">Henüz eklediğiniz bir ekip üyesi yok.</p>';

  const htmlContent = `
        <div style="text-align: left; font-size: 14px; margin-bottom:15px;">
            <p style="color:var(--text-dim); font-size:13px; margin-bottom:15px;">Aşağıdaki listeye eklediğiniz Gmail hesapları, sisteme girdiklerinde <b>sizin defterinizi ve tüm evraklarınızı</b> görebilir, kendi taradıklarını da sizin defterinize kaydedebilirler. <b>(Eğer Premium paketiniz varsa, eklediğiniz kişiler de kısıtlamasız kullanabilir!)</b></p>
            <div style="max-height: 150px; overflow-y: auto; margin-bottom:15px;">
                ${empListHtml}
            </div>
            <label style="font-weight:bold; color:var(--text-color); font-size:13px;">Yeni Ekip Üyesi (Gmail):</label>
            <input id="new-team-email" type="email" class="swal2-input" placeholder="ornek@gmail.com" style="margin-top:5px; margin-bottom:0; width:90%;">
        </div>
    `;

  const { value: formValues } = await Swal.fire({
    title: "Ekip / Ortak Hesap Yönetimi",
    html: htmlContent,
    showCancelButton: true,
    confirmButtonText: "Kişiyi Ekle",
    cancelButtonText: "Kapat",
    focusConfirm: false,
    preConfirm: () => {
      const email = document.getElementById("new-team-email").value.trim();
      if (!email) return false;
      if (!email.includes("@")) {
        Swal.showValidationMessage("Geçerli bir E-Posta giriniz.");
        return false;
      }
      return email;
    },
  });

  if (formValues) {
    const newEmail = formValues.toLowerCase();
    if (employees.includes(newEmail)) {
      Swal.fire("Hata", "Bu e-posta zaten ekli.", "info");
      return;
    }

    employees.push(newEmail);
    await window._updateAccountLinks(employees);
  }
};

window.removeTeamMember = async function (emailToRemove) {
  Swal.fire({
    title: "Emin misiniz?",
    text: emailToRemove + " kişisinin defterinize erişimi iptal edilecek.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Evet, Çıkar",
    cancelButtonText: "İptal",
  }).then(async (result) => {
    if (result.isConfirmed) {
      let employees = window.myEmployees || [];
      employees = employees.filter((e) => e !== emailToRemove);
      await window._updateAccountLinks(employees);
    }
  });
};

window._updateAccountLinks = async function (newEmployeesArray) {
  const sb = window.getSupabase();
  const userEmail = window.currentUser.email;

  // Fetch current links
  const { data } = await sb
    .from("records")
    .select("*")
    .eq("name", "__account_links__")
    .limit(1);
  let linksRecord = data && data.length > 0 ? data[0] : null;
  let allLinks = {};
  if (linksRecord && linksRecord.content) {
    try {
      allLinks = JSON.parse(linksRecord.content);
    } catch (e) {}
  }

  // Update
  allLinks[userEmail] = newEmployeesArray;

  if (linksRecord) {
    await sb
      .from("records")
      .update({ content: JSON.stringify(allLinks) })
      .eq("id", linksRecord.id);
  } else {
    await sb.from("records").insert([
      {
        name: "__account_links__",
        location: "Sistem",
        content: JSON.stringify(allLinks),
        is_deleted: false,
      },
    ]);
  }

  Swal.fire({
    title: "Başarılı",
    text: "Ekip güncellendi!",
    icon: "success",
    timer: 1500,
    showConfirmButton: false,
  });

  // Refresh
  if (typeof loadRecords === "function") {
    setTimeout(() => loadRecords(), 500);
  }
};


// ==========================================
// CAPACITOR NATIVE ML KIT DOCUMENT SCANNER
// ==========================================
window.launchNativeMLKitScanner = async function() {
    try {
        const { DocumentScanner } = window.Capacitor.Plugins;
        if (!DocumentScanner) {
            console.error("[ArşivX] DocumentScanner plugin native platformda bulunamadı!");
            return;
        }
        
        const result = await DocumentScanner.scanDocument({
            galleryImportAllowed: true,
            pageLimit: 1, 
            resultFormats: ['JPEG'],
            scannerMode: 'FULL' // FULL modu Google'ın mükemmel arayüzünü açar
        });
        
        if (result.scannedImages && result.scannedImages.length > 0) {
            // ML Kit kırpılmış ve filtrelenmiş harika bir JPEG döndürür.
            const nativePath = result.scannedImages[0];
            const webPath = window.Capacitor.convertFileSrc(nativePath);
            
            showGlobalSpinner("Evrak işleniyor...");
            let originalImg = document.getElementById("original-img");
            
            originalImg.onload = function() {
                // ML Kit kendi filtreleme arayüzünü sunduğu için, bizim web filtremizi atlayıp
                // orijinal filtreyi seçili tutarak direkt 2. adıma atıyoruz.
                window.applyFilter('none'); // Orijinal (Zaten ML kit temizledi)
                
                // Crop ekranını tamamen atla
                document.getElementById("doc-editor-modal").classList.remove("hidden");
                window.nextEditorStep(2); 
                hideGlobalSpinner();
                
                originalImg.onload = null; // Bellek sızıntısını önle
            };
            
            originalImg.src = webPath;
        }
    } catch (e) {
        console.log("[ArşivX] Native tarayıcı iptal edildi veya çöktü:", e);
    }
};
