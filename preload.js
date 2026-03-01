const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    loadDactyloStats: () => ipcRenderer.invoke("dactylo:load-stats"),
    saveDactyloStats: (stats) => ipcRenderer.invoke("dactylo:save-stats", stats),
    loadQuestStats: () => ipcRenderer.invoke("quest:load-stats"),
    saveQuestStats: (stats) => ipcRenderer.invoke("quest:save-stats", stats),
    listQuestnaires: () => ipcRenderer.invoke("quest:list"),
    loadQuestnaire: (fileName) => ipcRenderer.invoke("quest:load", fileName),
    deleteQuestnaire: (fileName) => ipcRenderer.invoke("quest:delete", fileName),
    resolveQuestAsset: (assetPath) => ipcRenderer.invoke("quest:resolve-asset", assetPath),
    writeQuestJson: (fileName, payload) => ipcRenderer.invoke("quest:write-json", fileName, payload),
    ensureQuestDirectory: (dirPath) => ipcRenderer.invoke("quest:ensure-dir", dirPath),
    removeQuestEntry: (entryPath) => ipcRenderer.invoke("quest:remove-entry", entryPath),
    copyFileToQuest: (sourcePath, destinationPath) =>
        ipcRenderer.invoke("quest:copy-file", sourcePath, destinationPath),
    directoryExists: (directoryPath) => ipcRenderer.invoke("fs:directory-exists", directoryPath),
    fileExists: (filePath) => ipcRenderer.invoke("fs:file-exists", filePath),
    listFilmAffiches: () => ipcRenderer.invoke("film:list-affiches"),
    saveFilmClassement: (classement, nomClassement) =>
        ipcRenderer.invoke("film:save-classement", classement, nomClassement),
    listFilmClassements: () => ipcRenderer.invoke("film:list-classements"),
    loadFilmClassement: (fileName) => ipcRenderer.invoke("film:load-classement", fileName),
    openOrCreateDailyNote: (fileName, defaultPayload) =>
        ipcRenderer.invoke("daily-note:open-or-create", fileName, defaultPayload),
    saveDailyNote: (fileName, payload) =>
        ipcRenderer.invoke("daily-note:save", fileName, payload),
    listDailyNoteTags: () => ipcRenderer.invoke("daily-note:list-tags"),
    listDailyNotesByTag: (tag) => ipcRenderer.invoke("daily-note:list-by-tag", tag),
});

window.addEventListener("DOMContentLoaded", () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element) element.innerText = text;
    };

    for (const type of ["chrome", "node", "electron"]) {
        replaceText(`${type}-version`, process.version[type]);
    }
});
