// --- Ton code d'animation existant (si tu en as un) peut être placé ici, au début du fichier.
// Assure-toi que les keyframes CSS pour 'fondAnime' sont bien dans le bloc <style> de l'HTML.
// Si Animation.js contient du JS pour l'animation, il peut rester ici.
// ---

// --- DÉBUT DU CODE GOOGLE ET GESTION DES FICHIERS ---

const previewContainer = document.getElementById('preview-container');
const messageDisplay = document.getElementById('message-display');

// **ATTENTION : Ces identifiants sont exposés côté client. Ce n'est PAS SÛR pour une application en production.**
// Pour une application réelle, tu devrais utiliser un serveur backend pour interagir avec l'API Google Drive
// afin de protéger ta clé API et tes identifiants de service.
const CLIENT_ID = '716108448607-4d46lrnamcdkk07jo2gaq7bc9pu47ag3.apps.googleusercontent.com';
const API_KEY = 'AIzaSyBeHW_Izkd7InzeahDl6gGxI5OMyOhiFm8';
const SCOPES = 'https://www.googleapis.com/auth/drive.file'; // Permet d'accéder aux fichiers créés par l'app

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // Limite de 5 Mo pour les fichiers (5 * 1024 * 1024 bytes)

let tokenClient; // Utilisé par Google Identity Services (GIS) pour la connexion
let accessToken = null; // Le token d'accès obtenu après connexion

// Drapeaux pour suivre le chargement des bibliothèques Google
let gapiIsReady = false;
let gisIsReady = false;

/**
 * Affiche un message à l'utilisateur de manière non bloquante.
 * @param {string} message - Le texte du message à afficher.
 * @param {string} type - Le type de message ('success', 'error', 'info').
 */
function displayMessage(message, type) {
    if (!messageDisplay) {
        // Fallback to alert if messageDisplay element is not found
        alert(message);
        return;
    }
    messageDisplay.textContent = message;
    messageDisplay.className = ''; // Réinitialise les classes
    messageDisplay.classList.add(type);
    messageDisplay.style.display = 'block';

    // Cache le message après 5 secondes
    setTimeout(() => {
        messageDisplay.style.display = 'none';
    }, 5000);
}

/**
 * Active le bouton de connexion Google lorsque les deux bibliothèques (GAPI et GIS) sont chargées.
 */
function enableGoogleLoginButton() {
    if (gapiIsReady && gisIsReady) {
        const googleLoginBtn = document.getElementById('google-login-btn');
        if (googleLoginBtn) {
            googleLoginBtn.disabled = false;
            googleLoginBtn.textContent = 'Connexion Google';
            // Le gestionnaire de clic est attaché une seule fois dans DOMContentLoaded
        }
        console.log("🟢 Les API Google (GAPI et GIS) sont prêtes ! Bouton de connexion activé.");
    }
}

/**
 * Fonction de rappel appelée par le script 'api.js' de Google (GAPI) une fois qu'il est chargé.
 * Charge le client d'API GAPI.
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
        enableGoogleLoginButton(); // Tente d'activer le bouton si GIS est aussi prêt
    } catch (error) {
        console.error("❌ Erreur lors de l'initialisation du client GAPI:", error);
        displayMessage("Une erreur est survenue lors de l'initialisation de Google Drive API. Vérifiez la console.", 'error');
    }
}

/**
 * Fonction de rappel appelée par le script 'gsi/client.js' de Google (GIS) une fois qu'il est chargé.
 * Initialise le client de jeton pour l'authentification.
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
                // Si l'utilisateur refuse ou quitte, l'état peut rester "Déconnecté"
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
        },
    });
    gisIsReady = true;
    console.log('✅ Client de jeton GIS initialisé. gisIsReady =', gIsReady);
    enableGoogleLoginButton(); // Tente d'activer le bouton si GAPI est aussi prêt
}

// Rend les fonctions gapiLoaded et gisLoaded accessibles globalement pour que les scripts Google les appellent.
window.gapiLoaded = gapiLoaded;
window.gisLoaded = gisLoaded;

// Cet événement est déclenché lorsque le DOM est entièrement chargé
document.addEventListener('DOMContentLoaded', () => {
    console.log("🔵 DOMContentLoaded déclenché. Initialisation des éléments de l'interface.");

    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.disabled = true; // Désactive le bouton initialement
        googleLoginBtn.textContent = 'Chargement Google Connexion...'; // Message d'attente
        // Attache le gestionnaire de clic une seule fois
        googleLoginBtn.onclick = () => {
            if (tokenClient) {
                tokenClient.requestAccessToken();
            } else {
                displayMessage("La bibliothèque de connexion Google n'est pas encore chargée. Veuillez patienter.", 'info');
            }
        };
    }

    // Gestionnaire pour l'importation de fichiers
    const fileUploadInput = document.getElementById('file-upload');
    if (fileUploadInput) {
        fileUploadInput.addEventListener('change', function(event) {
            const files = Array.from(event.target.files);
            let saved = JSON.parse(localStorage.getItem('fichiers') || '[]');

            files.forEach((file) => {
                if (file.size > MAX_FILE_SIZE_BYTES) {
                    displayMessage(`Le fichier "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} Mo) dépasse la limite de ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} Mo et ne sera pas sauvegardé.`, 'error');
                    return; // Passe au fichier suivant
                }

                const reader = new FileReader();
                reader.onload = function(e) {
                    createPreviewBox(file.name, e.target.result, file.type);
                    saved.push({ name: file.name, data: e.target.result, type: file.type });
                    localStorage.setItem('fichiers', JSON.stringify(saved));
                };
                reader.readAsDataURL(file);
            });
            event.target.value = ''; // Réinitialise l'input pour pouvoir importer le même fichier à nouveau
        });
    }

    // Chargement initial des fichiers sauvegardés depuis localStorage
    const saved = JSON.parse(localStorage.getItem('fichiers') || '[]');
    saved.forEach(f => createPreviewBox(f.name, f.data, f.type));
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
 * Upload un fichier sur Google Drive.
 * @param {string} fileName - Nom du fichier.
 * @param {string} dataURL - Data URL du fichier.
 * @param {string} fileType - Type MIME du fichier.
 */
async function uploadToDrive(fileName, dataURL, fileType) {
    if (!accessToken) {
        displayMessage("Connectez-vous à Google avant d'envoyer sur Drive.", 'info');
        return;
    }
    // Vérifie si gapi.client.drive est initialisé
    // Note: gapi.client.drive n'est pas directement disponible après gapi.client.init(),
    // mais plutôt après que les APIs découvertes (discoveryDocs) soient chargées et le client Drive soit "prêt" à être appelé.
    // L'erreur "API Google Drive non chargée" peut survenir si la discoveryDocs n'a pas fini de charger.
    // L'appel `gapi.client.init()` assure que les documents de découverte sont chargés.
    // Si des problèmes persistent, vérifie la console pour les erreurs de chargement de l'API Drive.

    const fileBlob = dataURLtoBlob(dataURL);
    const metadata = {
        name: fileName,
        mimeType: fileType
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
    form.append('file', fileBlob);

    try {
        displayMessage(`Envoi de "${fileName}" sur Google Drive...`, 'info');
        // Utilisation de fetch API pour l'upload
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + accessToken
            },
            body: form
        });

        if (!response.ok) { // Si la réponse HTTP n'est pas un succès (ex: 4xx, 5xx)
            const errorData = await response.json();
            throw new Error(errorData.error.message || 'Erreur inconnue lors de l\'envoi du fichier.');
        }

        const result = await response.json(); // Parse la réponse JSON
        displayMessage(`Fichier "${result.name}" envoyé sur Google Drive ! ID: ${result.id}`, 'success');
        console.log('Fichier uploadé:', result);
    } catch (err) {
        console.error('❌ Erreur lors de l\'envoi sur Drive:', err);
        displayMessage(`Erreur lors de l'envoi sur Drive: ${err.message}`, 'error');
    }
}

/**
 * Crée et ajoute une boîte de prévisualisation pour un fichier.
 * @param {string} fileName - Nom du fichier.
 * @param {string} dataURL - Data URL du fichier.
 * @param {string} fileType - Type MIME du fichier.
 */
function createPreviewBox(fileName, dataURL, fileType) {
    const previewBox = document.createElement('div');
    previewBox.className = 'preview-box'; // Ajout de la classe pour le style CSS

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

    // Conteneur pour les boutons en haut
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'preview-buttons-container';

    // Télécharger bouton
    const downloadBtn = document.createElement('a');
    downloadBtn.textContent = 'Télécharger';
    downloadBtn.href = dataURL;
    downloadBtn.download = fileName;
    downloadBtn.className = 'download-btn'; // Ajout de la classe pour le style CSS
    buttonsContainer.appendChild(downloadBtn);

    // Enregistrer sur Drive bouton
    const driveBtn = document.createElement('button');
    driveBtn.textContent = 'Enregistrer sur Drive';
    driveBtn.className = 'drive-btn'; // Ajout de la classe pour le style CSS
    driveBtn.style.background = '#4285F4'; // Couleur spécifique pour le bouton Drive
    driveBtn.style.color = '#fff';
    driveBtn.onclick = function() {
        uploadToDrive(fileName, dataURL, fileType);
    };
    buttonsContainer.appendChild(driveBtn);

    previewBox.appendChild(buttonsContainer); // Ajoute le conteneur de boutons

    // Supprimer bouton (positionné en bas à droite)
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Supprimer';
    removeBtn.className = 'remove-btn'; // Ajout de la classe pour le style CSS
    removeBtn.onclick = function() {
        previewBox.remove();
        let saved = JSON.parse(localStorage.getItem('fichiers') || '[]');
        saved = saved.filter(f => f.name !== fileName);
        localStorage.setItem('fichiers', JSON.stringify(saved));
        displayMessage(`Fichier "${fileName}" supprimé.`, 'info');
    };
    previewBox.appendChild(removeBtn); // Ajoute le bouton supprimer directement à previewBox

    previewContainer.appendChild(previewBox);
}
