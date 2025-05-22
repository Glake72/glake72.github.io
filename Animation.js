// Déclarations de constantes et variables (éléments du DOM, IDs API, etc.)
const previewContainer = document.getElementById('preview-container');
const messageDisplay = document.getElementById('message-display');
const googleLoginBtn = document.getElementById('google-login-btn');
const googleUserSpan = document.getElementById('google-user');
const fileUploadInput = document.getElementById('file-upload');
const showDriveFilesBtn = document.getElementById('show-drive-files-btn');
const driveFilesContainer = document.getElementById('drive-files-container');
const drivePathDisplay = document.getElementById('drive-path');
const createFolderBtn = document.getElementById('create-folder-btn');
const notesInput = document.getElementById('notes-input');
const notesContainer = document.getElementById('notes-container');
const addNoteBtn = document.getElementById('add-note-btn');

// Identifiants et permissions Google API
const CLIENT_ID = 'YOUR_CLIENT_ID'; // Remplace par ton CLIENT_ID
const API_KEY = 'YOUR_API_KEY';     // Remplace par ton API_KEY

// Les permissions demandées à Google Drive
const SCOPES = [
    'https://www.googleapis.com/auth/drive.file', // Accès aux fichiers créés ou ouverts par l'app
    'https://www.googleapis.com/auth/drive.metadata.readonly' // Accès en lecture aux métadonnées (pour lister les fichiers/dossiers)
];

let tokenClient;
let gapiInited = false;
let gisInited = false;
let accessToken; // Stocke le token d'accès Google

// Variable pour suivre le dossier courant dans Google Drive
// C'est une pile (stack) pour gérer la navigation dans les dossiers
let currentDrivePath = [{ id: 'root', name: 'Racine' }];

// Fonctions de rappel Google (gapiLoaded, gisLoaded)
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    });
    gapiInited = true;
    maybeEnableButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES.join(' '),
        callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
                accessToken = tokenResponse.access_token;
                gapi.client.setToken({ access_token: accessToken });
                googleLoginBtn.textContent = 'Déconnexion Google';
                googleUserSpan.textContent = 'Connecté';
                displayMessage('Connecté à Google Drive !', 'success');
                listDriveFiles(currentDrivePath[currentDrivePath.length - 1].id); // Liste les fichiers du dossier courant
            } else {
                googleLoginBtn.textContent = 'Connexion Google';
                googleUserSpan.textContent = 'Déconnecté';
                displayMessage('Déconnecté de Google Drive.', 'info');
                driveFilesContainer.innerHTML = '<p>Cliquez sur "Afficher mes fichiers Drive" ci-dessous pour les charger.</p>';
            }
        },
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        googleLoginBtn.textContent = 'Connexion Google';
        googleLoginBtn.disabled = false;
    }
}

// Fonction pour gérer la connexion/déconnexion Google
function handleAuthClick() {
    if (accessToken) {
        // Déconnexion
        accessToken = null;
        gapi.client.setToken(null); // Retire le token de gapi.client
        googleLoginBtn.textContent = 'Connexion Google';
        googleUserSpan.textContent = 'Déconnecté';
        displayMessage('Déconnecté de Google Drive.', 'info');
        driveFilesContainer.innerHTML = '<p>Cliquez sur "Afficher mes fichiers Drive" ci-dessous pour les charger.</p>';
        // Réinitialise le chemin du Drive à la racine
        currentDrivePath = [{ id: 'root', name: 'Racine' }];
        updateDrivePathDisplay();
    } else {
        // Connexion
        tokenClient.requestAccessToken();
    }
}

// Événement DOMContentLoaded (le code s'exécute une fois que le HTML est chargé)
document.addEventListener('DOMContentLoaded', () => {
    // Récupération des références aux boutons et inputs
    if (googleLoginBtn) {
        googleLoginBtn.onclick = handleAuthClick;
    }
    if (showDriveFilesBtn) {
        showDriveFilesBtn.onclick = () => {
            if (accessToken) {
                listDriveFiles(currentDrivePath[currentDrivePath.length - 1].id);
            } else {
                displayMessage('Veuillez vous connecter à Google Drive d\'abord.', 'error');
            }
        };
    }
    if (fileUploadInput) {
        fileUploadInput.addEventListener('change', function(event) {
            const files = Array.from(event.target.files);
            files.forEach((file) => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    createPreviewBox(file.name, e.target.result, file.type);
                    let saved = JSON.parse(localStorage.getItem('fichiers') || '[]');
                    saved.push({ name: file.name, data: e.target.result, type: file.type });
                    localStorage.setItem('fichiers', JSON.stringify(saved));
                };
                reader.readAsDataURL(file);
            });
        });
    }
    if (createFolderBtn) {
        createFolderBtn.addEventListener('click', async () => {
            const folderName = prompt('Nom du nouveau dossier :');
            if (folderName) {
                await createFolder(folderName, currentDrivePath[currentDrivePath.length - 1].id);
            }
        });
    }
    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', addNote);
    }

    // Chargement initial des données
    loadLocalFiles();
    loadNotes();
    updateDrivePathDisplay(); // Met à jour l'affichage du chemin au chargement
});

// Fonctions utilitaires
function displayMessage(message, type) {
    messageDisplay.textContent = message;
    messageDisplay.className = `message ${type}`;
    messageDisplay.style.display = 'block';
    setTimeout(() => {
        messageDisplay.style.display = 'none';
    }, 5000); // Masque le message après 5 secondes
}

function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

function loadLocalFiles() {
    let saved = JSON.parse(localStorage.getItem('fichiers') || '[]');
    saved.forEach(file => createPreviewBox(file.name, file.data, file.type));
}

function createPreviewBox(fileName, fileData, fileType) {
    const previewBox = document.createElement('div');
    previewBox.className = 'preview-box';

    if (fileType.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = fileData;
        img.alt = fileName;
        previewBox.appendChild(img);
    } else {
        const icon = document.createElement('span');
        icon.className = 'file-icon';
        icon.textContent = '📄'; // Icône générique pour les fichiers non-image
        previewBox.appendChild(icon);
    }

    const fileNameSpan = document.createElement('span');
    fileNameSpan.className = 'file-name';
    fileNameSpan.textContent = fileName;
    previewBox.appendChild(fileNameSpan);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'preview-buttons-container';

    // Bouton Télécharger
    const downloadLink = document.createElement('a');
    downloadLink.href = fileData;
    downloadLink.download = fileName;
    downloadLink.textContent = 'Télécharger';
    downloadLink.className = 'download-btn';
    buttonsContainer.appendChild(downloadLink);

    // Bouton Supprimer
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Supprimer';
    removeBtn.className = 'remove-btn';
    removeBtn.onclick = () => {
        previewBox.remove();
        let saved = JSON.parse(localStorage.getItem('fichiers') || '[]');
        saved = saved.filter(f => f.name !== fileName || f.data !== fileData); // Supprime l'élément correspondant
        localStorage.setItem('fichiers', JSON.stringify(saved));
        displayMessage('Fichier local supprimé !', 'info');
    };
    buttonsContainer.appendChild(removeBtn);

    // Bouton Envoyer sur Drive
    const driveBtn = document.createElement('button');
    driveBtn.textContent = 'Envoyer sur Drive';
    driveBtn.className = 'drive-btn';
    driveBtn.onclick = async () => {
        if (accessToken) {
            await uploadToDrive(fileName, fileData, fileType);
            // Optionnel: supprimer le fichier local après l'upload sur Drive
            // removeBtn.click();
        } else {
            displayMessage('Veuillez vous connecter à Google Drive d\'abord.', 'error');
        }
    };
    buttonsContainer.appendChild(driveBtn);

    previewBox.appendChild(buttonsContainer);
    previewContainer.prepend(previewBox); // Ajoute le nouveau fichier en haut
}

// Fonctions Google Drive
async function uploadToDrive(fileName, dataURL, fileType) {
    displayMessage(`Envoi de "${fileName}" sur Drive...`, 'info');
    const blob = dataURLtoBlob(dataURL);

    const fileMetadata = {
        name: fileName,
        parents: [currentDrivePath[currentDrivePath.length - 1].id] // Ajoute le fichier dans le dossier courant
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
    form.append('file', blob);

    try {
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            body: form
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Erreur d'envoi : ${errorData.error.message}`);
        }

        const file = await response.json();
        displayMessage(`Fichier "${file.name}" envoyé sur Google Drive !`, 'success');
        listDriveFiles(currentDrivePath[currentDrivePath.length - 1].id); // Rafraîchit la liste Drive
    } catch (error) {
        console.error('Erreur lors de l\'envoi sur Drive :', error);
        displayMessage(`Échec de l'envoi sur Drive : ${error.message}`, 'error');
    }
}

async function listDriveFiles(folderId) {
    if (!accessToken) {
        displayMessage('Non connecté à Google Drive.', 'error');
        return;
    }

    displayMessage('Chargement des fichiers Drive...', 'info');
    driveFilesContainer.innerHTML = ''; // Vide le conteneur

    try {
        const response = await gapi.client.drive.files.list({
            pageSize: 100, // Nombre d'éléments à récupérer
            fields: 'nextPageToken, files(id, name, mimeType, parents)',
            q: `'${folderId}' in parents and trashed = false`, // Filtre par dossier parent et non corbeille
        });

        const files = response.result.files;
        if (files && files.length > 0) {
            // Créer le bouton "Retour" si on n'est pas à la racine
            if (currentDrivePath.length > 1) {
                const backBtn = document.createElement('button');
                backBtn.textContent = 'Retour au dossier parent';
                backBtn.className = 'drive-action-btn back-btn';
                backBtn.onclick = goBackToParentFolder;
                driveFilesContainer.appendChild(backBtn);
            }

            files.forEach(file => {
                createDriveItemBox(file);
            });
            displayMessage('Fichiers Drive chargés.', 'success');
        } else {
            displayMessage('Aucun fichier ou dossier dans ce répertoire.', 'info');
        }
    } catch (error) {
        console.error('Erreur lors du listage des fichiers Drive :', error);
        displayMessage(`Échec du chargement des fichiers Drive : ${error.message}`, 'error');
    }
}

async function createFolder(folderName, parentId) {
    if (!accessToken) {
        displayMessage('Non connecté à Google Drive.', 'error');
        return;
    }

    displayMessage(`Création du dossier "${folderName}"...`, 'info');

    const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
    };

    try {
        const response = await gapi.client.drive.files.create({
            resource: fileMetadata,
            fields: 'id, name',
        });

        const folder = response.result;
        displayMessage(`Dossier "${folder.name}" créé !`, 'success');
        listDriveFiles(parentId); // Rafraîchit la liste
    } catch (error) {
        console.error('Erreur lors de la création du dossier :', error);
        displayMessage(`Échec de la création du dossier : ${error.message}`, 'error');
    }
}

async function deleteDriveFile(itemId, itemName) {
    if (!accessToken) {
        displayMessage('Non connecté à Google Drive.', 'error');
        return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${itemName}" de Google Drive ?`)) {
        return; // Annule si l'utilisateur ne confirme pas
    }

    displayMessage(`Suppression de "${itemName}"...`, 'info');

    try {
        await gapi.client.drive.files.delete({
            fileId: itemId,
        });
        displayMessage(`"${itemName}" supprimé de Google Drive !`, 'success');
        listDriveFiles(currentDrivePath[currentDrivePath.length - 1].id); // Rafraîchit la liste
    } catch (error) {
        console.error('Erreur lors de la suppression du fichier/dossier Drive :', error);
        displayMessage(`Échec de la suppression : ${error.message}`, 'error');
    }
}

function createDriveItemBox(item) {
    const itemBox = document.createElement('div');
    itemBox.className = 'drive-item-box';

    const icon = document.createElement('span');
    icon.className = 'drive-icon';
    if (item.mimeType === 'application/vnd.google-apps.folder') {
        icon.textContent = '📁'; // Icône de dossier
        itemBox.classList.add('folder');
        itemBox.onclick = () => enterFolder(item.id, item.name); // Permet d'entrer dans le dossier
    } else {
        icon.textContent = '📄'; // Icône de fichier générique
    }
    itemBox.appendChild(icon);

    const itemNameSpan = document.createElement('span');
    itemNameSpan.className = 'item-name';
    itemNameSpan.textContent = item.name;
    itemBox.appendChild(itemNameSpan);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Supprimer';
    deleteBtn.className = 'delete-drive-btn';
    deleteBtn.onclick = (e) => {
        e.stopPropagation(); // Empêche l'événement de clic sur le dossier de se propager
        deleteDriveFile(item.id, item.name);
    };
    itemBox.appendChild(deleteBtn);

    driveFilesContainer.appendChild(itemBox);
}

// Fonction pour entrer dans un dossier Google Drive
function enterFolder(folderId, folderName) {
    currentDrivePath.push({ id: folderId, name: folderName }); // Ajoute le dossier à la pile
    updateDrivePathDisplay();
    listDriveFiles(folderId);
}

// Fonction pour revenir au dossier parent Google Drive
function goBackToParentFolder() {
    if (currentDrivePath.length > 1) { // S'assurer qu'on n'est pas déjà à la racine
        currentDrivePath.pop(); // Retire le dossier actuel de la pile
        const parentFolder = currentDrivePath[currentDrivePath.length - 1];
        updateDrivePathDisplay();
        listDriveFiles(parentFolder.id);
    } else {
        displayMessage('Vous êtes déjà à la racine de Google Drive.', 'info');
    }
}

// Fonction pour mettre à jour l'affichage du chemin du dossier Google Drive
function updateDrivePathDisplay() {
    drivePathDisplay.innerHTML = ''; // Vide l'affichage actuel
    currentDrivePath.forEach((folder, index) => {
        const span = document.createElement('span');
        span.textContent = folder.name;
        span.className = 'path-segment';
        span.onclick = () => {
            // Permet de cliquer sur un segment du chemin pour y revenir
            currentDrivePath.splice(index + 1); // Tronque la pile à ce point
            updateDrivePathDisplay();
            listDriveFiles(folder.id);
        };
        drivePathDisplay.appendChild(span);
        if (index < currentDrivePath.length - 1) {
            const separator = document.createElement('span');
            separator.textContent = ' / ';
            separator.className = 'path-separator';
            drivePathDisplay.appendChild(separator);
        }
    });
}

// NOUVELLES FONCTIONS POUR LA GESTION DES NOTES
function addNote() {
    const noteContent = notesInput.value.trim();
    if (noteContent) {
        let notes = JSON.parse(localStorage.getItem('notes') || '[]');
        notes.push(noteContent);
        localStorage.setItem('notes', JSON.stringify(notes));
        createNoteElement(noteContent);
        notesInput.value = '';
        displayMessage('Note ajoutée !', 'success');
    } else {
        displayMessage('Veuillez écrire une note.', 'error');
    }
}

function createNoteElement(noteContent) {
    const noteItem = document.createElement('div');
    noteItem.className = 'note-item';

    const noteText = document.createElement('span');
    noteText.textContent = noteContent;
    noteItem.appendChild(noteText);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'X';
    deleteBtn.className = 'delete-note-btn';
    deleteBtn.onclick = function() {
        deleteNote(noteContent, noteItem);
    };
    noteItem.appendChild(deleteBtn);

    notesContainer.prepend(noteItem);
}

function deleteNote(noteContent, noteElement) {
    let notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const index = notes.indexOf(noteContent);
    if (index > -1) {
        notes.splice(index, 1);
        localStorage.setItem('notes', JSON.stringify(notes));
        noteElement.remove();
        displayMessage('Note supprimée !', 'info');
    }
}

function loadNotes() {
    let notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.reverse().forEach(note => createNoteElement(note));
}
