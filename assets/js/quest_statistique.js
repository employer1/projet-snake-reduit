/*fichier JS de quest_statistique.html*/
(() => {
    const canvas = document.getElementById("stats-chart");
    const emptyMessage = document.querySelector(".stats-empty");
    const elementNbTotalQuestion = document.getElementById("nb-total-question");
    const elementNbTotalQuestionnaire = document.getElementById("nb-total-questionnaire");
    const elementNbTotalReponse = document.getElementById("nb-total-reponse");
    const elementTauxBonneReponse = document.getElementById("taux-bonne-reponse");
    const fichierStatistiques = "stat_quest.json";
    const nombreSemaines = 20;

    if (!canvas) return;

    let statsFileHandle = null;

    const obtenirHandleStatistiques = async () => {
        if (!("storage" in navigator) || typeof navigator.storage.getDirectory !== "function") {
            return null;
        }
        if (!statsFileHandle) {
            const racine = await navigator.storage.getDirectory();
            const dossierQuest = await racine.getDirectoryHandle("quest", { create: true });
            const dossierStat = await dossierQuest.getDirectoryHandle("stat", { create: true });
            statsFileHandle = await dossierStat.getFileHandle(fichierStatistiques, { create: true });
        }
        return statsFileHandle;
    };

    const chargerStatistiques = async () => {
        if (window.electronAPI?.loadQuestStats) {
            try {
                const statsElectron = await window.electronAPI.loadQuestStats();
                if (statsElectron) {
                    return statsElectron;
                }
            } catch {
                // Fallbacks gérés plus bas.
            }
        }

        const handle = await obtenirHandleStatistiques();
        if (handle) {
            try {
                const fichier = await handle.getFile();
                if (fichier.size > 0) {
                    const contenu = await fichier.text();
                    return JSON.parse(contenu);
                }
            } catch {
                // Fallbacks gérés plus bas.
            }
        }

        try {
            const reponse = await fetch(`../quest/stat/${fichierStatistiques}`, { cache: "no-store" });
            if (!reponse.ok) {
                return { historique: [] };
            }
            return await reponse.json();
        } catch {
            return { historique: [] };
        }
    };

    const parserDate = (valeur) => {
        if (!valeur || typeof valeur !== "string") return null;
        const [jour, mois, annee] = valeur.split("-").map((part) => Number(part));
        if (!jour || !mois || !annee) return null;
        const date = new Date(annee, mois - 1, jour);
        if (Number.isNaN(date.getTime())) return null;
        return date;
    };

    const obtenirDebutSemaine = (date) => {
        const debut = new Date(date);
        const jour = debut.getDay();
        const decalage = (jour + 6) % 7;
        debut.setDate(debut.getDate() - decalage);
        debut.setHours(0, 0, 0, 0);
        return debut;
    };

    const construireSemaines = (dateReference) => {
        const fin = obtenirDebutSemaine(dateReference);
        const debut = new Date(fin);
        debut.setDate(fin.getDate() - (nombreSemaines - 1) * 7);
        const semaines = [];
        for (let i = 0; i < nombreSemaines; i += 1) {
            const semaine = new Date(debut);
            semaine.setDate(debut.getDate() + i * 7);
            semaines.push(semaine);
        }
        return semaines;
    };

    const agregerSemaines = (statistiques) => {
        const semaines = construireSemaines(new Date());
        const debut = semaines[0];
        const fin = semaines[semaines.length - 1];
        const buckets = new Map();

        statistiques.forEach((stat) => {
            const date = parserDate(stat.date);
            const nombreQuestion = Number(stat.nombre_question);
            const nombreReponse = Number(stat.nombre_reponse);
            if (!date || !Number.isFinite(nombreQuestion) || !Number.isFinite(nombreReponse)) return;
            const semaine = obtenirDebutSemaine(date);
            if (semaine < debut || semaine > fin) return;
            const cle = semaine.toISOString();
            const actuel = buckets.get(cle) || {
                totalQuestions: 0,
                totalReponses: 0,
                count: 0,
            };
            actuel.totalQuestions += nombreQuestion;
            actuel.totalReponses += nombreReponse;
            actuel.count += 1;
            buckets.set(cle, actuel);
        });

        const valeursQuestions = semaines.map((semaine) => {
            const bucket = buckets.get(semaine.toISOString());
            if (!bucket || bucket.count === 0) return 0;
            return Math.round(bucket.totalQuestions / bucket.count);
        });

        const valeursReponses = semaines.map((semaine) => {
            const bucket = buckets.get(semaine.toISOString());
            if (!bucket || bucket.count === 0) return 0;
            return Math.round(bucket.totalReponses / bucket.count);
        });

        return { semaines, valeursQuestions, valeursReponses };
    };

    const dessinerLigne = (ctx, valeurs, couleur, padding, innerHeight, maxGraduation, stepX) => {
        ctx.strokeStyle = couleur;
        ctx.lineWidth = 2;
        ctx.beginPath();
        valeurs.forEach((valeur, index) => {
            const x = padding.left + stepX * index;
            const y = padding.top + innerHeight - (valeur / maxGraduation) * innerHeight;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        ctx.fillStyle = couleur;
        valeurs.forEach((valeur, index) => {
            const x = padding.left + stepX * index;
            const y = padding.top + innerHeight - (valeur / maxGraduation) * innerHeight;
            ctx.beginPath();
            ctx.arc(x, y, 3.5, 0, Math.PI * 2);
            ctx.fill();
        });
    };

    const dessinerGraphique = (semaines, valeursQuestions, valeursReponses) => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const ratio = window.devicePixelRatio || 1;
        const largeur = canvas.clientWidth;
        const hauteur = canvas.clientHeight;
        canvas.width = largeur * ratio;
        canvas.height = hauteur * ratio;
        ctx.scale(ratio, ratio);

        ctx.clearRect(0, 0, largeur, hauteur);

        const padding = { top: 24, right: 24, bottom: 36, left: 48 };
        const innerWidth = largeur - padding.left - padding.right;
        const innerHeight = hauteur - padding.top - padding.bottom;

        const maxValeur = Math.max(1, ...valeursQuestions, ...valeursReponses);
        const pasGraduation = 10;
        const maxGraduation = Math.max(pasGraduation, Math.ceil(maxValeur / pasGraduation) * pasGraduation);
        const stepX = innerWidth / (semaines.length - 1 || 1);

        ctx.strokeStyle = "#ffffff2f";
        ctx.lineWidth = 1;
        ctx.fillStyle = "#ffffffb5";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        for (let valeur = 0; valeur <= maxGraduation; valeur += pasGraduation) {
            const y = padding.top + innerHeight - (valeur / maxGraduation) * innerHeight;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + innerWidth, y);
            ctx.stroke();
            ctx.fillText(`${valeur}`, padding.left - 8, y);
        }

        dessinerLigne(ctx, valeursQuestions, "#7cc7ff", padding, innerHeight, maxGraduation, stepX);
        dessinerLigne(ctx, valeursReponses, "#66e49c", padding, innerHeight, maxGraduation, stepX);

        ctx.fillStyle = "#ffffffb5";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const stepLabel = 4;
        semaines.forEach((semaine, index) => {
            if (index % stepLabel !== 0 && index !== semaines.length - 1) return;
            const label = semaine.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
            const x = padding.left + stepX * index;
            const y = padding.top + innerHeight + 8;
            ctx.fillText(label, x, y);
        });
    };

    const afficherResume = (stats) => {
        const nbTotalQuestion = Number(stats.nb_total_question) || 0;
        const nbTotalQuestionnaire = Number(stats.nb_total_questionnaire) || 0;
        const nbTotalReponse = Number(stats.nb_total_reponse) || 0;
        const tauxBonneReponse =
            nbTotalQuestion > 0 ? Math.round((nbTotalReponse / nbTotalQuestion) * 100) : 0;

        if (elementNbTotalQuestion) {
            elementNbTotalQuestion.textContent = `${nbTotalQuestion}`;
        }
        if (elementNbTotalQuestionnaire) {
            elementNbTotalQuestionnaire.textContent = `${nbTotalQuestionnaire}`;
        }
        if (elementNbTotalReponse) {
            elementNbTotalReponse.textContent = `${nbTotalReponse}`;
        }
        if (elementTauxBonneReponse) {
            elementTauxBonneReponse.textContent = `${tauxBonneReponse} %`;
        }
    };

    const initialiser = async () => {
        const stats = await chargerStatistiques();
        const liste = Array.isArray(stats.historique) ? stats.historique : [];
        afficherResume(stats);
        const { semaines, valeursQuestions, valeursReponses } = agregerSemaines(liste);

        const maxValeur = Math.max(...valeursQuestions, ...valeursReponses);
        if (emptyMessage) {
            emptyMessage.textContent =
                maxValeur === 0
                    ? "Aucune donnée enregistrée sur les 20 dernières semaines."
                    : "Moyennes hebdomadaires des questions et réponses (20 dernières semaines).";
        }

        dessinerGraphique(semaines, valeursQuestions, valeursReponses);
        window.addEventListener("resize", () => dessinerGraphique(semaines, valeursQuestions, valeursReponses));
    };

    initialiser();
})();
