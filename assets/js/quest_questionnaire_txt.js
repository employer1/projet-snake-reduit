/*fichier JS de quest_questionnaire_txt.html*/
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

const construireCheminImage = (dossierImage, image) => {
    if (image === null || image === undefined) return null;
    const imageTexte = String(image).trim();
    if (!imageTexte) return null;

    if (/[\\/]/.test(imageTexte)) {
        return imageTexte;
    }

    const dossierTexte = dossierImage === null || dossierImage === undefined
        ? ""
        : String(dossierImage).trim();
    if (!dossierTexte) {
        return imageTexte;
    }

    const dossierSansSlash = dossierTexte.replace(/[\\/]+$/, "");
    return `${dossierSansSlash}/${imageTexte}`;
};

const extraireQuestionsTxt = (questionnaire) => {
    if (!questionnaire || !Array.isArray(questionnaire.questionnaire)) return [];
    const dossierImage = questionnaire.path ?? questionnaire.imagePath ?? "";
    return questionnaire.questionnaire
        .map((entree) => {
            if (!entree || typeof entree !== "object") return null;
            const question = entree.question ?? entree.titre ?? "";
            const reponses = normaliserListe(entree.reponse ?? entree.reponses ?? "");
            const definitions = normaliserListe(entree.def ?? "");
            const definition = definitions.join(", ");
            const libelle = question === null || question === undefined ? "" : String(question).trim();
            if (!libelle || !reponses.length) return null;
            return {
                question: libelle,
                reponses,
                definition,
                image: construireCheminImage(dossierImage, entree.image ?? entree.images ?? null),
            };
        })
        .filter(Boolean);
};

const melanger = (liste) => {
    const copie = [...liste];
    for (let i = copie.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
};

const creerChrono = (element, actif = true) => {
    if (!element || !actif) {
        return {
            arreter: () => {},
            lire: () => "",
        };
    }
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

const initialiserElements = () => ({
    titre: document.querySelector(".section h1"),
    chrono: document.querySelector(".position_1"),
    question: document.querySelector(".sous_corps h2"),
    image: document.getElementById("question-image"),
    champ: document.getElementById("champ-reponse"),
    reponseAffichee: document.getElementById("reponse-affichee"),
    boutonEnvoyer: document.getElementById("bouton-envoyer"),
    boutonFin: document.getElementById("bouton-fin"),
    compteur: document.getElementById("compteur"),
});

const normaliserEntreeUtilisateur = (valeur) =>
    (valeur || "")
        .trim()
        .toLocaleLowerCase("fr-FR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[-\s]+/g, " ");

const normaliserReponsesUtilisateur = (valeur) =>
    (valeur || "")
        .split(/[,;/\n]+/)
        .map((entree) => normaliserEntreeUtilisateur(entree))
        .filter(Boolean);

document.addEventListener("DOMContentLoaded", async () => {
    const elements = initialiserElements();
    if (!elements.boutonEnvoyer || !elements.boutonFin || !elements.champ) return;

    const options = chargerOptions();
    if (!options?.questionnaire?.fichier) {
        elements.boutonEnvoyer.disabled = true;
        elements.boutonFin.disabled = true;
        elements.champ.disabled = true;
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

    const questionsBrutes = extraireQuestionsTxt(questionnaire);
    if (!questionsBrutes.length) {
        elements.boutonEnvoyer.disabled = true;
        elements.boutonFin.disabled = true;
        elements.champ.disabled = true;
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
    const chronometre = creerChrono(elements.chrono, true);

    const mettreAJourAffichage = async () => {
        const question = questions[index];
        if (!question) return;
        if (elements.question) {
            elements.question.textContent = question.question;
        }
        if (elements.image) {
            if (question.image) {
                try {
                    const url = await window.electronAPI?.resolveQuestAsset(question.image);
                    if (url) {
                        elements.image.src = url;
                        elements.image.hidden = false;
                    } else {
                        elements.image.hidden = true;
                        elements.image.removeAttribute("src");
                    }
                } catch (error) {
                    console.error("Impossible de charger l'image du questionnaire", error);
                    elements.image.hidden = true;
                    elements.image.removeAttribute("src");
                }
            } else {
                elements.image.hidden = true;
                elements.image.removeAttribute("src");
            }
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

    const finirQuestionnaire = async () => {
        if (timeoutReponse) {
            window.clearTimeout(timeoutReponse);
        }
        chronometre.arreter();
        const chronoLecture = chronometre.lire();
        const nombreQuestionsRepondues = detailsQuestions.length;
        const resultats = {
            score,
            total: nombreQuestionsRepondues,
            chrono: chronoLecture,
            titre: options.questionnaire.titre || questionnaire?.titre || "Questionnaire",
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
        void mettreAJourAffichage();
    };

    const afficherReponses = (question) => {
        if (!elements.reponseAffichee) {
            passerQuestionSuivante();
            return;
        }
        const texteReponse =
            (question.definition && question.definition.trim()) || question.reponses.join(", ");
        if (!texteReponse) {
            passerQuestionSuivante();
            return;
        }
        elements.reponseAffichee.textContent = `Réponse : ${texteReponse}`;
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
        const question = questions[index];
        if (!question) return;
        if (timeoutReponse) return;
        const reponsesUtilisateur = normaliserReponsesUtilisateur(elements.champ.value);
        const reponsesValides = question.reponses
            .map((reponse) => normaliserEntreeUtilisateur(reponse))
            .filter(Boolean);
        const reponsesUtilisateurUniques = [...new Set(reponsesUtilisateur)];
        const reponsesValidesUniques = [...new Set(reponsesValides)];
        let bonneReponse = false;
        if (reponsesValidesUniques.length === 1) {
            bonneReponse = reponsesUtilisateurUniques.includes(reponsesValidesUniques[0]);
        } else if (reponsesValidesUniques.length > 1) {
            bonneReponse =
                reponsesValidesUniques.every((reponse) =>
                    reponsesUtilisateurUniques.includes(reponse),
                ) && reponsesUtilisateurUniques.length === reponsesValidesUniques.length;
        }
        const reponseTexte =
            (question.definition && question.definition.trim()) || question.reponses.join(", ");

        detailsQuestions.push({
            question: question.question,
            reponse: reponseTexte,
            correct: bonneReponse,
            reponseUtilisateur: elements.champ.value.trim(),
        });

        if (bonneReponse) {
            score += 1;
            passerQuestionSuivante();
            return;
        }
        if (options.afficherReponse) {
            afficherReponses(question);
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
    elements.boutonFin.addEventListener("click", () => void finirQuestionnaire());

    void mettreAJourAffichage();
});
