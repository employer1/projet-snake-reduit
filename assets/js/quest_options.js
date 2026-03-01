/*fichier JS de quest_options.html*/
const stockageSelectionQuest = "quest_selection";
const stockageOptionsQuest = "quest_options";

const pagesQuestionnaire = {
    txt: "../pages/quest_questionnaire_txt.html",
    qcm: "../pages/quest_questionnaire_qcm.html",
    alphabet: "../pages/quest_questionnaire_alphabet.html",
    langue: "../pages/quest_questionnaire_langue.html",
};

const optionsParType = {
    alphabet: ["ordre", "chrono"],
    langue: ["mode", "nbQuestions", "ordre", "sens", "afficherReponse", "chrono"],
    qcm: ["mode", "nbQuestions", "ordre", "avance", "afficherReponse", "chrono"],
    txt: ["mode", "nbQuestions", "ordre", "avance", "reverse", "afficherReponse", "chrono"],
};

const typesAvecModeLecture = ["langue", "qcm", "txt"];

const optionsDefaut = {
    mode: "question",
    ordre: false,
    avance: false,
    reverse: false,
    afficherReponse: false,
    chrono: false,
    sens: "langue1",
};

const mettreAJourValeurRange = () => {
    const range = document.getElementById("nbq");
    const output = document.getElementById("nbq-value");

    if (!range || !output) return;

    output.textContent = range.value;
    range.addEventListener("input", () => {
        output.textContent = range.value;
    });
};

const chargerQuestionnaire = async (nomFichier) => {
    if (!window.electronAPI?.loadQuestnaire) {
        throw new Error("Electron API indisponible");
    }
    return window.electronAPI.loadQuestnaire(nomFichier);
};

const mettreAJourTitre = (titre) => {
    const titreElement = document.querySelector(".section h1");
    if (!titreElement) return;
    titreElement.textContent = titre ? `Options - ${titre}` : "Options";
};

const definirNavigation = (bouton, questionnaire, options) => {
    const pageQuestionnaire = pagesQuestionnaire[questionnaire.type];
    if (!pageQuestionnaire) {
        bouton.disabled = true;
        return;
    }
    bouton.disabled = false;
    bouton.addEventListener("click", () => {
        const pageCible = options.mode === "lecture" ? "../pages/quest_lecture.html" : pageQuestionnaire;
        const optionsSauvegardees = {
            ...options,
            questionnaire: {
                fichier: questionnaire.fichier,
                titre: questionnaire.titre,
                type: questionnaire.type,
            },
        };
        localStorage.setItem(stockageOptionsQuest, JSON.stringify(optionsSauvegardees));
        window.location.href = pageCible;
    });
};

const definirEtatBoutonMode = (boutons, modeActif) => {
    boutons.forEach((bouton) => {
        const estActif = bouton.dataset.mode === modeActif;
        bouton.classList.toggle("is-active", estActif);
    });
};

const mettreAJourDisponibiliteLecture = (questionnaire, boutonsMode, options) => {
    const boutonLecture = boutonsMode.find((bouton) => bouton.dataset.mode === "lecture");
    if (!boutonLecture) return;

    const lectureDisponible = typesAvecModeLecture.includes(questionnaire.type);
    boutonLecture.classList.toggle("option-hidden", !lectureDisponible);
    boutonLecture.disabled = !lectureDisponible;

    if (!lectureDisponible && options.mode === "lecture") {
        options.mode = "question";
    }
};

const mettreAJourAffichageOptions = (questionnaire, options) => {
    const optionsDisponibles = optionsParType[questionnaire.type] || [];
    const modeEstLecture = options.mode === "lecture";

    const elements = {
        mode: document.getElementById("mode-container"),
        nbQuestions: document.getElementById("nb_qst"),
        ordre: document.getElementById("ordre")?.closest(".sous_corps"),
        sens: document.getElementById("sens")?.closest(".sous_corps"),
        avance: document.getElementById("avance")?.closest(".sous_corps"),
        reverse: document.getElementById("reverse")?.closest(".sous_corps"),
        afficherReponse: document.getElementById("afficher-reponse")?.closest(".sous_corps"),
        chrono: document.getElementById("chrono")?.closest(".sous_corps"),
    };
    const range = document.getElementById("nbq");
    const output = document.getElementById("nbq-value");

    Object.entries(elements).forEach(([cle, element]) => {
        if (!element) return;
        const visible = optionsDisponibles.includes(cle);
        element.classList.toggle("option-hidden", !visible);
    });

    if (range) {
        const nbQuestionsDisponible = optionsDisponibles.includes("nbQuestions");
        range.disabled = !nbQuestionsDisponible;
        if (!nbQuestionsDisponible) {
            const totalQuestions = Array.isArray(questionnaire.questionnaire)
                ? questionnaire.questionnaire.length
                : 1;
            range.value = String(totalQuestions);
            options.nombreQuestions = totalQuestions;
            if (output) {
                output.textContent = range.value;
            }
        }
    }

    if (elements.avance) {
        const avanceActive = optionsDisponibles.includes("avance") && modeEstLecture;
        elements.avance.classList.toggle("option-disabled", !avanceActive);
        const checkbox = elements.avance.querySelector("input");
        if (checkbox) {
            checkbox.disabled = !avanceActive;
            if (!avanceActive) {
                checkbox.checked = false;
                options.avance = false;
            }
        }
    }

    if (elements.reverse) {
        const reverseInterdit = questionnaire.reverse === 0 || questionnaire.reverse === "0";
        const reverseAutorise =
            !reverseInterdit &&
            (questionnaire.type === "txt" || questionnaire.reverse === 1 || questionnaire.reverse === true);
        const reverseActif = optionsDisponibles.includes("reverse") && reverseAutorise;
        elements.reverse.classList.toggle("option-disabled", !reverseActif);
        const checkbox = elements.reverse.querySelector("input");
        if (checkbox) {
            checkbox.disabled = !reverseActif;
            if (!reverseActif) {
                checkbox.checked = false;
                options.reverse = false;
            }
        }
    }
};

const appliquerConfiguration = (questionnaire) => {
    const range = document.getElementById("nbq");
    const boutonsMode = Array.from(document.querySelectorAll(".choix_mode"));
    const checkboxOrdre = document.getElementById("ordre");
    const checkboxAvance = document.getElementById("avance");
    const checkboxReverse = document.getElementById("reverse");
    const checkboxAfficherReponse = document.getElementById("afficher-reponse");
    const checkboxChrono = document.getElementById("chrono");
    const selectSens = document.getElementById("sens");

    if (!range) return null;

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

    const extraireSourcesLangue = (source, cible, sens) => {
        const sources = [];
        const dejaVu = new Set();
        const ajouter = (mot) => {
            const valeur = mot === null || mot === undefined ? "" : String(mot).trim();
            if (!valeur || dejaVu.has(valeur)) return;
            dejaVu.add(valeur);
            sources.push(valeur);
        };

        const collecterDepuisObjet = (objetSource) => {
            if (!objetSource || typeof objetSource !== "object") return;
            Object.keys(objetSource).forEach((mot) => ajouter(mot));
        };

        if (Array.isArray(questionnaire.questionnaire)) {
            questionnaire.questionnaire.forEach((entree) => {
                if (!entree || typeof entree !== "object") return;
                const cleSource = obtenirCleLangue(entree, sens === "langue2" ? "langue 2" : "langue 1");
                if (!cleSource) return;
                const sourceEntree = entree[cleSource];
                if (sourceEntree && typeof sourceEntree === "object" && !Array.isArray(sourceEntree)) {
                    collecterDepuisObjet(sourceEntree);
                } else {
                    ajouter(sourceEntree);
                }
            });
        }

        if (Array.isArray(source) && Array.isArray(cible)) {
            const limite = Math.min(source.length, cible.length);
            for (let i = 0; i < limite; i += 1) {
                ajouter(source[i]);
            }
            return sources;
        }

        if (source && typeof source === "object" && !Array.isArray(source)) {
            collecterDepuisObjet(source);
            return sources;
        }

        if (Array.isArray(source)) {
            source.forEach((mot) => ajouter(mot));
        }

        return sources;
    };

    const calculerTotalQuestions = (sens) => {
        if (questionnaire.type !== "langue") {
            return Array.isArray(questionnaire.questionnaire) ? questionnaire.questionnaire.length : 1;
        }
        const cleSource = sens === "langue2" ? "langue 2" : "langue 1";
        const cleCible = sens === "langue2" ? "langue 1" : "langue 2";
        const source = questionnaire[obtenirCleLangue(questionnaire, cleSource)];
        const cible = questionnaire[obtenirCleLangue(questionnaire, cleCible)];
        const sources = extraireSourcesLangue(source, cible, sens);
        return sources.length || 1;
    };

    const totalQuestions = calculerTotalQuestions(selectSens?.value || optionsDefaut.sens);
    range.max = String(Math.max(totalQuestions, 1));
    if (Number(range.value) > totalQuestions) {
        range.value = String(totalQuestions);
    }
    mettreAJourValeurRange();

    const options = {
        ...optionsDefaut,
        mode: "question",
        nombreQuestions: Number(range.value),
    };

    if (selectSens) {
        selectSens.value = options.sens;
    }

    mettreAJourDisponibiliteLecture(questionnaire, boutonsMode, options);
    definirEtatBoutonMode(boutonsMode, options.mode);
    mettreAJourAffichageOptions(questionnaire, options);

    boutonsMode.forEach((bouton) => {
        bouton.addEventListener("click", () => {
            options.mode = bouton.dataset.mode;
            mettreAJourDisponibiliteLecture(questionnaire, boutonsMode, options);
            definirEtatBoutonMode(boutonsMode, options.mode);
            mettreAJourAffichageOptions(questionnaire, options);
        });
    });

    range.addEventListener("input", () => {
        options.nombreQuestions = Number(range.value);
    });

    if (checkboxOrdre) {
        checkboxOrdre.addEventListener("change", () => {
            options.ordre = checkboxOrdre.checked;
        });
    }

    if (checkboxAvance) {
        checkboxAvance.addEventListener("change", () => {
            options.avance = checkboxAvance.checked;
        });
    }

    if (checkboxReverse) {
        checkboxReverse.addEventListener("change", () => {
            options.reverse = checkboxReverse.checked;
        });
    }

    if (checkboxAfficherReponse) {
        checkboxAfficherReponse.addEventListener("change", () => {
            options.afficherReponse = checkboxAfficherReponse.checked;
        });
    }

    if (checkboxChrono) {
        checkboxChrono.addEventListener("change", () => {
            options.chrono = checkboxChrono.checked;
        });
    }

    if (selectSens) {
        selectSens.addEventListener("change", () => {
            options.sens = selectSens.value;
            const nouveauTotal = calculerTotalQuestions(options.sens);
            range.max = String(Math.max(nouveauTotal, 1));
            if (Number(range.value) > nouveauTotal) {
                range.value = String(nouveauTotal);
            }
            options.nombreQuestions = Number(range.value);
            const output = document.getElementById("nbq-value");
            if (output) {
                output.textContent = range.value;
            }
        });
    }

    return options;
};

document.addEventListener("DOMContentLoaded", async () => {
    const boutonDemarrer = document.getElementById("quest-demarrer");
    const selection = localStorage.getItem(stockageSelectionQuest);

    if (!boutonDemarrer) return;

    if (!selection) {
        boutonDemarrer.disabled = true;
        return;
    }

    try {
        const questionnaire = await chargerQuestionnaire(selection);
        questionnaire.fichier = selection;
        mettreAJourTitre(questionnaire.titre);
        const options = appliquerConfiguration(questionnaire);
        if (!options) {
            boutonDemarrer.disabled = true;
            return;
        }
        definirNavigation(boutonDemarrer, questionnaire, options);
    } catch (error) {
        console.error("Impossible de charger le questionnaire", error);
        boutonDemarrer.disabled = true;
    }
});
