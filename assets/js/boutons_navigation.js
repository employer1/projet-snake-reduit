const nativeAlert = window.alert.bind(window);

window.alert = (message) => {
    const elementActifAvantAlerte = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    nativeAlert(message);

    if (elementActifAvantAlerte) {
        elementActifAvantAlerte.focus();
        if (typeof elementActifAvantAlerte.select === "function") {
            elementActifAvantAlerte.select();
        }
    }
};

// Navigation: tous les boutons qui ont data-page
document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
        const page = button.dataset.page;
        if (page) window.location.href = page;
    });
});

// Quitter
const quitterBtn = document.getElementById("quitter-bouton");
if (quitterBtn) {
    quitterBtn.addEventListener("click", () => {
        // Mode Electron (plus tard) :
        // window.electron?.quitApp?.();

        // Mode Web (maintenant) :
        // window.close() ne marche que si la fenêtre a été ouverte par JavaScript.
        // Donc on propose une alternative propre :
        const ok = confirm("Fermer l'application / l'onglet ?");
        if (!ok) return;

        window.close();

        // fallback si le navigateur bloque window.close()
        // (par exemple si l'onglet n'a pas été ouvert via window.open)
        setTimeout(() => {
            if (!document.hidden) {
                alert("Le navigateur a bloqué la fermeture automatique. Tu peux fermer l'onglet manuellement.");
            }
        }, 150);
    });
}

const boutonRetour = document.getElementById("btn-back");
if (boutonRetour) {
    boutonRetour.addEventListener("click", () => {
        window.history.back();
    });
}
