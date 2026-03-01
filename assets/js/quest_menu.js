/*fichier JS de quest_menu.html*/
const stockageSelectionQuest = "quest_selection";
const dossierQuestionnaires = "questionnaire/";

const normaliserChemin = (chemin = "") => chemin.replace(/\\/g, "/").replace(/^\/+/, "");

const estQuestionnaire = (chemin) => {
    const cheminNormalise = normaliserChemin(chemin);
    return cheminNormalise.toLowerCase().endsWith(".json")
        && (!cheminNormalise.includes("/") || cheminNormalise.startsWith(dossierQuestionnaires));
};

const formatNomQuestionnaire = (nomFichier) => {
    const cheminNormalise = normaliserChemin(nomFichier);
    const nom = cheminNormalise.split("/").pop() || cheminNormalise;
    return nom.replace(/_/g, " ").replace(/\.json$/i, "");
};

const initialiserSelect = (select, questionnaires) => {
    select.innerHTML = "";

    if (!questionnaires.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Aucun questionnaire trouvé";
        option.disabled = true;
        option.selected = true;
        select.appendChild(option);
        return;
    }

    const optionPlaceholder = document.createElement("option");
    optionPlaceholder.value = "";
    optionPlaceholder.textContent = "Sélectionnez un questionnaire";
    optionPlaceholder.selected = true;
    select.appendChild(optionPlaceholder);

    questionnaires.forEach((nomFichier) => {
        const option = document.createElement("option");
        option.value = nomFichier;
        option.textContent = formatNomQuestionnaire(nomFichier);
        select.appendChild(option);
    });
};

const chargerQuestionnaires = async (select) => {
    if (!window.electronAPI?.listQuestnaires) {
        initialiserSelect(select, []);
        return [];
    }

    try {
        const questionnaires = (await window.electronAPI.listQuestnaires()).filter(estQuestionnaire);
        initialiserSelect(select, questionnaires);
        return questionnaires;
    } catch (error) {
        console.error("Impossible de charger les questionnaires", error);
        initialiserSelect(select, []);
        return [];
    }
};

const mettreAJourEtatBoutonDemarrer = (boutonDemarrer, valeurSelectionnee) => {
    boutonDemarrer.disabled = !valeurSelectionnee;
};

document.addEventListener("DOMContentLoaded", async () => {
    const select = document.querySelector("select.choix");
    const boutonDemarrer = document.getElementById("demarrer");

    if (!select || !boutonDemarrer) return;

    await chargerQuestionnaires(select);
    const selectionSauvee = localStorage.getItem(stockageSelectionQuest) || "";
    if (selectionSauvee) {
        select.value = selectionSauvee;
    }

    mettreAJourEtatBoutonDemarrer(boutonDemarrer, select.value);

    select.addEventListener("change", () => {
        const valeur = select.value;
        if (valeur) {
            localStorage.setItem(stockageSelectionQuest, valeur);
        } else {
            localStorage.removeItem(stockageSelectionQuest);
        }
        mettreAJourEtatBoutonDemarrer(boutonDemarrer, valeur);
    });

    boutonDemarrer.addEventListener("click", (event) => {
        if (!select.value) {
            event.preventDefault();
            alert("Sélectionnez un questionnaire pour continuer.");
            return;
        }
        localStorage.setItem(stockageSelectionQuest, select.value);
        window.location.href = "../pages/quest_options.html";
    });
});
