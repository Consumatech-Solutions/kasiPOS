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
    return config;
});

// Intercepteur pour gérer les erreurs silencieusement
api.interceptors.response.use(
    (response) => response,
    (error) => {
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
        return Promise.reject(error);
    }
);