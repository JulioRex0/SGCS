// src/app/constants.ts
const currentIP = window.location.hostname;

export const API_CONFIG = {
    BASE_URL: `http://${currentIP}:3000/api`,
    LOGIN: `http://${currentIP}:3000/api/login`,
    SALAS: `http://${currentIP}:3000/api/salas`
};