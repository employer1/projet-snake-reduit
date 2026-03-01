/*fichier JS de quest_lecture.html*/
const stockageOptionsQuest = "quest_options";

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

const normaliserTexte = (valeur) => {
    if (valeur === null || valeur === undefined) return "";
    if (Array.isArray(valeur)) {
        return valeur
            .map((item) => normaliserTexte(item))
            .filter(Boolean)
            .join(", ");
    }
    if (typeof valeur === "object") {
        return Object.entries(valeur)
            .map(([cle, item]) => {
                const texteValeur = normaliserTexte(item);
                return texteValeur ? `${cle}: ${texteValeur}` : cle;
            })
            .filter(Boolean)
            .join(" | ");
    }
    return String(valeur).trim();
};

const construireCheminImage = (dossierImage, image) => {
    if (image === null || image === undefined) return "";
    const imageTexte = String(image).trim();
    if (!imageTexte) return "";

    if (/^(https?:|file:|data:)/i.test(imageTexte) || imageTexte.startsWith("../") || imageTexte.startsWith("/")) {
        return imageTexte;
    }

    if (/[\\/]/.test(imageTexte)) {
        return `../${imageTexte.replace(/^\.\/?/, "")}`;
    }

    const dossierTexte = String(dossierImage || "").trim().replace(/[\\/]+$/, "");
    if (!dossierTexte) {
        return imageTexte;
    }

    return `../${dossierTexte}/${imageTexte}`;
};

const obtenirCleLangue = (objet, cle) => {
    if (!objet || typeof objet !== "object") return null;
    const normaliserCle = (valeur) =>
        String(valeur)
            .toLowerCase()
            .replace(/[\s_]+/g, "");
    const cleNormalisee = normaliserCle(cle);
    const cleTrouvee = Object.keys(objet).find((candidate) => normaliserCle(candidate) === cleNormalisee);
    return cleTrouvee || null;
};

const extraireItemsLecture = (questionnaire, options) => {
    if (!questionnaire) return [];

    if (questionnaire.type === "langue") {
        const sens = options?.sens || "langue1";
        const cleSource = sens === "langue2" ? "langue 2" : "langue 1";
        const sourceCleQuestionnaire = obtenirCleLangue(questionnaire, cleSource);

        const entree = Array.isArray(questionnaire.questionnaire)
            ? questionnaire.questionnaire.find((item) => item && typeof item === "object")
            : null;
        const sourceCleEntree = obtenirCleLangue(entree, cleSource);

        const source = (sourceCleQuestionnaire && questionnaire[sourceCleQuestionnaire])
            || (sourceCleEntree && entree[sourceCleEntree]);

        if (!source || typeof source !== "object" || Array.isArray(source)) {
            return [];
        }

        return Object.entries(source)
            .map(([question, valeur]) => {
                const reponse = normaliserTexte(valeur);
                return {
                    question: normaliserTexte(question),
                    reponse,
                    definition: "",
                    image: "",
                };
            })
            .filter((item) => item.question || item.reponse);
    }

    const dossierImage = questionnaire.path ?? questionnaire.imagePath ?? "";
    if (!Array.isArray(questionnaire.questionnaire)) return [];

    return questionnaire.questionnaire
        .map((entree) => {
            if (!entree || typeof entree !== "object") return null;
            const question = normaliserTexte(entree.question ?? entree.titre);
            const reponse = normaliserTexte(entree.reponse ?? entree.reponses);
            const definition = normaliserTexte(entree.def);
            const image = construireCheminImage(dossierImage, entree.image ?? entree.images ?? null);

            if (!question && !reponse && !definition) return null;

            return {
                question,
                reponse,
                definition,
                image,
            };
        })
        .filter(Boolean);
};

const appliquerOrdreEtLimite = (items, options) => {
    if (!Array.isArray(items)) return [];
    const liste = [...items];

    if (options?.ordre) {
        for (let i = liste.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [liste[i], liste[j]] = [liste[j], liste[i]];
        }
    }

    const limite = Number(options?.nombreQuestions) || liste.length;
    return liste.slice(0, Math.max(0, Math.min(limite, liste.length)));
};

const afficherItem = async (items, index, elements) => {
    const total = items.length;
    const item = items[index];

    if (!item || !total) {
        elements.question.textContent = "Aucune donnée à afficher.";
        elements.reponse.textContent = "";
        elements.definition.textContent = "";
        elements.compteur.textContent = "0/0";
        elements.definitionContainer.hidden = true;
        elements.imageContainer.hidden = true;
        elements.precedent.disabled = true;
        elements.suivant.disabled = true;
        return;
    }

    elements.question.textContent = item.question || "";
    elements.reponse.textContent = item.reponse || "";

    const definition = item.definition || "";
    elements.definition.textContent = definition;
    elements.definitionContainer.hidden = !definition;

    const image = item.image || "";
    if (image) {
        try {
            const url = await window.electronAPI?.resolveQuestAsset(image);
            if (url) {
                elements.image.src = url;
                elements.imageContainer.hidden = false;
            } else {
                elements.image.removeAttribute("src");
                elements.imageContainer.hidden = true;
            }
        } catch (error) {
            console.error("Impossible de charger l'image du questionnaire", error);
            elements.image.removeAttribute("src");
            elements.imageContainer.hidden = true;
        }
    } else {
        elements.image.removeAttribute("src");
        elements.imageContainer.hidden = true;
    }

    elements.compteur.textContent = `${index + 1}/${total}`;
    elements.precedent.disabled = index <= 0;
    elements.suivant.disabled = index >= total - 1;
};

document.addEventListener("DOMContentLoaded", async () => {
    const elements = {
        titre: document.getElementById("lecture-titre"),
        imageContainer: document.getElementById("lecture-image-container"),
        image: document.getElementById("lecture-image"),
        question: document.getElementById("lecture-question"),
        reponse: document.getElementById("lecture-reponse"),
        definitionContainer: document.getElementById("lecture-definition-container"),
        definition: document.getElementById("lecture-definition"),
        compteur: document.getElementById("compteur"),
        precedent: document.getElementById("lecture-precedent"),
        suivant: document.getElementById("lecture-suivant"),
    };

    if (!elements.question || !elements.reponse || !elements.compteur || !elements.precedent || !elements.suivant) {
        return;
    }

    const options = chargerOptions();
    if (!options?.questionnaire?.fichier || !window.electronAPI?.loadQuestnaire) {
        afficherItem([], 0, elements);
        return;
    }

    elements.titre.textContent = options.questionnaire.titre || "Questionnaire";

    let questionnaire = null;
    try {
        questionnaire = await window.electronAPI.loadQuestnaire(options.questionnaire.fichier);
    } catch (error) {
        console.error("Impossible de charger le questionnaire", error);
    }

    const items = appliquerOrdreEtLimite(extraireItemsLecture(questionnaire, options), options);
    let index = 0;

    await afficherItem(items, index, elements);

    elements.precedent.addEventListener("click", () => {
        if (index <= 0) return;
        index -= 1;
        void afficherItem(items, index, elements);
    });

    elements.suivant.addEventListener("click", () => {
        if (index >= items.length - 1) return;
        index += 1;
        void afficherItem(items, index, elements);
    });
});
