const { app, BrowserWindow, ipcMain } = require("electron");
const { promises: fs } = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const getStatsPath = () => path.join(app.getPath("userData"), "dactylo", "stat_dactylo.json");
const getQuestStatsPath = () =>
    path.join(app.getPath("userData"), "quest", "stat", "stat_quest.json");
const getLegacyQuestStatsPath = () =>
    path.join(app.getPath("userData"), "quest", "stat_quest.json");
const getQuestDestinationPath = () => path.join(app.getPath("userData"), "quest");
const getQuestSourcePath = () => path.join(app.getAppPath(), "quest");
const getDailyNoteDestinationPath = () => path.join(app.getPath("userData"), "daily_note", "notes");
const getDailyNoteTagsPath = () => path.join(app.getPath("userData"), "daily_note", "tags.json");
const getDailyNoteTagsSourcePath = () => path.join(app.getAppPath(), "daily_note", "tags.json");
const normaliserChemin = (chemin = "") => chemin.replace(/\\/g, "/").replace(/^\/+/, "");

const getFilmAffichesPath = () => path.join(app.getAppPath(), "film", "affiche");
const getFilmClassementPath = () => path.join(app.getAppPath(), "film", "classement");

const copyDirectory = async (sourceDir, destinationDir) => {
    await fs.mkdir(destinationDir, { recursive: true });
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const destinationPath = path.join(destinationDir, entry.name);
        if (entry.isDirectory()) {
            await copyDirectory(sourcePath, destinationPath);
        } else if (entry.isFile()) {
            await fs.copyFile(sourcePath, destinationPath);
        }
    }
};

const ensureQuestSeeded = async () => {
    try {
        await fs.access(getQuestDestinationPath());
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
        await copyDirectory(getQuestSourcePath(), getQuestDestinationPath());
    }
};

const listQuestFiles = async () => {
    const questDir = getQuestDestinationPath();
    await fs.mkdir(questDir, { recursive: true });

    const walk = async (dir) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files = [];
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...await walk(fullPath));
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
                files.push(fullPath);
            }
        }
        return files;
    };

    const files = await walk(questDir);
    return files.map((filePath) => path.relative(questDir, filePath));
};


const deleteQuestFile = async (fileName) => {
    if (!fileName || typeof fileName !== "string") {
        throw new Error("Invalid quest file name");
    }
    if (path.isAbsolute(fileName)) {
        throw new Error("Invalid quest file path");
    }
    const questDir = getQuestDestinationPath();
    const normalizedPath = path.normalize(fileName);
    const questPath = path.resolve(questDir, normalizedPath);
    const questDirResolved = path.resolve(questDir);
    if (questPath !== questDirResolved && !questPath.startsWith(`${questDirResolved}${path.sep}`)) {
        throw new Error("Invalid quest file path");
    }
    const cheminRelatif = normaliserChemin(path.relative(questDirResolved, questPath));
    if (!cheminRelatif.startsWith("questionnaire/")) {
        throw new Error("Invalid quest file path");
    }
    if (!questPath.toLowerCase().endsWith(".json")) {
        throw new Error("Invalid quest file extension");
    }

    const dossierQuestionnaire = normaliserChemin(path.dirname(cheminRelatif));
    const nomQuestionnaire = path.basename(questPath, ".json");
    const contenuQuestionnaire = JSON.parse(await fs.readFile(questPath, "utf-8"));
    const cheminImagesQuestionnaire = normaliserChemin(contenuQuestionnaire?.path || "");
    const dossiersImagesAssocies = new Set([
        `questionnaire/creer/qcm/img/img_${nomQuestionnaire}`,
        `questionnaire/creer/txt/img/img_${nomQuestionnaire}`,
    ].filter((dossierImage) => dossierImage.startsWith(`${dossierQuestionnaire}/img/`)));

    if (cheminImagesQuestionnaire.startsWith("img/")) {
        dossiersImagesAssocies.add(cheminImagesQuestionnaire);
    }

    await fs.unlink(questPath);

    for (const dossierImageRelatif of dossiersImagesAssocies) {
        const dossierImageAbsolu = path.resolve(questDirResolved, path.normalize(dossierImageRelatif));
        await fs.rm(dossierImageAbsolu, { recursive: true, force: true });
    }

    return { ok: true };
};

const readQuestFile = async (fileName) => {
    if (!fileName || typeof fileName !== "string") {
        throw new Error("Invalid quest file name");
    }
    if (path.isAbsolute(fileName)) {
        throw new Error("Invalid quest file path");
    }
    const questDir = getQuestDestinationPath();
    const normalizedPath = path.normalize(fileName);
    const questPath = path.resolve(questDir, normalizedPath);
    const questDirResolved = path.resolve(questDir);
    if (questPath !== questDirResolved && !questPath.startsWith(`${questDirResolved}${path.sep}`)) {
        throw new Error("Invalid quest file path");
    }
    if (!questPath.toLowerCase().endsWith(".json")) {
        throw new Error("Invalid quest file extension");
    }
    const contenu = await fs.readFile(questPath, "utf-8");
    return JSON.parse(contenu);
};

const resolveQuestAsset = async (assetPath) => {
    if (!assetPath || typeof assetPath !== "string") {
        throw new Error("Invalid quest asset path");
    }
    const questDir = getQuestDestinationPath();
    const cleanedPath = assetPath.replace(/^\/+/, "").replace(/^quest[\\/]/i, "");
    if (path.isAbsolute(cleanedPath)) {
        throw new Error("Invalid quest asset path");
    }
    const normalizedPath = path.normalize(cleanedPath);
    const questPath = path.resolve(questDir, normalizedPath);
    const questDirResolved = path.resolve(questDir);
    if (questPath !== questDirResolved && !questPath.startsWith(`${questDirResolved}${path.sep}`)) {
        throw new Error("Invalid quest asset path");
    }
    await fs.access(questPath);
    return pathToFileURL(questPath).toString();
};

const writeQuestJson = async (fileName, payload) => {
    if (!fileName || typeof fileName !== "string") {
        throw new Error("Invalid quest file name");
    }
    if (!payload || typeof payload !== "object") {
        throw new Error("Invalid quest payload");
    }
    if (path.isAbsolute(fileName)) {
        throw new Error("Invalid quest file path");
    }

    const questDir = getQuestDestinationPath();
    const normalizedPath = path.normalize(fileName);
    const questPath = path.resolve(questDir, normalizedPath);
    const questDirResolved = path.resolve(questDir);

    if (questPath !== questDirResolved && !questPath.startsWith(`${questDirResolved}${path.sep}`)) {
        throw new Error("Invalid quest file path");
    }
    if (!questPath.toLowerCase().endsWith(".json")) {
        throw new Error("Invalid quest file extension");
    }

    const parentDir = path.dirname(questPath);
    await fs.mkdir(parentDir, { recursive: true });
    await fs.writeFile(questPath, JSON.stringify(payload, null, 4), "utf-8");
    return { ok: true };
};

const ensureQuestDirectory = async (dirPath) => {
    if (!dirPath || typeof dirPath !== "string") {
        throw new Error("Invalid directory path");
    }
    if (path.isAbsolute(dirPath)) {
        throw new Error("Invalid directory path");
    }

    const questDir = getQuestDestinationPath();
    const normalizedPath = path.normalize(dirPath);
    const targetDir = path.resolve(questDir, normalizedPath);
    const questDirResolved = path.resolve(questDir);

    if (targetDir !== questDirResolved && !targetDir.startsWith(`${questDirResolved}${path.sep}`)) {
        throw new Error("Invalid directory path");
    }

    await fs.mkdir(targetDir, { recursive: true });
    return { ok: true };
};

const removeQuestEntry = async (entryPath) => {
    if (!entryPath || typeof entryPath !== "string") {
        throw new Error("Invalid path");
    }
    if (path.isAbsolute(entryPath)) {
        throw new Error("Invalid path");
    }

    const questDir = getQuestDestinationPath();
    const normalizedPath = path.normalize(entryPath);
    const targetPath = path.resolve(questDir, normalizedPath);
    const questDirResolved = path.resolve(questDir);

    if (targetPath !== questDirResolved && !targetPath.startsWith(`${questDirResolved}${path.sep}`)) {
        throw new Error("Invalid path");
    }

    await fs.rm(targetPath, { recursive: true, force: true });
    return { ok: true };
};

const copyFileToQuest = async (sourcePath, destinationPath) => {
    if (!sourcePath || typeof sourcePath !== "string" || !destinationPath || typeof destinationPath !== "string") {
        throw new Error("Invalid copy paths");
    }
    if (path.isAbsolute(destinationPath)) {
        throw new Error("Invalid destination path");
    }

    const questDir = getQuestDestinationPath();
    const normalizedDestination = path.normalize(destinationPath);
    const fullDestinationPath = path.resolve(questDir, normalizedDestination);
    const questDirResolved = path.resolve(questDir);

    if (fullDestinationPath !== questDirResolved && !fullDestinationPath.startsWith(`${questDirResolved}${path.sep}`)) {
        throw new Error("Invalid destination path");
    }

    const stats = await fs.stat(sourcePath);
    if (!stats.isFile()) {
        throw new Error("Source must be a file");
    }

    await fs.mkdir(path.dirname(fullDestinationPath), { recursive: true });
    await fs.copyFile(sourcePath, fullDestinationPath);
    return { ok: true };
};

const directoryExists = async (directoryPath) => {
    if (!directoryPath || typeof directoryPath !== "string") {
        return false;
    }
    try {
        const stats = await fs.stat(directoryPath);
        return stats.isDirectory();
    } catch (_error) {
        return false;
    }
};

const fileExists = async (filePath) => {
    if (!filePath || typeof filePath !== "string") {
        return false;
    }
    try {
        const stats = await fs.stat(filePath);
        return stats.isFile();
    } catch (_error) {
        return false;
    }
};

const listFilmAffiches = async () => {
    const affichesDir = getFilmAffichesPath();
    const entries = await fs.readdir(affichesDir, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((fileName) => /\.(png|jpe?g|webp|gif|bmp)$/i.test(fileName))
        .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
};


const saveFilmClassement = async (classement, nomClassement) => {
    if (!Array.isArray(classement)) {
        throw new Error("Invalid film classement payload");
    }

    const classementDir = getFilmClassementPath();
    await fs.mkdir(classementDir, { recursive: true });

    const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
    const nomSaisi = typeof nomClassement === "string" ? nomClassement.trim() : "";
    const nomNettoye = nomSaisi
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");

    const baseNomFichier = nomNettoye || `classement_${horodatage}`;
    const nomFichier = `${baseNomFichier}.json`;
    const cheminFichier = path.join(classementDir, nomFichier);

    const payload = {
        date: new Date().toISOString(),
        classement
    };

    await fs.writeFile(cheminFichier, JSON.stringify(payload, null, 4), "utf-8");

    return {
        ok: true,
        filePath: normaliserChemin(path.relative(app.getAppPath(), cheminFichier))
    };
};

const listFilmClassements = async () => {
    const classementDir = getFilmClassementPath();
    await fs.mkdir(classementDir, { recursive: true });

    const entries = await fs.readdir(classementDir, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
        .map((entry) => entry.name)
        .sort((a, b) => b.localeCompare(a, "fr", { sensitivity: "base" }));
};

const loadFilmClassement = async (fileName) => {
    if (!fileName || typeof fileName !== "string") {
        throw new Error("Invalid film classement file name");
    }
    if (path.isAbsolute(fileName)) {
        throw new Error("Invalid film classement file path");
    }

    const classementDir = getFilmClassementPath();
    const normalizedPath = path.normalize(fileName);
    const classementPath = path.resolve(classementDir, normalizedPath);
    const classementDirResolved = path.resolve(classementDir);

    if (
        classementPath !== classementDirResolved
        && !classementPath.startsWith(`${classementDirResolved}${path.sep}`)
    ) {
        throw new Error("Invalid film classement file path");
    }
    if (!classementPath.toLowerCase().endsWith(".json")) {
        throw new Error("Invalid film classement file extension");
    }

    const contenu = await fs.readFile(classementPath, "utf-8");
    return JSON.parse(contenu);
};

const openOrCreateDailyNote = async (fileName, defaultPayload) => {
    if (!fileName || typeof fileName !== "string") {
        throw new Error("Invalid daily note file name");
    }
    if (!defaultPayload || typeof defaultPayload !== "object") {
        throw new Error("Invalid daily note payload");
    }
    if (path.isAbsolute(fileName)) {
        throw new Error("Invalid daily note path");
    }

    const dailyNoteDir = getDailyNoteDestinationPath();
    const normalizedPath = path.normalize(fileName);
    const notePath = path.resolve(dailyNoteDir, normalizedPath);
    const dailyNoteDirResolved = path.resolve(dailyNoteDir);

    if (notePath !== dailyNoteDirResolved && !notePath.startsWith(`${dailyNoteDirResolved}${path.sep}`)) {
        throw new Error("Invalid daily note path");
    }
    if (!notePath.toLowerCase().endsWith(".json")) {
        throw new Error("Invalid daily note extension");
    }

    await fs.mkdir(path.dirname(notePath), { recursive: true });

    try {
        const contenu = await fs.readFile(notePath, "utf-8");
        return {
            created: false,
            fileName: normaliserChemin(path.relative(dailyNoteDirResolved, notePath)),
            content: JSON.parse(contenu),
        };
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    await fs.writeFile(notePath, JSON.stringify(defaultPayload, null, 4), "utf-8");
    return {
        created: true,
        fileName: normaliserChemin(path.relative(dailyNoteDirResolved, notePath)),
        content: defaultPayload,
    };
};


const saveDailyNote = async (fileName, payload) => {
    if (!fileName || typeof fileName !== "string") {
        throw new Error("Invalid daily note file name");
    }
    if (!payload || typeof payload !== "object") {
        throw new Error("Invalid daily note payload");
    }
    if (path.isAbsolute(fileName)) {
        throw new Error("Invalid daily note path");
    }

    const dailyNoteDir = getDailyNoteDestinationPath();
    const normalizedPath = path.normalize(fileName);
    const notePath = path.resolve(dailyNoteDir, normalizedPath);
    const dailyNoteDirResolved = path.resolve(dailyNoteDir);

    if (notePath !== dailyNoteDirResolved && !notePath.startsWith(`${dailyNoteDirResolved}${path.sep}`)) {
        throw new Error("Invalid daily note path");
    }
    if (!notePath.toLowerCase().endsWith(".json")) {
        throw new Error("Invalid daily note extension");
    }

    await fs.mkdir(path.dirname(notePath), { recursive: true });
    await fs.writeFile(notePath, JSON.stringify(payload, null, 4), "utf-8");
    await mergeDailyNoteTags(payload);

    return {
        ok: true,
        fileName: normaliserChemin(path.relative(dailyNoteDirResolved, notePath)),
    };
};

const lireTagsJson = async (filePath) => {
    const contenu = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(contenu);
    if (!Array.isArray(parsed)) {
        throw new Error("Invalid tags payload");
    }

    return parsed
        .filter((tag) => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
};

const extraireTagsDailyNote = (payload) => {
    const histoires = Array.isArray(payload?.histoire) ? payload.histoire : [];
    return histoires
        .flatMap((histoire) => (Array.isArray(histoire?.tags) ? histoire.tags : []))
        .filter((tag) => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
};

const mergeDailyNoteTags = async (payload) => {
    const tagsAAjouter = extraireTagsDailyNote(payload);
    if (tagsAAjouter.length === 0) {
        return;
    }

    const destinationPath = getDailyNoteTagsPath();
    const sourcePath = getDailyNoteTagsSourcePath();
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });

    let tagsExistants = [];
    try {
        tagsExistants = await lireTagsJson(destinationPath);
    } catch (error) {
        if (error.code === "ENOENT") {
            try {
                tagsExistants = await lireTagsJson(sourcePath);
            } catch (sourceError) {
                if (sourceError.code !== "ENOENT") {
                    throw sourceError;
                }
            }
        } else {
            throw error;
        }
    }

    const tagsUniques = new Set(tagsExistants);
    tagsAAjouter.forEach((tag) => tagsUniques.add(tag));
    await fs.writeFile(destinationPath, JSON.stringify(Array.from(tagsUniques), null, 2), "utf-8");
};


const lireJson = async (filePath) => {
    const contenu = await fs.readFile(filePath, "utf-8");
    return JSON.parse(contenu);
};

const listerTagsDailyNote = async () => {
    const destinationPath = getDailyNoteTagsPath();
    const sourcePath = getDailyNoteTagsSourcePath();

    let tags = [];
    try {
        tags = await lireTagsJson(destinationPath);
    } catch (error) {
        if (error.code === "ENOENT") {
            try {
                tags = await lireTagsJson(sourcePath);
            } catch (sourceError) {
                if (sourceError.code !== "ENOENT") {
                    throw sourceError;
                }
            }
        } else {
            throw error;
        }
    }

    return Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
};

const listDailyNotesByTag = async (tag) => {
    if (!tag || typeof tag !== "string") {
        return [];
    }

    const recherche = tag.trim();
    if (!recherche) {
        return [];
    }

    const dailyNoteDir = getDailyNoteDestinationPath();
    await fs.mkdir(dailyNoteDir, { recursive: true });

    const entries = await fs.readdir(dailyNoteDir, { withFileTypes: true });
    const fichiers = entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
        .map((entry) => entry.name);

    const resultats = [];

    for (const fileName of fichiers) {
        const fullPath = path.join(dailyNoteDir, fileName);
        try {
            const contenu = await lireJson(fullPath);
            const histoires = Array.isArray(contenu?.histoire)
                ? contenu.histoire
                : Object.values(contenu || {});

            const correspondance = histoires.some((histoire) => {
                const tags = Array.isArray(histoire?.tags) ? histoire.tags : [];
                return tags.some((item) => typeof item === "string" && item.trim() === recherche);
            });

            if (correspondance) {
                resultats.push({
                    fileName,
                    titre: fileName.replace(/\.json$/i, ""),
                });
            }
        } catch (_error) {
            // Fichier ignoré si JSON invalide
        }
    }

    return resultats.sort((a, b) => b.fileName.localeCompare(a.fileName, "fr", { sensitivity: "base" }));
};

const ensureStatsDir = async () => {
    const dir = path.dirname(getStatsPath());
    await fs.mkdir(dir, { recursive: true });
};

const ensureQuestStatsDir = async () => {
    const dir = path.dirname(getQuestStatsPath());
    await fs.mkdir(dir, { recursive: true });
};

const migrateLegacyQuestStats = async () => {
    try {
        await fs.access(getQuestStatsPath());
        return;
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    try {
        await fs.access(getLegacyQuestStatsPath());
    } catch (error) {
        if (error.code === "ENOENT") {
            return;
        }
        throw error;
    }

    await ensureQuestStatsDir();
    await fs.rename(getLegacyQuestStatsPath(), getQuestStatsPath());
};

const readStatsFile = async () => {
    try {
        const contenu = await fs.readFile(getStatsPath(), "utf-8");
        return JSON.parse(contenu);
    } catch (error) {
        if (error.code === "ENOENT") {
            return null;
        }
        throw error;
    }
};

const writeStatsFile = async (stats) => {
    await ensureStatsDir();
    await fs.writeFile(getStatsPath(), JSON.stringify(stats, null, 4), "utf-8");
};

const readQuestStatsFile = async () => {
    await migrateLegacyQuestStats();
    try {
        const contenu = await fs.readFile(getQuestStatsPath(), "utf-8");
        return JSON.parse(contenu);
    } catch (error) {
        if (error.code === "ENOENT") {
            return null;
        }
        throw error;
    }
};

const writeQuestStatsFile = async (stats) => {
    await migrateLegacyQuestStats();
    await ensureQuestStatsDir();
    await fs.writeFile(getQuestStatsPath(), JSON.stringify(stats, null, 4), "utf-8");
};

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    })

    win.loadFile('index.html');
}

app.whenReady().then(async () => {
    await ensureQuestSeeded();
    createWindow();

    ipcMain.handle("dactylo:load-stats", async () => readStatsFile());
    ipcMain.handle("dactylo:save-stats", async (_event, stats) => {
        if (!stats || typeof stats !== "object") {
            throw new Error("Invalid stats payload");
        }
        await writeStatsFile(stats);
        return { ok: true };
    });
    ipcMain.handle("quest:load-stats", async () => readQuestStatsFile());
    ipcMain.handle("quest:save-stats", async (_event, stats) => {
        if (!stats || typeof stats !== "object") {
            throw new Error("Invalid stats payload");
        }
        await writeQuestStatsFile(stats);
        return { ok: true };
    });

    ipcMain.handle("quest:list", async () => listQuestFiles());
    ipcMain.handle("quest:load", async (_event, fileName) => readQuestFile(fileName));
    ipcMain.handle("quest:delete", async (_event, fileName) => deleteQuestFile(fileName));
    ipcMain.handle("quest:resolve-asset", async (_event, assetPath) => resolveQuestAsset(assetPath));

    ipcMain.handle("quest:write-json", async (_event, fileName, payload) => writeQuestJson(fileName, payload));
    ipcMain.handle("quest:ensure-dir", async (_event, dirPath) => ensureQuestDirectory(dirPath));
    ipcMain.handle("quest:remove-entry", async (_event, entryPath) => removeQuestEntry(entryPath));
    ipcMain.handle("quest:copy-file", async (_event, sourcePath, destinationPath) =>
        copyFileToQuest(sourcePath, destinationPath));
    ipcMain.handle("fs:directory-exists", async (_event, directoryPath) => directoryExists(directoryPath));
    ipcMain.handle("fs:file-exists", async (_event, filePath) => fileExists(filePath));
    ipcMain.handle("film:list-affiches", async () => listFilmAffiches());
    ipcMain.handle("film:save-classement", async (_event, classement, nomClassement) =>
        saveFilmClassement(classement, nomClassement));
    ipcMain.handle("film:list-classements", async () => listFilmClassements());
    ipcMain.handle("film:load-classement", async (_event, fileName) => loadFilmClassement(fileName));
    ipcMain.handle("daily-note:open-or-create", async (_event, fileName, defaultPayload) =>
        openOrCreateDailyNote(fileName, defaultPayload));
    ipcMain.handle("daily-note:save", async (_event, fileName, payload) =>
        saveDailyNote(fileName, payload));
    ipcMain.handle("daily-note:list-tags", async () => listerTagsDailyNote());
    ipcMain.handle("daily-note:list-by-tag", async (_event, tag) => listDailyNotesByTag(tag));

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
})
