/*fichier JS de quest_resultats.html*/
const stockageResultatsQuest = "quest_resultats";
const stockageOptionsQuest = "quest_options";

const pagesQuestionnaire = {
    txt: "../pages/quest_questionnaire_txt.html",
    qcm: "../pages/quest_questionnaire_qcm.html",
    alphabet: "../pages/quest_questionnaire_alphabet.html",
    langue: "../pages/quest_questionnaire_langue.html",
};

const chargerDonnees = (cle) => {
    const brut = localStorage.getItem(cle);
    if (!brut) return null;
    try {
        return JSON.parse(brut);
    } catch (error) {
        console.error(`Impossible de lire ${cle}`, error);
        return null;
    }
};

const determinerNiveau = (score, total) => {
    if (!total) return "mauvais";
    const pourcentage = (score / total) * 100;
    if (pourcentage < 20) return "mauvais";
    if (pourcentage < 40) return "nul";
    if (pourcentage < 60) return "moyen";
    if (pourcentage < 80) return "bon";
    if (pourcentage < 95) return "excellent";
    if (pourcentage < 100) return "maître";
    return "créateur";
};

const formaterReponse = (reponse) => {
    if (Array.isArray(reponse)) {
        return reponse.filter(Boolean).join(", ");
    }
    if (reponse === null || reponse === undefined) return "";
    return String(reponse).trim();
};

const creerCarteQuestion = (entree) => {
    const carte = document.createElement("div");
    carte.className = "petit_cadre";

    const blocQuestion = document.createElement("div");
    blocQuestion.className = "question";

    const texteQuestion = document.createElement("p");
    texteQuestion.className = "texte question-texte";
    texteQuestion.textContent = entree.question || "Question";

    const statut = document.createElement("p");
    const estCorrect = Boolean(entree.correct);
    statut.className = `texte statut ${estCorrect ? "statut--correct" : "statut--wrong"}`;
    statut.textContent = estCorrect ? "Correct" : "Incorrect";

    const reponse = document.createElement("p");
    reponse.className = "texte reponse-texte";
    const reponseTexte = formaterReponse(entree.reponse) || "—";
    reponse.textContent = `Réponse : ${reponseTexte}`;

    blocQuestion.append(texteQuestion, statut);
    carte.append(blocQuestion, reponse);

    return carte;
};

document.addEventListener("DOMContentLoaded", () => {
    const elements = {
        titre: document.getElementById("titre-questionnaire"),
        listeQuestions: document.getElementById("liste-questions"),
        nbqValeur: document.getElementById("nbq-value"),
        range: document.getElementById("nbq"),
        chrono: document.getElementById("chrono"),
        niveau: document.getElementById("niveau"),
        restart: document.getElementById("restart-bouton"),
    };

    const resultats = chargerDonnees(stockageResultatsQuest);
    const options = chargerDonnees(stockageOptionsQuest);

    const questions = Array.isArray(resultats?.questions) ? resultats.questions : [];
    const total = Number(resultats?.total ?? questions.length ?? 0);
    const score = Number(resultats?.score ?? 0);

    if (elements.titre) {
        elements.titre.textContent = resultats?.titre || "Questionnaire";
    }

    if (elements.nbqValeur) {
        elements.nbqValeur.textContent = String(total);
    }

    if (elements.range) {
        elements.range.min = "0";
        elements.range.max = String(total || 0);
        elements.range.value = String(Math.min(score, total || score));
    }

    if (elements.chrono) {
        elements.chrono.textContent = resultats?.chrono || "00:00";
    }

    if (elements.niveau) {
        elements.niveau.textContent = determinerNiveau(score, total);
    }

    if (elements.listeQuestions) {
        elements.listeQuestions.innerHTML = "";
        if (questions.length) {
            questions.forEach((entree) => {
                elements.listeQuestions.append(creerCarteQuestion(entree));
            });
            if (questions.length > 3) {
                elements.listeQuestions.classList.add("grand_cadre--scroll");
            }
        } else {
            const message = document.createElement("p");
            message.className = "texte";
            message.textContent = "Aucune question enregistrée.";
            elements.listeQuestions.append(message);
        }
    }

    if (elements.restart) {
        const pageQuestionnaire =
            options?.mode === "lecture"
                ? "../pages/quest_lecture.html"
                : pagesQuestionnaire[options?.questionnaire?.type];
        if (!pageQuestionnaire) {
            elements.restart.disabled = true;
        } else {
            elements.restart.addEventListener("click", () => {
                window.location.href = pageQuestionnaire;
            });
        }
    }
});
