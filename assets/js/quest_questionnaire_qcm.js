/*fichier JS de quest_questionnaire_qcm.html*/
const stockageOptionsQuest = "quest_options";
const stockageResultatsQuest = "quest_resultats";
const stockageEtatQcm = "quest_qcm_etat";

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

const clesQuestion = ["question", "intitule", "enonce", "libelle", "titre", "mot"];
const clesReponse = [
    "reponse",
    "reponse_correcte",
    "bonne_reponse",
    "bonneReponse",
    "correct",
    "answer",
];
const clesLeurres = [
    "leurres",
    "leurre",
    "fausses_reponses",
    "faussesReponses",
    "mauvaises_reponses",
    "mauvaisesReponses",
    "faux",
    "choix",
    "reponses",
    "answers",
];

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

const normaliserTexte = (valeur) =>
    String(valeur || "")
        .trim()
        .toLocaleLowerCase("fr-FR")
        .replace(/\s+/g, " ");

const melanger = (liste) => {
    const copie = [...liste];
    for (let i = copie.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
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

const obtenirValeurParCles = (objet, cles) => {
    if (!objet || typeof objet !== "object") return "";
    for (const cle of cles) {
        if (cle in objet) {
            const valeur = objet[cle];
            if (valeur !== null && valeur !== undefined) {
                const texte = String(valeur).trim();
                if (texte) return texte;
            }
        }
    }
    return "";
};

const extraireQuestionsQcm = (questionnaire) => {
    if (!questionnaire || !Array.isArray(questionnaire.questionnaire)) return [];
    const dossierImage = questionnaire.path ?? questionnaire.imagePath ?? "";
    return questionnaire.questionnaire
        .map((entree) => {
            if (!entree || typeof entree !== "object") return null;
            const question = obtenirValeurParCles(entree, clesQuestion);
            let reponse = obtenirValeurParCles(entree, clesReponse);
            let leurres = [];
            clesLeurres.forEach((cle) => {
                if (cle in entree) {
                    leurres = leurres.concat(normaliserListe(entree[cle]));
                }
            });

            if (!reponse && leurres.length) {
                reponse = leurres.shift();
            }

            if (!reponse) return null;

            const normaliseReponse = normaliserTexte(reponse);
            const leurresFiltres = Array.from(
                new Set(
                    leurres
                        .map((valeur) => String(valeur).trim())
                        .filter((valeur) => normaliserTexte(valeur) !== normaliseReponse),
                ),
            );

            const nombreReponsesDisponibles = Math.min(6, Math.max(1, 1 + leurresFiltres.length));

            return {
                question: question || "Question",
                reponse,
                leurres: leurresFiltres,
                nombreReponses: nombreReponsesDisponibles,
                image: construireCheminImage(dossierImage, entree.image ?? entree.images ?? null),
            };
        })
        .filter(Boolean);
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
    image: document.getElementById("question-image"),
    question: document.querySelector(".corps h2"),
    conteneurReponses: document.querySelector(".sous_corps"),
    labels: Array.from(document.querySelectorAll(".sous_corps label")),
    boutonEnvoyer: document.getElementById("bouton-envoyer"),
    boutonFin: document.getElementById("bouton-fin"),
    compteur: document.getElementById("compteur"),
    boutonMenu: document.querySelector(".bouton_menu"),
    boutonParam: document.querySelector(".bouton_param"),
});

document.addEventListener("DOMContentLoaded", async () => {
    const elements = initialiserElements();
    if (!elements.boutonEnvoyer || !elements.boutonFin || !elements.labels.length) return;

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

    const questionsBrutes = extraireQuestionsQcm(questionnaire);
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
    let chronometre = creerChrono(elements.chrono, 0, true);
    let timeoutAffichage = null;
    const detailsQuestions = [];

    const etatSauvegarde = sessionStorage.getItem(stockageEtatQcm);
    if (etatSauvegarde) {
        try {
            const etat = JSON.parse(etatSauvegarde);
            if (etat?.fichier === options.questionnaire.fichier && Array.isArray(etat.questions)) {
                index = etat.index || 0;
                score = etat.score || 0;
                questions.splice(0, questions.length, ...etat.questions);
                chronometre = creerChrono(elements.chrono, etat.tempsEcoule || 0, true);
                if (Array.isArray(etat.detailsQuestions)) {
                    detailsQuestions.splice(0, detailsQuestions.length, ...etat.detailsQuestions);
                }
            } else {
                sessionStorage.removeItem(stockageEtatQcm);
            }
        } catch (error) {
            console.error("Impossible de restaurer l'état du questionnaire", error);
        }
    }

    const sauvegarderEtat = () => {
        const etat = {
            fichier: options.questionnaire.fichier,
            index,
            score,
            questions,
            tempsEcoule: chronometre.ecoule(),
            detailsQuestions,
        };
        sessionStorage.setItem(stockageEtatQcm, JSON.stringify(etat));
    };

    const definirSelection = (label, selectionnee) => {
        label.classList.toggle("is-selected", selectionnee);
    };

    const mettreAJourAffichage = () => {
        const question = questions[index];
        if (!question) return;
        if (elements.question) {
            elements.question.textContent = question.question;
        }
        if (elements.compteur) {
            elements.compteur.textContent = `${index + 1}/${questions.length}`;
        }

        if (elements.image) {
            if (question.image) {
                void window.electronAPI?.resolveQuestAsset(question.image)
                    .then((url) => {
                        if (url) {
                            elements.image.src = url;
                            elements.image.hidden = false;
                        } else {
                            elements.image.hidden = true;
                            elements.image.removeAttribute("src");
                        }
                    })
                    .catch((error) => {
                        console.error("Impossible de charger l'image du questionnaire", error);
                        elements.image.hidden = true;
                        elements.image.removeAttribute("src");
                    });
            } else {
                elements.image.hidden = true;
                elements.image.removeAttribute("src");
            }
        }

        const reponsesUniq = Array.from(new Set([question.reponse, ...question.leurres]));
        const nombreReponses = Math.min(
            elements.labels.length,
            Math.max(1, Number(question.nombreReponses) || reponsesUniq.length || 1),
        );
        const reponsesAffichees = [question.reponse];
        melanger(reponsesUniq).forEach((valeur) => {
            if (reponsesAffichees.length >= nombreReponses) return;
            if (normaliserTexte(valeur) === normaliserTexte(question.reponse)) return;
            reponsesAffichees.push(valeur);
        });
        const reponsesMelangees = melanger(reponsesAffichees);

        if (elements.conteneurReponses) {
            const nombreLignes = Math.ceil(nombreReponses / 2);
            elements.conteneurReponses.style.setProperty("--qcm-nb-lignes", String(nombreLignes));
        }

        elements.labels.forEach((label, idx) => {
            const input = label.querySelector("input");
            const texte = label.querySelector(".reponse-texte");
            const valeur = reponsesMelangees[idx] || "";
            const visible = idx < nombreReponses;
            label.hidden = !visible;
            if (texte) {
                texte.textContent = valeur || "—";
            }
            if (input) {
                input.value = valeur;
                input.checked = false;
                input.disabled = !valeur || !visible;
            }
            label.classList.remove("is-correct", "is-wrong");
            label.dataset.bonneReponse = valeur && normaliserTexte(valeur) === normaliserTexte(question.reponse)
                ? "true"
                : "false";
            label.classList.toggle("option-inactive", !valeur || !visible);
            definirSelection(label, false);
        });
    };

    const finirQuestionnaire = async () => {
        if (timeoutAffichage) {
            window.clearTimeout(timeoutAffichage);
        }
        chronometre.arreter();
        sessionStorage.removeItem(stockageEtatQcm);
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

    const afficherCorrection = (labelSelectionnee) => {
        const labelCorrecte = elements.labels.find((label) => label.dataset.bonneReponse === "true");
        if (labelCorrecte) {
            labelCorrecte.classList.add("is-correct");
        }
        if (labelSelectionnee) {
            labelSelectionnee.classList.add("is-wrong");
        }
        elements.labels.forEach((label) => {
            const input = label.querySelector("input");
            if (input) {
                input.disabled = true;
            }
        });
        elements.boutonEnvoyer.disabled = true;
        timeoutAffichage = window.setTimeout(() => {
            elements.boutonEnvoyer.disabled = false;
            timeoutAffichage = null;
            passerQuestionSuivante();
        }, 3000);
    };

    const verifierReponse = (labelSelectionnee) => {
        if (!questions[index]) return;
        if (timeoutAffichage) return;
        const label = labelSelectionnee
            || elements.labels.find((candidate) => candidate.querySelector("input")?.checked);
        if (!label) return;
        const input = label.querySelector("input");
        const valeur = input ? input.value : "";
        const bonneReponse =
            valeur && normaliserTexte(valeur) === normaliserTexte(questions[index].reponse);

        detailsQuestions.push({
            question: questions[index].question,
            reponse: questions[index].reponse,
            correct: bonneReponse,
            reponseUtilisateur: valeur,
        });

        if (bonneReponse) {
            score += 1;
            passerQuestionSuivante();
            return;
        }
        if (options.afficherReponse) {
            afficherCorrection(label);
        } else {
            passerQuestionSuivante();
        }
    };

    elements.labels.forEach((label) => {
        const input = label.querySelector("input");
        label.addEventListener("click", () => {
            elements.labels.forEach((autre) => definirSelection(autre, false));
            definirSelection(label, true);
            if (input && !input.disabled) {
                input.checked = true;
            }
        });
        label.addEventListener("dblclick", () => {
            if (input && !input.disabled) {
                input.checked = true;
            }
            verifierReponse(label);
        });
    });

    elements.boutonEnvoyer.addEventListener("click", () => verifierReponse());
    elements.boutonFin.addEventListener("click", () => void finirQuestionnaire());

    if (elements.boutonMenu) {
        const menuLien = elements.boutonMenu.querySelector("[data-page]");
        elements.boutonMenu.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                sessionStorage.removeItem(stockageEtatQcm);
                if (menuLien?.dataset.page) {
                    window.location.href = menuLien.dataset.page;
                }
            },
            true,
        );
    }

    if (elements.boutonParam) {
        const paramLien = elements.boutonParam.querySelector("[data-page]");
        elements.boutonParam.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                sauvegarderEtat();
                if (paramLien?.dataset.page) {
                    window.location.href = paramLien.dataset.page;
                }
            },
            true,
        );
    }

    window.addEventListener("beforeunload", () => {
        if (sessionStorage.getItem(stockageEtatQcm)) {
            sauvegarderEtat();
        }
    });

    mettreAJourAffichage();
});
