/*fichier JS de quest_questionnaire_alphabet.html*/
const stockageOptionsQuest = "quest_options";
const stockageResultatsQuest = "quest_resultats";

const formaterDateActuelle = () => {
    const maintenant = new Date();
    const jour = String(maintenant.getDate()).padStart(2, "0");
    const mois = String(maintenant.getMonth() + 1).padStart(2, "0");
    const annee = String(maintenant.getFullYear());
    return `${jour}-${mois}-${annee}`;
};

const convertirChronoEnSecondes = (chrono) => {
    if (!chrono) return 0;
    const segments = String(chrono).split(":").map((valeur) => Number(valeur));
    if (segments.some((valeur) => Number.isNaN(valeur))) return 0;
    if (segments.length === 3) {
        const [heures, minutes, secondes] = segments;
        return heures * 3600 + minutes * 60 + secondes;
    }
    if (segments.length === 2) {
        const [minutes, secondes] = segments;
        return minutes * 60 + secondes;
    }
    if (segments.length === 1) {
        return segments[0];
    }
    return 0;
};

const enregistrerStatsQuest = async ({ chronoSecondes, nombreQuestion, nombreReponse }) => {
    if (!window.electronAPI?.loadQuestStats || !window.electronAPI?.saveQuestStats) {
        return;
    }
    try {
        const stats = await window.electronAPI.loadQuestStats();
        const historique = Array.isArray(stats?.historique) ? stats.historique : [];
        const nbTotalQuestionnaire = Number(stats?.nb_total_questionnaire) || 0;
        const nbTotalQuestion = Number(stats?.nb_total_question) || 0;
        const nbTotalReponse = Number(stats?.nb_total_reponse) || 0;
        const nouvellesStats = {
            nb_total_questionnaire: nbTotalQuestionnaire + 1,
            nb_total_question: nbTotalQuestion + nombreQuestion,
            nb_total_reponse: nbTotalReponse + nombreReponse,
            historique: [
                ...historique,
                {
                    date: formaterDateActuelle(),
                    chrono: chronoSecondes,
                    nombre_question: nombreQuestion,
                    nombre_reponse: nombreReponse,
                },
            ],
        };
        await window.electronAPI.saveQuestStats(nouvellesStats);
    } catch (error) {
        console.error("Impossible d'enregistrer les statistiques du questionnaire", error);
    }
};

const obtenirEntreeAleatoire = (liste, entreeExclue) => {
    if (!liste.length) return null;
    if (liste.length === 1) return liste[0];
    let entree = null;
    while (!entree || entree === entreeExclue) {
        entree = liste[Math.floor(Math.random() * liste.length)];
    }
    return entree;
};

const normaliserValeur = (entree) => {
    if (entree && typeof entree === "object") {
        const premiereCle = Object.keys(entree)[0];
        if (premiereCle) {
            return String(entree[premiereCle]);
        }
    }
    if (entree === null || entree === undefined) {
        return "";
    }
    return String(entree);
};

const melangerValeurs = (valeurs) => {
    const copie = [...valeurs];
    for (let i = copie.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
};

const chargerOptions = () => {
    const brut = localStorage.getItem(stockageOptionsQuest);
    if (!brut) return null;
    try {
        return JSON.parse(brut);
    } catch (error) {
        console.error("Impossible de lire les options du questionnaire", error);
        return null;
    }
};

const initialiserElements = () => ({
    titre: document.querySelector(".section h1"),
    chrono: document.querySelector(".position_1"),
    compteur: document.getElementById("compteur"),
    valeurPrincipale: document.querySelector(".sous_corps h2"),
    valeurSecondaire: document.querySelector(".sous_corps .comparaison"),
    boutonAvant: document.querySelector("[data-action=\"avant\"]"),
    boutonApres: document.querySelector("[data-action=\"apres\"]"),
    boutonFin: document.getElementById("bouton-fin"),
});

const demarrerChrono = (element) => {
    if (!element) return { arreter: () => {}, lire: () => "00:00" };
    const debut = Date.now();
    let intervalle = null;
    const rafraichir = () => {
        const ecoule = Date.now() - debut;
        const totalSecondes = Math.floor(ecoule / 1000);
        const minutes = String(Math.floor(totalSecondes / 60)).padStart(2, "0");
        const secondes = String(totalSecondes % 60).padStart(2, "0");
        element.textContent = `${minutes}:${secondes}`;
    };
    rafraichir();
    intervalle = window.setInterval(rafraichir, 1000);
    return {
        arreter: () => intervalle && window.clearInterval(intervalle),
        lire: () => element.textContent,
    };
};

document.addEventListener("DOMContentLoaded", async () => {
    const elements = initialiserElements();
    if (!elements.boutonAvant || !elements.boutonApres || !elements.boutonFin) return;

    const options = chargerOptions();
    if (!options?.questionnaire?.fichier) {
        elements.boutonAvant.disabled = true;
        elements.boutonApres.disabled = true;
        return;
    }

    if (elements.titre) {
        elements.titre.textContent = options.questionnaire.titre || "Questionnaire";
    }

    if (elements.chrono) {
        elements.chrono.hidden = !options.chrono;
        if (!options.chrono) {
            elements.chrono.textContent = "";
        }
    }

    let questionnaire = null;
    try {
        questionnaire = await window.electronAPI?.loadQuestnaire(options.questionnaire.fichier);
    } catch (error) {
        console.error("Impossible de charger le questionnaire", error);
    }

    if (!questionnaire || !Array.isArray(questionnaire.questionnaire)) {
        elements.boutonAvant.disabled = true;
        elements.boutonApres.disabled = true;
        return;
    }

    const valeursUniques = [];
    const dejaVu = new Set();
    questionnaire.questionnaire.forEach((entree) => {
        const valeur = normaliserValeur(entree);
        if (valeur && !dejaVu.has(valeur)) {
            dejaVu.add(valeur);
            valeursUniques.push(valeur);
        }
    });

    if (!valeursUniques.length) {
        elements.boutonAvant.disabled = true;
        elements.boutonApres.disabled = true;
        return;
    }

    const valeursAffichees = options.ordre ? melangerValeurs(valeursUniques) : valeursUniques;
    const chronometre = demarrerChrono(elements.chrono);
    let index = 0;
    let score = 0;
    let valeurCourante = "";
    let comparaisonCourante = "";
    const detailsQuestions = [];

    const mettreAJourAffichage = () => {
        valeurCourante = valeursAffichees[index];
        comparaisonCourante = obtenirEntreeAleatoire(valeursAffichees, valeurCourante);
        if (elements.valeurPrincipale) {
            elements.valeurPrincipale.textContent = valeurCourante;
        }
        if (elements.valeurSecondaire) {
            elements.valeurSecondaire.textContent = comparaisonCourante
                ? `Par rapport à ${comparaisonCourante}`
                : "";
        }
        if (elements.compteur) {
            elements.compteur.textContent = `${index + 1}/${valeursAffichees.length}`;
        }
    };

    const finirQuestionnaire = async () => {
        chronometre.arreter();
        const chronoLecture = chronometre.lire();
        const nombreQuestionsRepondues = detailsQuestions.length;
        const resultats = {
            score,
            total: nombreQuestionsRepondues,
            chrono: chronoLecture,
            titre: options.questionnaire.titre || questionnaire.titre || "Questionnaire",
            questions: detailsQuestions,
        };
        localStorage.setItem(stockageResultatsQuest, JSON.stringify(resultats));
        await enregistrerStatsQuest({
            chronoSecondes: convertirChronoEnSecondes(chronoLecture),
            nombreQuestion: nombreQuestionsRepondues,
            nombreReponse: score,
        });
        window.location.href = "../pages/quest_resultats.html";
    };

    const traiterReponse = (type) => {
        const valeurA = valeurCourante.toLocaleLowerCase("fr-FR");
        const valeurB = comparaisonCourante.toLocaleLowerCase("fr-FR");
        const comparaison = valeurA.localeCompare(valeurB, "fr-FR");
        const bonneReponse = type === "avant" ? comparaison < 0 : comparaison > 0;
        const reponseAttendue = comparaison < 0 ? "Avant" : comparaison > 0 ? "Après" : "Égal";
        const reponseUtilisateur = type === "avant" ? "Avant" : "Après";

        detailsQuestions.push({
            question: `${valeurCourante} (par rapport à ${comparaisonCourante})`,
            reponse: reponseAttendue,
            correct: bonneReponse,
            reponseUtilisateur,
        });
        if (bonneReponse) {
            score += 1;
        }
        index += 1;
        if (index >= valeursAffichees.length) {
            void finirQuestionnaire();
            return;
        }
        mettreAJourAffichage();
    };

    elements.boutonAvant.addEventListener("click", () => traiterReponse("avant"));
    elements.boutonApres.addEventListener("click", () => traiterReponse("apres"));
    elements.boutonFin.addEventListener("click", () => void finirQuestionnaire());

    mettreAJourAffichage();
});
