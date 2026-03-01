/*fichier JS de quest_questionnaire_langue.html*/
const stockageOptionsQuest = "quest_options";
const stockageResultatsQuest = "quest_resultats";
const stockageEtatLangue = "quest_langue_etat";

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

const obtenirCleLangue = (objet, cle) => {
    if (!objet || typeof objet !== "object") return null;
    const normaliserCle = (valeur) =>
        String(valeur)
            .toLowerCase()
            .replace(/[\s_]+/g, "");
    const cleNormalisee = normaliserCle(cle);
    const cleTrouvee = Object.keys(objet).find(
        (candidate) => normaliserCle(candidate) === cleNormalisee,
    );
    return cleTrouvee || null;
};

const normaliserListe = (valeur) => {
    if (valeur === null || valeur === undefined) return [];
    if (Array.isArray(valeur)) {
        return valeur
            .map((entree) => (entree === null || entree === undefined ? "" : String(entree)))
            .map((entree) => entree.trim())
            .filter(Boolean);
    }
    if (typeof valeur === "object") {
        return Object.values(valeur)
            .map((entree) => (entree === null || entree === undefined ? "" : String(entree)))
            .map((entree) => entree.trim())
            .filter(Boolean);
    }
    const texte = String(valeur).trim();
    return texte ? [texte] : [];
};

const extraireQuestionsLangue = (questionnaire, sens) => {
    const cleSource = sens === "langue2" ? "langue 2" : "langue 1";
    const cleCible = sens === "langue2" ? "langue 1" : "langue 2";
    const questions = [];
    const dejaVu = new Set();

    const ajouterQuestion = (mot, traductions) => {
        const source = mot === null || mot === undefined ? "" : String(mot).trim();
        if (!source || dejaVu.has(source)) return;
        const traductionsNormalisees = normaliserListe(traductions);
        dejaVu.add(source);
        questions.push({
            mot: source,
            traductions: traductionsNormalisees,
        });
    };

    const extraireDepuisObjet = (objetSource, objetCible) => {
        if (!objetSource || typeof objetSource !== "object" || Array.isArray(objetSource)) return;
        Object.entries(objetSource).forEach(([mot, traductions]) => {
            let traductionsCible = traductions;
            if (objetCible && typeof objetCible === "object" && !Array.isArray(objetCible)) {
                traductionsCible = objetCible[mot] ?? traductions;
            }
            ajouterQuestion(mot, traductionsCible);
        });
    };

    if (Array.isArray(questionnaire.questionnaire)) {
        questionnaire.questionnaire.forEach((entree) => {
            if (!entree || typeof entree !== "object") return;
            const cleSourceEntree = obtenirCleLangue(entree, cleSource);
            const cleCibleEntree = obtenirCleLangue(entree, cleCible);
            if (!cleSourceEntree) return;
            const sourceEntree = entree[cleSourceEntree];
            const cibleEntree = cleCibleEntree ? entree[cleCibleEntree] : null;
            if (sourceEntree && typeof sourceEntree === "object" && !Array.isArray(sourceEntree)) {
                extraireDepuisObjet(sourceEntree, cibleEntree);
            } else {
                ajouterQuestion(sourceEntree, cibleEntree || []);
            }
        });
    }

    const langueSource = questionnaire[obtenirCleLangue(questionnaire, cleSource)];
    const langueCible = questionnaire[obtenirCleLangue(questionnaire, cleCible)];

    if (Array.isArray(langueSource) && Array.isArray(langueCible)) {
        const limite = Math.min(langueSource.length, langueCible.length);
        for (let i = 0; i < limite; i += 1) {
            ajouterQuestion(langueSource[i], langueCible[i]);
        }
    } else if (langueSource && typeof langueSource === "object" && !Array.isArray(langueSource)) {
        Object.entries(langueSource).forEach(([mot, traductions]) => {
            ajouterQuestion(mot, traductions);
        });
    } else if (Array.isArray(langueSource)) {
        langueSource.forEach((mot) => {
            ajouterQuestion(mot, []);
        });
    }

    return questions;
};

const melanger = (liste) => {
    const copie = [...liste];
    for (let i = copie.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
};

const creerChrono = (element, tempsInitial = 0, actif = true) => {
    if (!element || !actif) {
        return {
            arreter: () => {},
            lire: () => "",
            ecoule: () => 0,
        };
    }
    let tempsEcoule = tempsInitial;
    let depart = Date.now();
    let intervalle = null;

    const rafraichir = () => {
        const total = tempsEcoule + (Date.now() - depart);
        const totalSecondes = Math.floor(total / 1000);
        const minutes = String(Math.floor(totalSecondes / 60)).padStart(2, "0");
        const secondes = String(totalSecondes % 60).padStart(2, "0");
        element.textContent = `${minutes}:${secondes}`;
    };

    rafraichir();
    intervalle = window.setInterval(rafraichir, 1000);

    return {
        arreter: () => intervalle && window.clearInterval(intervalle),
        lire: () => element.textContent,
        ecoule: () => tempsEcoule + (Date.now() - depart),
    };
};

const initialiserElements = () => ({
    titre: document.querySelector(".section h1"),
    chrono: document.querySelector(".position_1"),
    mot: document.querySelector(".sous_corps h2"),
    champ: document.getElementById("champ-traduction"),
    boutonEnvoyer: document.getElementById("bouton-envoyer"),
    boutonFin: document.getElementById("bouton-fin"),
    compteur: document.getElementById("compteur"),
    reponseAffichee: document.getElementById("reponse-affichee"),
    boutonMenu: document.querySelector(".bouton_menu"),
    boutonParam: document.querySelector(".bouton_param"),
});

const normaliserEntreeUtilisateur = (valeur) =>
    (valeur || "")
        .trim()
        .toLocaleLowerCase("fr-FR")
        .replace(/\s+/g, " ");

document.addEventListener("DOMContentLoaded", async () => {
    const elements = initialiserElements();
    if (!elements.boutonEnvoyer || !elements.boutonFin || !elements.champ) return;

    const options = chargerOptions();
    if (!options?.questionnaire?.fichier) {
        elements.boutonEnvoyer.disabled = true;
        elements.boutonFin.disabled = true;
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

    if (!questionnaire) {
        elements.boutonEnvoyer.disabled = true;
        elements.boutonFin.disabled = true;
        return;
    }

    const sens = options.sens || "langue1";
    const questionsBrutes = extraireQuestionsLangue(questionnaire, sens);
    if (!questionsBrutes.length) {
        elements.boutonEnvoyer.disabled = true;
        elements.boutonFin.disabled = true;
        return;
    }

    const questionsMelangees = options.ordre ? melanger(questionsBrutes) : questionsBrutes;
    const totalQuestions = Math.min(
        Number(options.nombreQuestions) || questionsMelangees.length,
        questionsMelangees.length,
    );
    const questions = questionsMelangees.slice(0, totalQuestions);

    let index = 0;
    let score = 0;
    let timeoutReponse = null;
    const detailsQuestions = [];
    let chronometre = creerChrono(elements.chrono, 0, true);

    const etatSauvegarde = sessionStorage.getItem(stockageEtatLangue);
    if (etatSauvegarde) {
        try {
            const etat = JSON.parse(etatSauvegarde);
            if (
                etat?.fichier === options.questionnaire.fichier &&
                etat?.sens === sens &&
                Array.isArray(etat.questions)
            ) {
                index = etat.index || 0;
                score = etat.score || 0;
                if (etat.questions.length) {
                    questions.splice(0, questions.length, ...etat.questions);
                }
                chronometre = creerChrono(elements.chrono, etat.tempsEcoule || 0, true);
                if (Array.isArray(etat.detailsQuestions)) {
                    detailsQuestions.splice(0, detailsQuestions.length, ...etat.detailsQuestions);
                }
            } else {
                sessionStorage.removeItem(stockageEtatLangue);
            }
        } catch (error) {
            console.error("Impossible de restaurer l'état du questionnaire", error);
        }
    }

    const mettreAJourAffichage = () => {
        const question = questions[index];
        if (!question) return;
        if (elements.mot) {
            elements.mot.textContent = question.mot;
        }
        if (elements.compteur) {
            elements.compteur.textContent = `${index + 1}/${questions.length}`;
        }
        if (elements.champ) {
            elements.champ.value = "";
            elements.champ.focus();
        }
        if (elements.reponseAffichee) {
            elements.reponseAffichee.textContent = "";
        }
    };

    const sauvegarderEtat = () => {
        const etat = {
            fichier: options.questionnaire.fichier,
            sens,
            index,
            score,
            questions,
            tempsEcoule: chronometre.ecoule(),
            detailsQuestions,
        };
        sessionStorage.setItem(stockageEtatLangue, JSON.stringify(etat));
    };

    const finirQuestionnaire = async () => {
        if (timeoutReponse) {
            window.clearTimeout(timeoutReponse);
        }
        chronometre.arreter();
        sessionStorage.removeItem(stockageEtatLangue);
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

    const passerQuestionSuivante = () => {
        index += 1;
        if (index >= questions.length) {
            void finirQuestionnaire();
            return;
        }
        mettreAJourAffichage();
    };

    const afficherReponses = (reponses) => {
        if (!elements.reponseAffichee) {
            passerQuestionSuivante();
            return;
        }
        elements.reponseAffichee.textContent = `Réponse(s) : ${reponses.join(", ")}`;
        elements.boutonEnvoyer.disabled = true;
        elements.champ.disabled = true;
        timeoutReponse = window.setTimeout(() => {
            elements.boutonEnvoyer.disabled = false;
            elements.champ.disabled = false;
            timeoutReponse = null;
            passerQuestionSuivante();
        }, 4000);
    };

    const verifierReponse = () => {
        if (!questions[index]) return;
        if (timeoutReponse) return;
        const reponseUtilisateur = normaliserEntreeUtilisateur(elements.champ.value);
        const reponsesValides = questions[index].traductions
            .map((traduction) => normaliserEntreeUtilisateur(traduction))
            .filter(Boolean);

        const bonneReponse =
            reponseUtilisateur &&
            (reponsesValides.length
                ? reponsesValides.includes(reponseUtilisateur)
                : false);

        detailsQuestions.push({
            question: questions[index].mot,
            reponse: questions[index].traductions,
            correct: bonneReponse,
            reponseUtilisateur: elements.champ.value.trim(),
        });

        if (bonneReponse) {
            score += 1;
            passerQuestionSuivante();
            return;
        }

        if (options.afficherReponse && reponsesValides.length) {
            afficherReponses(reponsesValides);
        } else {
            passerQuestionSuivante();
        }
    };

    elements.boutonEnvoyer.addEventListener("click", () => verifierReponse());
    elements.champ.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            verifierReponse();
        }
    });

    elements.boutonFin.addEventListener("click", () => {
        void finirQuestionnaire();
    });

    if (elements.boutonMenu) {
        elements.boutonMenu.addEventListener("click", () => {
            sessionStorage.removeItem(stockageEtatLangue);
        });
    }

    if (elements.boutonParam) {
        const paramLien = elements.boutonParam.querySelector("[data-page]");
        elements.boutonParam.addEventListener("click", () => {
            sauvegarderEtat();
            if (paramLien?.dataset.page) {
                window.location.href = paramLien.dataset.page;
            }
        });
    }

    window.addEventListener("beforeunload", () => {
        if (!sessionStorage.getItem(stockageEtatLangue)) {
            return;
        }
        sauvegarderEtat();
    });

    mettreAJourAffichage();
});
