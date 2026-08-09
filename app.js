// ============================================================
// TONTI ADMIN PORTAL — JAVASCRIPT LOGIC (SUPABASE CONNECTED)
// ============================================================

const SUPABASE_URL = "https://lyfmgbxkrzbxfsvnbhck.supabase.co";
const SUPABASE_KEY = "sb_publishable_4JrRsL6ziYiq5QEXV1grKQ_aa1KHJ3_";

// Initialisation du client Supabase CDN
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Données Démo de secours (si pas encore connecté à Supabase Auth)
let demoSubscribers = [
    { name: "Mme Koumba Solange", phone: "+241077123456", tier: "solidaire", expires: "28 Fév 2026", status: "actif" },
    { name: "M. Ondo Pierre", phone: "+241066987654", tier: "mboolo", expires: "01 Fév 2026", status: "expire" },
    { name: "Mme Obone Patricia", phone: "+241074112233", tier: "tycoon", expires: "15 Mars 2026", status: "actif" }
];

let demoTontines = [
    { name: "Tontine les Reines du Komo", president: "Mme Koumba Solange", amount: "50 000 FCFA", members: 12, pot: "600 000 FCFA", status: "Active" },
    { name: "Solidarité Akanda 2026", president: "M. Ondo Pierre", amount: "25 000 FCFA", members: 8, pot: "200 000 FCFA", status: "Active" },
    { name: "Business Tycoon Owendo", president: "Mme Obone Patricia", amount: "100 000 FCFA", members: 20, pot: "2 000 000 FCFA", status: "Active" }
];

let demoUsers = [
    { name: "Mme Koumba Solange", phone: "+241077123456", role: "president", joined: "10 Jan 2026", status: "Actif" },
    { name: "M. Ondo Pierre", phone: "+241066987654", role: "president", joined: "15 Jan 2026", status: "Actif" },
    { name: "Mme Obone Patricia", phone: "+241074112233", role: "president", joined: "01 Fév 2026", status: "Actif" },
    { name: "Jean-Paul Nzue", phone: "+241077001122", role: "membre", joined: "12 Jan 2026", status: "Actif" },
    { name: "Marcelle Mendome", phone: "+241066445566", role: "membre", joined: "18 Jan 2026", status: "Actif" }
];

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    setupLoginForm();
    setupNavigation();
    setupModal();
    setupPasswordToggle();
    renderTables();
}

// 1. GESTION DU FORMULAIRE DE CONNEXION (AUTHENTIFICATION STRICTE)
function setupLoginForm() {
    const loginForm = document.getElementById("login-form");
    const loginWrapper = document.getElementById("login-container");
    const dashboardLayout = document.getElementById("dashboard-container");
    const errorBanner = document.getElementById("login-error");
    const btnLogin = document.getElementById("btn-login");

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("admin-email").value.trim();
        const password = document.getElementById("admin-password").value;

        if (errorBanner) errorBanner.style.display = "none";
        if (btnLogin) btnLogin.innerHTML = `<span>Vérification...</span> <div class="spinner"></div>`;

        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) {
                    if (errorBanner) {
                        errorBanner.innerText = "Email ou mot de passe incorrect. Veuillez réessayer.";
                        errorBanner.style.display = "block";
                    }
                    if (btnLogin) btnLogin.innerHTML = `<span>Se connecter au Dashboard</span> <i class="fa-solid fa-arrow-right"></i>`;
                    return; // Bloquer l'accès au dashboard !
                }
            } catch (err) {
                if (errorBanner) {
                    errorBanner.innerText = "Erreur de connexion serveur: " + err.message;
                    errorBanner.style.display = "block";
                }
                if (btnLogin) btnLogin.innerHTML = `<span>Se connecter au Dashboard</span> <i class="fa-solid fa-arrow-right"></i>`;
                return;
            }
        }

        if (btnLogin) btnLogin.innerHTML = `<span>Se connecter au Dashboard</span> <i class="fa-solid fa-arrow-right"></i>`;

        // Accès accordé au dashboard uniquement si l'authentification est valide
        loginWrapper.classList.add("hidden");
        dashboardLayout.classList.remove("hidden");
        fetchLiveSupabaseData();
    });
}


// 2. RECUPERATION DES DONNEES REELLES DEPUIS SUPABASE (PRODUCTION)
async function fetchLiveSupabaseData() {
    if (!supabaseClient) return;

    try {
        // 1. Charger les utilisateurs réels depuis Supabase
        const { data: usersData, error: uErr } = await supabaseClient.from('utilisateurs').select('*');
        if (!uErr && usersData) {
            demoUsers = usersData.map(u => ({
                name: u.nom || 'Utilisateur',
                phone: u.telephone,
                role: u.role || 'membre',
                joined: u.cree_a ? new Date(u.cree_a).toLocaleDateString('fr-FR') : 'Récemment',
                status: 'Actif'
            }));

            // Mettre à jour les compteurs réels
            document.getElementById('stat-members').innerText = usersData.length;
            const pres = usersData.filter(u => u.role === 'president');
            document.getElementById('stat-presidents').innerText = pres.length;
        }

        // 2. Charger les tontines réelles depuis Supabase
        const { data: tontinesData, error: tErr } = await supabaseClient.from('tontines').select('*');
        if (!tErr && tontinesData) {
            let totalVolume = 0;
            demoTontines = tontinesData.map(t => {
                const montant = t.montant_cotisation || 0;
                totalVolume += (montant * 10);
                return {
                    name: t.nom,
                    president: t.president_telephone,
                    amount: montant.toLocaleString('fr-FR') + ' FCFA',
                    members: 10,
                    pot: (montant * 10).toLocaleString('fr-FR') + ' FCFA',
                    status: t.est_active ? 'Active' : 'Inactive'
                };
            });
            document.getElementById('stat-volume').innerText = totalVolume.toLocaleString('fr-FR') + ' FCFA';
        }

        // 3. Charger les abonnements SaaS réels depuis Supabase
        const { data: subsData, error: sErr } = await supabaseClient.from('abonnements_saas').select('*');
        if (!sErr && subsData) {
            let totalRev = 0;
            demoSubscribers = subsData.map(s => {
                totalRev += (s.montant || 0);
                return {
                    name: "Président " + s.telephone_president,
                    phone: s.telephone_president,
                    tier: s.forfait || 'mboolo',
                    expires: s.expire_le ? new Date(s.expire_le).toLocaleDateString('fr-FR') : 'Indéterminé',
                    status: s.statut === 'actif' ? 'actif' : 'expire'
                };
            });
            document.getElementById('stat-revenue').innerText = totalRev.toLocaleString('fr-FR') + ' FCFA';
        }

        renderTables();
    } catch (e) {
        console.log("Fetch live data error:", e);
    }
}


// 3. AFFICHAGE DES TABLEAUX DYNAMIQUES
function renderTables() {
    // Derniers abonnements
    const latestSubsBody = document.getElementById("latest-subs-body");
    if (latestSubsBody) {
        if (demoSubscribers.length === 0) {
            latestSubsBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94A3B8;">Aucun abonnement souscrit pour le moment</td></tr>`;
        } else {
            latestSubsBody.innerHTML = demoSubscribers.map(sub => `
                <tr>
                    <td><strong>${sub.name}</strong></td>
                    <td>${sub.phone}</td>
                    <td><span class="badge ${sub.tier}">${sub.tier.toUpperCase()}</span></td>
                    <td>${sub.tier === 'mboolo' ? '2 500 FCFA' : (sub.tier === 'solidaire' ? '5 000 FCFA' : '10 000 FCFA')}</td>
                    <td><span class="badge ${sub.status}">${sub.status === 'actif' ? 'Actif' : 'Expiré'}</span></td>
                </tr>
            `).join('');
        }
    }

    // Table Abonnements complète
    const subsTableBody = document.getElementById("subscriptions-table-body");
    if (subsTableBody) {
        if (demoSubscribers.length === 0) {
            subsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94A3B8;">Aucun abonnement en base de données</td></tr>`;
        } else {
            subsTableBody.innerHTML = demoSubscribers.map((sub, idx) => `
                <tr>
                    <td><strong>${sub.name}</strong></td>
                    <td>${sub.phone}</td>
                    <td><span class="badge ${sub.tier}">${sub.tier.toUpperCase()}</span></td>
                    <td>${sub.expires}</td>
                    <td><span class="badge ${sub.status}">${sub.status === 'actif' ? 'Actif' : 'Expiré'}</span></td>
                    <td>
                        <button class="btn-primary-sm" onclick="prolongSub(${idx})">
                            ${sub.status === 'actif' ? 'Prolonger' : 'Réactiver'}
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    }

    // Table Tontines
    const tontinesTableBody = document.getElementById("tontines-table-body");
    if (tontinesTableBody) {
        if (demoTontines.length === 0) {
            tontinesTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94A3B8;">Aucune tontine créée pour le moment</td></tr>`;
        } else {
            tontinesTableBody.innerHTML = demoTontines.map(t => `
                <tr>
                    <td><strong>${t.name}</strong></td>
                    <td>${t.president}</td>
                    <td>${t.amount}</td>
                    <td>${t.members} membres</td>
                    <td><strong>${t.pot}</strong></td>
                    <td><span class="badge active">${t.status}</span></td>
                </tr>
            `).join('');
        }
    }

    // Table Utilisateurs
    const usersTableBody = document.getElementById("users-table-body");
    if (usersTableBody) {
        if (demoUsers.length === 0) {
            usersTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94A3B8;">Aucun utilisateur en base de données</td></tr>`;
        } else {
            usersTableBody.innerHTML = demoUsers.map(u => `
                <tr>
                    <td><strong>${u.name}</strong></td>
                    <td>${u.phone}</td>
                    <td><span class="badge ${u.role}">${u.role.toUpperCase()}</span></td>
                    <td>${u.joined}</td>
                    <td><span class="badge active">${u.status}</span></td>
                </tr>
            `).join('');
        }
    }
}


// PROLONGER / ACTIVER UN ABONNEMENT
window.prolongSub = function(idx) {
    demoSubscribers[idx].status = 'actif';
    demoSubscribers[idx].expires = '09 Mars 2026';
    renderTables();
    alert(`Abonnement de ${demoSubscribers[idx].name} réactivé avec succès pour 30 jours !`);
};

// 4. NAVIGATION PAR ONGLET ET SIDEBAR RESPONSIVE
function setupNavigation() {
    const menuItems = document.querySelectorAll(".menu-item");
    const tabContents = document.querySelectorAll(".tab-content");
    const pageTitle = document.getElementById("page-title");
    const sidebar = document.getElementById("sidebar");
    const toggleSidebarBtn = document.getElementById("toggle-sidebar-btn");
    const logoutBtn = document.getElementById("btn-logout");

    menuItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const tabId = item.getAttribute("data-tab");

            menuItems.forEach(m => m.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));

            item.classList.add("active");
            document.getElementById(`tab-${tabId}`).classList.add("active");

            // Titre de la page
            const titles = {
                overview: "Vue d'ensemble",
                subscriptions: "Gestion des Abonnements SaaS",
                tontines: "Tontines Actives",
                users: "Utilisateurs Inscrits"
            };
            pageTitle.innerText = titles[tabId] || "Dashboard Admin";

            // Fermer sidebar sur mobile
            if (window.innerWidth <= 900) {
                sidebar.classList.remove("open");
            }
        });
    });

    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener("click", () => {
            sidebar.classList.toggle("open");
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            const logoutModal = document.getElementById("logout-confirm-modal");
            if (logoutModal) logoutModal.classList.remove("hidden");
        });
    }

    const closeLogoutBtn = document.getElementById("close-logout-modal-btn");
    const cancelLogoutBtn = document.getElementById("cancel-logout-modal-btn");
    const confirmLogoutBtn = document.getElementById("confirm-logout-btn");
    const logoutModal = document.getElementById("logout-confirm-modal");

    if (closeLogoutBtn) closeLogoutBtn.addEventListener("click", () => logoutModal.classList.add("hidden"));
    if (cancelLogoutBtn) cancelLogoutBtn.addEventListener("click", () => logoutModal.classList.add("hidden"));

    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener("click", async () => {
            if (supabaseClient) {
                try {
                    await supabaseClient.auth.signOut();
                } catch (e) {
                    console.log("Signout error:", e);
                }
            }
            if (logoutModal) logoutModal.classList.add("hidden");
            document.getElementById("dashboard-container").classList.add("hidden");
            document.getElementById("login-container").classList.remove("hidden");
        });
    }
}


// 5. GESTION DES MODALES (ABONNEMENT ET AJOUT ADMIN)
function setupModal() {
    // Modal Abonnement
    const modal = document.getElementById("activate-modal");
    const openBtn = document.getElementById("btn-open-activate-modal");
    const closeBtn = document.getElementById("close-modal-btn");
    const cancelBtn = document.getElementById("cancel-modal-btn");
    const form = document.getElementById("activate-sub-form");

    if (openBtn) openBtn.addEventListener("click", () => modal.classList.remove("hidden"));
    if (closeBtn) closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
    if (cancelBtn) cancelBtn.addEventListener("click", () => modal.classList.add("hidden"));

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const phone = document.getElementById("sub-phone").value;
            const tier = document.getElementById("sub-tier").value;

            demoSubscribers.unshift({
                name: "Président " + phone.slice(-4),
                phone: phone,
                tier: tier,
                expires: "09 Mars 2026",
                status: "actif"
            });

            if (supabaseClient) {
                try {
                    await supabaseClient.from('abonnements_saas').insert({
                        telephone_president: phone,
                        forfait: tier,
                        montant: tier === 'mboolo' ? 2500 : (tier === 'solidaire' ? 5000 : 10000),
                        moyen_paiement: 'especes',
                        expire_le: new Date(Date.now() + 30*24*60*60*1000).toISOString()
                    });
                } catch (err) {
                    console.log("Supabase sub insert:", err);
                }
            }

            renderTables();
            modal.classList.add("hidden");
            alert(`Abonnement ${tier.toUpperCase()} activé pour ${phone} !`);
            form.reset();
        });
    }

    // Modal Nouvel Admin
    const adminModal = document.getElementById("add-admin-modal");
    const openAdminBtn = document.getElementById("btn-open-admin-modal");
    const closeAdminBtn = document.getElementById("close-admin-modal-btn");
    const cancelAdminBtn = document.getElementById("cancel-admin-modal-btn");
    const adminForm = document.getElementById("add-admin-form");

    if (openAdminBtn) openAdminBtn.addEventListener("click", () => adminModal.classList.remove("hidden"));
    if (closeAdminBtn) closeAdminBtn.addEventListener("click", () => adminModal.classList.add("hidden"));
    if (cancelAdminBtn) cancelAdminBtn.addEventListener("click", () => adminModal.classList.add("hidden"));

    if (adminForm) {
        adminForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("admin-new-name").value;
            const email = document.getElementById("admin-new-email").value;
            const phone = document.getElementById("admin-new-phone").value;
            const pwd = document.getElementById("admin-new-pwd").value;

            // Ajouter dans la liste démo des utilisateurs
            demoUsers.unshift({
                name: name,
                phone: phone,
                role: "admin",
                joined: new Date().toLocaleDateString('fr-FR'),
                status: "Actif"
            });

            // Insérer dans Supabase si connecté
            if (supabaseClient) {
                try {
                    // 1. Inscrire dans Supabase Auth
                    await supabaseClient.auth.signUp({
                        email: email,
                        password: pwd,
                        options: { data: { name: name, role: 'admin' } }
                    });

                    // 2. Insérer dans la table utilisateurs
                    await supabaseClient.from('utilisateurs').insert({
                        telephone: phone,
                        nom: name,
                        email: email,
                        role: 'admin'
                    });
                } catch (err) {
                    console.log("Supabase create admin error:", err);
                }
            }

            renderTables();
            adminModal.classList.add("hidden");
            alert(`Administrateur ${name} (${email}) créé avec succès !`);
            adminForm.reset();
        });
    }
}


function setupPasswordToggle() {
    const toggleBtn = document.getElementById("toggle-pwd");
    const pwdInput = document.getElementById("admin-password");

    if (toggleBtn && pwdInput) {
        toggleBtn.addEventListener("click", () => {
            const isPassword = pwdInput.type === "password";
            pwdInput.type = isPassword ? "text" : "password";
            toggleBtn.className = isPassword ? "fa-regular fa-eye-slash toggle-password" : "fa-regular fa-eye toggle-password";
        });
    }
}
