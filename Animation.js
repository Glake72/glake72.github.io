// --- DÉBUT DU CODE GOOGLE ET GESTION DES FICHIERS ---

const previewContainer = document.getElementById('preview-container');

// REMPLACE TES CLIENT_ID ET API_KEY ICI
const CLIENT_ID = '716108448607-4d46lrnamcdkk07jo2gaq7bc9pu47ag3.apps.googleusercontent.com';
const API_KEY = 'AIzaSyBeHW_Izkd7InzeahDl6gGxI5OMyOhiFm8';
const SCOPES = 'https://www.googleapis.com/auth/drive.file'; // Permet d'accéder aux fichiers créés par l'app

let tokenClient; // Utilisé par Google Identity Services (GIS) pour la connexion
let accessToken = null; // Le token d'accès obtenu après connexion

// Drapeaux pour suivre le chargement des bibliothèques
let gapiIsReady = false;
let gisIsReady = false;

// Fonction pour activer le bouton de connexion une fois que les deux bibliothèques sont prêtes
function enableGoogleLoginButton() {
    if (gapiIsReady && gisIsReady) {
        const googleLoginBtn = document.getElementById('google-login-btn');
        if (googleLoginBtn) { // Vérifie si le bouton existe avant d'interagir
            googleLoginBtn.disabled = false;
            googleLoginBtn.textContent = 'Connexion Google';
        }
        console.log("Les API Google sont prêtes ! Bouton de connexion activé.");
    }
}

// Fonction appelée quand la bibliothèque GAPI (Google API Client) est chargée
// Elle est déclenchée par le script async/defer dans index.html
function gapiLoaded() {
    console.log("gapi.js script chargé.");
    gapi.load('client', initializeGapiClient);
}

// Initialise le client GAPI pour pouvoir faire des requêtes aux APIs (ex: Drive)
async function initializeGapiClient() {
    console.log("Initialisation du client GAPI...");
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        });
        gapiIsReady = true;
        console.log('Client GAPI initialisé. gapiIsReady =', gapiIsReady);
        enableGoogleLoginButton();
    } catch (error) {
        console.error("Erreur lors de l'initialisation du client GAPI:", error);
        // Vous pouvez ajouter une alerte à l'utilisateur ici si vous le souhaitez
    }
}

// Fonction appelée quand la bibliothèque GIS (Google Identity Services) est chargée
// Elle est déclenchée par le script async/defer dans index.html
function gisLoaded() {
    console.log("gsi/client.js script chargé.");
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        // Callback exécuté après que l'utilisateur se soit connecté ou ait donné son consentement
        callback: (tokenResponse) => {
            if (tokenResponse.error) {
                alert('Erreur de connexion Google : ' + tokenResponse.error);
                console.error('Erreur GIS:', tokenResponse.error);
                return;
            }
            // Si la connexion réussit, stocke le token d'accès
            accessToken = tokenResponse.access_token;
            const googleUserSpan = document.getElementById('google-user');
            if (googleUserSpan) {
                googleUserSpan.textContent = "Connecté";
            }
            console.log('Connecté à Google, token d\'accès obtenu.');
        },
    });
    gisIsReady = true;
    console.log('Client de jeton GIS initialisé. gisIsReady =', gisIsReady);
    enableGoogleLoginButton();
}

// Assure que les fonctions sont accessibles globalement par les scripts async (defer)
// C'est essentiel pour que les scripts Google puissent les appeler
window.gapiLoaded = gapiLoaded;
window.gisLoaded = gisLoaded;

// Cet événement est déclenché lorsque le DOM est entièrement chargé
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded déclenché. Initialisation du bouton et des gestionnaires de fichiers.");

    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.disabled = true; // Désactive le bouton initialement
        googleLoginBtn.textContent = 'Chargement Google Connexion...'; // Message d'attente
        googleLoginBtn.onclick = () => {
            // Le clic n'est possible que si le bouton est activé par enableGoogleLoginButton()
            if (tokenClient) {
                tokenClient.requestAccessToken();
            } else {
                alert("La bibliothèque de connexion Google n'est pas encore chargée. Veuillez réessayer dans quelques secondes.");
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
                const reader = new FileReader();
                reader.onload = function(e) {
                    createPreviewBox(file.name, e.target.result, file.type);
                    saved.push({ name: file.name, data: e.target.result, type: file.type });
                    localStorage.setItem('fichiers', JSON.stringify(saved));
                };
                reader.readAsDataURL(file);
            });
        });
    }

    // Chargement initial des fichiers sauvegardés depuis localStorage
    const saved = JSON.parse(localStorage.getItem('fichiers') || '[]');
    saved.forEach(f => createPreviewBox(f.name, f.data, f.type));
});


// Convertit une dataURL en Blob pour l'upload
function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], {type:mime});
}

// Upload un fichier sur Google Drive
async function uploadToDrive(fileName, dataURL, fileType) {
    if (!accessToken) {
        alert("Connectez-vous à Google avant d'envoyer sur Drive.");
        return;
    }
    if (!gapi.client.drive) {
        alert("L'API Google Drive n'est pas encore chargée. Veuillez patienter ou réessayer.");
        return;
    }

    const fileBlob = dataURLtoBlob(dataURL);
    const metadata = {
        name: fileName,
        mimeType: fileType
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
    form.append('file', fileBlob);

    try {
        const res = await gapi.client.request({
            path: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'multipart/related'
            },
            body: form,
        });
        alert('Fichier envoyé sur Google Drive ! ID: ' + res.result.id);
        console.log('Fichier uploadé:', res.result);
    } catch (err) {
        console.error('Erreur lors de l\'envoi sur Drive:', err);
        alert('Erreur lors de l\'envoi sur Drive: ' + (err.result && err.result.error ? err.result.error.message : err.message || "Erreur inconnue."));
    }
}

// Crée la boîte de prévisualisation pour un fichier
function createPreviewBox(fileName, dataURL, fileType) {
    const previewBox = document.createElement('div');
    previewBox.style.border = '2px solid #00ff15';
    previewBox.style.borderRadius = '15px';
    previewBox.style.padding = '10px';
    previewBox.style.background = '#f0f0f0';
    previewBox.style.position = 'relative';
    previewBox.style.width = '150px';
    previewBox.style.textAlign = 'center';

    let content;
    if (fileType.startsWith('image/')) {
        content = document.createElement('img');
        content.src = dataURL;
        content.style.maxWidth = '100%';
        content.style.maxHeight = '100px';
        content.alt = fileName;
    } else {
        content = document.createElement('div');
        content.textContent = fileName;
        content.style.margin = '20px 0';
    }
    previewBox.appendChild(content);

    const downloadBtn = document.createElement('a');
    downloadBtn.textContent = 'Télécharger';
    downloadBtn.href = dataURL;
    downloadBtn.download = fileName;
    downloadBtn.style.position = 'absolute';
    downloadBtn.style.left = '5px';
    downloadBtn.style.top = '5px';
    downloadBtn.style.background = '#00ff15';
    downloadBtn.style.color = '#000';
    downloadBtn.style.border = 'none';
    downloadBtn.style.borderRadius = '10px';
    downloadBtn.style.padding = '5px 10px';
    downloadBtn.style.textDecoration = 'none';
    downloadBtn.style.cursor = 'pointer';
    previewBox.appendChild(downloadBtn);

    const driveBtn = document.createElement('button');
    driveBtn.textContent = 'Enregistrer sur Drive';
    driveBtn.style.position = 'absolute';
    driveBtn.style.top = '35px';
    driveBtn.style.left = '5px';
    driveBtn.style.background = '#4285F4';
    driveBtn.style.color = '#fff';
    driveBtn.style.border = 'none';
    driveBtn.style.borderRadius = '10px';
    driveBtn.style.padding = '5px 10px';
    driveBtn.style.cursor = 'pointer';
    driveBtn.onclick = function() {
        uploadToDrive(fileName, dataURL, fileType);
    };
    previewBox.appendChild(driveBtn);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Supprimer';
    removeBtn.style.position = 'absolute';
    removeBtn.style.top = '90px';
    removeBtn.style.right = '5px';
    removeBtn.style.background = '#ff4d4d';
    removeBtn.style.color = '#fff';
    removeBtn.style.border = 'none';
    removeBtn.style.borderRadius = '10px';
    removeBtn.style.padding = '5px 10px';
    removeBtn.style.cursor = 'pointer';
    removeBtn.onclick = function() {
        previewBox.remove();
        let saved = JSON.parse(localStorage.getItem('fichiers') || '[]');
        saved = saved.filter(f => f.name !== fileName);
        localStorage.setItem('fichiers', JSON.stringify(saved));
    };
    previewBox.appendChild(removeBtn);

    previewContainer.appendChild(previewBox);
}
