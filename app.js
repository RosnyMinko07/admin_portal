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

// Échappe le texte avant de l'insérer en HTML : noms de tontines, noms et
// numéros sont saisis par les utilisateurs et ne doivent jamais être
// interprétés comme du code dans la session d'un administrateur.
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    setupLoginForm();
    setupNavigation();
    setupModal();
    renderTables();
}

// 1. CONNEXION DES ADMINISTRATEURS : COMPTE GOOGLE UNIQUEMENT
// Le portail ne décide rien seul : c'est la base (fonction est_admin) qui
// confirme qu'il s'agit d'une session Google d'un profil administrateur.
const LIBELLE_BOUTON = `<i class="fa-brands fa-google"></i> <span>Se connecter avec Google</span>`;

function afficherErreurConnexion(message) {
    const banner = document.getElementById("login-error");
    if (banner) {
        banner.innerText = message;
        banner.style.display = "block";
    }
    const btn = document.getElementById("btn-login");
    if (btn) btn.innerHTML = LIBELLE_BOUTON;
}

function afficherDashboard() {
    document.getElementById("login-container").classList.add("hidden");
    document.getElementById("dashboard-container").classList.remove("hidden");
    fetchLiveSupabaseData();
}

// Au retour de Google (ou au rechargement), vérifie la session ouverte.
async function verifierSessionAdmin() {
    // Échec côté Google/Supabase : l'erreur revient dans l'adresse de la page.
    const params = new URLSearchParams(
        window.location.hash.slice(1) || window.location.search.slice(1)
    );
    const erreurRetour = params.get("error_description") || params.get("error");
    if (erreurRetour) {
        history.replaceState(null, "", window.location.pathname);
        let message = erreurRetour;
        try { message = decodeURIComponent(erreurRetour); } catch (_) { /* déjà lisible */ }
        afficherErreurConnexion("Connexion Google refusée : " + message);
        return;
    }

    const { data } = await supabaseClient.auth.getSession();
    if (!data.session) return;

    // Étape 1 : session Google d'un profil administrateur ?
    const { data: estAdminGoogle, error } = await supabaseClient.rpc('est_admin_google');
    if (error || estAdminGoogle !== true) {
        await supabaseClient.auth.signOut();
        afficherErreurConnexion(
            "Ce compte Google n'a pas les droits administrateur TONTI."
        );
        return;
    }

    // Étape 2 : code de l'application d'authentification (niveau aal2).
    const { data: niveau } = await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if (niveau && niveau.currentLevel === 'aal2') {
        await ouvrirDashboardSiAdmin();
    } else {
        await demarrerEtapeCode();
    }
}

// Ouvre le dashboard seulement si la base confirme les droits complets.
async function ouvrirDashboardSiAdmin() {
    const { data: estAdmin, error } = await supabaseClient.rpc('est_admin');
    if (error || estAdmin !== true) {
        await supabaseClient.auth.signOut();
        masquerEtapeCode();
        afficherErreurConnexion("Droits administrateur non confirmés. Reconnectez-vous.");
        return;
    }
    masquerEtapeCode();
    afficherDashboard();
}

// --- 2e étape : code à 6 chiffres (Google Authenticator, etc.) ---
let facteurMfa = null;

function afficherErreurCode(message) {
    const banner = document.getElementById("mfa-error");
    banner.innerText = message;
    banner.style.display = message ? "block" : "none";
}

function masquerEtapeCode() {
    document.getElementById("mfa-step").classList.add("hidden");
    document.getElementById("login-form").classList.remove("hidden");
}

async function demarrerEtapeCode() {
    document.getElementById("login-form").classList.add("hidden");
    document.getElementById("mfa-step").classList.remove("hidden");
    afficherErreurCode("");

    const { data: facteurs, error } = await supabaseClient.auth.mfa.listFactors();
    if (error) {
        afficherErreurCode("Impossible de lire vos facteurs de sécurité : " + error.message);
        return;
    }

    const verifie = (facteurs.totp || []).find(f => f.status === 'verified');
    if (verifie) {
        // Connexion habituelle : on demande le code.
        facteurMfa = verifie.id;
        document.getElementById("mfa-intro").innerText =
            "Saisissez le code à 6 chiffres affiché dans votre application d'authentification.";
        document.getElementById("mfa-enrolement").classList.add("hidden");
    } else {
        // Première connexion : on retire un éventuel enrôlement inachevé,
        // puis on affiche le QR code à scanner.
        for (const f of (facteurs.all || [])) {
            if (f.factor_type === 'totp' && f.status !== 'verified') {
                await supabaseClient.auth.mfa.unenroll({ factorId: f.id });
            }
        }
        const { data: enrol, error: errEnrol } = await supabaseClient.auth.mfa.enroll({
            factorType: 'totp',
            friendlyName: 'TONTI Admin'
        });
        if (errEnrol) {
            afficherErreurCode("Activation de la double authentification impossible : " + errEnrol.message);
            return;
        }
        facteurMfa = enrol.id;
        document.getElementById("mfa-intro").innerText =
            "Première connexion : scannez ce QR code avec Google Authenticator " +
            "(ou une application similaire), puis saisissez le code affiché.";
        document.getElementById("mfa-qr").src = enrol.totp.qr_code;
        document.getElementById("mfa-cle").innerText = enrol.totp.secret;
        document.getElementById("mfa-enrolement").classList.remove("hidden");
    }
    document.getElementById("mfa-code").value = "";
    document.getElementById("mfa-code").focus();
}

async function validerCode() {
    const code = document.getElementById("mfa-code").value.trim();
    if (!/^\d{6}$/.test(code)) {
        afficherErreurCode("Saisissez les 6 chiffres du code.");
        return;
    }
    const btn = document.getElementById("btn-mfa");
    btn.disabled = true;
    const { error } = await supabaseClient.auth.mfa.challengeAndVerify({
        factorId: facteurMfa,
        code
    });
    btn.disabled = false;
    if (error) {
        afficherErreurCode("Code incorrect ou expiré. Réessayez avec le code affiché.");
        document.getElementById("mfa-code").value = "";
        return;
    }
    await ouvrirDashboardSiAdmin();
}

function setupLoginForm() {
    const btnLogin = document.getElementById("btn-login");

    if (!supabaseClient) {
        afficherErreurConnexion("Service d'authentification indisponible. Réessayez plus tard.");
        if (btnLogin) btnLogin.disabled = true;
        return;
    }

    btnLogin.addEventListener("click", async () => {
        const banner = document.getElementById("login-error");
        if (banner) banner.style.display = "none";
        btnLogin.innerHTML = `<span>Redirection vers Google...</span> <div class="spinner"></div>`;

        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            // Retour sur cette page après la connexion Google.
            options: { redirectTo: window.location.origin + window.location.pathname }
        });
        if (error) {
            afficherErreurConnexion("Connexion Google impossible : " + error.message);
        }
    });

    document.getElementById("btn-mfa").addEventListener("click", validerCode);
    document.getElementById("mfa-code").addEventListener("keydown", (e) => {
        if (e.key === "Enter") validerCode();
    });
    document.getElementById("btn-mfa-annuler").addEventListener("click", async () => {
        await supabaseClient.auth.signOut();
        masquerEtapeCode();
    });

    verifierSessionAdmin().catch(() =>
        afficherErreurConnexion("Erreur de connexion au serveur. Réessayez.")
    );
}


// 2. RECUPERATION DES DONNEES REELLES DEPUIS SUPABASE (PRODUCTION)
async function fetchLiveSupabaseData() {
    if (!supabaseClient) return;

    // Un admin connecté ne doit jamais voir les données de démonstration.
    demoUsers = [];
    demoTontines = [];
    demoSubscribers = [];
    renderTables();

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
                    <td><strong>${esc(sub.name)}</strong></td>
                    <td>${esc(sub.phone)}</td>
                    <td><span class="badge ${esc(sub.tier)}">${esc(sub.tier).toUpperCase()}</span></td>
                    <td>${sub.tier === 'mboolo' ? '2 500 FCFA' : (sub.tier === 'solidaire' ? '5 000 FCFA' : '10 000 FCFA')}</td>
                    <td><span class="badge ${esc(sub.status)}">${sub.status === 'actif' ? 'Actif' : 'Expiré'}</span></td>
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
                    <td><strong>${esc(sub.name)}</strong></td>
                    <td>${esc(sub.phone)}</td>
                    <td><span class="badge ${esc(sub.tier)}">${esc(sub.tier).toUpperCase()}</span></td>
                    <td>${esc(sub.expires)}</td>
                    <td><span class="badge ${esc(sub.status)}">${sub.status === 'actif' ? 'Actif' : 'Expiré'}</span></td>
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
                    <td><strong>${esc(t.name)}</strong></td>
                    <td>${esc(t.president)}</td>
                    <td>${esc(t.amount)}</td>
                    <td>${esc(t.members)} membres</td>
                    <td><strong>${esc(t.pot)}</strong></td>
                    <td><span class="badge active">${esc(t.status)}</span></td>
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
                    <td><strong>${esc(u.name)}</strong></td>
                    <td>${esc(u.phone)}</td>
                    <td><span class="badge ${esc(u.role)}">${esc(u.role).toUpperCase()}</span></td>
                    <td>${esc(u.joined)}</td>
                    <td><span class="badge active">${esc(u.status)}</span></td>
                </tr>
            `).join('');
        }
    }
}


const PRIX_FORFAITS = { mboolo: 2500, solidaire: 5000, tycoon: 10000 };

// Active (ou prolonge) un forfait de 30 jours pour un président, après un
// paiement reçu hors application (espèces). Écrit l'historique dans
// abonnements_saas et met à jour le profil ; autorisé par la RLS pour un admin.
const MOYENS_PAIEMENT = ['airtel_money', 'moov_money', 'especes', 'manuel_admin'];

async function activerAbonnement(phone, tier, moyen = 'manuel_admin') {
    if (!MOYENS_PAIEMENT.includes(moyen)) throw new Error("Moyen de paiement inconnu");
    if (!supabaseClient) throw new Error("Service indisponible");
    if (!/^\+241\d{9}$/.test(phone)) throw new Error("Numéro invalide (format attendu : +241 suivi de 9 chiffres)");
    if (!PRIX_FORFAITS[tier]) throw new Error("Forfait inconnu");

    const { data: profil, error: pErr } = await supabaseClient
        .from('utilisateurs')
        .select('abonnement_expire_le')
        .eq('telephone', phone)
        .maybeSingle();
    if (pErr) throw pErr;
    if (!profil) throw new Error("Aucun utilisateur avec ce numéro : il doit d'abord se connecter à l'application");

    // Prolongation à partir de l'échéance actuelle si elle est future.
    const base = profil.abonnement_expire_le && new Date(profil.abonnement_expire_le) > new Date()
        ? new Date(profil.abonnement_expire_le)
        : new Date();
    const expire = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: aErr } = await supabaseClient.from('abonnements_saas').insert({
        telephone_president: phone,
        forfait: tier,
        montant: PRIX_FORFAITS[tier],
        moyen_paiement: moyen,
        statut: 'actif',
        expire_le: expire
    });
    if (aErr) throw aErr;

    const { error: uErr } = await supabaseClient.from('utilisateurs').update({
        role: 'president',
        abonnement_forfait: tier,
        abonnement_statut: 'actif',
        abonnement_expire_le: expire,
        modifie_a: new Date().toISOString()
    }).eq('telephone', phone);
    if (uErr) throw uErr;

    return expire;
}

// PROLONGER / ACTIVER UN ABONNEMENT
window.prolongSub = async function(idx) {
    const sub = demoSubscribers[idx];
    if (!sub) return;
    try {
        const expire = await activerAbonnement(sub.phone, sub.tier);
        alert(`Abonnement de ${sub.phone} prolongé jusqu'au ${new Date(expire).toLocaleDateString('fr-FR')}.`);
        fetchLiveSupabaseData();
    } catch (err) {
        alert("Échec de la prolongation : " + (err.message || err));
    }
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
            const loginForm = document.getElementById("login-form");
            if (loginForm) loginForm.reset();
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
            const phone = document.getElementById("sub-phone").value.replace(/\s/g, '');
            const tier = document.getElementById("sub-tier").value;

            try {
                const moyen = document.getElementById("sub-method").value;
                const expire = await activerAbonnement(phone, tier, moyen);
                modal.classList.add("hidden");
                alert(`Abonnement ${tier.toUpperCase()} activé pour ${phone} jusqu'au ${new Date(expire).toLocaleDateString('fr-FR')}.`);
                form.reset();
                fetchLiveSupabaseData();
            } catch (err) {
                alert("Échec de l'activation : " + (err.message || err));
            }
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

            if (!supabaseClient) {
                alert("Service indisponible.");
                return;
            }

            // Création côté serveur (Edge Function creer-admin) : vérifie que
            // l'appelant est admin et ne déconnecte pas la session en cours.
            const { data, error } = await supabaseClient.functions.invoke('creer-admin', {
                body: { nom: name, email: email, telephone: phone }
            });
            let message = data && data.error;
            if (error && error.context && typeof error.context.json === 'function') {
                try { message = (await error.context.json()).error; } catch (_) { /* ignoré */ }
            }
            if (error || !data || !data.success) {
                alert("Échec de la création : " + (message || "erreur inconnue"));
                return;
            }

            adminModal.classList.add("hidden");
            alert(`Administrateur ${name} (${email}) créé avec succès !`);
            adminForm.reset();
            fetchLiveSupabaseData();
        });
    }
}
