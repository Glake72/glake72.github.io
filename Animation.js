// --- Ton code d'animation existant (si tu en a un) peut être placé ici, au début du fichier.
// Assure-toi que les keyframes CSS pour 'fondAnime' sont bien dans le bloc <style> de l'HTML.
// Si Animation.js contient du JS pour l'animation, il peut rester ici.
// ---

// --- DÉBUT DU CODE GOOGLE ET GESTION DES FICHIERS ---

const previewContainer = document.getElementById('preview-container');
const driveFilesContainer = document.getElementById('drive-files-container'); // Conteneur pour les fichiers et dossiers Drive
const messageDisplay = document.getElementById('message-display');
const drivePathElement = document.getElementById('drive-path'); // Élément pour afficher le chemin actuel

// **ATTENTION : Ces identifiants sont exposés côté client. Ce n'est PAS SÛR pour une application en production.**
// Pour une application réelle, tu devrais utiliser un serveur backend pour interagir avec l'API Google Drive
// afin de protéger ta clé API et tes identifiants de service.
const CLIENT_ID = '716108448607-4d46lrnamcdkk07jo2gaq7bc9pu47ag3.apps.googleusercontent.com';
const API_KEY = 'AIzaSyBeHW_Izkd7InzeahDl6gGxI5OMyOhiFm8';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata';

let tokenClient; // Utilisé par Google Identity Services (GIS) pour la connexion
let accessToken = null; // Le token d'accès obtenu après connexion

// Variables d'état pour la navigation dans Google Drive
let currentFolderId = 'root'; // 'root' représente le dossier racine de Google Drive
let drivePath = [{ name: 'Racine', id: 'root' }]; // Tableau pour stocker le chemin de navigation (utile pour "revenir en arrière")

// Drapeaux pour suivre le chargement des bibliothèques Google
let gapiIsReady = false;
let gisIsReady = false;

// NOUVELLES RÉFÉRENCES POUR LA SECTION NOTES
const notesInput = document.getElementById('notes-input');
const addNoteBtn = document.getElementById('add-note-btn');
const notesContainer = document.getElementById('notes-container');

/**
 * Affiche un message à l'utilisateur de manière non bloquante.
 * @param {string} message - Le texte du message à afficher.
 * @param {string} type - Le type de message ('success', 'error', 'info').
 */
function displayMessage(message, type) {
    if (!messageDisplay) {
        alert(message);
        return;
    }
    messageDisplay.textContent = message;
    messageDisplay.className = '';
    messageDisplay.classList.add(type);
    messageDisplay.style.display = 'block';

    setTimeout(() => {
        messageDisplay.style.display = 'none';
    }, 5000);
}

/**
 * Met à jour l'affichage du chemin de navigation Drive.
 */
function updateDrivePathDisplay() {
    drivePathElement.innerHTML = ''; // Vide le contenu actuel
    drivePath.forEach((folder, index) => {
        const span = document.createElement('span');
        const link = document.createElement('a');
        link.textContent = folder.name;
        link.href = '#'; // Pour rendre le lien cliquable
        link.onclick = (e) => {
            e.preventDefault();
            // Navigue vers ce dossier dans l'historique du chemin
            drivePath.splice(index + 1); // Supprime tous les éléments après celui cliqué
            currentFolderId = folder.id;
            listDriveFiles(currentFolderId); // Recharge les fichiers pour ce dossier
            updateDrivePathDisplay(); // Met à jour l'affichage du chemin
        };
        span.appendChild(link);
        if (index < drivePath.length - 1) {
            span.innerHTML += ' / '; // Ajoute un séparateur
        }
        drivePathElement.appendChild(span);
    });
}


/**
 * Active les boutons de connexion Google et Drive lorsque les bibliothèques sont chargées.
 */
function enableGoogleLoginButton() {
    if (gapiIsReady && gisIsReady) {
        const googleLoginBtn = document.getElementById('google-login-btn');
        const showDriveFilesBtn = document.getElementById('show-drive-files-btn');
        const createFolderBtn = document.getElementById('create-folder-btn'); // Nouveau bouton

        if (googleLoginBtn) {
            googleLoginBtn.disabled = false;
            googleLoginBtn.textContent = 'Connexion Google';
        }
        if (showDriveFilesBtn) {
            showDriveFilesBtn.disabled = false;
        }
        if (createFolderBtn) {
            createFolderBtn.disabled = false;
        }
        console.log("🟢 Les API Google (GAPI et GIS) sont prêtes ! Boutons activés.");
    }
}

/**
 * Fonction de rappel appelée par le script 'api.js' de Google (GAPI) une fois qu'il est chargé.
 */
function gapiLoaded() {
    console.log("➡️ gapi.js script chargé. Chargement du client GAPI...");
    gapi.load('client', initializeGapiClient);
}

/**
 * Initialise le client GAPI pour pouvoir faire des requêtes aux APIs (ex: Drive).
 */
async function initializeGapiClient() {
    console.log("⚙️ Initialisation du client GAPI...");
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        });
        gapiIsReady = true;
        console.log('✅ Client GAPI initialisé. gapiIsReady =', gapiIsReady);
        enableGoogleLoginButton();
    } catch (error) {
        console.error("❌ Erreur lors de l'initialisation du client GAPI:", error);
        displayMessage("Une erreur est survenue lors de l'initialisation de Google Drive API. Vérifiez la console.", 'error');
    }
}

/**
 * Fonction de rappel appelée par le script 'gsi/client.js' de Google (GIS) une fois qu'il est chargé.
 */
function gisLoaded() {
    console.log("➡️ gsi/client.js script chargé. Initialisation du client de jeton GIS...");
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            if (tokenResponse.error) {
                displayMessage('Erreur de connexion Google : ' + tokenResponse.error, 'error');
                console.error('❌ Erreur GIS:', tokenResponse.error);
                const googleUserSpan = document.getElementById('google-user');
                if (googleUserSpan) {
                    googleUserSpan.textContent = "Déconnecté";
                }
                return;
            }
            accessToken = tokenResponse.access_token;
            const googleUserSpan = document.getElementById('google-user');
            if (googleUserSpan) {
                googleUserSpan.textContent = "Connecté";
            }
            displayMessage('Connecté à Google !', 'success');
            console.log('✅ Connecté à Google, token d\'accès obtenu.');
            // Après connexion réussie, on liste les fichiers du dossier actuel (racine par défaut)
            listDriveFiles(currentFolderId);
        },
    });
    gisIsReady = true;
    console.log('✅ Client de jeton GIS initialisé. gisIsReady =', gisIsReady);
    enableGoogleLoginButton();
}

// Rend les fonctions gapiLoaded et gisLoaded accessibles globalement.
window.gapiLoaded = gapiLoaded;
window.gisLoaded = gisLoaded;

document.addEventListener('DOMContentLoaded', () => {
    console.log("🔵 DOMContentLoaded déclenché. Initialisation des éléments de l'interface.");

    const googleLoginBtn = document.getElementById('google-login-btn');
    const showDriveFilesBtn = document.getElementById('show-drive-files-btn');
    const createFolderBtn = document.getElementById('create-folder-btn');

    if (googleLoginBtn) {
        googleLoginBtn.disabled = true;
        googleLoginBtn.textContent = 'Chargement Google Connexion...';
        googleLoginBtn.onclick = () => {
            if (tokenClient) {
                tokenClient.requestAccessToken();
            } else {
                displayMessage("La bibliothèque de connexion Google n'est pas encore chargée. Veuillez patienter.", 'info');
            }
        };
    }

    if (showDriveFilesBtn) {
        showDriveFilesBtn.disabled = true; // Désactivé tant que non connecté/API non prête
        showDriveFilesBtn.onclick = () => {
            listDriveFiles(currentFolderId); // Affiche le contenu du dossier actuel
        };
    }

    if (createFolderBtn) {
        createFolderBtn.disabled = true; // Désactivé tant que non connecté/API non prête
        createFolderBtn.onclick = () => {
            const folderName = prompt("Entrez le nom du nouveau dossier :");
            if (folderName) {
                createFolder(folderName, currentFolderId);
            }
        };
    }

    const fileUploadInput = document.getElementById('file-upload');
    if (fileUploadInput) {
        fileUploadInput.addEventListener('change', function(event) {
            const files = Array.from(event.target.files);
            let saved = JSON.parse(localStorage.getItem('fichiers') || '[]');

            files.forEach((file) => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    createPreviewBox(file.name, e.target.result, file.type);
                    saved.push({ name: file.name, data: e.target.result, type: file.type });
                    localStorage.setItem('fichiers', JSON.stringify(saved));
                };
                reader.readAsDataURL(file);
            });
            event.target.value = '';
        });
    }

    const saved = JSON.parse(localStorage.getItem('fichiers') || '[]');
    saved.forEach(f => createPreviewBox(f.name, f.data, f.type));

    updateDrivePathDisplay(); // Initialise l'affichage du chemin (Racine)
    loadNotes(); // CHARGE LES NOTES AU DÉMARRAGE

    // GESTION DES NOTES
    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', addNote);
    }
});


/**
 * Convertit une Data URL en objet Blob.
 * @param {string} dataurl - La Data URL à convertir.
 * @returns {Blob} L'objet Blob représentant les données.
 */
function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], {type:mime});
}

/**
 * Upload un fichier sur Google Drive dans le dossier actuel.
 * @param {string} fileName - Nom du fichier.
 * @param {string} dataURL - Data URL du fichier.
 * @param {string} fileType - Type MIME du fichier.
 */
async function uploadToDrive(fileName, dataURL, fileType) {
    if (!accessToken) {
        displayMessage("Connectez-vous à Google avant d'envoyer sur Drive.", 'info');
        return;
    }
    if (!gapiIsReady) {
        displayMessage("L'API Google Drive n'est pas encore prête. Veuillez patienter.", 'info');
        return;
    }

    const fileBlob = dataURLtoBlob(dataURL);
    const metadata = {
        name: fileName,
        mimeType: fileType,
        parents: [currentFolderId] // Le point crucial : ajoute le fichier au dossier actuel
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
    form.append('file', fileBlob);

    try {
        displayMessage(`Envoi de "${fileName}" sur Google Drive...`, 'info');
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + accessToken
            },
            body: form
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || 'Erreur inconnue lors de l\'envoi du fichier.');
        }

        const result = await response.json();
        displayMessage(`Fichier "${result.name}" envoyé sur Google Drive ! ID: ${result.id}`, 'success');
        console.log('Fichier uploadé:', result);
        // Après l'upload, on rafraîchit la liste des fichiers/dossiers Drive du dossier actuel
        listDriveFiles(currentFolderId);
    } catch (err) {
        console.error('❌ Erreur lors de l\'envoi sur Drive:', err);
        displayMessage(`Erreur lors de l'envoi sur Drive: ${err.message}`, 'error');
    }
}

/**
 * Crée et ajoute une boîte de prévisualisation pour un fichier sauvegardé localement.
 * (Cette fonction reste la même, elle gère les fichiers du localStorage)
 * @param {string} fileName - Nom du fichier.
 * @param {string} dataURL - Data URL du fichier.
 * @param {string} fileType - Type MIME du fichier.
 */
function createPreviewBox(fileName, dataURL, fileType) {
    const previewBox = document.createElement('div');
    previewBox.className = 'preview-box';

    let content;
    if (fileType.startsWith('image/')) {
        content = document.createElement('img');
        content.src = dataURL;
        content.alt = fileName;
    } else {
        content = document.createElement('div');
        content.textContent = fileName;
        content.className = 'file-name';
    }
    previewBox.appendChild(content);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'preview-buttons-container';

    const downloadBtn = document.createElement('a');
    downloadBtn.textContent = 'Télécharger';
    downloadBtn.href = dataURL;
    downloadBtn.download = fileName;
    downloadBtn.className = 'download-btn';
    buttonsContainer.appendChild(downloadBtn);

    const driveBtn = document.createElement('button');
    driveBtn.textContent = 'Enregistrer sur Drive';
    driveBtn.className = 'drive-btn';
    driveBtn.style.background = '#4285F4';
    driveBtn.style.color = '#fff';
    driveBtn.onclick = function() {
        // Enregistre dans le dossier Drive ACTUEL
        uploadToDrive(fileName, dataURL, fileType);
    };
    buttonsContainer.appendChild(driveBtn);

    previewBox.appendChild(buttonsContainer);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Supprimer';
    removeBtn.className = 'remove-btn';
    removeBtn.onclick = function() {
        previewBox.remove();
        let saved = JSON.parse(localStorage.getItem('fichiers') || '[]');
        saved = saved.filter(f => f.name !== fileName);
        localStorage.setItem('fichiers', JSON.stringify(saved));
        displayMessage(`Fichier "${fileName}" supprimé du stockage local.`, 'info');
    };
    previewBox.appendChild(removeBtn);

    previewContainer.appendChild(previewBox);
}

// --- Fonctions Google Drive (inchangées) ---

/**
 * Liste les fichiers et dossiers présents dans un dossier spécifique du Google Drive.
 * @param {string} folderId - L'ID du dossier dont il faut lister le contenu ('root' pour la racine).
 */
async function listDriveFiles(folderId) {
    if (!accessToken) {
        displayMessage("Connectez-vous à Google pour voir vos fichiers Drive.", 'info');
        return;
    }
    if (!gapiIsReady) {
        displayMessage("L'API Google Drive n'est pas encore prête. Veuillez patienter.", 'info');
        return;
    }

    displayMessage('Chargement des fichiers et dossiers Drive...', 'info');
    driveFilesContainer.innerHTML = ''; // Vide le conteneur avant de charger

    let query = `'${folderId}' in parents and trashed = false`; // Recherche les éléments dont le parent est folderId et qui ne sont pas à la corbeille

    try {
        const response = await gapi.client.drive.files.list({
            q: query,
            pageSize: 100, // Augmenté pour voir plus d'éléments
            fields: "nextPageToken, files(id, name, mimeType, webContentLink, iconLink)", // iconLink peut être utile pour les icônes de type de fichier
            orderBy: 'folder,name asc' // Affiche les dossiers en premier, puis trie par nom
        });

        const items = response.result.files; // Peut contenir fichiers et dossiers
        if (items && items.length > 0) {
            items.forEach(item => {
                createDriveItemBox(item); // Utilise la nouvelle fonction qui gère fichiers ET dossiers
            });
            displayMessage(`${items.length} élément(s) trouvé(s) dans ce dossier Drive.`, 'success');
        } else {
            driveFilesContainer.innerHTML = '<p style="width: 100%; text-align: center; color: #777;">Aucun fichier ni dossier trouvé dans ce répertoire.</p>';
            displayMessage('Aucun élément trouvé dans ce dossier Drive.', 'info');
        }
    } catch (err) {
        console.error('❌ Erreur lors de la liste des fichiers Drive:', err);
        displayMessage('Erreur lors de la récupération des éléments Drive: ' + (err.result && err.result.error ? err.result.error.message : err.message || "Erreur inconnue."), 'error');
        driveFilesContainer.innerHTML = '<p style="width: 100%; text-align: center; color: #777;">Erreur lors du chargement des éléments.</p>';
    }
}

/**
 * Crée un nouveau dossier dans Google Drive.
 * @param {string} folderName - Le nom du dossier à créer.
 * @param {string} parentId - L'ID du dossier parent dans lequel créer le nouveau dossier ('root' pour la racine).
 */
async function createFolder(folderName, parentId) {
    if (!accessToken) {
        displayMessage("Connectez-vous à Google pour créer un dossier.", 'info');
        return;
    }
    if (!gapiIsReady) {
        displayMessage("L'API Google Drive n'est pas encore prête. Veuillez patienter.", 'info');
        return;
    }

    const metadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
    };

    try {
        displayMessage(`Création du dossier "${folderName}"...`, 'info');
        const response = await gapi.client.drive.files.create({
            resource: metadata,
            fields: 'id, name, mimeType'
        });

        displayMessage(`Dossier "${response.result.name}" créé !`, 'success');
        console.log('Dossier créé:', response.result);
        // Après création, rafraîchit la liste du dossier actuel
        listDriveFiles(currentFolderId);
    } catch (err) {
        console.error('❌ Erreur lors de la création du dossier:', err);
        displayMessage(`Erreur lors de la création du dossier: ${err.message}`, 'error');
    }
}


/**
 * Crée et ajoute une boîte de prévisualisation pour un élément (fichier ou dossier) de Google Drive.
 * @param {object} item - L'objet élément (fichier ou dossier) de l'API Google Drive.
 */
function createDriveItemBox(item) {
    const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
    const driveItemBox = document.createElement('div');
    driveItemBox.className = 'drive-item-box' + (isFolder ? ' folder' : ''); // Ajoute la classe 'folder' si c'est un dossier

    // Gère le clic sur le dossier
    if (isFolder) {
        driveItemBox.onclick = () => enterFolder(item.id, item.name);
    } else {
        // Pour les fichiers, le clic peut ne rien faire ou ouvrir un aperçu
        // Ici, on ne fait rien pour les fichiers pour l'instant, le téléchargement est via le bouton
    }


    // Affichage de l'icône (si disponible via iconLink) ou une icône par défaut
    const itemIcon = document.createElement('img');
    if (item.iconLink) {
        itemIcon.src = item.iconLink;
    } else {
        // Icône par défaut pour les dossiers ou fichiers sans iconLink
        itemIcon.src = isFolder ? 'https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/prod/svg/drive_64dp.svg' : 'https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/prod/svg/drive_64dp.svg'; // Remplacer par des icônes locales si besoin
    }
    itemIcon.alt = isFolder ? 'Dossier' : 'Fichier';
    itemIcon.style.width = '48px'; // Taille de l'icône
    itemIcon.style.height = '48px';
    itemIcon.style.marginBottom = '10px';
    driveItemBox.appendChild(itemIcon);


    const itemName = document.createElement('div');
    itemName.textContent = item.name;
    itemName.className = 'file-name';
    driveItemBox.appendChild(itemName);

    const itemType = document.createElement('div');
    itemType.textContent = isFolder ? 'Dossier' : `Type: ${item.mimeType.split('/').pop()}`; // Affiche 'Dossier' ou le type MIME simplifié
    itemType.className = 'item-type';
    driveItemBox.appendChild(itemType);

    // Bouton de téléchargement pour les fichiers (pas pour les dossiers)
    if (!isFolder && item.webContentLink) {
        const downloadLink = document.createElement('a');
        downloadLink.href = item.webContentLink;
        downloadLink.textContent = 'Télécharger';
        downloadLink.target = '_blank';
        downloadLink.className = 'download-btn'; // Utilise le style de download-btn
        downloadLink.style.position = 'relative'; // Pour s'assurer que les styles du a s'appliquent bien
        downloadLink.style.display = 'block';
        downloadLink.style.marginTop = '10px';
        downloadLink.style.marginBottom = '5px';
        downloadLink.style.background = '#007bff'; // Couleur différente pour les liens de téléchargement Drive
        downloadLink.style.color = '#fff';
        downloadLink.style.borderRadius = '10px';
        downloadLink.style.textDecoration = 'none';
        driveItemBox.appendChild(downloadLink);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Supprimer de Drive';
    deleteBtn.className = 'delete-drive-btn';
    deleteBtn.onclick = async function(event) {
        event.stopPropagation(); // Empêche le clic sur le bouton de déclencher l'entrée dans le dossier
        if (confirm(`Êtes-vous sûr de vouloir supprimer "${item.name}" de Google Drive ?`)) {
            const success = await deleteDriveFile(item.id, item.name);
            if (success) {
                driveItemBox.remove();
            }
        }
    };
    driveItemBox.appendChild(deleteBtn);

    driveFilesContainer.appendChild(driveItemBox);
}

/**
 * Supprime un fichier ou un dossier de Google Drive.
 * @param {string} itemId - L'ID de l'élément (fichier ou dossier) à supprimer.
 * @param {string} itemName - Le nom de l'élément (pour les messages utilisateur).
 * @returns {boolean} - Vrai si la suppression a réussi, faux sinon.
 */
async function deleteDriveFile(itemId, itemName) { // Renommée de deleteDriveFile à deleteDriveItem
    if (!accessToken) {
        displayMessage("Connectez-vous à Google pour supprimer des éléments.", 'info');
        return false;
    }
    if (!gapiIsReady) {
        displayMessage("L'API Google Drive n'est pas encore prête. Veuillez patienter.", 'info');
        return false;
    }

    displayMessage(`Suppression de "${itemName}" de Google Drive...`, 'info');
    try {
        const response = await gapi.client.drive.files.delete({
            'fileId': itemId
        });
        if (response.status === 204) {
            displayMessage(`"${itemName}" supprimé de Google Drive avec succès.`, 'success');
            console.log('Élément supprimé de Drive:', itemName);
            return true;
        } else {
            console.error('❌ Échec de la suppression:', response);
            displayMessage(`Erreur lors de la suppression de "${itemName}".`, 'error');
            return false;
        }
    } catch (err) {
        console.error('❌ Erreur lors de la suppression de Drive:', err);
        displayMessage(`Erreur lors de la suppression de "${itemName}": ` + (err.result && err.result.error ? err.result.error.message : err.message || "Erreur inconnue."), 'error');
        return false;
    }
}

/**
 * Entre dans un dossier et affiche son contenu.
 * @param {string} folderId - L'ID du dossier à ouvrir.
 * @param {string} folderName - Le nom du dossier à ouvrir.
 */
function enterFolder(folderId, folderName) {
    currentFolderId = folderId;
    drivePath.push({ name: folderName, id: folderId });
    updateDrivePathDisplay();
    listDriveFiles(currentFolderId);
}

/**
 * Remonte au dossier parent.
 */
function goBackToParentFolder() {
    if (drivePath.length > 1) { // Ne peut pas remonter si on est à la racine
        drivePath.pop(); // Retire le dossier actuel
        const parentFolder = drivePath[drivePath.length - 1];
        currentFolderId = parentFolder.id;
        updateDrivePathDisplay();
        listDriveFiles(currentFolderId);
    } else {
        displayMessage("Vous êtes déjà à la racine de Google Drive.", 'info');
    }
}

// --- NOUVELLES FONCTIONS POUR LA GESTION DES NOTES ---

/**
 * Ajoute une nouvelle note au stockage local et à l'affichage.
 */
function addNote() {
    const noteContent = notesInput.value.trim();
    if (noteContent) {
        let notes = JSON.parse(localStorage.getItem('notes') || '[]');
        notes.push(noteContent);
        localStorage.setItem('notes', JSON.stringify(notes));
        createNoteElement(noteContent);
        notesInput.value = ''; // Vide la zone de texte après ajout
        displayMessage('Note ajoutée !', 'success');
    } else {
        displayMessage('Veuillez écrire quelque chose pour ajouter une note.', 'info');
    }
}

/**
 * Crée un élément HTML pour une note et l'ajoute au conteneur.
 * @param {string} noteContent - Le contenu de la note.
 */
function createNoteElement(noteContent) {
    const noteItem = document.createElement('div');
    noteItem.className = 'note-item';
    noteItem.textContent = noteContent;

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'X'; // Ou une icône de croix
    deleteBtn.className = 'delete-note-btn';
    deleteBtn.onclick = function() {
        deleteNote(noteContent, noteItem); // Passe le contenu et l'élément pour suppression
    };
    noteItem.appendChild(deleteBtn);

    notesContainer.prepend(noteItem); // Ajoute la nouvelle note en haut de la liste
}

/**
 * Supprime une note du stockage local et de l'affichage.
 * @param {string} noteContent - Le contenu de la note à supprimer.
 * @param {HTMLElement} noteElement - L'élément HTML de la note à supprimer de l'affichage.
 */
function deleteNote(noteContent, noteElement) {
    let notes = JSON.parse(localStorage.getItem('notes') || '[]');
    // Trouve l'index de la première occurrence de cette note et la supprime
    const index = notes.indexOf(noteContent);
    if (index > -1) {
        notes.splice(index, 1);
        localStorage.setItem('notes', JSON.stringify(notes));
        noteElement.remove(); // Supprime l'élément HTML
        displayMessage('Note supprimée !', 'info');
    }
}

/**
 * Charge les notes depuis le stockage local et les affiche au démarrage.
 */
function loadNotes() {
    let notes = JSON.parse(localStorage.getItem('notes') || '[]');
    // Affiche les notes dans l'ordre inverse pour que les plus récentes soient en haut
    notes.reverse().forEach(note => createNoteElement(note));
}
