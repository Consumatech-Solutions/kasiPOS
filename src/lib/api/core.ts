import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    // Ne pas définir Content-Type pour FormData - Axios le fera automatiquement
    if (config.data instanceof FormData) {
        // Supprimer le Content-Type par défaut pour que Axios puisse définir la boundary
        // Utiliser delete pour supprimer complètement la propriété
        if (config.headers && 'Content-Type' in config.headers) {
            delete config.headers['Content-Type'];
        }
        // FormData détecté - Axios gérera automatiquement le Content-Type avec la boundary
        // Logs supprimés pour éviter la pollution de la console
    }
    return config;
});

// Intercepteur pour gérer les erreurs silencieusement
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Gérer les erreurs réseau (backend non disponible)
        // Ne logger qu'en développement et seulement pour les endpoints catalogue
        if ((error.code === 'ERR_NETWORK' || error.message === 'Network Error') &&
            process.env.NODE_ENV === 'development' &&
            (error?.config?.url?.includes('/categories') || 
             error?.config?.url?.includes('/products'))) {
            // Logger seulement une fois avec un message moins alarmant
            if (!(window as any).__backendNetworkErrorLogged) {
                console.warn('⚠️ Backend not available - running in offline mode. Categories and products will be managed locally.', {
                    backendUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
                });
                (window as any).__backendNetworkErrorLogged = true;
            }
        }
        
        // Ne pas logger les erreurs 404 pour les endpoints catalogue si backend n'est pas disponible
        if (error?.response?.status === 404 && 
            (error?.config?.url?.includes('/categories') || 
             error?.config?.url?.includes('/products'))) {
            // Ces erreurs sont attendues si le backend n'est pas démarré
            // On les laisse passer pour que le code puisse les gérer
        }
        // Gérer les erreurs 401 (Unauthorized) - token manquant ou invalide
        if (error?.response?.status === 401) {
            // L'erreur sera gérée par le code appelant
            // On pourrait aussi rediriger vers la page de login ici si nécessaire
        }
        // Ne pas logger les erreurs 400 pour les uploads de fichiers (erreurs de configuration backend attendues)
        if (error?.response?.status === 400) {
            const isFileUploadError = error?.config?.url?.includes('/files');
            
            // Ne pas logger les erreurs 400 pour les uploads de fichiers
            // Ces erreurs sont attendues jusqu'à ce que le backend soit configuré
            // L'image est sauvegardée localement, donc on ne bloque pas l'utilisateur
            if (isFileUploadError) {
                // Silencieux - rejeter l'erreur sans la logger
                return Promise.reject(error);
            }
            
            // Pour les autres erreurs 400 non liées aux fichiers, logger seulement en développement
            if (process.env.NODE_ENV === 'development') {
                console.warn('Bad Request (400):', {
                    url: error?.config?.url,
                    method: error?.config?.method,
                    responseData: error?.response?.data,
                });
            }
        }
        return Promise.reject(error);
    }
);